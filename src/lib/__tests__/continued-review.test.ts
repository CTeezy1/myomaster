import { beforeEach, describe, expect, it, vi } from "vitest";
import { cervicalCourse } from "@/src/lib/course-controller";
import {
  advanceStudyDay,
  clearCourseProgress,
  createDefaultCourseProgress,
  getCourseProgress,
  getCurrentStudyDay,
  isCurrentStudyDayCompleted,
  markStudyDayCompleted,
  writeCourseProgressStore,
} from "@/src/lib/course-progress";
import { planDailyWorkload, MIN_DAILY_GRADED_CARDS } from "@/src/lib/daily-workload-planning";
import { canAdvanceStudyDay } from "@/src/lib/guided-scheduling";
import { computeDashboardStats } from "@/src/hooks/useDashboardStats";
import {
  getDailyNewMuscleTarget,
  INTRODUCTION_PERIOD_DAYS,
} from "@/src/lib/introduction-policy";
import { clearAllLearningProgress } from "@/src/lib/learning-progress-reset";
import { createDefaultCardProgress } from "@/src/lib/mastery-progress";
import {
  createPersistedActiveStudySession,
  isResumableActiveStudySession,
  writeActiveStudySession,
} from "@/src/lib/active-study-session";
import { applyGradeToProgress } from "@/src/lib/scheduling";
import {
  formatStudyDayStatValue,
  isContinuedReviewStudyDay,
} from "@/src/lib/study-day-display";
import { buildStudyDayScheduledQueue } from "@/src/lib/study-day-session";
import { createInitialCardFeedbackState } from "@/src/lib/quiz-card-state";
import { buildCardProgressKey } from "@/src/lib/card-progress-key";
import type { CardProgressKey } from "@/src/lib/card-progress-key";
import type { MasteryProgressStore } from "@/src/lib/progress.types";
import { createSameSessionRelearnState } from "@/src/lib/same-session-relearn";
import type { QueuedCard } from "@/src/lib/review-queue";

const emptyStore = (): MasteryProgressStore => ({
  version: 1,
  cards: {},
});

function makeIntroducedReviewStore(
  muscleIds: string[],
  introductionStudyDay = 1,
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
        nextReviewStudyDay: introductionStudyDay + 7,
      };
    }
  }

  return {
    version: 1,
    cards,
  };
}

beforeEach(() => {
  const storage = new Map<string, string>();

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });

  clearCourseProgress();
});

