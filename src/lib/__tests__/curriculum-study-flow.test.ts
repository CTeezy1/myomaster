import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { CURRICULUM_IDS } from "@/src/data/curricula/section-region-orders";
import { myomasterProgramCourse } from "@/src/data/courses/myomaster-program-course";
import { getLibraryRegions } from "@/src/data/library-regions";
import { getMuscleProfilesForRegionId } from "@/src/data/muscle-profiles";
import { CANONICAL_REGIONS } from "@/src/data/regions";
import { computeDashboardStats } from "@/src/hooks/useDashboardStats";
import {
  createPersistedActiveStudySession,
  isResumableActiveStudySession,
  readActiveStudySession,
  writeActiveStudySession,
} from "@/src/lib/active-study-session";
import {
  createDefaultCourseProgress,
  getCourseProgress,
  isCurrentStudyDayCompleted,
  writeCourseProgressStore,
} from "@/src/lib/course-progress";
import {
  MAX_DAILY_GRADED_CARDS,
  MIN_DAILY_GRADED_CARDS,
  planDailyWorkload,
} from "@/src/lib/daily-workload-planning";
import { getBaseDailyNewMuscleAllowance } from "@/src/lib/guided-scheduling";
import {
  getDailyNewMuscleTarget,
  WEEKLY_NEW_MUSCLE_TARGETS,
} from "@/src/lib/introduction-policy";
import { introduceMuscleCards } from "@/src/lib/mastery-engine";
import { createDefaultCardProgress } from "@/src/lib/mastery-progress";
import { getNewMuscleIdsForStudyDay } from "@/src/lib/new-muscle-queue";
import {
  applyCurriculumAssignment,
  createFreshProgressWithPinnedCurriculum,
  resolvePinnedStudyCourse,
} from "@/src/lib/progress/curriculum-assignment";
import {
  applyStudyStateToLocal,
  createDefaultPersistedLearnerProgress,
  ensureDefaultCourseInState,
  readCurriculumAssignment,
} from "@/src/lib/progress/learner-progress-snapshot";
import { parsePersistedLearnerProgress } from "@/src/lib/progress/learner-progress-validation";
import {
  CURRICULUM_ASSIGNMENT_STORAGE_KEY,
  LEARNER_PROGRESS_SCHEMA_VERSION,
} from "@/src/lib/progress/learner-progress.types";
import type { CourseSection } from "@/src/lib/profile.types";
import type { MasteryProgressStore } from "@/src/lib/progress.types";
import { createInitialCardFeedbackState } from "@/src/lib/quiz-card-state";
import { buildCardProgressKey, type CardProgressKey } from "@/src/lib/card-progress-key";
import type { QueuedCard } from "@/src/lib/review-queue";
import {
  applySameSessionGrade,
  createSameSessionRelearnState,
  countPendingRetriesForCard,
} from "@/src/lib/same-session-relearn";
import { isCardDue } from "@/src/lib/scheduling";
import type { CurriculumId } from "@/src/lib/curriculum";
import { getStudyCourseForCurriculum } from "@/src/lib/curriculum";

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

function firstMuscleIdForRegion(
  regionId: (typeof CANONICAL_REGIONS)[number]["id"],
) {
  const profile = getMuscleProfilesForRegionId(regionId)[0];

  if (!profile) {
    throw new Error(`Missing first muscle for region ${regionId}`);
  }

  return profile.id;
}

function emptyStore(): MasteryProgressStore {
  return { version: 1, cards: {} };
}

function pinAndHydrate(curriculumId: CurriculumId) {
  applyStudyStateToLocal(
    createFreshProgressWithPinnedCurriculum(
      createDefaultPersistedLearnerProgress,
      "Testing",
      curriculumId,
    ).state,
  );
}

function assignNewLearner(section: CourseSection) {
  const assigned = applyCurriculumAssignment(
    ensureDefaultCourseInState(createDefaultPersistedLearnerProgress()),
    section,
  );

  expect(assigned.ok).toBe(true);
  if (!assigned.ok) {
    throw new Error("expected curriculum assignment to succeed");
  }

  applyStudyStateToLocal(assigned.progress.state);
  return assigned.progress.curriculumId!;
}

function dayOneIntroductions(course = resolvePinnedStudyCourse()) {
  expect(course).not.toBeNull();
  const progress = getCourseProgress(course!.id);
  const allowance = getDailyNewMuscleTarget(1, 0, 0, null);

  return getNewMuscleIdsForStudyDay(course!, progress, allowance);
}

