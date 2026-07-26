import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCardProgressKey,
  resolveCardProgressKey,
  type CardProgressKey,
} from "@/src/lib/card-progress-key";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { cards } from "@/src/data/cards";
import { allCourses } from "@/src/data/courses";
import { allMuscleProfiles } from "@/src/data/muscle-profiles";
import { myomasterProgramCourse } from "@/src/data/courses/myomaster-program-course";
import { cervicalCourse, getCourseById, getProfileForStudyCard } from "@/src/lib/course-controller";
import {
  buildMixedReviewQueue,
  resolveQueuedCardToStudyCard,
} from "@/src/lib/review-session";
import {
  calculateRecentAccuracy,
  advanceStudyDay,
  clearCourseProgress,
  COURSE_PROGRESS_STORAGE_KEY,
  countMusclesIntroducedDuringCurrentCourseWeek,
  createDefaultCourseProgress,
  getCourseDay,
  getCourseProgress,
  getCurrentStudyDay,
  markMuscleIntroduced,
  markStudyDayCompleted,
  migrateLegacyCourseProgressIfNeeded,
  setCarriedOverRetryKeys,
  startCourseIfNotStarted,
  writeCourseProgressStore,
} from "@/src/lib/course-progress";
import {
  applyCardGrade,
  introduceMuscleCards,
} from "@/src/lib/mastery-engine";
import { createDefaultCardProgress } from "@/src/lib/mastery-progress";
import {
  getMuscleMasteryPercent,
  getMuscleMasteryState,
} from "@/src/lib/muscle-mastery";
import {
  getDueReviewPromptCount,
  getIntroducedMuscleCount,
  getMasteredMuscleCount,
} from "@/src/lib/dashboard-progress";
import {
  getDailyNewMuscleTarget,
  getWeeklyNewMuscleTarget,
  WEEKLY_NEW_MUSCLE_TARGETS,
} from "@/src/lib/introduction-policy";
import type {
  CardProgress,
  MasteryProgressStore,
} from "@/src/lib/progress.types";
import { buildReviewQueue, type QueuedCard } from "@/src/lib/review-queue";
import {
  buildNewMuscleQueuedCards,
  buildStudyDayScheduledQueue,
  buildStudyDaySession,
  isStudyDaySessionComplete,
} from "@/src/lib/study-day-session";
import {
  advanceSameSessionIndex,
  applySameSessionGrade,
  areAttachmentPairsAdjacent,
  buildCarriedOverRetryQueue,
  countNonRetryCards,
  countPendingRetriesForCard,
  createSameSessionRelearnState,
  DAILY_GRADED_PROMPT_CAP,
  insertRelearnCards,
  isSameSessionRelearnComplete,
} from "@/src/lib/same-session-relearn";
import {
  applyGradeToProgress,
  INTERVAL_LADDER,
  isCardDue,
} from "@/src/lib/scheduling";
import {
  buildStudyUnitsForMuscle,
  getStudyUnitDueDate,
} from "@/src/lib/study-units";
import { clearAllLearningProgress } from "@/src/lib/learning-progress-reset";
import {
  getViewedMuscleBriefIds,
  markMuscleBriefViewed,
} from "@/src/lib/muscle-brief-progress";
import { readMasteryProgress, writeMasteryProgress } from "@/src/lib/mastery-progress";
import {
  resolveGuidedFirstExposureScreen,
  shouldShowMuscleBriefForGuidedStudy,
} from "@/src/lib/guided-first-exposure";
import {
  MIN_STARTING_QUEUE,
  planDailyWorkload,
  selectRandomPracticeCards,
  selectRandomPracticeUnits,
  shouldShowWorkloadWarning,
} from "@/src/lib/daily-workload-planning";
import {
  canAdvanceStudyDay as getCanAdvanceStudyDay,
  countMusclesIntroducedOnCourseDay,
  findNextGuidedMuscleIndex,
  getBaseDailyNewMuscleAllowance,
  getGuidedDailyNewMuscleAllowance,
  getGuidedStudyButtonLabel,
  hasIncompleteGuidedMuscle,
  isMuscleGuidedComplete,
} from "@/src/lib/guided-scheduling";

const emptyStore = (): MasteryProgressStore => ({
  version: 1,
  cards: {},
});

const reviewedAt = new Date("2026-01-01T12:00:00.000Z");
const dueStudyDay = 2;

function makeIntroducedDueStore(
  muscleId: string,
  categories: Array<"origin" | "insertion" | "action" | "innervation">,
  gradedStudyDay = 1,
): MasteryProgressStore {
  let store = introduceMuscleCards(emptyStore(), muscleId);

  for (const category of categories) {
    store = applyCardGrade(
      store,
      muscleId,
      category,
      "correct",
      reviewedAt,
      gradedStudyDay,
    );
  }

  return store;
}

function getQueueMuscleBlocks(queue: QueuedCard[]): string[] {
  const blocks: string[] = [];
  let index = 0;

  while (index < queue.length) {
    const card = queue[index];

    if (card.attachmentPairId) {
      blocks.push(card.muscleId);
      index += 2;
      continue;
    }

    blocks.push(card.muscleId);
    index += 1;
  }

  return blocks;
}

function advanceToMastered(progress: CardProgress): CardProgress {
  let current = progress;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    current = applyGradeToProgress(current, "correct", reviewedAt, 1 + attempt);
  }

  return current;
}

describe("stable progress keys", () => {
  it("builds lowercase profileId:category keys", () => {
    expect(buildCardProgressKey("longus-colli", "Origin")).toBe(
      "longus-colli:origin",
    );
    expect(buildCardProgressKey("longus-colli", "INSERTION")).toBe(
      "longus-colli:insertion",
    );
  });

  it("resolves generated cards to stable keys via profile matching", () => {
    const longusColliOrigin = cards.find(
      (card) => card.muscle === "Longus colli" && card.category === "Origin",
    );

    expect(longusColliOrigin).toBeDefined();
    expect(resolveCardProgressKey(longusColliOrigin!, cervicalCourse)).toBe(
      "longus-colli:origin",
    );
  });
});

describe("scheduling", () => {
  it("advances correct grades through the interval ladder", () => {
    let progress = createDefaultCardProgress({
      key: "longus-colli:action",
      muscleId: "longus-colli",
      category: "action",
    });

    for (const expectedInterval of INTERVAL_LADDER) {
      progress = applyGradeToProgress(progress, "correct", reviewedAt, 1);
      expect(progress.currentIntervalDays).toBe(expectedInterval);
      expect(progress.nextReviewStudyDay).toBe(1 + expectedInterval);
    }

    progress = applyGradeToProgress(progress, "correct", reviewedAt, 1);
    expect(progress.currentIntervalDays).toBe(60);
  });

  it("handles partial grades without increasing successfulReviewCount", () => {
    const progress = applyGradeToProgress(
      createDefaultCardProgress({
        key: "longus-colli:action",
        muscleId: "longus-colli",
        category: "action",
      }),
      "partial",
      reviewedAt,
      1,
    );

    expect(progress.successfulReviewCount).toBe(0);
    expect(progress.partialAttempts).toBe(1);
    expect(progress.state).toBe("new");
    expect(progress.currentIntervalDays).toBe(0);
  });

  it("handles incorrect grades by decreasing mastery two levels", () => {
    let progress = applyGradeToProgress(
      createDefaultCardProgress({
        key: "longus-colli:action",
        muscleId: "longus-colli",
        category: "action",
      }),
      "correct",
      reviewedAt,
      1,
    );

    progress = applyGradeToProgress(progress, "incorrect", reviewedAt, 2);

    expect(progress.successfulReviewCount).toBe(0);
    expect(progress.correctAttempts).toBe(1);
    expect(progress.incorrectAttempts).toBe(1);
    expect(progress.totalAttempts).toBe(2);
    expect(progress.state).toBe("relearning");
    expect(progress.currentIntervalDays).toBe(1);
  });

  it("progresses from new to mastered in five consecutive correct reviews", () => {
    let progress = createDefaultCardProgress({
      key: "longus-colli:origin",
      muscleId: "longus-colli",
      category: "origin",
    });

    const states: string[] = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      progress = applyGradeToProgress(
        progress,
        "correct",
        new Date(reviewedAt.getTime() + attempt * 15 * 24 * 60 * 60 * 1000),
        1 + attempt,
      );
      states.push(progress.state);
    }

    expect(states).toEqual(["learning", "learning", "learning", "review", "mastered"]);
    expect(progress.currentIntervalDays).toBe(30);
  });
});

