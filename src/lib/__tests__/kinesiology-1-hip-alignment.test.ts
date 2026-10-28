import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { createPersistedActiveStudySession } from "@/src/lib/active-study-session";
import { buildCardProgressKey } from "@/src/lib/card-progress-key";
import {
  createDefaultCourseProgress,
  getCourseProgress,
  markMuscleIntroduced,
  writeCourseProgressStore,
} from "@/src/lib/course-progress";
import { getStudyCourseForCurriculum } from "@/src/lib/curriculum";
import { getDueReviewPromptCount } from "@/src/lib/dashboard-progress";
import {
  countMasteryAttempts,
  KINESIOLOGY_1_HIP_ALIGNMENT_REASON,
  KINESIOLOGY_1_HIP_START_DAY,
  KINESIOLOGY_1_SECTION,
  hasReachedHipSection,
  planKinesiology1HipAlignment,
  planKinesiology1HipRollback,
  predictKinesiology1NextSession,
} from "@/src/lib/kinesiology-1-hip-alignment";
import { getNewMuscleIdsForStudyDay } from "@/src/lib/new-muscle-queue";
import { getWeeklyParticipation } from "@/src/lib/participation";
import { parsePersistedLearnerProgress } from "@/src/lib/progress/learner-progress-validation";
import { LEARNER_PROGRESS_SCHEMA_VERSION } from "@/src/lib/progress/learner-progress.types";
import { createDefaultPersistedLearnerProgress } from "@/src/lib/progress/learner-progress-snapshot";
import { createDefaultCardProgress } from "@/src/lib/mastery-progress";
import { createInitialCardFeedbackState } from "@/src/lib/quiz-card-state";
import { createSameSessionRelearnState } from "@/src/lib/same-session-relearn";
import type { PersistedLearnerProgress } from "@/src/lib/progress/learner-progress.types";
import type { CourseProgress, MasteryProgressStore } from "@/src/lib/progress.types";

const course = getStudyCourseForCurriculum("upper-first-v1");

function stubLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
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
      for (const key of Object.keys(store)) delete store[key];
    },
  });
  vi.stubGlobal("window", { localStorage: globalThis.localStorage });
}

function envelope(
  courseProgress: CourseProgress,
  options?: {
    mastery?: MasteryProgressStore;
    activeSession?: boolean;
  },
): PersistedLearnerProgress {
  const base = createDefaultPersistedLearnerProgress({
    curriculumId: "upper-first-v1",
  });

  return {
    ...base,
    state: {
      ...base.state,
      curriculumId: "upper-first-v1",
      activeStudySession: options?.activeSession
        ? createPersistedActiveStudySession({
            courseId: DEFAULT_COURSE_ID,
            studyDay: courseProgress.currentStudyDay,
            plannedStaticQueue: [],
            session: createSameSessionRelearnState([]),
            screen: "study-day",
            currentMuscleIndex: 0,
            cardFeedback: createInitialCardFeedbackState(),
          })
        : null,
      masteryProgress: options?.mastery ?? { version: 1, cards: {} },
      courseProgress: {
        version: 1,
        courses: {
          [DEFAULT_COURSE_ID]: courseProgress,
        },
      },
    },
  };
}

function progressAtDay(day: number, introducedCount: number): CourseProgress {
  return {
    ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
    currentStudyDay: day,
    introducedMuscleIds: course.muscleProfileIds.slice(0, introducedCount),
    completedStudyDays: Array.from({ length: Math.max(0, day - 1) }, (_, index) => index + 1),
    studyDayCompletions: Array.from({ length: Math.max(0, day - 1) }, (_, index) => ({
      studyDay: index + 1,
      completedAt: "2026-10-01T12:00:00.000Z",
    })),
  };
}

function masteryDueOn(day: number, muscleIds: string[]): MasteryProgressStore {
  const cards: MasteryProgressStore["cards"] = {};

  for (const muscleId of muscleIds) {
    for (const category of ["origin", "insertion", "action", "innervation"] as const) {
      const key = buildCardProgressKey(muscleId, category)!;
      cards[key] = {
        ...createDefaultCardProgress({ key, muscleId, category }),
        state: "learning",
        totalAttempts: 1,
        correctAttempts: 1,
        successfulReviewCount: 1,
        currentIntervalDays: 3,
        nextReviewStudyDay: day,
      };
    }
  }

  return { version: 1, cards };
}