function makeDueStore(
  muscleIds: string[],
  dueOnStudyDay: number,
): MasteryProgressStore {
  const cards: MasteryProgressStore["cards"] = {};

  for (const muscleId of muscleIds) {
    for (const category of ["origin", "insertion", "action", "innervation"] as const) {
      const key = buildCardProgressKey(muscleId, category);

      if (!key) {
        continue;
      }

      cards[key] = {
        ...createDefaultCardProgress({
          key,
          muscleId,
          category,
        }),
        totalAttempts: 1,
        correctAttempts: 1,
        successfulReviewCount: 1,
        currentIntervalDays: 7,
        nextReviewStudyDay: dueOnStudyDay,
      };
    }
  }

  return { version: 1, cards };
}

function introducedProgress(muscleIds: string[], studyDay: number) {
  return {
    ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
    currentStudyDay: studyDay,
    startedAt: "2026-08-01T12:00:00.000Z",
    introducedMuscleIds: muscleIds,
    introductionStudyDays: Object.fromEntries(
      muscleIds.map((muscleId) => [muscleId, 1]),
    ),
  };
}

function simulateStartStudying() {
  const course = resolvePinnedStudyCourse();

  if (!course) {
    return { kind: "missing" as const };
  }

  const courseProgress = getCourseProgress(course.id);
  const persisted = readActiveStudySession();

  if (isResumableActiveStudySession(persisted, course.id, courseProgress)) {
    return {
      kind: "resume" as const,
      course,
      screen: persisted.screen,
      queue: persisted.session.queue.map((card) => ({ ...card })),
      plannedStaticQueue: persisted.plannedStaticQueue.map((card) => ({
        ...card,
      })),
    };
  }

  const masteryStore = emptyStore();
  const plan = planDailyWorkload(course, courseProgress, masteryStore);
  const newMuscleIds = getNewMuscleIdsForStudyDay(
    course,
    courseProgress,
    plan.newMuscleAllowance,
  );

  return {
    kind: "plan" as const,
    course,
    plan,
    newMuscleIds,
  };
}

beforeEach(() => {
  stubLocalStorage();
});

describe("section-specific first introductions", () => {
  it.each([
    ["Testing", "upper-first-v1", "shoulder"],
    ["Kinesiology 1", "upper-first-v1", "shoulder"],
    ["Kinesiology 2", "axial-then-upper-v1", "cervical"],
    ["Movement Anatomy 1", "lower-first-v1", "ankle-and-foot"],
    ["Movement Anatomy 2", "lower-first-v1", "ankle-and-foot"],
  ] as const)(
    "introduces the first %s learner muscle from %s",
    (section, curriculumId, regionId) => {
      expect(assignNewLearner(section)).toBe(curriculumId);

      const started = simulateStartStudying();
      expect(started.kind).toBe("plan");
      if (started.kind !== "plan") {
        return;
      }

      expect(started.newMuscleIds[0]).toBe(firstMuscleIdForRegion(regionId));
      expect(started.course.id).toBe(DEFAULT_COURSE_ID);
    },
  );

  it("keeps an existing legacy-canonical-v1 learner on the cervical-first roster", () => {
    pinAndHydrate("legacy-canonical-v1");

    expect(dayOneIntroductions()[0]).toBe(firstMuscleIdForRegion("cervical"));
    expect(resolvePinnedStudyCourse()?.muscleProfileIds).toEqual(
      myomasterProgramCourse.muscleProfileIds,
    );
  });
});

describe("pinned curriculum survives later section changes", () => {
  it("keeps upper-first-v1 even if the profile section becomes Kinesiology 2", () => {
    const pinned = applyCurriculumAssignment(
      createDefaultPersistedLearnerProgress({
        curriculumId: "upper-first-v1",
      }),
      "Kinesiology 2",
    );

    expect(pinned.ok).toBe(true);
    if (!pinned.ok) {
      return;
    }

    applyStudyStateToLocal(pinned.progress.state);

    expect(readCurriculumAssignment()).toBe("upper-first-v1");
    expect(dayOneIntroductions()[0]).toBe(firstMuscleIdForRegion("shoulder"));
    expect(dayOneIntroductions()[0]).not.toBe(firstMuscleIdForRegion("cervical"));
  });

  it("keeps lower-first-v1 even if the profile section becomes Testing", () => {
    const pinned = applyCurriculumAssignment(
      createDefaultPersistedLearnerProgress({
        curriculumId: "lower-first-v1",
      }),
      "Testing",
    );

    expect(pinned.ok).toBe(true);
    if (!pinned.ok) {
      return;
    }

    applyStudyStateToLocal(pinned.progress.state);

    expect(readCurriculumAssignment()).toBe("lower-first-v1");
    expect(dayOneIntroductions()[0]).toBe(firstMuscleIdForRegion("ankle-and-foot"));
    expect(dayOneIntroductions()[0]).not.toBe(firstMuscleIdForRegion("shoulder"));
  });
});