describe("origin/insertion pairing", () => {
  it("uses the earlier due date for attachment pairs", () => {
    let store = introduceMuscleCards(emptyStore(), "longus-colli");
    store = applyCardGrade(store, "longus-colli", "origin", "correct", reviewedAt, 1);
    store = applyCardGrade(
      store,
      "longus-colli",
      "insertion",
      "incorrect",
      reviewedAt,
      1,
    );

    const [pairUnit] = buildStudyUnitsForMuscle("longus-colli");
    const dueDate = getStudyUnitDueDate(pairUnit, store);

    expect(dueDate).toBe(store.cards["longus-colli:insertion"]!.nextReviewAt);
  });

  it("returns null due date when either attachment is unintroduced", () => {
    const store = applyCardGrade(
      emptyStore(),
      "longus-colli",
      "origin",
      "correct",
      reviewedAt,
      1,
    );
    const [pairUnit] = buildStudyUnitsForMuscle("longus-colli");

    expect(getStudyUnitDueDate(pairUnit, store)).toBeNull();
  });
});

describe("review queue", () => {
  function makePairOnlyDueStore(muscleId: string): MasteryProgressStore {
    let store = emptyStore();
    store = applyCardGrade(store, muscleId, "origin", "correct", reviewedAt, 1);
    store = applyCardGrade(store, muscleId, "insertion", "correct", reviewedAt, 1);
    return store;
  }

  it("keeps attachment pairs back-to-back", () => {
    const store = makePairOnlyDueStore("longus-colli");
    const units = buildStudyUnitsForMuscle("longus-colli");
    const queue = buildReviewQueue(units, store, dueStudyDay, () => 0.5);

    const originIndex = queue.findIndex(
      (card) => card.cardKey === "longus-colli:origin",
    );
    const insertionIndex = queue.findIndex(
      (card) => card.cardKey === "longus-colli:insertion",
    );

    expect(originIndex).toBeGreaterThanOrEqual(0);
    expect(Math.abs(originIndex - insertionIndex)).toBe(1);
    expect(queue[originIndex].attachmentPairId).toBe(
      "longus-colli:attachment-pair",
    );
  });

  it("allows origin-first or insertion-first order inside a pair", () => {
    const store = makePairOnlyDueStore("longus-colli");
    const units = buildStudyUnitsForMuscle("longus-colli");

    const originFirst = buildReviewQueue(units, store, dueStudyDay, () => 0);
    const insertionFirst = buildReviewQueue(units, store, dueStudyDay, () => 0.5);

    expect(originFirst).toHaveLength(2);
    expect(insertionFirst).toHaveLength(2);
    expect(originFirst[0].category).toBe("origin");
    expect(originFirst[1].category).toBe("insertion");
    expect(insertionFirst[0].category).toBe("insertion");
    expect(insertionFirst[1].category).toBe("origin");
  });

  it("excludes unintroduced cards from the review queue", () => {
    let store = emptyStore();
    store = applyCardGrade(store, "longus-colli", "action", "correct", reviewedAt, 1);

    const units = buildStudyUnitsForMuscle("longus-colli");
    const queue = buildReviewQueue(units, store, dueStudyDay, () => 0.5);
    const cardKeys = queue.map((card) => card.cardKey);

    expect(cardKeys).toEqual(["longus-colli:action"]);
  });

  it("excludes introduced-but-ungraded cards from the review queue", () => {
    const store = introduceMuscleCards(emptyStore(), "longus-colli");
    const units = buildStudyUnitsForMuscle("longus-colli");
    const queue = buildReviewQueue(units, store, dueStudyDay, () => 0.5);

    expect(queue).toEqual([]);
  });

  it("excludes a partially completed attachment pair from the review queue", () => {
    let store = emptyStore();
    store = applyCardGrade(store, "longus-colli", "origin", "correct", reviewedAt, 1);

    const units = buildStudyUnitsForMuscle("longus-colli");
    const queue = buildReviewQueue(units, store, dueStudyDay, () => 0.5);
    const cardKeys = queue.map((card) => card.cardKey);

    expect(cardKeys).not.toContain("longus-colli:origin");
    expect(cardKeys).not.toContain("longus-colli:insertion");
  });

  it("includes an attachment pair after both cards are graded and due", () => {
    const store = makePairOnlyDueStore("longus-colli");
    const units = buildStudyUnitsForMuscle("longus-colli");
    const queue = buildReviewQueue(units, store, dueStudyDay, () => 0);

    expect(queue.map((card) => card.cardKey)).toEqual([
      "longus-colli:origin",
      "longus-colli:insertion",
    ]);
  });

  it("randomizes due review blocks without enforcing anti-streak ordering", () => {
    const muscles = ["longus-colli", "longus-capitis", "sternocleidomastoid"];
    let store = emptyStore();

    for (const muscleId of muscles) {
      store = applyCardGrade(store, muscleId, "action", "correct", reviewedAt, 1);
    }

    const units = muscles.flatMap((muscleId) => buildStudyUnitsForMuscle(muscleId));
    const queue = buildReviewQueue(units, store, dueStudyDay, () => 0);
    const muscleBlocks = getQueueMuscleBlocks(queue);

    expect(muscleBlocks.sort()).toEqual([...muscles].sort());
  });
});

describe("introduction policy", () => {
  it("totals exactly 88 muscles across active introduction weeks", () => {
    const total = WEEKLY_NEW_MUSCLE_TARGETS.reduce<number>(
      (sum, target) => sum + target,
      0,
    );

    expect(total).toBe(88);
  });

  it("returns zero daily introductions during weeks 12 through 15", () => {
    expect(getDailyNewMuscleTarget(78, 0, 0, null)).toBe(0);
    expect(getDailyNewMuscleTarget(85, 0, 0, null)).toBe(0);
    expect(getDailyNewMuscleTarget(92, 0, 0, null)).toBe(0);
    expect(getDailyNewMuscleTarget(99, 0, 0, null)).toBe(0);
    expect(getWeeklyNewMuscleTarget(12)).toBe(0);
    expect(getWeeklyNewMuscleTarget(15)).toBe(0);
  });
});

describe("course progress", () => {
  it("calculates course day from startedAt using whole-day steps", () => {
    const startedAt = "2026-01-01T12:00:00.000Z";

    expect(getCourseDay(startedAt, new Date("2026-01-01T18:00:00.000Z"))).toBe(1);
    expect(getCourseDay(startedAt, new Date("2026-01-02T11:00:00.000Z"))).toBe(1);
    expect(getCourseDay(startedAt, new Date("2026-01-02T13:00:00.000Z"))).toBe(2);
    expect(getCourseDay(startedAt, new Date("2026-04-16T12:00:00.000Z"))).toBe(105);
    expect(getCourseDay(startedAt, new Date("2026-05-01T12:00:00.000Z"))).toBe(105);
  });

  it("calculates recent accuracy with weighted grades", () => {
    expect(calculateRecentAccuracy(["correct", "correct"])).toBe(100);
    expect(calculateRecentAccuracy(["correct", "partial"])).toBe(75);
    expect(calculateRecentAccuracy(["correct", "partial", "incorrect"])).toBe(50);
    expect(calculateRecentAccuracy([])).toBeNull();
  });

  it("counts only muscles introduced during the current study week", () => {
    const progress = {
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 5,
      introducedMuscleIds: ["longus-colli", "longus-capitis", "scalenes"],
      introductionStudyDays: {
        "longus-colli": 2,
        "longus-capitis": 8,
        scalenes: 3,
      },
    };

    expect(countMusclesIntroducedDuringCurrentCourseWeek(progress)).toBe(2);

    expect(
      countMusclesIntroducedDuringCurrentCourseWeek({
        ...progress,
        currentStudyDay: 8,
      }),
    ).toBe(1);
  });

  it("starts a course only once in persisted storage", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const firstStart = startCourseIfNotStarted("cervical", now);
    const secondStart = startCourseIfNotStarted(
      "cervical",
      new Date("2026-01-05T12:00:00.000Z"),
    );
    const persisted = getCourseProgress("cervical");

    expect(firstStart.startedAt).toBe("2026-01-01T12:00:00.000Z");
    expect(secondStart.startedAt).toBe("2026-01-01T12:00:00.000Z");
    expect(persisted.startedAt).toBe("2026-01-01T12:00:00.000Z");
  });

  it("stores a muscle introduction date once", () => {
    const introducedAt = new Date("2026-01-02T09:00:00.000Z");

    startCourseIfNotStarted("cervical", new Date("2026-01-01T12:00:00.000Z"));
    markMuscleIntroduced("cervical", "longus-colli", introducedAt);

    const progress = getCourseProgress("cervical");

    expect(progress.introducedMuscleIds).toEqual(["longus-colli"]);
    expect(progress.introductionDates["longus-colli"]).toBe(
      "2026-01-02T09:00:00.000Z",
    );
  });

  it("does not duplicate muscle introductions when revisited", () => {
    startCourseIfNotStarted("cervical", new Date("2026-01-01T12:00:00.000Z"));
    markMuscleIntroduced("cervical", "longus-colli", new Date("2026-01-02T09:00:00.000Z"));
    markMuscleIntroduced("cervical", "longus-colli", new Date("2026-01-10T15:00:00.000Z"));

    const progress = getCourseProgress("cervical");

    expect(progress.introducedMuscleIds).toEqual(["longus-colli"]);
    expect(progress.introductionDates["longus-colli"]).toBe(
      "2026-01-02T09:00:00.000Z",
    );
  });
});

