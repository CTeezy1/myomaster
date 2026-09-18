import { beforeEach, describe, expect, it, vi } from "vitest";
import { cervicalCourse, myomasterProgramCourse } from "@/src/lib/course-controller";
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
import {
  MAX_DAILY_GRADED_CARDS,
  MIN_DAILY_GRADED_CARDS,
  planDailyWorkload,
} from "@/src/lib/daily-workload-planning";
import { canAdvanceStudyDay } from "@/src/lib/guided-scheduling";
import { computeDashboardStats } from "@/src/hooks/useDashboardStats";
import {
  getDailyNewMuscleTarget,
  COURSE_DAYS,
  INTRODUCTION_PERIOD_DAYS,
} from "@/src/lib/introduction-policy";
import { clearAllLearningProgress } from "@/src/lib/learning-progress-reset";
import { createDefaultCardProgress } from "@/src/lib/mastery-progress";
import {
  createPersistedActiveStudySession,
  isResumableActiveStudySession,
  writeActiveStudySession,
} from "@/src/lib/active-study-session";
import { applyGradeToProgress, isCardDue } from "@/src/lib/scheduling";
import {
  EXPECTED_COURSE_STUDY_SESSIONS,
  formatStudyDayStatValue,
  isContinuedReviewStudyDay,
} from "@/src/lib/study-day-display";
import {
  buildStudyDayScheduledQueue,
  isStudyDaySessionComplete,
} from "@/src/lib/study-day-session";
import { createInitialCardFeedbackState } from "@/src/lib/quiz-card-state";
import { buildCardProgressKey } from "@/src/lib/card-progress-key";
import type { CardProgressKey } from "@/src/lib/card-progress-key";
import type { MasteryProgressStore } from "@/src/lib/progress.types";
import {
  applySameSessionGrade,
  advanceSameSessionIndex,
  areAttachmentPairsAdjacent,
  createSameSessionRelearnState,
  DAILY_GRADED_PROMPT_CAP,
} from "@/src/lib/same-session-relearn";
import {
  buildReviewQueue,
  selectReviewUnitsUpToCardLimit,
  type QueuedCard,
  type ReviewUnit,
} from "@/src/lib/review-queue";
import { buildStudyUnitsForMuscle } from "@/src/lib/study-units";

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

function makeFullyDueReviewStore(
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

  return {
    version: 1,
    cards,
  };
}

function buildContinuedReviewProgress(
  studyDay: number,
  muscleIds: string[],
) {
  return {
    ...createDefaultCourseProgress("cervical"),
    currentStudyDay: studyDay,
    startedAt: "2026-01-01T12:00:00.000Z",
    introducedMuscleIds: muscleIds,
    introductionStudyDays: Object.fromEntries(
      muscleIds.map((muscleId) => [muscleId, 1]),
    ),
  };
}