describe("reset and resume safety", () => {
  it("preserves the pinned curriculum and restarts Day 1 on that roster", () => {
    applyStudyStateToLocal({
      ...createDefaultPersistedLearnerProgress({
        curriculumId: "upper-first-v1",
      }).state,
      courseProgress: {
        version: 1,
        courses: {
          [DEFAULT_COURSE_ID]: {
            ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
            startedAt: "2026-08-01T12:00:00.000Z",
            currentStudyDay: 12,
            introducedMuscleIds: [firstMuscleIdForRegion("shoulder")],
            completedStudyDays: [1],
          },
        },
      },
    });

    const reset = ensureDefaultCourseInState(
      createFreshProgressWithPinnedCurriculum(
        createDefaultPersistedLearnerProgress,
        "Kinesiology 2",
        readCurriculumAssignment(),
      ),
    );
    applyStudyStateToLocal(reset.state);

    expect(reset.curriculumId).toBe("upper-first-v1");
    expect(readCurriculumAssignment()).toBe("upper-first-v1");
    expect(getCourseProgress(DEFAULT_COURSE_ID).currentStudyDay).toBe(1);
    expect(getCourseProgress(DEFAULT_COURSE_ID).introducedMuscleIds).toEqual([]);
    expect(dayOneIntroductions()[0]).toBe(firstMuscleIdForRegion("shoulder"));
  });

  it("resumes an active study session without rebuilding its queue", () => {
    pinAndHydrate("upper-first-v1");

    const cervicalId = firstMuscleIdForRegion("cervical");
    const existingQueue: QueuedCard[] = [
      {
        muscleId: cervicalId,
        cardKey: `${cervicalId}:action` as CardProgressKey,
        category: "action",
      },
      {
        muscleId: cervicalId,
        cardKey: `${cervicalId}:innervation` as CardProgressKey,
        category: "innervation",
      },
    ];
    let session = createSameSessionRelearnState(existingQueue, {
      enforceDailyCap: true,
    });
    session = applySameSessionGrade(session, existingQueue[0], "incorrect");

    const persisted = createPersistedActiveStudySession({
      courseId: DEFAULT_COURSE_ID,
      studyDay: 1,
      plannedStaticQueue: existingQueue,
      session,
      screen: "study-day",
      currentMuscleIndex: 0,
      cardFeedback: createInitialCardFeedbackState(),
    });

    writeActiveStudySession(persisted);
    writeCourseProgressStore({
      version: 1,
      courses: {
        [DEFAULT_COURSE_ID]: {
          ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
          currentStudyDay: 1,
          startedAt: "2026-08-01T12:00:00.000Z",
        },
      },
    });

    const stored = readActiveStudySession();
    const started = simulateStartStudying();
    const plannedIds = getNewMuscleIdsForStudyDay(
      resolvePinnedStudyCourse()!,
      getCourseProgress(DEFAULT_COURSE_ID),
      getDailyNewMuscleTarget(1, 0, 0, null),
    );

    expect(started.kind).toBe("resume");
    expect(stored).not.toBeNull();
    if (started.kind !== "resume" || !stored) {
      return;
    }

    expect(started.queue).toEqual(stored.session.queue);
    expect(started.plannedStaticQueue).toEqual(stored.plannedStaticQueue);
    expect(started.queue.some((card) => card.isPendingRetry)).toBe(true);
    expect(plannedIds[0]).toBe(firstMuscleIdForRegion("shoulder"));
    expect(started.queue.map((card) => card.muscleId)).not.toContain(plannedIds[0]);
  });

  it("leaves an active session for the dashboard without completing the study day", () => {
    pinAndHydrate("upper-first-v1");

    const cervicalId = firstMuscleIdForRegion("cervical");
    const existingQueue: QueuedCard[] = [
      {
        muscleId: cervicalId,
        cardKey: `${cervicalId}:action` as CardProgressKey,
        category: "action",
      },
      {
        muscleId: cervicalId,
        cardKey: `${cervicalId}:innervation` as CardProgressKey,
        category: "innervation",
      },
    ];
    let session = createSameSessionRelearnState(existingQueue, {
      enforceDailyCap: true,
    });
    session = applySameSessionGrade(session, existingQueue[0], "correct");

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: DEFAULT_COURSE_ID,
        studyDay: 1,
        plannedStaticQueue: existingQueue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );
    writeCourseProgressStore({
      version: 1,
      courses: {
        [DEFAULT_COURSE_ID]: {
          ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
          currentStudyDay: 1,
          startedAt: "2026-08-01T12:00:00.000Z",
        },
      },
    });

    const storedAfterLeave = readActiveStudySession();
    const courseProgressAfterLeave = getCourseProgress(DEFAULT_COURSE_ID);
    const resumed = simulateStartStudying();

    expect(storedAfterLeave).not.toBeNull();
    expect(isCurrentStudyDayCompleted(courseProgressAfterLeave)).toBe(false);
    expect(courseProgressAfterLeave.completedStudyDays).toEqual([]);
    expect(courseProgressAfterLeave.studyDayCompletions).toEqual([]);
    expect(
      isResumableActiveStudySession(
        storedAfterLeave,
        DEFAULT_COURSE_ID,
        courseProgressAfterLeave,
      ),
    ).toBe(true);
    expect(resumed.kind).toBe("resume");
    if (resumed.kind !== "resume" || !storedAfterLeave) {
      return;
    }

    expect(resumed.queue).toEqual(storedAfterLeave.session.queue);
    expect(resumed.plannedStaticQueue).toEqual(storedAfterLeave.plannedStaticQueue);
    expect(resumed.queue.map((card) => card.muscleId)).toEqual([
      cervicalId,
      cervicalId,
    ]);
  });

  it("leaves a Muscle Brief active session without completing the brief or study day", () => {
    pinAndHydrate("upper-first-v1");

    const cervicalId = firstMuscleIdForRegion("cervical");
    const existingQueue: QueuedCard[] = [
      {
        muscleId: cervicalId,
        cardKey: `${cervicalId}:action` as CardProgressKey,
        category: "action",
      },
    ];
    const session = createSameSessionRelearnState(existingQueue, {
      enforceDailyCap: true,
    });

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: DEFAULT_COURSE_ID,
        studyDay: 1,
        plannedStaticQueue: existingQueue,
        session,
        screen: "brief",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );
    writeCourseProgressStore({
      version: 1,
      courses: {
        [DEFAULT_COURSE_ID]: {
          ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
          currentStudyDay: 1,
          startedAt: "2026-08-01T12:00:00.000Z",
        },
      },
    });

    const storedAfterLeave = readActiveStudySession();
    const courseProgressAfterLeave = getCourseProgress(DEFAULT_COURSE_ID);
    const resumed = simulateStartStudying();

    expect(storedAfterLeave).not.toBeNull();
    expect(storedAfterLeave?.screen).toBe("brief");
    expect(isCurrentStudyDayCompleted(courseProgressAfterLeave)).toBe(false);
    expect(courseProgressAfterLeave.studyDayCompletions).toEqual([]);
    expect(
      isResumableActiveStudySession(
        storedAfterLeave,
        DEFAULT_COURSE_ID,
        courseProgressAfterLeave,
      ),
    ).toBe(true);
    expect(resumed.kind).toBe("resume");
    if (resumed.kind !== "resume") {
      return;
    }

    expect(resumed.screen).toBe("brief");
    expect(resumed.queue).toEqual(storedAfterLeave?.session.queue);
  });
});