describe("dashboard progress", () => {
  it("counts due review prompts by queued cards", () => {
    let store = emptyStore();
    store = applyCardGrade(store, "longus-colli", "origin", "correct", reviewedAt, 1);
    store = applyCardGrade(store, "longus-colli", "insertion", "correct", reviewedAt, 1);
    store = applyCardGrade(store, "longus-colli", "action", "correct", reviewedAt, 1);
    store = applyCardGrade(store, "longus-colli", "innervation", "correct", reviewedAt, 1);

    const promptCount = getDueReviewPromptCount(
      ["longus-colli"],
      store,
      dueStudyDay,
    );

    expect(promptCount).toBe(4);
  });

  it("counts introduced and mastered muscles for the course", () => {
    let store = emptyStore();

    for (const category of ["origin", "insertion", "action", "innervation"] as const) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        store = applyCardGrade(
          store,
          "longus-colli",
          category,
          "correct",
          new Date(reviewedAt.getTime() + attempt * 15 * 24 * 60 * 60 * 1000),
          1 + attempt,
        );
      }
    }

    expect(getIntroducedMuscleCount(["longus-colli"], ["longus-colli"])).toBe(1);
    expect(getMasteredMuscleCount(["longus-colli"], store)).toBe(1);
    expect(getMasteredMuscleCount(["longus-colli", "longus-capitis"], store)).toBe(1);
  });

  it("returns zero counts for empty storage", () => {
    expect(getDueReviewPromptCount(["longus-colli"], emptyStore(), dueStudyDay)).toBe(0);
    expect(getIntroducedMuscleCount(["longus-colli"], [])).toBe(0);
    expect(getMasteredMuscleCount(["longus-colli"], emptyStore())).toBe(0);
  });

  it("resolves queued cards back to generated study cards", () => {
    const actionCard = cards.find(
      (card) => card.muscle === "Longus colli" && card.category === "Action",
    );
    const store = applyCardGrade(
      emptyStore(),
      "longus-colli",
      "action",
      "correct",
      reviewedAt,
      1,
    );
    const queue = buildMixedReviewQueue(
      ["longus-colli"],
      store,
      dueStudyDay,
      () => 0,
    );
    const resolved = resolveQueuedCardToStudyCard(
      queue[0],
      cards,
      cervicalCourse,
    );

    expect(actionCard).toBeDefined();
    expect(queue).toHaveLength(1);
    expect(resolved).toEqual(actionCard);
  });
});

describe("guided scheduling", () => {
  it("uses day-one allowance before the course has started", () => {
    const progress = createDefaultCourseProgress("cervical");
    const allowance = getGuidedDailyNewMuscleAllowance(
      progress,
      cervicalCourse.muscleProfileIds,
      emptyStore(),
    );

    expect(allowance).toBe(2);
  });

  it("reduces remaining allowance for muscles introduced today", () => {
    const progress = {
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 1,
      introducedMuscleIds: ["longus-colli"],
      introductionStudyDays: {
        "longus-colli": 1,
      },
    };

    expect(countMusclesIntroducedOnCourseDay(progress, 1)).toBe(1);

    const allowance = getGuidedDailyNewMuscleAllowance(
      progress,
      cervicalCourse.muscleProfileIds,
      emptyStore(),
    );

    expect(allowance).toBe(1);
  });

  it("resumes incomplete muscles before introducing new ones", () => {
    const progress = {
      ...createDefaultCourseProgress("cervical"),
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: ["longus-colli", "longus-capitis"],
      introductionDates: {
        "longus-colli": "2026-01-01T12:00:00.000Z",
        "longus-capitis": "2026-01-01T12:00:00.000Z",
      },
    };
    const store = introduceMuscleCards(emptyStore(), "longus-colli");

    expect(isMuscleGuidedComplete("longus-colli", store)).toBe(false);
    expect(
      findNextGuidedMuscleIndex(cervicalCourse, progress, store, 0),
    ).toEqual({ index: 0, isNew: false });
  });

  it("introduces the next unintroduced muscle in course order when allowance remains", () => {
    const progress = {
      ...createDefaultCourseProgress("cervical"),
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: ["longus-colli"],
      introductionDates: {
        "longus-colli": "2026-01-01T12:00:00.000Z",
      },
    };
    const store = makeIntroducedDueStore("longus-colli", [
      "origin",
      "insertion",
      "action",
      "innervation",
    ]);

    expect(
      findNextGuidedMuscleIndex(cervicalCourse, progress, store, 1),
    ).toEqual({ index: 1, isNew: true });
  });

  it("returns null when daily allowance is exhausted and nothing is incomplete", () => {
    const progress = {
      ...createDefaultCourseProgress("cervical"),
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: ["longus-colli", "longus-capitis"],
      introductionDates: {
        "longus-colli": "2026-01-01T12:00:00.000Z",
        "longus-capitis": "2026-01-01T12:00:00.000Z",
      },
    };
    const store = makeIntroducedDueStore("longus-colli", [
      "origin",
      "insertion",
      "action",
      "innervation",
    ]);
    store.cards = {
      ...store.cards,
      ...makeIntroducedDueStore("longus-capitis", [
        "origin",
        "insertion",
        "action",
        "innervation",
      ]).cards,
    };

    expect(
      findNextGuidedMuscleIndex(cervicalCourse, progress, store, 0),
    ).toBeNull();
    expect(
      hasIncompleteGuidedMuscle(cervicalCourse, progress, store),
    ).toBe(false);
  });

  it("labels the guided study action from the next muscle state", () => {
    expect(getGuidedStudyButtonLabel(null)).toBe("No New Muscles Today");
    expect(getGuidedStudyButtonLabel({ index: 0, isNew: false })).toBe(
      "Continue Studying",
    );
    expect(getGuidedStudyButtonLabel({ index: 1, isNew: true })).toBe(
      "Start Studying",
    );
  });
});

describe("guided first exposure", () => {
  it("shows the brief for a newly scheduled muscle even after markMuscleIntroduced", () => {
    markMuscleIntroduced("cervical", "longus-colli", new Date("2026-01-01T12:00:00.000Z"));

    expect(getCourseProgress("cervical").introducedMuscleIds).toContain("longus-colli");
    expect(shouldShowMuscleBriefForGuidedStudy("longus-colli")).toBe(true);
    expect(resolveGuidedFirstExposureScreen("longus-colli")).toBe("brief");
  });

  it("skips the brief after Start Practice marks the muscle brief viewed", () => {
    markMuscleIntroduced("cervical", "longus-colli", new Date("2026-01-01T12:00:00.000Z"));
    markMuscleBriefViewed("longus-colli");

    expect(shouldShowMuscleBriefForGuidedStudy("longus-colli")).toBe(false);
    expect(resolveGuidedFirstExposureScreen("longus-colli")).toBe("study");
  });

  it("still shows the next muscle brief after advancing study day", () => {
    startCourseIfNotStarted("cervical", new Date("2026-01-01T12:00:00.000Z"));
    markMuscleIntroduced("cervical", "longus-colli", new Date("2026-01-01T12:00:00.000Z"));
    markMuscleBriefViewed("longus-colli");

    markStudyDayCompleted("cervical");
    advanceStudyDay("cervical");
    markMuscleIntroduced("cervical", "longus-capitis", new Date("2026-01-02T12:00:00.000Z"));

    expect(getCourseProgress("cervical").currentStudyDay).toBe(2);
    expect(getCourseProgress("cervical").introducedMuscleIds).toEqual([
      "longus-colli",
      "longus-capitis",
    ]);
    expect(shouldShowMuscleBriefForGuidedStudy("longus-capitis")).toBe(true);
    expect(resolveGuidedFirstExposureScreen("longus-capitis")).toBe("brief");
  });
});