describe("continued review beyond study day 105", () => {
  it("advances from day 105 to day 106 when the current day is complete", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          currentStudyDay: 105,
          completedStudyDays: [105],
        },
      },
    });

    const advanced = advanceStudyDay("cervical");

    expect(advanced.currentStudyDay).toBe(106);
  });

  it("advances from day 106 to day 107 when the current day is complete", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          currentStudyDay: 106,
          completedStudyDays: [106],
        },
      },
    });

    const advanced = advanceStudyDay("cervical");

    expect(advanced.currentStudyDay).toBe(107);
  });

  it("accepts currentStudyDay values above 105", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          currentStudyDay: 150,
        },
      },
    });

    expect(getCurrentStudyDay(getCourseProgress("cervical"))).toBe(150);
  });

  it("reloads persisted day 120 without clamping to 105", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          currentStudyDay: 120,
          completedStudyDays: [119],
        },
      },
    });

    expect(getCourseProgress("cervical").currentStudyDay).toBe(120);
  });

  it("does not introduce new muscles after day 77", () => {
    expect(getDailyNewMuscleTarget(INTRODUCTION_PERIOD_DAYS + 1, 0, 0, null)).toBe(0);
    expect(getDailyNewMuscleTarget(106, 0, 0, null)).toBe(0);
    expect(getDailyNewMuscleTarget(120, 0, 0, null)).toBe(0);
  });

  it("builds a review/practice queue on day 106", () => {
    const muscleIds = cervicalCourse.muscleProfileIds.slice(0, 8);
    const courseProgress = {
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 106,
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: muscleIds,
      introductionStudyDays: Object.fromEntries(
        muscleIds.map((muscleId) => [muscleId, 1]),
      ),
    };
    const masteryStore = makeIntroducedReviewStore(muscleIds, 1);
    const plan = planDailyWorkload(cervicalCourse, courseProgress, masteryStore);

    expect(plan.newMusclePromptCount).toBe(0);
    expect(plan.plannedPromptCount).toBeGreaterThanOrEqual(MIN_DAILY_GRADED_CARDS);
    expect(
      buildStudyDayScheduledQueue(cervicalCourse, courseProgress, masteryStore).length,
    ).toBeGreaterThan(0);
  });

  it("schedules mastery reviews beyond day 105 using study-day intervals", () => {
    const progress = createDefaultCardProgress({
      key: "longus-colli:action",
      muscleId: "longus-colli",
      category: "action",
    });
    const updated = applyGradeToProgress(
      progress,
      "correct",
      new Date("2026-01-01T12:00:00.000Z"),
      106,
    );

    expect(updated.nextReviewStudyDay).toBe(107);

    const mastered = {
      ...progress,
      successfulReviewCount: 4,
      currentIntervalDays: 14,
    };
    const scheduled = applyGradeToProgress(
      mastered,
      "correct",
      new Date("2026-01-01T12:00:00.000Z"),
      106,
    );

    expect(scheduled.nextReviewStudyDay).toBe(136);

    const longInterval = applyGradeToProgress(
      {
        ...progress,
        successfulReviewCount: 5,
        currentIntervalDays: 30,
      },
      "correct",
      new Date("2026-01-01T12:00:00.000Z"),
      120,
    );

    expect(longInterval.nextReviewStudyDay).toBe(180);
  });

  it("shows Study Day X of 105 through day 105", () => {
    expect(formatStudyDayStatValue(1).primary).toBe("1 of 105");
    expect(formatStudyDayStatValue(105).primary).toBe("105 of 105");
    expect(formatStudyDayStatValue(105).secondary).toBeUndefined();
    expect(isContinuedReviewStudyDay(105)).toBe(false);
  });

  it("shows continued review labeling after day 105", () => {
    expect(formatStudyDayStatValue(106)).toEqual({
      primary: "106",
      secondary: "Continued Review",
    });
    expect(isContinuedReviewStudyDay(106)).toBe(true);
  });

  it("keeps completed-day locking after day 105", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          currentStudyDay: 106,
          startedAt: "2026-01-01T12:00:00.000Z",
        },
      },
    });

    expect(isCurrentStudyDayCompleted(getCourseProgress("cervical"))).toBe(false);
    expect(
      canAdvanceStudyDay(
        getCourseProgress("cervical"),
        cervicalCourse.muscleProfileIds,
        emptyStore(),
      ),
    ).toBe(false);

    markStudyDayCompleted("cervical");

    expect(isCurrentStudyDayCompleted(getCourseProgress("cervical"))).toBe(true);
    expect(computeDashboardStats(cervicalCourse).canStartGuidedStudy).toBe(false);
    expect(
      canAdvanceStudyDay(
        getCourseProgress("cervical"),
        cervicalCourse.muscleProfileIds,
        emptyStore(),
      ),
    ).toBe(true);
  });

  it("resumes an active session after day 105", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          currentStudyDay: 106,
          startedAt: "2026-01-01T12:00:00.000Z",
        },
      },
    });

    const queue: QueuedCard[] = [
      {
        muscleId: "longus-colli",
        cardKey: "longus-colli:action" as CardProgressKey,
        category: "action",
      },
    ];
    const session = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    const persisted = createPersistedActiveStudySession({
      courseId: "cervical",
      studyDay: 106,
      plannedStaticQueue: queue,
      session,
      screen: "study-day",
      currentMuscleIndex: 0,
      cardFeedback: createInitialCardFeedbackState(),
    });

    writeActiveStudySession(persisted);

    expect(
      isResumableActiveStudySession(
        persisted,
        "cervical",
        getCourseProgress("cervical"),
      ),
    ).toBe(true);
    expect(computeDashboardStats(cervicalCourse).hasResumableStudySession).toBe(true);
  });

  it("returns reset learners to day 1", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          currentStudyDay: 120,
          completedStudyDays: [119, 120],
        },
      },
    });

    clearAllLearningProgress();

    expect(getCourseProgress("cervical").currentStudyDay).toBe(1);
    expect(getCourseProgress("cervical").completedStudyDays).toEqual([]);
  });
});