describe("dashboard and start studying share the pinned course", () => {
  it("calculates dashboard stats from the same learner-specific roster", () => {
    pinAndHydrate("lower-first-v1");

    const dashboardCourse = resolvePinnedStudyCourse();
    const started = simulateStartStudying();

    expect(dashboardCourse).not.toBeNull();
    expect(started.kind).toBe("plan");
    if (!dashboardCourse || started.kind !== "plan") {
      return;
    }

    expect(dashboardCourse.muscleProfileIds).toEqual(started.course.muscleProfileIds);
    expect(dashboardCourse.muscleProfileIds[0]).toBe(
      firstMuscleIdForRegion("ankle-and-foot"),
    );

    const stats = computeDashboardStats(dashboardCourse);
    expect(stats.introducedMuscleCount).toBe(0);
    expect(stats.newMusclePromptCount).toBe(started.plan.newMusclePromptCount);
    expect(stats.dueReviewPromptCount).toBe(started.plan.dueReviewPromptCount);
    expect(stats.plannedPromptCount).toBe(started.plan.plannedPromptCount);
    expect(dashboardCourse.muscleProfileIds.length - stats.introducedMuscleCount).toBe(
      84,
    );
  });
});

describe("curriculum variants keep the same study rules", () => {
  it("keeps all 84 canonical muscles in every pinned study course", () => {
    const liveSet = new Set(myomasterProgramCourse.muscleProfileIds);

    for (const curriculumId of CURRICULUM_IDS) {
      pinAndHydrate(curriculumId);
      const course = resolvePinnedStudyCourse();

      expect(course?.id).toBe(DEFAULT_COURSE_ID);
      expect(course?.muscleProfileIds).toHaveLength(84);
      expect(new Set(course?.muscleProfileIds)).toEqual(liveSet);
    }
  });

  it("keeps daily new-muscle counts on the current schedule", () => {
    const dayOneTarget = getDailyNewMuscleTarget(1, 0, 0, null);
    const emptyMastery = emptyStore();

    expect(WEEKLY_NEW_MUSCLE_TARGETS.reduce((sum, target) => sum + target, 0)).toBe(
      84,
    );

    for (const curriculumId of CURRICULUM_IDS) {
      const course = getStudyCourseForCurriculum(curriculumId);
      const progress = createDefaultCourseProgress(course.id);

      expect(
        getBaseDailyNewMuscleAllowance(progress, course.muscleProfileIds, emptyMastery),
      ).toBe(dayOneTarget);
      expect(getNewMuscleIdsForStudyDay(course, progress, dayOneTarget)).toHaveLength(
        dayOneTarget,
      );
      expect(getDailyNewMuscleTarget(78, 0, 0, null)).toBe(0);
    }
  });

  it("keeps due-review counts identical across roster permutations", () => {
    const muscleIds = [
      firstMuscleIdForRegion("shoulder"),
      firstMuscleIdForRegion("cervical"),
    ];
    const masteryStore = makeDueStore(muscleIds, 8);
    const progress = introducedProgress(muscleIds, 8);

    const counts = CURRICULUM_IDS.map((curriculumId) => {
      const plan = planDailyWorkload(
        getStudyCourseForCurriculum(curriculumId),
        progress,
        masteryStore,
        () => 0.5,
      );

      for (const muscleId of muscleIds) {
        const key = buildCardProgressKey(muscleId, "action");
        expect(key).toBeTruthy();
        expect(isCardDue(masteryStore.cards[key!]!, 8)).toBe(true);
      }

      return plan.dueReviewPromptCount;
    });

    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBe(8);
  });

  it("keeps practice filler filling to the 16-card minimum", () => {
    for (const curriculumId of CURRICULUM_IDS) {
      const course = getStudyCourseForCurriculum(curriculumId);
      const firstIds = course.muscleProfileIds.slice(0, 2);
      let masteryStore = emptyStore();

      for (const muscleId of firstIds) {
        masteryStore = introduceMuscleCards(masteryStore, muscleId);
      }

      const plan = planDailyWorkload(
        course,
        introducedProgress(firstIds, 1),
        masteryStore,
        () => 0.5,
      );

      expect(plan.newMusclePromptCount).toBe(8);
      expect(plan.practicePromptCount).toBe(8);
      expect(plan.plannedPromptCount).toBe(MIN_DAILY_GRADED_CARDS);
      expect(plan.queue.filter((card) => card.isPractice)).toHaveLength(8);
    }
  });

  it("keeps retry-until-correct append behavior", () => {
    const queue: QueuedCard[] = [
      {
        muscleId: firstMuscleIdForRegion("ankle-and-foot"),
        cardKey: `${firstMuscleIdForRegion("ankle-and-foot")}:action` as CardProgressKey,
        category: "action",
      },
      {
        muscleId: firstMuscleIdForRegion("shoulder"),
        cardKey: `${firstMuscleIdForRegion("shoulder")}:action` as CardProgressKey,
        category: "action",
      },
    ];

    let state = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    state = applySameSessionGrade(state, queue[0], "incorrect");

    expect(countPendingRetriesForCard(state.queue, queue[0].cardKey)).toBe(1);
    expect(state.queue.some((card) => card.isPendingRetry)).toBe(true);
    expect(state.unresolvedKeys).toContain(queue[0].cardKey);
  });

  it("keeps the 40-card static cap", () => {
    const muscleIds = myomasterProgramCourse.muscleProfileIds.slice(0, 25);
    const masteryStore = makeDueStore(muscleIds, 20);
    const progress = introducedProgress(muscleIds, 20);

    for (const curriculumId of CURRICULUM_IDS) {
      const plan = planDailyWorkload(
        getStudyCourseForCurriculum(curriculumId),
        progress,
        masteryStore,
        () => 0.5,
      );

      expect(plan.dueReviewPromptCount).toBe(100);
      expect(plan.plannedPromptCount).toBe(MAX_DAILY_GRADED_CARDS);
      expect(plan.queue.length).toBe(MAX_DAILY_GRADED_CARDS);
      expect(plan.queue.every((card) => !card.isPractice)).toBe(true);
    }
  });

  it("still plans continued review after Day 105", () => {
    const muscleIds = myomasterProgramCourse.muscleProfileIds.slice(0, 20);
    const masteryStore = makeDueStore(muscleIds, 106);
    const progress = introducedProgress(muscleIds, 106);

    expect(getDailyNewMuscleTarget(106, 0, 0, null)).toBe(0);

    for (const curriculumId of CURRICULUM_IDS) {
      const course = getStudyCourseForCurriculum(curriculumId);
      const plan = planDailyWorkload(course, progress, masteryStore, () => 0.5);

      expect(plan.newMusclePromptCount).toBe(0);
      expect(plan.newMuscleAllowance).toBe(0);
      expect(plan.dueReviewPromptCount).toBeGreaterThan(0);
      expect(plan.plannedPromptCount).toBeGreaterThan(0);
      expect(plan.plannedPromptCount).toBeLessThanOrEqual(MAX_DAILY_GRADED_CARDS);
    }
  });
});