describe("study days", () => {
  it("defaults to study day 1", () => {
    expect(getCurrentStudyDay(createDefaultCourseProgress("cervical"))).toBe(1);
    expect(getCourseProgress("cervical").currentStudyDay).toBe(1);
  });

  it("advances to study day 2", () => {
    startCourseIfNotStarted("cervical", new Date("2026-01-01T12:00:00.000Z"));
    markStudyDayCompleted("cervical");

    const advanced = advanceStudyDay("cervical");

    expect(advanced.currentStudyDay).toBe(2);
    expect(getCourseProgress("cervical").currentStudyDay).toBe(2);
  });

  it("allows multiple advances within one real calendar day", () => {
    startCourseIfNotStarted("cervical", new Date("2026-01-01T12:00:00.000Z"));

    markStudyDayCompleted("cervical");
    advanceStudyDay("cervical");
    markStudyDayCompleted("cervical");
    const advancedTwice = advanceStudyDay("cervical");

    expect(advancedTwice.currentStudyDay).toBe(3);
  });

  it("caps study day advancement at day 105", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          currentStudyDay: 105,
        },
      },
    });

    const capped = advanceStudyDay("cervical");

    expect(capped.currentStudyDay).toBe(105);
  });

  it("recalculates new-muscle allowance after advancing study day", () => {
    const progress = {
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 1,
      introducedMuscleIds: ["longus-colli", "longus-capitis"],
      introductionStudyDays: {
        "longus-colli": 1,
        "longus-capitis": 1,
      },
    };
    const muscleIds = cervicalCourse.muscleProfileIds;
    const store = emptyStore();

    expect(
      getGuidedDailyNewMuscleAllowance(progress, muscleIds, store),
    ).toBe(0);

    const nextDayProgress = {
      ...progress,
      currentStudyDay: 2,
    };

    expect(
      getGuidedDailyNewMuscleAllowance(nextDayProgress, muscleIds, store),
    ).toBe(2);
    expect(
      getCanAdvanceStudyDay(nextDayProgress, muscleIds, store),
    ).toBe(false);
  });

  it("migrates legacy calendar progress into study-day fields", () => {
    window.localStorage.setItem(
      COURSE_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        courses: {
          cervical: {
            version: 1,
            courseId: "cervical",
            startedAt: "2026-01-01T00:00:00.000Z",
            introducedMuscleIds: ["longus-colli"],
            introductionDates: {
              "longus-colli": "2026-01-02T12:00:00.000Z",
            },
            recentGrades: ["correct"],
          },
        },
      }),
    );

    const progress = getCourseProgress("cervical");

    expect(progress.introducedMuscleIds).toEqual(["longus-colli"]);
    expect(progress.introductionStudyDays["longus-colli"]).toBe(2);
    expect(progress.currentStudyDay).toBeGreaterThanOrEqual(1);
    expect(progress.recentGrades).toEqual(["correct"]);
  });
});

describe("curriculum registry", () => {
  it("registers 88 unique profiles across 8 non-empty courses", () => {
    const profileIds = allMuscleProfiles.map((profile) => profile.id);
    const courseMuscleIds = allCourses.flatMap(
      (course) => course.muscleProfileIds,
    );

    expect(allMuscleProfiles).toHaveLength(88);
    expect(new Set(profileIds).size).toBe(88);
    expect(allCourses.every((course) => course.muscleProfileIds.length > 0)).toBe(
      true,
    );
    expect(myomasterProgramCourse.muscleProfileIds).toHaveLength(88);
    expect(courseMuscleIds.length).toBeGreaterThan(88);
  });

  it("orders the global program by region and spreadsheet sequence", () => {
    expect(myomasterProgramCourse.muscleProfileIds.slice(0, 7)).toEqual(
      cervicalCourse.muscleProfileIds,
    );
    expect(myomasterProgramCourse.name).toBe("MyoMaster 15-Week Program");
  });

  it("resolves every generated card to a profile and program roster entry", () => {
    const programCourse = getCourseById(DEFAULT_COURSE_ID);

    for (const card of cards) {
      const profile = getProfileForStudyCard(card, programCourse ?? null);

      expect(profile, `missing profile for ${card.region}:${card.muscle}`).toBeDefined();
      expect(programCourse?.muscleProfileIds).toContain(profile!.id);
    }
  });

  it("migrates legacy cervical course progress into the global program", () => {
    startCourseIfNotStarted("cervical", new Date("2026-01-01T12:00:00.000Z"));
    markMuscleIntroduced("cervical", "longus-colli", new Date("2026-01-02T09:00:00.000Z"));

    migrateLegacyCourseProgressIfNeeded(DEFAULT_COURSE_ID);

    const programProgress = getCourseProgress(DEFAULT_COURSE_ID);

    expect(programProgress.startedAt).toBe("2026-01-01T12:00:00.000Z");
    expect(programProgress.introducedMuscleIds).toEqual(["longus-colli"]);
  });
});

describe("study-day scheduling", () => {
  it("includes cards learned on Study Day 1 when Study Day 2 begins", () => {
    const store = makeIntroducedDueStore("longus-colli", ["action"], 1);
    const actionProgress = store.cards["longus-colli:action"]!;

    expect(actionProgress.nextReviewStudyDay).toBe(2);
    expect(isCardDue(actionProgress, 1)).toBe(false);
    expect(isCardDue(actionProgress, 2)).toBe(true);

    const units = buildStudyUnitsForMuscle("longus-colli");
    expect(buildReviewQueue(units, store, 1)).toEqual([]);
    expect(buildReviewQueue(units, store, 2).map((card) => card.cardKey)).toEqual([
      "longus-colli:action",
    ]);
  });

  it("still produces reviews after advancing multiple study days in one real day", () => {
    startCourseIfNotStarted("cervical", new Date("2026-01-01T12:00:00.000Z"));
    const store = makeIntroducedDueStore("longus-colli", ["action"], 1);

    markStudyDayCompleted("cervical");
    advanceStudyDay("cervical");
    markStudyDayCompleted("cervical");
    advanceStudyDay("cervical");

    const progress = getCourseProgress("cervical");
    expect(getCurrentStudyDay(progress)).toBe(3);

    const units = buildStudyUnitsForMuscle("longus-colli");
    expect(buildReviewQueue(units, store, 3).map((card) => card.cardKey)).toEqual([
      "longus-colli:action",
    ]);
  });

  it("migrates legacy card progress without nextReviewStudyDay safely", () => {
    writeMasteryProgress({
      version: 1,
        cards: {
        "longus-colli:action": {
          key: "longus-colli:action",
          muscleId: "longus-colli",
          category: "action",
          state: "learning",
          totalAttempts: 1,
          correctAttempts: 1,
          partialAttempts: 0,
          incorrectAttempts: 0,
          successfulReviewCount: 1,
          currentIntervalDays: 1,
          lastReviewedAt: reviewedAt.toISOString(),
          nextReviewAt: reviewedAt.toISOString(),
          nextReviewStudyDay: null,
        },
      },
    });

    const progress = readMasteryProgress().cards["longus-colli:action"]!;
    expect(progress.nextReviewStudyDay).toBeNull();
    expect(isCardDue(progress, 1)).toBe(true);
  });
});

