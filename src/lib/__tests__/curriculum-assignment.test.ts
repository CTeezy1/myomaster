import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { createDefaultCourseProgress } from "@/src/lib/course-progress";
import { createDefaultCardProgress } from "@/src/lib/mastery-progress";
import {
  applyCurriculumAssignment,
  createFreshProgressWithPinnedCurriculum,
  hasMeaningfulCurriculumProgress,
  LEGACY_CURRICULUM_ID,
  resolveCurriculumAssignment,
} from "@/src/lib/progress/curriculum-assignment";
import {
  applyStudyStateToLocal,
  collectLocalStudyState,
  createDefaultPersistedLearnerProgress,
  ensureDefaultCourseInState,
  readCurriculumAssignment,
} from "@/src/lib/progress/learner-progress-snapshot";
import { parsePersistedLearnerProgress } from "@/src/lib/progress/learner-progress-validation";
import { LEARNER_PROGRESS_SCHEMA_VERSION } from "@/src/lib/progress/learner-progress.types";
import type { PersistedLearnerProgress } from "@/src/lib/progress/learner-progress.types";

function stubLocalStorage() {
  const store: Record<string, string> = {};
  const storage = {
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
    get length() {
      return Object.keys(store).length;
    },
  };

  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
}

function createUnstartedProgress(): PersistedLearnerProgress {
  return ensureDefaultCourseInState(createDefaultPersistedLearnerProgress());
}

function createStartedProgress(): PersistedLearnerProgress {
  const card = createDefaultCardProgress({
    key: "longus-colli:origin",
    muscleId: "longus-colli",
    category: "origin",
  });

  return {
    schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
    savedAt: "2026-08-01T00:00:00.000Z",
    state: {
      courseProgress: {
        version: 1,
        courses: {
          [DEFAULT_COURSE_ID]: {
            ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
            startedAt: "2026-08-01T12:00:00.000Z",
            currentStudyDay: 2,
            introducedMuscleIds: ["longus-colli"],
            introductionDates: {
              "longus-colli": "2026-08-01T12:00:00.000Z",
            },
            introductionStudyDays: {
              "longus-colli": 1,
            },
            recentGrades: ["correct"],
            completedStudyDays: [1],
          },
        },
      },
      masteryProgress: {
        version: 1,
        cards: {
          [card.key]: card,
        },
      },
      activeStudySession: null,
      muscleBriefViewedIds: ["longus-colli"],
    },
  };
}

describe("curriculum assignment", () => {
  it("treats started course activity as meaningful progress", () => {
    expect(hasMeaningfulCurriculumProgress(createStartedProgress().state)).toBe(
      true,
    );
    expect(hasMeaningfulCurriculumProgress(createUnstartedProgress().state)).toBe(
      false,
    );
  });

  it("pins existing started learners without a curriculum to legacy-canonical-v1", () => {
    const assigned = applyCurriculumAssignment(
      createStartedProgress(),
      "Testing",
    );

    expect(assigned.ok).toBe(true);
    if (assigned.ok) {
      expect(assigned.progress.curriculumId).toBe(LEGACY_CURRICULUM_ID);
      expect(assigned.progress.state.curriculumId).toBe(LEGACY_CURRICULUM_ID);
      expect(assigned.source).toBe("legacy");
      expect(assigned.didAssign).toBe(true);
    }
  });

  it.each([
    ["Testing", "upper-first-v1"],
    ["Kinesiology 1", "upper-first-v1"],
    ["Kinesiology 2", "axial-then-upper-v1"],
    ["Movement Anatomy 1", "lower-first-v1"],
    ["Movement Anatomy 2", "lower-first-v1"],
  ] as const)(
    "assigns an unstarted %s learner to %s",
    (section, curriculumId) => {
      const assigned = applyCurriculumAssignment(
        createUnstartedProgress(),
        section,
      );

      expect(assigned.ok).toBe(true);
      if (assigned.ok) {
        expect(assigned.progress.curriculumId).toBe(curriculumId);
        expect(assigned.progress.state.curriculumId).toBe(curriculumId);
        expect(assigned.source).toBe("section");
      }
    },
  );

  it("assigns a new learner from their section", () => {
    const assigned = applyCurriculumAssignment(
      createDefaultPersistedLearnerProgress(),
      "Kinesiology 2",
    );

    expect(assigned.ok).toBe(true);
    if (assigned.ok) {
      expect(assigned.progress.curriculumId).toBe("axial-then-upper-v1");
    }
  });

  it("never overwrites a valid pinned curriculum when the section differs", () => {
    const pinned = createDefaultPersistedLearnerProgress({
      curriculumId: "upper-first-v1",
    });
    const assigned = applyCurriculumAssignment(pinned, "Kinesiology 2");

    expect(assigned.ok).toBe(true);
    if (assigned.ok) {
      expect(assigned.progress.curriculumId).toBe("upper-first-v1");
      expect(assigned.didAssign).toBe(false);
      expect(assigned.source).toBe("pinned");
    }
  });

  it("preserves the pinned curriculum when resetting learning progress", () => {
    const reset = createFreshProgressWithPinnedCurriculum(
      createDefaultPersistedLearnerProgress,
      "Kinesiology 2",
      "upper-first-v1",
    );

    expect(reset.curriculumId).toBe("upper-first-v1");
    expect(reset.state.curriculumId).toBe("upper-first-v1");
    expect(hasMeaningfulCurriculumProgress(reset.state)).toBe(false);
  });

  it("preserves a pinned curriculum during start-fresh recovery", () => {
    const recovered = createFreshProgressWithPinnedCurriculum(
      () => createUnstartedProgress(),
      "Movement Anatomy 1",
      "axial-then-upper-v1",
    );

    expect(recovered.curriculumId).toBe("axial-then-upper-v1");
    expect(recovered.state.courseProgress.courses[DEFAULT_COURSE_ID]).toBeDefined();
  });

  it("falls back to the current section only when no pin exists for start fresh", () => {
    const recovered = createFreshProgressWithPinnedCurriculum(
      createDefaultPersistedLearnerProgress,
      "Movement Anatomy 2",
      null,
    );

    expect(recovered.curriculumId).toBe("lower-first-v1");
  });

  it("does not change existing study, mastery, or session fields when pinning", () => {
    const original = createStartedProgress();
    const assigned = applyCurriculumAssignment(original, "Kinesiology 1");

    expect(assigned.ok).toBe(true);
    if (!assigned.ok) {
      return;
    }

    expect(assigned.progress.state.courseProgress).toEqual(
      original.state.courseProgress,
    );
    expect(assigned.progress.state.masteryProgress).toEqual(
      original.state.masteryProgress,
    );
    expect(assigned.progress.state.activeStudySession).toEqual(
      original.state.activeStudySession,
    );
    expect(assigned.progress.state.muscleBriefViewedIds).toEqual(
      original.state.muscleBriefViewedIds,
    );
  });

  it("rejects invalid curriculum IDs instead of choosing another curriculum", () => {
    const resolved = resolveCurriculumAssignment({
      existingCurriculumId: "upper-first-v2",
      section: "Testing",
      state: createUnstartedProgress().state,
    });

    expect(resolved).toEqual({ ok: false, kind: "invalid_curriculum" });
    expect(
      applyCurriculumAssignment(
        {
          ...createUnstartedProgress(),
          curriculumId: "not-a-curriculum" as "legacy-canonical-v1",
        },
        "Testing",
      ),
    ).toEqual({ ok: false, kind: "invalid_curriculum" });
  });
});