describe("library and invalid curriculum safety", () => {
  it("does not change Muscle Library region order", () => {
    pinAndHydrate("lower-first-v1");

    expect(getLibraryRegions().map((region) => region.id)).toEqual(
      CANONICAL_REGIONS.map((region) => region.id),
    );
    expect(getLibraryRegions()[0]?.id).toBe("cervical");
    expect(getLibraryRegions().at(-1)?.id).toBe("ankle-and-foot");
  });

  it("does not guess another curriculum from a malformed stored pin", () => {
    window.localStorage.setItem(
      CURRICULUM_ASSIGNMENT_STORAGE_KEY,
      "not-a-curriculum",
    );

    expect(readCurriculumAssignment()).toBeNull();
    expect(resolvePinnedStudyCourse()).toBeNull();
    expect(
      parsePersistedLearnerProgress({
        schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
        savedAt: "2026-08-22T00:00:00.000Z",
        curriculumId: "not-a-curriculum",
        state: createDefaultPersistedLearnerProgress().state,
      }),
    ).toBeNull();
  });
});

describe("study-flow source wiring", () => {
  it("replaces hard-coded live course lookups in dashboard and start studying", () => {
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
    expect(page).not.toContain("profile.section");
    expect(dashboard).not.toContain("profile.section");
    expect(page).not.toContain("onResetLearningProgress");
    expect(page).toContain("onReturnToDashboard={handleReturnToDashboard}");
    expect(page).toMatch(
      /<MuscleBriefScreen[\s\S]*onReturnToDashboard=\{handleReturnToDashboard\}/,
    );
    expect(page).toContain('onOpenMuscleLibrary={() => router.push("/library")}');

    const mixedReviewFinish = page.slice(
      page.indexOf("function handleFinishMixedReview()"),
      page.indexOf("function handleStartStudying()"),
    );
    const returnToDashboard = page.slice(
      page.indexOf("function handleReturnToDashboard()"),
      page.indexOf("function handleAdvanceStudyDay()"),
    );

    expect(mixedReviewFinish).toContain("function handleFinishMixedReview()");
    expect(mixedReviewFinish).not.toContain("markStudyDayCompleted");
    expect(returnToDashboard).toContain("function handleReturnToDashboard()");
    expect(returnToDashboard).not.toContain("markStudyDayCompleted");
  });
});