describe("same-session relearning", () => {
  const baseQueue: QueuedCard[] = [
    {
      muscleId: "longus-colli",
      cardKey: "longus-colli:action",
      category: "action",
    },
    {
      muscleId: "longus-capitis",
      cardKey: "longus-capitis:action",
      category: "action",
    },
    {
      muscleId: "scalenes",
      cardKey: "scalenes:action",
      category: "action",
    },
    {
      muscleId: "levator-scapulae",
      cardKey: "levator-scapulae:action",
      category: "action",
    },
    {
      muscleId: "sternocleidomastoid",
      cardKey: "sternocleidomastoid:action",
      category: "action",
    },
  ];

  it("appends partial-card retries at the end of the queue", () => {
    let state = createSameSessionRelearnState(baseQueue);
    state = applySameSessionGrade(state, baseQueue[0], "partial");
    state = advanceSameSessionIndex(state);

    expect(state.queue.at(-1)?.cardKey).toBe("longus-colli:action");
    expect(state.queue.at(-1)?.isPendingRetry).toBe(true);
  });

  it("appends incorrect-card retries at the end of the queue", () => {
    let state = createSameSessionRelearnState(baseQueue);
    state = applySameSessionGrade(state, baseQueue[0], "incorrect");
    state = advanceSameSessionIndex(state);

    expect(state.queue.at(-1)?.cardKey).toBe("longus-colli:action");
  });

  it("does not repeat the same card immediately", () => {
    const queue = insertRelearnCards(baseQueue, 0, [baseQueue[0]]);

    expect(queue[1]?.cardKey).not.toBe("longus-colli:action");
    expect(queue.at(-1)?.cardKey).toBe("longus-colli:action");
  });

  it("requeues attachment pairs together at the end", () => {
    const pairQueue: QueuedCard[] = [
      {
        muscleId: "longus-colli",
        cardKey: "longus-colli:origin",
        category: "origin",
        attachmentPairId: "longus-colli:attachment-pair",
      },
      {
        muscleId: "longus-colli",
        cardKey: "longus-colli:insertion",
        category: "insertion",
        attachmentPairId: "longus-colli:attachment-pair",
      },
      ...baseQueue.slice(1),
    ];
    const state = applySameSessionGrade(
      createSameSessionRelearnState(pairQueue),
      pairQueue[0],
      "partial",
    );

    expect(areAttachmentPairsAdjacent(state.queue)).toBe(true);
    expect(state.queue.at(-2)?.attachmentPairId).toBe("longus-colli:attachment-pair");
    expect(state.queue.at(-1)?.attachmentPairId).toBe("longus-colli:attachment-pair");
  });

  it("cannot finish the session with unresolved relearning cards", () => {
    let state = createSameSessionRelearnState(baseQueue);
    state = applySameSessionGrade(state, baseQueue[0], "partial");
    state = advanceSameSessionIndex(state);

    expect(isSameSessionRelearnComplete(state)).toBe(false);
    expect(state.unresolvedKeys).toContain("longus-colli:action");
  });

  it("does not add unnecessary extra cards for an all-correct learner", () => {
    let state = createSameSessionRelearnState(baseQueue);

    while (state.index < state.queue.length && !state.dailyCapReached) {
      const current = state.queue[state.index];
      state = applySameSessionGrade(state, current, "correct");
      state = advanceSameSessionIndex(state);
    }

    expect(isSameSessionRelearnComplete(state)).toBe(true);
    expect(state.queue).toHaveLength(baseQueue.length);
  });

  it("keeps origin and insertion adjacent in due, filler, and relearn queues", () => {
    const store = makeIntroducedDueStore("longus-colli", [
      "origin",
      "insertion",
      "action",
      "innervation",
    ]);
    const dueQueue = buildReviewQueue(
      buildStudyUnitsForMuscle("longus-colli"),
      store,
      2,
    );
    const plan = planDailyWorkload(
      cervicalCourse,
      {
        ...createDefaultCourseProgress("cervical"),
        currentStudyDay: 2,
        startedAt: "2026-01-01T12:00:00.000Z",
        introducedMuscleIds: ["longus-colli"],
        introductionStudyDays: { "longus-colli": 1 },
      },
      store,
    );
    const relearnState = applySameSessionGrade(
      createSameSessionRelearnState(dueQueue),
      dueQueue[0],
      "partial",
    );

    expect(areAttachmentPairsAdjacent(dueQueue)).toBe(true);
    expect(areAttachmentPairsAdjacent(plan.queue)).toBe(true);
    expect(areAttachmentPairsAdjacent(relearnState.queue)).toBe(true);
  });

  it("queues only one attachment-pair retry for a missed pair", () => {
    const pairQueue: QueuedCard[] = [
      {
        muscleId: "longus-colli",
        cardKey: "longus-colli:origin",
        category: "origin",
        attachmentPairId: "longus-colli:attachment-pair",
      },
      {
        muscleId: "longus-colli",
        cardKey: "longus-colli:insertion",
        category: "insertion",
        attachmentPairId: "longus-colli:attachment-pair",
      },
    ];
    const state = applySameSessionGrade(
      createSameSessionRelearnState(pairQueue),
      pairQueue[0],
      "partial",
    );
    const pendingPairCards = state.queue.filter(
      (card) =>
        card.isPendingRetry &&
        card.attachmentPairId === "longus-colli:attachment-pair",
    );

    expect(pendingPairCards).toHaveLength(2);
    expect(areAttachmentPairsAdjacent(pendingPairCards)).toBe(true);
  });

  it("does not duplicate pending retries when the same card is missed repeatedly", () => {
    let state = createSameSessionRelearnState(baseQueue);
    state = applySameSessionGrade(state, baseQueue[0], "partial");
    state = advanceSameSessionIndex(state);

    while (state.index < state.queue.length) {
      const current = state.queue[state.index];

      if (current.cardKey !== "longus-colli:action") {
        state = applySameSessionGrade(state, current, "correct");
        state = advanceSameSessionIndex(state);
        continue;
      }

      state = applySameSessionGrade(state, current, "incorrect");
      state = advanceSameSessionIndex(state);
      break;
    }

    expect(countPendingRetriesForCard(state.queue, "longus-colli:action")).toBe(1);
  });

  it("does not let one incorrect answer multiply the queue", () => {
    let state = createSameSessionRelearnState(baseQueue);
    state = applySameSessionGrade(state, baseQueue[0], "incorrect");

    expect(state.queue.length).toBe(baseQueue.length + 1);
    expect(countPendingRetriesForCard(state.queue, "longus-colli:action")).toBe(1);

    state = advanceSameSessionIndex(state);

    while (
      state.index < state.queue.length &&
      state.queue[state.index]?.cardKey !== "longus-colli:action"
    ) {
      state = applySameSessionGrade(state, state.queue[state.index], "correct");
      state = advanceSameSessionIndex(state);
    }

    state = applySameSessionGrade(state, state.queue[state.index], "incorrect");

    expect(countPendingRetriesForCard(state.queue, "longus-colli:action")).toBe(1);
    expect(state.queue.length).toBe(baseQueue.length + 1);
    expect(isSameSessionRelearnComplete(state)).toBe(false);
    state = advanceSameSessionIndex(state);
    expect(state.queue[state.index]?.isPendingRetry).toBe(true);
  });

  it("appends another retry after incorrect on an existing retry card", () => {
    let state = createSameSessionRelearnState(baseQueue);
    state = applySameSessionGrade(state, baseQueue[0], "incorrect");
    state = advanceSameSessionIndex(state);

    while (
      state.index < state.queue.length &&
      !state.queue[state.index]?.isPendingRetry
    ) {
      state = applySameSessionGrade(state, state.queue[state.index], "correct");
      state = advanceSameSessionIndex(state);
    }

    const retryCard = state.queue[state.index];
    expect(retryCard?.isPendingRetry).toBe(true);

    state = applySameSessionGrade(state, retryCard!, "incorrect");

    expect(countPendingRetriesForCard(state.queue, "longus-colli:action")).toBe(1);
    expect(isSameSessionRelearnComplete(state)).toBe(false);

    state = advanceSameSessionIndex(state);

    expect(state.queue[state.index]?.cardKey).toBe("longus-colli:action");
    expect(state.queue[state.index]?.isPendingRetry).toBe(true);
  });

  it("continues recycling after three incorrect grades until correct", () => {
    let state = createSameSessionRelearnState(baseQueue);

    state = applySameSessionGrade(state, state.queue[state.index], "incorrect");
    expect(isSameSessionRelearnComplete(state)).toBe(false);
    expect(state.unresolvedKeys).toContain("longus-colli:action");
    state = advanceSameSessionIndex(state);

    while (
      state.index < state.queue.length &&
      !state.queue[state.index]?.isPendingRetry
    ) {
      state = applySameSessionGrade(state, state.queue[state.index], "correct");
      state = advanceSameSessionIndex(state);
    }

    for (let miss = 0; miss < 2; miss += 1) {
      expect(state.queue[state.index]?.isPendingRetry).toBe(true);
      state = applySameSessionGrade(state, state.queue[state.index], "incorrect");
      expect(isSameSessionRelearnComplete(state)).toBe(false);
      expect(state.unresolvedKeys).toContain("longus-colli:action");
      state = advanceSameSessionIndex(state);
    }

    expect(state.queue[state.index]?.isPendingRetry).toBe(true);

    state = applySameSessionGrade(state, state.queue[state.index], "correct");
    state = advanceSameSessionIndex(state);

    expect(state.unresolvedKeys).not.toContain("longus-colli:action");
    expect(isSameSessionRelearnComplete(state)).toBe(true);
  });

  it("continues recycling partial retries until correct", () => {
    let state = createSameSessionRelearnState(baseQueue);

    state = applySameSessionGrade(state, state.queue[state.index], "partial");
    expect(isSameSessionRelearnComplete(state)).toBe(false);
    state = advanceSameSessionIndex(state);

    while (
      state.index < state.queue.length &&
      !state.queue[state.index]?.isPendingRetry
    ) {
      state = applySameSessionGrade(state, state.queue[state.index], "correct");
      state = advanceSameSessionIndex(state);
    }

    for (let miss = 0; miss < 2; miss += 1) {
      expect(state.queue[state.index]?.isPendingRetry).toBe(true);
      state = applySameSessionGrade(state, state.queue[state.index], "partial");
      expect(isSameSessionRelearnComplete(state)).toBe(false);
      state = advanceSameSessionIndex(state);
    }

    state = applySameSessionGrade(state, state.queue[state.index], "correct");
    state = advanceSameSessionIndex(state);

    expect(isSameSessionRelearnComplete(state)).toBe(true);
  });

  it("clears a pending retry after a correct grade", () => {
    let state = createSameSessionRelearnState(baseQueue);
    state = applySameSessionGrade(state, baseQueue[0], "partial");
    state = advanceSameSessionIndex(state);

    while (state.index < state.queue.length) {
      const current = state.queue[state.index];

      if (current.cardKey !== "longus-colli:action") {
        state = applySameSessionGrade(state, current, "correct");
        state = advanceSameSessionIndex(state);
        continue;
      }

      state = applySameSessionGrade(state, current, "correct");
      break;
    }

    expect(countPendingRetriesForCard(state.queue, "longus-colli:action")).toBe(0);
    expect(state.unresolvedKeys).not.toContain("longus-colli:action");
  });

  it("does not rebuild the queue after each grade", () => {
    let state = createSameSessionRelearnState(baseQueue);

    for (let step = 0; step < 3; step += 1) {
      const current = state.queue[state.index];
      state = applySameSessionGrade(
        state,
        current,
        step === 0 ? "partial" : "correct",
      );
      state = advanceSameSessionIndex(state);
      expect(countNonRetryCards(state.queue)).toBe(state.initialQueueLength);
    }
  });

  it("never grades more than 40 static prompts in a capped study day", () => {
    const largeQueue: QueuedCard[] = myomasterProgramCourse.muscleProfileIds
      .slice(0, 60)
      .map((muscleId) => ({
        muscleId,
        cardKey: `${muscleId}:action` as CardProgressKey,
        category: "action" as const,
      }));

    let state = createSameSessionRelearnState(largeQueue, { enforceDailyCap: true });

    while (
      state.index < state.queue.length &&
      !state.dailyCapReached
    ) {
      const current = state.queue[state.index];
      state = applySameSessionGrade(state, current, "correct");
      state = advanceSameSessionIndex(state);
    }

    expect(state.staticGradedCount).toBe(DAILY_GRADED_PROMPT_CAP);
    expect(state.dailyCapReached).toBe(true);
    expect(isStudyDaySessionComplete(state)).toBe(true);
  });

  it("appends a retry after an incorrect grade on the 40th static card", () => {
    const queue: QueuedCard[] = Array.from({ length: 40 }, (_, index) => ({
      muscleId: "longus-colli",
      cardKey: `longus-colli:action-${index}` as CardProgressKey,
      category: "action" as const,
    }));
    queue[39] = {
      muscleId: "longus-colli",
      cardKey: "longus-colli:action",
      category: "action",
    };

    let state = createSameSessionRelearnState(queue, { enforceDailyCap: true });

    for (let index = 0; index < 39; index += 1) {
      state = applySameSessionGrade(state, state.queue[state.index], "correct");
      state = advanceSameSessionIndex(state);
    }

    expect(state.staticGradedCount).toBe(39);
    expect(state.dailyCapReached).toBe(false);

    state = applySameSessionGrade(state, state.queue[state.index], "incorrect");

    expect(state.staticGradedCount).toBe(40);
    expect(state.dailyCapReached).toBe(true);
    expect(countPendingRetriesForCard(state.queue, "longus-colli:action")).toBe(1);
    expect(isStudyDaySessionComplete(state)).toBe(false);
  });

  it("allows total graded prompts to exceed 40 when retries are required", () => {
    const queue: QueuedCard[] = Array.from({ length: 40 }, (_, index) => ({
      muscleId: "longus-colli",
      cardKey: `longus-colli:action-${index}` as CardProgressKey,
      category: "action" as const,
    }));
    queue[39] = {
      muscleId: "longus-colli",
      cardKey: "longus-colli:action",
      category: "action",
    };

    let state = createSameSessionRelearnState(queue, { enforceDailyCap: true });

    for (let index = 0; index < 39; index += 1) {
      state = applySameSessionGrade(state, state.queue[state.index], "correct");
      state = advanceSameSessionIndex(state);
    }

    state = applySameSessionGrade(state, state.queue[state.index], "incorrect");
    state = advanceSameSessionIndex(state);

    expect(state.gradedPromptCount).toBe(40);
    expect(state.queue[state.index]?.cardKey).toBe("longus-colli:action");
    expect(state.queue[state.index]?.isPendingRetry).toBe(true);

    state = applySameSessionGrade(state, state.queue[state.index], "correct");

    expect(state.gradedPromptCount).toBeGreaterThan(40);
    expect(isStudyDaySessionComplete(state)).toBe(true);
  });

  it("blocks study day completion until all retries are answered correctly", () => {
    const queue: QueuedCard[] = [
      {
        muscleId: "longus-colli",
        cardKey: "longus-colli:action",
        category: "action",
      },
    ];
    let state = createSameSessionRelearnState(queue, { enforceDailyCap: true });

    state = applySameSessionGrade(state, queue[0], "partial");
    state = advanceSameSessionIndex(state);

    expect(isStudyDaySessionComplete(state)).toBe(false);
    expect(state.unresolvedKeys).toContain("longus-colli:action");

    while (
      state.index < state.queue.length &&
      state.queue[state.index]?.cardKey !== "longus-colli:action"
    ) {
      state = advanceSameSessionIndex(state);
    }

    state = applySameSessionGrade(state, state.queue[state.index], "correct");

    expect(isStudyDaySessionComplete(state)).toBe(true);
    expect(state.unresolvedKeys).not.toContain("longus-colli:action");
  });

  it("restores carried-over retries after closing and reopening a study day", () => {
    startCourseIfNotStarted("cervical", new Date("2026-01-01T12:00:00.000Z"));
    setCarriedOverRetryKeys("cervical", ["longus-colli:action"]);

    const session = buildStudyDaySession(
      cervicalCourse,
      getCourseProgress("cervical"),
      emptyStore(),
    );

    expect(
      session.queue.some(
        (card) =>
          card.cardKey === "longus-colli:action" && card.isPendingRetry === true,
      ),
    ).toBe(true);
    expect(getCourseProgress("cervical").carriedOverRetryKeys).toEqual([]);
  });

  it("does not apply a second mastery penalty when a missed card is retried with partial", () => {
    let store = introduceMuscleCards(emptyStore(), "longus-colli");
    store = applyCardGrade(
      store,
      "longus-colli",
      "action",
      "incorrect",
      reviewedAt,
      1,
    );
    const afterIncorrect = store.cards["longus-colli:action"]!.successfulReviewCount;

    store = applyCardGrade(
      store,
      "longus-colli",
      "action",
      "partial",
      reviewedAt,
      1,
    );

    expect(store.cards["longus-colli:action"]!.successfulReviewCount).toBe(
      afterIncorrect,
    );

    store = applyCardGrade(
      store,
      "longus-colli",
      "action",
      "correct",
      reviewedAt,
      2,
    );

    expect(store.cards["longus-colli:action"]!.successfulReviewCount).toBe(
      afterIncorrect + 1,
    );
  });

  it("carries unresolved retries to the next study day queue", () => {
    const carriedQueue = buildCarriedOverRetryQueue(["longus-colli:action"]);
    const plan = buildStudyDayScheduledQueue(
      cervicalCourse,
      {
        ...createDefaultCourseProgress("cervical"),
        currentStudyDay: 2,
        startedAt: "2026-01-01T12:00:00.000Z",
        carriedOverRetryKeys: ["longus-colli:action"],
      },
      emptyStore(),
      ["longus-colli:action"],
    );

    expect(carriedQueue[0]?.cardKey).toBe("longus-colli:action");
    const carriedIndex = plan.findIndex(
      (card) =>
        card.cardKey === "longus-colli:action" && card.isPendingRetry === true,
    );
    expect(carriedIndex).toBeGreaterThanOrEqual(0);
    expect(carriedIndex).toBe(plan.length - 1);
    expect(plan[carriedIndex]?.isPendingRetry).toBe(true);
  });
});

