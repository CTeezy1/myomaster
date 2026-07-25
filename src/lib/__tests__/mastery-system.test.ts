import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCardProgressKey,
  resolveCardProgressKey,
} from "@/src/lib/card-progress-key";
import { cards } from "@/src/data/cards";
import { cervicalCourse } from "@/src/lib/course-controller";
import {
  buildMixedReviewQueue,
  resolveQueuedCardToStudyCard,
} from "@/src/lib/review-session";
import {
  calculateRecentAccuracy,
  clearCourseProgress,
  countMusclesIntroducedDuringCurrentCourseWeek,
  createDefaultCourseProgress,
  getCourseDay,
  getCourseProgress,
  markMuscleIntroduced,
  startCourseIfNotStarted,
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
  applyGradeToProgress,
  INTERVAL_LADDER,
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
  countMusclesIntroducedOnCourseDay,
  findNextGuidedMuscleIndex,
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
const dueNow = new Date("2026-02-01T12:00:00.000Z");

function makeIntroducedDueStore(
  muscleId: string,
  categories: Array<"origin" | "insertion" | "action" | "innervation">,
): MasteryProgressStore {
  let store = introduceMuscleCards(emptyStore(), muscleId);

  for (const category of categories) {
    store = applyCardGrade(store, muscleId, category, "correct", reviewedAt);
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
    const reviewDate = new Date(
      reviewedAt.getTime() + attempt * 20 * 24 * 60 * 60 * 1000,
    );
    current = applyGradeToProgress(current, "correct", reviewDate);
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
      progress = applyGradeToProgress(progress, "correct", reviewedAt);
      expect(progress.currentIntervalDays).toBe(expectedInterval);
    }

    progress = applyGradeToProgress(progress, "correct", reviewedAt);
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
    );

    expect(progress.successfulReviewCount).toBe(0);
    expect(progress.partialAttempts).toBe(1);
    expect(progress.state).toBe("learning");
    expect(progress.currentIntervalDays).toBe(1);
  });

  it("handles incorrect grades without erasing attempt history", () => {
    let progress = applyGradeToProgress(
      createDefaultCardProgress({
        key: "longus-colli:action",
        muscleId: "longus-colli",
        category: "action",
      }),
      "correct",
      reviewedAt,
    );

    progress = applyGradeToProgress(progress, "incorrect", reviewedAt);

    expect(progress.successfulReviewCount).toBe(1);
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
    store = applyCardGrade(store, "longus-colli", "origin", "correct", reviewedAt);
    store = applyCardGrade(
      store,
      "longus-colli",
      "insertion",
      "incorrect",
      reviewedAt,
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
    );
    const [pairUnit] = buildStudyUnitsForMuscle("longus-colli");

    expect(getStudyUnitDueDate(pairUnit, store)).toBeNull();
  });
});