describe("curriculum assignment persistence", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("keeps the pinned curriculum through save, logout-style collect, and hydration", () => {
    const assigned = applyCurriculumAssignment(
      createUnstartedProgress(),
      "Testing",
    );

    expect(assigned.ok).toBe(true);
    if (!assigned.ok) {
      return;
    }

    applyStudyStateToLocal(assigned.progress.state);

    expect(readCurriculumAssignment()).toBe("upper-first-v1");

    const collected = collectLocalStudyState();
    const saved = parsePersistedLearnerProgress({
      schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
      savedAt: "2026-08-22T00:00:00.000Z",
      curriculumId: collected.curriculumId,
      state: collected,
    });

    expect(saved?.curriculumId).toBe("upper-first-v1");

    const rehydrated = applyCurriculumAssignment(saved!, "Kinesiology 2");

    expect(rehydrated.ok).toBe(true);
    if (rehydrated.ok) {
      expect(rehydrated.progress.curriculumId).toBe("upper-first-v1");
      expect(rehydrated.didAssign).toBe(false);
    }
  });

  it("loads legacy persisted progress that omits curriculumId", () => {
    const legacy = parsePersistedLearnerProgress({
      schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
      savedAt: "2026-07-30T00:00:00.000Z",
      state: createStartedProgress().state,
    });

    expect(legacy).not.toBeNull();
    expect(legacy?.curriculumId).toBeUndefined();

    const assigned = applyCurriculumAssignment(legacy!, "Testing");

    expect(assigned.ok).toBe(true);
    if (assigned.ok) {
      expect(assigned.progress.curriculumId).toBe(LEGACY_CURRICULUM_ID);
    }
  });
});

describe("curriculum resolver isolation", () => {
  it("keeps planner internals free of curriculum resolution", () => {
    const files = [
      "src/lib/daily-workload-planning.ts",
      "src/lib/study-day-session.ts",
      "src/lib/new-muscle-queue.ts",
      "src/lib/guided-scheduling.ts",
      "src/lib/course-controller.ts",
    ];

    for (const relativePath of files) {
      const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");
      expect(source).not.toContain("getStudyCourseForCurriculum");
      expect(source).not.toContain("buildMuscleRoster");
      expect(source).not.toContain("applyCurriculumAssignment");
      expect(source).not.toContain("resolvePinnedStudyCourse");
      expect(source).not.toContain("getCurriculumIdForSection");
    }
  });

  it("wires dashboard and start studying to the persisted curriculum pin", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app/(authenticated)/page.tsx"),
      "utf8",
    );
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/hooks/useDashboardStats.ts"),
      "utf8",
    );

    expect(page).toContain("resolvePinnedStudyCourse");
    expect(dashboard).toContain("resolvePinnedStudyCourse");
    expect(page).not.toContain("getCourseById(DEFAULT_COURSE_ID)");
    expect(dashboard).not.toContain("getCourseById(DEFAULT_COURSE_ID)");
    expect(page).not.toContain("getCurriculumIdForSection");
    expect(dashboard).not.toContain("getCurriculumIdForSection");
  });
});