function makeReviewReadyStore(
  muscleIds: string[],
  gradedStudyDay = 1,
): MasteryProgressStore {
  let store = emptyStore();

  for (const muscleId of muscleIds) {
    const muscleStore = makeIntroducedDueStore(
      muscleId,
      ["origin", "insertion", "action", "innervation"],
      gradedStudyDay,
    );
    store = {
      ...store,
      cards: {
        ...store.cards,
        ...muscleStore.cards,
      },
    };
  }

  return store;
}

function makeFutureReviewStore(
  muscleIds: string[],
  gradedStudyDay = 1,
  nextDueStudyDay = 10,
): MasteryProgressStore {
  const store = makeReviewReadyStore(muscleIds, gradedStudyDay);

  return {
    ...store,
    cards: Object.fromEntries(
      Object.entries(store.cards).map(([cardKey, progress]) => [
        cardKey,
        {
          ...progress,
          nextReviewStudyDay: nextDueStudyDay,
        },
      ]),
    ),
  };
}

describe("study-day session queue", () => {
  it("plans at least 16 prompts on light review days", () => {
    const muscleIds = cervicalCourse.muscleProfileIds.slice(0, 8);
    const store = makeFutureReviewStore(muscleIds, 1, 10);
    const courseProgress = {
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 2,
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: muscleIds,
      introductionStudyDays: Object.fromEntries(
        muscleIds.map((muscleId) => [muscleId, 1]),
      ),
    };
    const plan = planDailyWorkload(cervicalCourse, courseProgress, store);

    expect(plan.dueReviewPromptCount).toBe(0);
    expect(plan.plannedPromptCount).toBeGreaterThanOrEqual(MIN_STARTING_QUEUE);
  });

  it("places new-muscle cards before due reviews in the planned queue", () => {
    const courseProgress = {
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 2,
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: ["longus-colli"],
      introductionStudyDays: { "longus-colli": 1 },
    };
    const store = makeIntroducedDueStore("longus-colli", ["action"], 1);
    const plan = planDailyWorkload(cervicalCourse, courseProgress, store);

    expect(plan.dueReviewPromptCount).toBe(1);
    expect(plan.queue.some((card) => card.cardKey === "longus-colli:action")).toBe(true);
    expect(plan.queue.some((card) => card.muscleId === "longus-capitis")).toBe(true);

    const firstDueIndex = plan.queue.findIndex(
      (card) => card.cardKey === "longus-colli:action",
    );
    const firstNewIndex = plan.queue.findIndex(
      (card) => card.muscleId === "longus-capitis",
    );

    expect(firstNewIndex).toBeGreaterThanOrEqual(0);
    expect(firstDueIndex).toBeGreaterThan(firstNewIndex);
  });

  it("cannot complete until relearning is resolved", () => {
    const session = buildStudyDaySession(
      cervicalCourse,
      {
        ...createDefaultCourseProgress("cervical"),
        currentStudyDay: 1,
        startedAt: "2026-01-01T12:00:00.000Z",
      },
      emptyStore(),
      () => 0,
    );

    let state = applySameSessionGrade(
      session,
      session.queue[session.queue.length - 1],
      "partial",
    );
    state = advanceSameSessionIndex(state);

    expect(isStudyDaySessionComplete(state)).toBe(false);
    expect(state.unresolvedKeys.length).toBeGreaterThan(0);
  });
});