describe("review queue", () => {
  function makePairOnlyDueStore(muscleId: string): MasteryProgressStore {
    let store = emptyStore();
    store = applyCardGrade(store, muscleId, "origin", "correct", reviewedAt);
    store = applyCardGrade(store, muscleId, "insertion", "correct", reviewedAt);
    return store;
  }

  it("keeps attachment pairs back-to-back", () => {
    const store = makePairOnlyDueStore("longus-colli");
    const units = buildStudyUnitsForMuscle("longus-colli");
    const queue = buildReviewQueue(units, store, dueNow, () => 0.5);

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

    const originFirst = buildReviewQueue(units, store, dueNow, () => 0);
    const insertionFirst = buildReviewQueue(units, store, dueNow, () => 0.5);

    expect(originFirst).toHaveLength(2);
    expect(insertionFirst).toHaveLength(2);
    expect(originFirst[0].category).toBe("origin");
    expect(originFirst[1].category).toBe("insertion");
    expect(insertionFirst[0].category).toBe("insertion");
    expect(insertionFirst[1].category).toBe("origin");
  });

  it("excludes unintroduced cards from the review queue", () => {
    let store = emptyStore();
    store = applyCardGrade(store, "longus-colli", "action", "correct", reviewedAt);

    const units = buildStudyUnitsForMuscle("longus-colli");
    const queue = buildReviewQueue(units, store, dueNow, () => 0.5);
    const cardKeys = queue.map((card) => card.cardKey);

    expect(cardKeys).toEqual(["longus-colli:action"]);
  });

  it("excludes introduced-but-ungraded cards from the review queue", () => {
    const store = introduceMuscleCards(emptyStore(), "longus-colli");
    const units = buildStudyUnitsForMuscle("longus-colli");
    const queue = buildReviewQueue(units, store, dueNow, () => 0.5);

    expect(queue).toEqual([]);
  });

  it("excludes a partially completed attachment pair from the review queue", () => {
    let store = emptyStore();
    store = applyCardGrade(store, "longus-colli", "origin", "correct", reviewedAt);

    const units = buildStudyUnitsForMuscle("longus-colli");
    const queue = buildReviewQueue(units, store, dueNow, () => 0.5);
    const cardKeys = queue.map((card) => card.cardKey);

    expect(cardKeys).not.toContain("longus-colli:origin");
    expect(cardKeys).not.toContain("longus-colli:insertion");
  });

  it("includes an attachment pair after both cards are graded and due", () => {
    const store = makePairOnlyDueStore("longus-colli");
    const units = buildStudyUnitsForMuscle("longus-colli");
    const queue = buildReviewQueue(units, store, dueNow, () => 0);

    expect(queue.map((card) => card.cardKey)).toEqual([
      "longus-colli:origin",
      "longus-colli:insertion",
    ]);
  });

  it("avoids consecutive blocks from the same muscle when alternatives exist", () => {
    const muscles = ["longus-colli", "longus-capitis", "sternocleidomastoid"];
    let store = emptyStore();

    for (const muscleId of muscles) {
      store = applyCardGrade(store, muscleId, "action", "correct", reviewedAt);
    }

    const units = muscles.flatMap((muscleId) => buildStudyUnitsForMuscle(muscleId));
    const queue = buildReviewQueue(units, store, dueNow, () => 0);
    const muscleBlocks = getQueueMuscleBlocks(queue);

    expect(muscleBlocks).toHaveLength(3);
    for (let index = 1; index < muscleBlocks.length; index += 1) {
      expect(muscleBlocks[index]).not.toBe(muscleBlocks[index - 1]);
    }
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

  it("counts only muscles introduced during the current course week", () => {
    const progress = {
      ...createDefaultCourseProgress("cervical"),
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: ["longus-colli", "longus-capitis", "scalenes"],
      introductionDates: {
        "longus-colli": "2026-01-02T12:00:00.000Z",
        "longus-capitis": "2026-01-08T12:00:00.000Z",
        scalenes: "2026-01-03T12:00:00.000Z",
      },
    };

    expect(
      countMusclesIntroducedDuringCurrentCourseWeek(
        progress,
        new Date("2026-01-05T12:00:00.000Z"),
      ),
    ).toBe(2);

    expect(
      countMusclesIntroducedDuringCurrentCourseWeek(
        progress,
        new Date("2026-01-10T12:00:00.000Z"),
      ),
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
    store = applyCardGrade(store, "longus-colli", "origin", "correct", reviewedAt);
    store = applyCardGrade(store, "longus-colli", "insertion", "correct", reviewedAt);
    store = applyCardGrade(store, "longus-colli", "action", "correct", reviewedAt);
    store = applyCardGrade(store, "longus-colli", "innervation", "correct", reviewedAt);

    const promptCount = getDueReviewPromptCount(
      ["longus-colli"],
      store,
      dueNow,
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
        );
      }
    }

    expect(getIntroducedMuscleCount(["longus-colli"], ["longus-colli"])).toBe(1);
    expect(getMasteredMuscleCount(["longus-colli"], store)).toBe(1);
    expect(getMasteredMuscleCount(["longus-colli", "longus-capitis"], store)).toBe(1);
  });

  it("returns zero counts for empty storage", () => {
    expect(getDueReviewPromptCount(["longus-colli"], emptyStore(), dueNow)).toBe(0);
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
    );
    const queue = buildMixedReviewQueue(
      ["longus-colli"],
      store,
      dueNow,
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
      new Date("2026-01-01T12:00:00.000Z"),
    );

    expect(allowance).toBe(2);
  });

  it("reduces remaining allowance for muscles introduced today", () => {
    const progress = {
      ...createDefaultCourseProgress("cervical"),
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: ["longus-colli"],
      introductionDates: {
        "longus-colli": "2026-01-01T15:00:00.000Z",
      },
    };

    expect(
      countMusclesIntroducedOnCourseDay(
        progress,
        1,
        new Date("2026-01-01T18:00:00.000Z"),
      ),
    ).toBe(1);

    const allowance = getGuidedDailyNewMuscleAllowance(
      progress,
      cervicalCourse.muscleProfileIds,
      emptyStore(),
      new Date("2026-01-01T18:00:00.000Z"),
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
    store = applyCardGrade(store, "longus-colli", "action", "correct", reviewedAt);

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
    );

    expect(original.cards["longus-colli:action"]!.totalAttempts).toBe(0);
    expect(graded.cards["longus-colli:action"]!.totalAttempts).toBe(1);
    expect(graded.cards).not.toBe(original.cards);
  });
});