describe("Kinesiology 1 hip alignment planner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("advances a Day 1 student to Day 20, defers pre-hip muscles, and predicts hip next", () => {
    const plan = planKinesiology1HipAlignment(
      envelope(progressAtDay(1, 3)),
      new Date("2026-10-27T12:00:00.000Z"),
    );
    const updated = plan.progress.state.courseProgress.courses[DEFAULT_COURSE_ID]!;

    expect(plan.action).toBe("adjust");
    expect(plan.originalStudyDay).toBe(1);
    expect(plan.proposedStudyDay).toBe(20);
    expect(updated.completedStudyDays).toEqual([]);
    expect(updated.studyDayCompletions).toEqual([]);
    expect(updated.curriculumAlignmentAudit).toMatchObject({
      originalStudyDay: 1,
      adjustedStudyDay: 20,
      section: KINESIOLOGY_1_SECTION,
      reason: KINESIOLOGY_1_HIP_ALIGNMENT_REASON,
    });
    expect(getNewMuscleIdsForStudyDay(course, updated, 1)).toEqual([
      "gluteus-maximus",
    ]);
  });

  it("advances a Day 5 student and preserves relative overdue status", () => {
    const muscleIds = course.muscleProfileIds.slice(0, 11);
    const mastery = masteryDueOn(6, muscleIds);
    const plan = planKinesiology1HipAlignment(
      envelope(progressAtDay(5, 11), { mastery }),
    );
    const updated = plan.progress.state.courseProgress.courses[DEFAULT_COURSE_ID]!;

    expect(plan.proposedStudyDay).toBe(20);
    expect(plan.reviewDayDelta).toBe(15);
    expect(
      getDueReviewPromptCount(course.muscleProfileIds, mastery, 5),
    ).toBe(
      getDueReviewPromptCount(
        course.muscleProfileIds,
        plan.progress.state.masteryProgress,
        20,
      ),
    );
    expect(getNewMuscleIdsForStudyDay(course, updated, 1)[0]).toBe(
      "gluteus-maximus",
    );
  });

  it("advances a Day 19 student who already finished pre-hip introductions", () => {
    const plan = planKinesiology1HipAlignment(envelope(progressAtDay(19, 38)));
    const updated = plan.progress.state.courseProgress.courses[DEFAULT_COURSE_ID]!;

    expect(plan.proposedStudyDay).toBe(KINESIOLOGY_1_HIP_START_DAY);
    expect(plan.deferredMuscleIds).toEqual([]);
    expect(getNewMuscleIdsForStudyDay(course, updated, 1)).toEqual([
      "gluteus-maximus",
    ]);
  });

  it("leaves a Day 20 student already in hip unchanged", () => {
    const current = {
      ...progressAtDay(20, 39),
      introducedMuscleIds: [
        ...course.muscleProfileIds.slice(0, 38),
        "gluteus-maximus",
      ],
    };
    const source = envelope(current);
    const plan = planKinesiology1HipAlignment(source);

    expect(hasReachedHipSection(current)).toBe(true);
    expect(plan.action).toBe("unchanged");
    expect(plan.progress).toBe(source);
  });

  it("leaves Day 24 hip students unchanged", () => {
    const current = {
      ...progressAtDay(24, 46),
      introducedMuscleIds: [
        ...course.muscleProfileIds.slice(0, 38),
        ...course.muscleProfileIds.slice(38, 46),
      ],
    };
    const source = envelope(current);
    const plan = planKinesiology1HipAlignment(source);

    expect(plan.action).toBe("unchanged");
    expect(plan.progress).toBe(source);
  });

  it("keeps a Day 25 student on Day 25 and only defers leftover hand muscles", () => {
    const plan = planKinesiology1HipAlignment(envelope(progressAtDay(25, 36)));
    const updated = plan.progress.state.courseProgress.courses[DEFAULT_COURSE_ID]!;

    expect(plan.originalStudyDay).toBe(25);
    expect(plan.proposedStudyDay).toBe(25);
    expect(plan.reviewDayDelta).toBe(0);
    expect(updated.deferredMuscleIds).toEqual([
      "opponens-pollicis",
      "lumbricals",
    ]);
    expect(updated.completedStudyDays).toHaveLength(24);
    expect(getNewMuscleIdsForStudyDay(course, updated, 3)).toEqual([
      "gluteus-maximus",
      "gluteus-medius",
      "gluteus-minimus",
    ]);
  });

  it("clears an active session without writing participation events", () => {
    const plan = planKinesiology1HipAlignment(
      envelope(progressAtDay(2, 5), { activeSession: true }),
    );

    expect(plan.clearActiveSession).toBe(true);
    expect(plan.progress.state.activeStudySession).toBeNull();
    expect(
      plan.progress.state.courseProgress.courses[DEFAULT_COURSE_ID]
        ?.studyDayCompletions,
    ).toHaveLength(1);
  });

  it("persists deferredMuscleIds through course-progress parsing", () => {
    stubLocalStorage();
    writeCourseProgressStore({
      version: 1,
      courses: {
        [DEFAULT_COURSE_ID]: {
          ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
          deferredMuscleIds: ["deltoid", "lumbricals"],
        },
      },
    });

    expect(getCourseProgress(DEFAULT_COURSE_ID).deferredMuscleIds).toEqual([
      "deltoid",
      "lumbricals",
    ]);
  });

  it("does not treat the alignment audit as a study-day completion", () => {
    const plan = planKinesiology1HipAlignment(envelope(progressAtDay(5, 11)));
    const updated = plan.progress.state.courseProgress.courses[DEFAULT_COURSE_ID]!;

    expect(updated.curriculumAlignmentAudit?.reason).toContain(
      "not a completed study day",
    );
    expect(updated.completedStudyDays).not.toContain(20);
    expect(
      updated.studyDayCompletions?.some((event) => event.studyDay === 20),
    ).toBe(false);
  });

  it("preserves participation, mastery attempts, and introduced muscles", () => {
    const current = progressAtDay(5, 11);
    const mastery = masteryDueOn(3, course.muscleProfileIds.slice(0, 11));
    const source = envelope(current, { mastery });
    const plan = planKinesiology1HipAlignment(source);
    const updated = plan.progress.state.courseProgress.courses[DEFAULT_COURSE_ID]!;

    expect(updated.introducedMuscleIds).toEqual(current.introducedMuscleIds);
    expect(updated.recentGrades).toEqual(current.recentGrades);
    expect(updated.studyDayCompletions).toEqual(current.studyDayCompletions);
    expect(getWeeklyParticipation(updated.studyDayCompletions, 0)).toEqual(
      getWeeklyParticipation(current.studyDayCompletions, 0),
    );
    expect(countMasteryAttempts(plan.progress.state.masteryProgress)).toBe(
      countMasteryAttempts(mastery),
    );
  });

  it("predicts hip as the next new-muscle session after adjustment", () => {
    const plan = planKinesiology1HipAlignment(envelope(progressAtDay(5, 11)));
    const predicted = predictKinesiology1NextSession(plan.progress);

    expect(predicted?.studyDay).toBe(20);
    expect(predicted?.overdueBlocksNewMuscles).toBe(false);
    expect(predicted?.newMuscleIds[0]).toBe("gluteus-maximus");
  });

  it("removes a deferred muscle once it is actually introduced", () => {
    stubLocalStorage();
    writeCourseProgressStore({
      version: 1,
      courses: {
        [DEFAULT_COURSE_ID]: {
          ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
          deferredMuscleIds: ["lumbricals", "deltoid"],
        },
      },
    });

    const updated = markMuscleIntroduced(
      DEFAULT_COURSE_ID,
      "lumbricals",
      new Date("2026-10-27T12:00:00.000Z"),
    );

    expect(updated.deferredMuscleIds).toEqual(["deltoid"]);
    expect(updated.introducedMuscleIds).toContain("lumbricals");
  });

  it("writes planned progress that still parses as learner progress", () => {
    const plan = planKinesiology1HipAlignment(
      envelope(progressAtDay(1, 3)),
      new Date("2026-10-27T12:00:00.000Z"),
    );

    expect(parsePersistedLearnerProgress(plan.progress)).not.toBeNull();
  });

  it("restores only when the current row still matches the applied snapshot", () => {
    const original = envelope(progressAtDay(5, 11));
    const applied = planKinesiology1HipAlignment(original).progress;
    const later = {
      ...applied,
      savedAt: "2026-10-28T12:00:00.000Z",
    };

    expect(
      planKinesiology1HipRollback({
        originalProgress: original,
        originalRevision: 4,
        appliedRevision: 5,
        appliedProgress: applied,
        currentProgress: applied,
        currentRevision: 5,
      }),
    ).toMatchObject({
      action: "restore",
      expectedRevision: 5,
    });
    expect(
      planKinesiology1HipRollback({
        originalProgress: original,
        originalRevision: 4,
        appliedRevision: 5,
        appliedProgress: applied,
        currentProgress: later,
        currentRevision: 6,
      }),
    ).toEqual({
      action: "skip",
      reason: "student-activity-after-update",
    });
  });
});

describe("learner progress schema still accepts records without defer fields", () => {
  it("keeps schemaVersion 1 envelopes valid", () => {
    expect(LEARNER_PROGRESS_SCHEMA_VERSION).toBe(1);
    const parsed = envelope(createDefaultCourseProgress(DEFAULT_COURSE_ID));
    expect(parsed.state.courseProgress.courses[DEFAULT_COURSE_ID]?.deferredMuscleIds).toBeUndefined();
  });
});