describe("daily workload planning", () => {
  it("fills light days up to the 16-prompt minimum", () => {
    const muscleIds = cervicalCourse.muscleProfileIds.slice(0, 8);
    const store = makeFutureReviewStore(muscleIds, 1, 10);
    const plan = planDailyWorkload(
      cervicalCourse,
      {
        ...createDefaultCourseProgress("cervical"),
        currentStudyDay: 2,
        startedAt: "2026-01-01T12:00:00.000Z",
        introducedMuscleIds: muscleIds,
        introductionStudyDays: Object.fromEntries(
          muscleIds.map((muscleId) => [muscleId, 1]),
        ),
      },
      store,
    );

    expect(plan.plannedPromptCount).toBeGreaterThanOrEqual(MIN_STARTING_QUEUE);
    expect(plan.practicePromptCount).toBeGreaterThan(0);
    expect(plan.queue.filter((card) => card.isPractice).length).toBe(
      plan.practicePromptCount,
    );
  });

  it("allows repeated practice card keys when fewer than 16 unique cards exist", () => {
    const muscleIds = ["longus-colli"];
    const coreQueue = buildNewMuscleQueuedCards("longus-colli");
    const practiceQueue = selectRandomPracticeCards(
      muscleIds,
      [],
      coreQueue,
      8,
      () => 0,
    );

    expect(practiceQueue).toHaveLength(8);
    expect(practiceQueue.every((card) => card.isPractice === true)).toBe(true);
    expect(new Set(practiceQueue.map((card) => card.cardKey)).size).toBeLessThan(8);
  });

  it("builds a 16-card day 1 queue from two newly introduced muscles", () => {
    const muscleIds = ["longus-colli", "longus-capitis"];
    let store = emptyStore();

    for (const muscleId of muscleIds) {
      store = introduceMuscleCards(store, muscleId);
    }

    const plan = planDailyWorkload(
      cervicalCourse,
      {
        ...createDefaultCourseProgress("cervical"),
        currentStudyDay: 1,
        startedAt: "2026-01-01T12:00:00.000Z",
        introducedMuscleIds: muscleIds,
        introductionStudyDays: {
          "longus-colli": 1,
          "longus-capitis": 1,
        },
      },
      store,
      () => 0.5,
    );

    expect(plan.newMusclePromptCount).toBe(8);
    expect(plan.practicePromptCount).toBe(8);
    expect(plan.plannedPromptCount).toBe(16);
    expect(countNonRetryCards(plan.queue)).toBe(16);
    expect(plan.queue.every((card) => !card.isPendingRetry)).toBe(true);
  });

  it("selects practice filler from muscles introduced on the current study day", () => {
    const muscleIds = ["longus-colli", "longus-capitis"];
    const coreQueue = muscleIds.flatMap((muscleId) =>
      buildNewMuscleQueuedCards(muscleId),
    );
    const practiceQueue = selectRandomPracticeCards(
      muscleIds,
      [],
      coreQueue,
      8,
      () => 0,
    );

    expect(practiceQueue).toHaveLength(8);
    expect(
      practiceQueue.every((card) => muscleIds.includes(card.muscleId)),
    ).toBe(true);
  });

  it("does not count retry prompts toward the 16-card initial static minimum", () => {
    const staticQueue = Array.from({ length: 16 }, (_, index) => ({
      muscleId: "longus-colli",
      cardKey: `longus-colli:action-${index}` as CardProgressKey,
      category: "action" as const,
    }));
    staticQueue[15] = {
      muscleId: "longus-colli",
      cardKey: "longus-colli:action",
      category: "action",
    };

    let state = createSameSessionRelearnState(staticQueue, {
      enforceDailyCap: true,
    });

    expect(state.initialStaticQueueLength).toBe(16);

    state = applySameSessionGrade(state, staticQueue[15], "incorrect");

    expect(countNonRetryCards(state.queue)).toBe(16);
    expect(state.queue.length).toBe(17);
  });

  it("does not duplicate practice cards already in the queue when unique cards remain", () => {
    const store = makeReviewReadyStore(["longus-colli"], 1);
    const plan = planDailyWorkload(
      cervicalCourse,
      {
        ...createDefaultCourseProgress("cervical"),
        currentStudyDay: 2,
        startedAt: "2026-01-01T12:00:00.000Z",
        introducedMuscleIds: ["longus-colli"],
        introductionStudyDays: { "longus-colli": 1 },
      },
      store,
    );
    const cardKeys = plan.queue.map((card) => card.cardKey);

    expect(new Set(cardKeys).size).toBe(cardKeys.length);
  });

  it("selects random practice cards from introduced muscles", () => {
    const muscleIds = cervicalCourse.muscleProfileIds.slice(0, 6);
    const store = makeFutureReviewStore(muscleIds, 1, 20);
    const courseProgress = {
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 2,
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: muscleIds,
      introductionStudyDays: Object.fromEntries(
        muscleIds.map((muscleId) => [muscleId, 1]),
      ),
    };
    const units = muscleIds.flatMap((muscleId) =>
      buildStudyUnitsForMuscle(muscleId),
    );
    const practiceUnits = selectRandomPracticeUnits(
      units,
      store,
      courseProgress,
      2,
      new Set(),
      8,
      () => 0.99,
    );

    expect(practiceUnits.length).toBeGreaterThan(0);
    expect(
      practiceUnits.every((unit) => muscleIds.includes(unit.muscleId)),
    ).toBe(true);
  });

  it("adds practice cards when enough introduced muscles exist", () => {
    const muscleIds = cervicalCourse.muscleProfileIds.slice(0, 8);
    const store = makeFutureReviewStore(muscleIds, 1, 10);
    const plan = planDailyWorkload(
      cervicalCourse,
      {
        ...createDefaultCourseProgress("cervical"),
        currentStudyDay: 2,
        startedAt: "2026-01-01T12:00:00.000Z",
        introducedMuscleIds: muscleIds,
        introductionStudyDays: Object.fromEntries(
          muscleIds.map((muscleId) => [muscleId, 1]),
        ),
      },
      store,
      () => 0,
    );
    const practiceCards = plan.queue.filter((card) => card.isPractice);

    expect(practiceCards.length).toBeGreaterThan(0);
    expect(practiceCards.every((card) => card.isPractice === true)).toBe(true);
  });

  it("uses the base new-muscle allowance regardless of due review load", () => {
    const muscleIds = cervicalCourse.muscleProfileIds.slice(0, 6);
    const store = makeReviewReadyStore(muscleIds, 1);
    const courseProgress = {
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 2,
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: muscleIds,
      introductionStudyDays: Object.fromEntries(
        muscleIds.map((muscleId) => [muscleId, 1]),
      ),
    };
    const baseAllowance = getBaseDailyNewMuscleAllowance(
      courseProgress,
      cervicalCourse.muscleProfileIds,
      store,
    );
    const plan = planDailyWorkload(cervicalCourse, courseProgress, store);

    expect(plan.newMuscleAllowance).toBe(baseAllowance);
    expect(plan.newMusclePromptCount).toBeGreaterThan(0);
  });

  it("schedules pending new muscles before due reviews when allowance remains", () => {
    const muscleIds = cervicalCourse.muscleProfileIds.slice(0, 2);
    const store = makeFutureReviewStore(muscleIds, 1, 10);
    const plan = planDailyWorkload(
      cervicalCourse,
      {
        ...createDefaultCourseProgress("cervical"),
        currentStudyDay: 2,
        startedAt: "2026-01-01T12:00:00.000Z",
        introducedMuscleIds: muscleIds,
        introductionStudyDays: Object.fromEntries(
          muscleIds.map((muscleId) => [muscleId, 1]),
        ),
      },
      store,
    );

    expect(plan.newMuscleAllowance).toBeGreaterThan(0);
    expect(plan.newMusclePromptCount).toBeGreaterThan(0);
  });

  it("shows a workload warning above 40 mandatory prompts", () => {
    expect(shouldShowWorkloadWarning(41)).toBe(true);
    expect(shouldShowWorkloadWarning(40)).toBe(false);
  });

  it("never caps required due review work", () => {
    const muscleIds = myomasterProgramCourse.muscleProfileIds.slice(0, 15);
    const store = makeReviewReadyStore(muscleIds, 1);
    const plan = planDailyWorkload(
      myomasterProgramCourse,
      {
        ...createDefaultCourseProgress("cervical"),
        currentStudyDay: 2,
        startedAt: "2026-01-01T12:00:00.000Z",
        introducedMuscleIds: muscleIds,
        introductionStudyDays: Object.fromEntries(
          muscleIds.map((muscleId) => [muscleId, 1]),
        ),
      },
      store,
    );

    expect(plan.dueReviewPromptCount).toBe(plan.mandatoryPromptCount);
    expect(plan.dueReviewPromptCount).toBeGreaterThan(40);
    expect(plan.queue.length).toBeGreaterThanOrEqual(plan.dueReviewPromptCount);
  });
});