const programMuscleIds = myomasterProgramCourse.muscleProfileIds;

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

  it("keeps the 75-session course expectation separate from the 105-day engine bound", () => {
    expect(EXPECTED_COURSE_STUDY_SESSIONS).toBe(75);
    expect(COURSE_DAYS).toBe(105);
    expect(formatStudyDayStatValue(75, EXPECTED_COURSE_STUDY_SESSIONS)).toEqual({
      primary: "75 of 75",
    });
    expect(formatStudyDayStatValue(76, EXPECTED_COURSE_STUDY_SESSIONS)).toEqual({
      primary: "76",
    });
    expect(formatStudyDayStatValue(105, EXPECTED_COURSE_STUDY_SESSIONS)).toEqual({
      primary: "105",
    });
    expect(formatStudyDayStatValue(106, EXPECTED_COURSE_STUDY_SESSIONS)).toEqual({
      primary: "106",
      secondary: "Continued Review",
    });
    expect(formatStudyDayStatValue(75).primary).toBe("75 of 105");
    expect(isContinuedReviewStudyDay(75)).toBe(false);
    expect(isContinuedReviewStudyDay(76)).toBe(false);
    expect(isContinuedReviewStudyDay(105)).toBe(false);
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

describe("continued review daily static card cap", () => {
  it("creates a 40-card static queue on day 106 when 100 cards are due", () => {
    const muscleIds = programMuscleIds.slice(0, 25);
    const courseProgress = buildContinuedReviewProgress(106, muscleIds);
    const masteryStore = makeFullyDueReviewStore(muscleIds, 106);
    const plan = planDailyWorkload(
      myomasterProgramCourse,
      courseProgress,
      masteryStore,
      () => 0.5,
    );

    expect(plan.dueReviewPromptCount).toBe(100);
    expect(plan.newMusclePromptCount).toBe(0);
    expect(plan.plannedPromptCount).toBe(MAX_DAILY_GRADED_CARDS);
    expect(plan.queue.length).toBe(MAX_DAILY_GRADED_CARDS);
    expect(plan.queue.every((card) => !card.isPractice)).toBe(true);
  });

  it("creates a 40-card static queue on day 120 when 75 cards are due", () => {
    const muscleIds = programMuscleIds.slice(0, 19);
    const masteryStore = makeFullyDueReviewStore(muscleIds, 120);
    masteryStore.cards[`${muscleIds[18]}:innervation` as CardProgressKey] = {
      ...masteryStore.cards[`${muscleIds[18]}:innervation` as CardProgressKey]!,
      nextReviewStudyDay: 200,
    };
    const courseProgress = buildContinuedReviewProgress(120, muscleIds);
    const plan = planDailyWorkload(
      myomasterProgramCourse,
      courseProgress,
      masteryStore,
      () => 0.5,
    );

    expect(plan.dueReviewPromptCount).toBe(75);
    expect(plan.plannedPromptCount).toBe(MAX_DAILY_GRADED_CARDS);
    expect(plan.queue.length).toBe(MAX_DAILY_GRADED_CARDS);
  });

  it("leaves excess due cards due on the next study day", () => {
    const muscleIds = programMuscleIds.slice(0, 25);
    const masteryStore = makeFullyDueReviewStore(muscleIds, 106);
    const courseProgress = buildContinuedReviewProgress(106, muscleIds);
    const day106Plan = planDailyWorkload(
      myomasterProgramCourse,
      courseProgress,
      masteryStore,
      () => 0.5,
    );
    const selectedKeys = new Set(day106Plan.queue.map((card) => card.cardKey));
    const unselectedKey = programMuscleIds
      .flatMap((muscleId) =>
        (["origin", "insertion", "action", "innervation"] as const).map(
          (category) => buildCardProgressKey(muscleId, category),
        ),
      )
      .find((key): key is CardProgressKey => Boolean(key && !selectedKeys.has(key)));

    expect(unselectedKey).toBeDefined();

    const day107Plan = planDailyWorkload(
      myomasterProgramCourse,
      buildContinuedReviewProgress(107, muscleIds),
      masteryStore,
      () => 0.5,
    );

    expect(day107Plan.dueReviewPromptCount).toBe(100);
    expect(
      buildReviewQueue(
        muscleIds.flatMap((muscleId) => buildStudyUnitsForMuscle(muscleId)),
        masteryStore,
        107,
      ).some((card) => card.cardKey === unselectedKey),
    ).toBe(true);
    expect(isCardDue(masteryStore.cards[unselectedKey!]!, 107)).toBe(true);
  });

  it("does not mark unselected due cards reviewed or rescheduled during planning", () => {
    const muscleIds = programMuscleIds.slice(0, 25);
    const masteryStore = makeFullyDueReviewStore(muscleIds, 106);
    const beforePlanning = structuredClone(masteryStore);
    const courseProgress = buildContinuedReviewProgress(106, muscleIds);
    const plan = planDailyWorkload(
      myomasterProgramCourse,
      courseProgress,
      masteryStore,
      () => 0.5,
    );
    const selectedKeys = new Set(plan.queue.map((card) => card.cardKey));
    const unselectedKeys = Object.keys(masteryStore.cards).filter(
      (key) => !selectedKeys.has(key as CardProgressKey),
    ) as CardProgressKey[];

    expect(unselectedKeys.length).toBeGreaterThan(0);

    for (const key of unselectedKeys) {
      expect(masteryStore.cards[key]).toEqual(beforePlanning.cards[key]);
    }
  });

  it("preserves attachment pairs when the 40-card selection boundary is reached", () => {
    const muscleIds = programMuscleIds.slice(0, 25);
    const courseProgress = buildContinuedReviewProgress(106, muscleIds);
    const masteryStore = makeFullyDueReviewStore(muscleIds, 106);
    const plan = planDailyWorkload(
      myomasterProgramCourse,
      courseProgress,
      masteryStore,
      () => 0.5,
    );

    expect(areAttachmentPairsAdjacent(plan.queue)).toBe(true);

    const singleUnits: ReviewUnit[] = Array.from({ length: 39 }, (_, index) => ({
      kind: "single",
      cards: [
        {
          muscleId: `muscle-${index}`,
          cardKey: `muscle-${index}:action` as CardProgressKey,
          category: "action" as const,
        },
      ],
    }));
    const trailingPair: ReviewUnit = {
      kind: "attachmentPair",
      cards: [
        {
          muscleId: "paired-muscle",
          cardKey: "paired-muscle:origin" as CardProgressKey,
          category: "origin",
          attachmentPairId: "paired-muscle:attachment-pair",
        },
        {
          muscleId: "paired-muscle",
          cardKey: "paired-muscle:insertion" as CardProgressKey,
          category: "insertion",
          attachmentPairId: "paired-muscle:attachment-pair",
        },
      ],
    };

    expect(selectReviewUnitsUpToCardLimit(singleUnits, 39)).toHaveLength(39);
    expect(
      selectReviewUnitsUpToCardLimit([...singleUnits, trailingPair], 39),
    ).toHaveLength(39);
    expect(
      selectReviewUnitsUpToCardLimit([...singleUnits, trailingPair], 39).some(
        (card) => card.attachmentPairId === "paired-muscle:attachment-pair",
      ),
    ).toBe(false);
  });

  it("allows retries to extend the total session beyond 40", () => {
    const muscleIds = programMuscleIds.slice(0, 25);
    const courseProgress = buildContinuedReviewProgress(106, muscleIds);
    const masteryStore = makeFullyDueReviewStore(muscleIds, 106);
    const plan = planDailyWorkload(
      myomasterProgramCourse,
      courseProgress,
      masteryStore,
      () => 0.5,
    );
    const lastStaticCard = plan.queue[plan.queue.length - 1];

    let state = createSameSessionRelearnState(plan.queue, { enforceDailyCap: true });

    while (
      state.index < state.queue.length &&
      state.queue[state.index]?.cardKey !== lastStaticCard.cardKey
    ) {
      state = applySameSessionGrade(state, state.queue[state.index], "correct");
      state = advanceSameSessionIndex(state);
    }

    state = applySameSessionGrade(state, state.queue[state.index], "incorrect");

    expect(state.staticGradedCount).toBe(DAILY_GRADED_PROMPT_CAP);
    expect(state.dailyCapReached).toBe(true);
    expect(state.queue.length).toBeGreaterThan(DAILY_GRADED_PROMPT_CAP);

    state = advanceSameSessionIndex(state);
    state = applySameSessionGrade(state, state.queue[state.index], "correct");

    expect(state.gradedPromptCount).toBeGreaterThan(DAILY_GRADED_PROMPT_CAP);
    expect(isStudyDaySessionComplete(state)).toBe(true);
  });

  it("adds practice filler on day 106 when fewer than 16 cards are due", () => {
    const dueMuscleIds = programMuscleIds.slice(0, 2);
    const introducedMuscleIds = programMuscleIds.slice(0, 8);
    const courseProgress = buildContinuedReviewProgress(106, introducedMuscleIds);
    const masteryStore = makeIntroducedReviewStore(introducedMuscleIds, 1);

    for (const muscleId of introducedMuscleIds) {
      for (const category of ["origin", "insertion", "action", "innervation"] as const) {
        const key = buildCardProgressKey(muscleId, category);

        if (!key || !masteryStore.cards[key]) {
          continue;
        }

        masteryStore.cards[key] = {
          ...masteryStore.cards[key]!,
          nextReviewStudyDay: dueMuscleIds.includes(muscleId) ? 106 : 200,
        };
      }
    }

    const plan = planDailyWorkload(
      myomasterProgramCourse,
      courseProgress,
      masteryStore,
      () => 0.5,
    );

    expect(plan.dueReviewPromptCount).toBe(8);
    expect(plan.plannedPromptCount).toBe(MIN_DAILY_GRADED_CARDS);
    expect(plan.practicePromptCount).toBe(8);
    expect(plan.queue.filter((card) => card.isPractice)).toHaveLength(8);
  });

  it("does not add practice filler on day 106 when 16 to 40 cards are due", () => {
    const muscleIds = programMuscleIds.slice(0, 5);
    const courseProgress = buildContinuedReviewProgress(106, muscleIds);
    const masteryStore = makeFullyDueReviewStore(muscleIds, 106);
    const plan = planDailyWorkload(
      myomasterProgramCourse,
      courseProgress,
      masteryStore,
      () => 0.5,
    );

    expect(plan.dueReviewPromptCount).toBe(20);
    expect(plan.plannedPromptCount).toBe(20);
    expect(plan.practicePromptCount).toBe(0);
    expect(plan.queue.every((card) => !card.isPractice)).toBe(true);
  });

  it("never introduces a new muscle on day 106+", () => {
    const muscleIds = programMuscleIds.slice(0, 25);
    const introducedIds = muscleIds.slice(0, 20);
    const courseProgress = {
      ...buildContinuedReviewProgress(106, introducedIds),
      introducedMuscleIds: introducedIds,
    };
    const masteryStore = makeFullyDueReviewStore(introducedIds, 106);
    const plan = planDailyWorkload(
      myomasterProgramCourse,
      courseProgress,
      masteryStore,
      () => 0.5,
    );

    expect(plan.newMusclePromptCount).toBe(0);
    expect(plan.newMuscleAllowance).toBe(0);
    expect(
      plan.queue.every((card) => introducedIds.includes(card.muscleId)),
    ).toBe(true);
  });

  it("keeps the days 1-105 static cap behavior unchanged", () => {
    const muscleIds = programMuscleIds.slice(0, 25);
    const masteryStore = makeFullyDueReviewStore(muscleIds, 30);
    const courseProgress = {
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 30,
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: muscleIds,
      introductionStudyDays: Object.fromEntries(
        muscleIds.map((muscleId) => [muscleId, 1]),
      ),
    };
    const plan = planDailyWorkload(
      myomasterProgramCourse,
      courseProgress,
      masteryStore,
      () => 0.5,
    );

    expect(plan.dueReviewPromptCount).toBe(100);
    expect(plan.plannedPromptCount).toBe(MAX_DAILY_GRADED_CARDS);
    expect(plan.queue.length).toBe(MAX_DAILY_GRADED_CARDS);
  });
});