describe("learning progress reset", () => {
  it("clears muscle brief, mastery, and course progress together", () => {
    startCourseIfNotStarted("cervical", new Date("2026-01-01T12:00:00.000Z"));
    markMuscleIntroduced("cervical", "longus-colli", new Date("2026-01-02T09:00:00.000Z"));
    markMuscleBriefViewed("longus-colli");
    writeMasteryProgress(introduceMuscleCards(emptyStore(), "longus-colli"));

    clearAllLearningProgress();

    expect(getViewedMuscleBriefIds()).toEqual([]);
    expect(readMasteryProgress().cards).toEqual({});
    expect(getCourseProgress("cervical")).toEqual(
      createDefaultCourseProgress("cervical"),
    );
  });
});

beforeEach(() => {
  const storage = new Map<string, string>();

  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };

  vi.stubGlobal("window", { localStorage });
  clearCourseProgress();
});

describe("muscle mastery", () => {
  it("reports not-started, learning, and mastered states", () => {
    expect(getMuscleMasteryState("longus-colli", emptyStore())).toBe("not-started");
    expect(getMuscleMasteryPercent("longus-colli", emptyStore())).toBe(0);

    const partial = makeIntroducedDueStore("longus-colli", ["action", "origin"]);
    expect(getMuscleMasteryState("longus-colli", partial)).toBe("learning");
    expect(getMuscleMasteryPercent("longus-colli", partial)).toBe(20);

    let mastered = introduceMuscleCards(emptyStore(), "longus-capitis");

    for (const category of [
      "origin",
      "insertion",
      "action",
      "innervation",
    ] as const) {
      mastered = {
        ...mastered,
        cards: {
          ...mastered.cards,
          [`longus-capitis:${category}`]: advanceToMastered(
            mastered.cards[`longus-capitis:${category}`]!,
          ),
        },
      };
    }

    expect(getMuscleMasteryState("longus-capitis", mastered)).toBe("mastered");
    expect(getMuscleMasteryPercent("longus-capitis", mastered)).toBe(100);
  });
  it("does not increase mastery when a practice card is answered correctly", () => {
    let store = introduceMuscleCards(emptyStore(), "longus-colli");
    store = applyCardGrade(
      store,
      "longus-colli",
      "action",
      "partial",
      reviewedAt,
      1,
    );
    const beforeCount = store.cards["longus-colli:action"]!.successfulReviewCount;
    const beforeCorrect = store.cards["longus-colli:action"]!.correctAttempts;

    store = applyCardGrade(
      store,
      "longus-colli",
      "action",
      "correct",
      reviewedAt,
      1,
      { isPractice: true },
    );

    expect(store.cards["longus-colli:action"]!.successfulReviewCount).toBe(
      beforeCount,
    );
    expect(store.cards["longus-colli:action"]!.correctAttempts).toBe(
      beforeCorrect + 1,
    );
  });
});

describe("immutable store updates", () => {
  it("does not mutate the original store during introduction", () => {
    const original = emptyStore();
    const introduced = introduceMuscleCards(original, "longus-colli");

    expect(original.cards).toEqual({});
    expect(Object.keys(introduced.cards)).toHaveLength(4);
  });

  it("does not overwrite existing progress during introduction", () => {
    let store = introduceMuscleCards(emptyStore(), "longus-colli");
    store = applyCardGrade(store, "longus-colli", "action", "correct", reviewedAt, 1);

    const existingAction = store.cards["longus-colli:action"];
    const reintroduced = introduceMuscleCards(store, "longus-colli");

    expect(reintroduced.cards["longus-colli:action"]).toEqual(existingAction);
    expect(reintroduced.cards["longus-colli:origin"]!.state).toBe("new");
  });

  it("does not mutate the original store during grading", () => {
    const original = introduceMuscleCards(emptyStore(), "longus-colli");
    const graded = applyCardGrade(
      original,
      "longus-colli",
      "action",
      "correct",
      reviewedAt,
      1,
    );

    expect(original.cards["longus-colli:action"]!.totalAttempts).toBe(0);
    expect(graded.cards["longus-colli:action"]!.totalAttempts).toBe(1);
    expect(graded.cards).not.toBe(original.cards);
  });
});
