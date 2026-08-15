import type { CardProgressKey } from "@/src/lib/card-progress-key";
import type { Course } from "@/src/lib/course.types";
import { getCurrentStudyDay } from "@/src/lib/course-progress";
import { getBaseDailyNewMuscleAllowance } from "@/src/lib/guided-scheduling";
import type { CourseProgress, MasteryProgressStore } from "@/src/lib/progress.types";
import {
  buildNewMuscleQueuedCards,
  getMuscleIdsIntroducedOnStudyDay,
  getNewMuscleIdsForStudyDay,
} from "@/src/lib/new-muscle-queue";
import {
  buildReviewQueueUpToLimit,
  isUnitReviewEligible,
  shuffleQueueBlocks,
  type QueuedCard,
} from "@/src/lib/review-queue";
import {
  buildStudyUnitsForMuscle,
  getStudyUnitCardKeys,
  isStudyUnitDue,
  type StudyUnit,
} from "@/src/lib/study-units";

export const MIN_DAILY_GRADED_CARDS = 16;
export const MAX_DAILY_GRADED_CARDS = 40;
/** @deprecated Use MIN_DAILY_GRADED_CARDS */
export const MIN_STARTING_QUEUE = MIN_DAILY_GRADED_CARDS;
export const NORMAL_RANGE_MAX = 30;
export const HEAVY_LOAD_WARNING_THRESHOLD = 40;

export type DailyWorkloadPlan = {
  queue: QueuedCard[];
  mandatoryPromptCount: number;
  dueReviewPromptCount: number;
  newMusclePromptCount: number;
  fillerReviewPromptCount: number;
  practicePromptCount: number;
  plannedPromptCount: number;
  newMuscleAllowance: number;
  showWorkloadWarning: boolean;
};

function defaultRandom(): number {
  return Math.random();
}

function countQueuedPrompts(cards: QueuedCard[]): number {
  return cards.length;
}

function trimPlannedQueueToMax(queue: QueuedCard[]): QueuedCard[] {
  if (queue.length <= MAX_DAILY_GRADED_CARDS) {
    return queue;
  }

  const practiceIndex = queue.findIndex((card) => card.isPractice);

  if (practiceIndex === -1) {
    return queue.slice(0, MAX_DAILY_GRADED_CARDS);
  }

  const coreQueue = queue.slice(0, practiceIndex);
  const practiceQueue = queue.slice(practiceIndex);

  if (coreQueue.length >= MAX_DAILY_GRADED_CARDS) {
    return coreQueue;
  }

  return [
    ...coreQueue,
    ...practiceQueue.slice(0, MAX_DAILY_GRADED_CARDS - coreQueue.length),
  ];
}

export function shouldShowWorkloadWarning(
  mandatoryPromptCount: number,
): boolean {
  return mandatoryPromptCount > HEAVY_LOAD_WARNING_THRESHOLD;
}

function resolveNewMuscleIdsForQueue(
  course: Course,
  courseProgress: CourseProgress,
  currentStudyDay: number,
  newMuscleAllowance: number,
): string[] {
  const introducedToday = getMuscleIdsIntroducedOnStudyDay(
    courseProgress,
    currentStudyDay,
  );

  if (introducedToday.length > 0) {
    return introducedToday;
  }

  return getNewMuscleIdsForStudyDay(
    course,
    courseProgress,
    newMuscleAllowance,
  );
}

function buildIntroducedMusclePracticePool(
  introducedMuscleIds: string[],
): QueuedCard[] {
  return introducedMuscleIds.flatMap((muscleId) =>
    buildNewMuscleQueuedCards(muscleId),
  );
}

function isPracticeCandidateUnit(
  unit: StudyUnit,
  store: MasteryProgressStore,
  courseProgress: CourseProgress,
  currentStudyDay: number,
  dueReviewCardKeys: Set<CardProgressKey>,
  queuedCardKeys: Set<CardProgressKey>,
): boolean {
  if (!courseProgress.introducedMuscleIds.includes(unit.muscleId)) {
    return false;
  }

  if (
    isStudyUnitDue(unit, store, currentStudyDay) &&
    isUnitReviewEligible(unit, store)
  ) {
    return false;
  }

  if (
    getStudyUnitCardKeys(unit).some((cardKey) => dueReviewCardKeys.has(cardKey))
  ) {
    return false;
  }

  return !getStudyUnitCardKeys(unit).some((cardKey) =>
    queuedCardKeys.has(cardKey),
  );
}

/** @deprecated Use selectRandomPracticeCards */
export function selectRandomPracticeUnits(
  units: StudyUnit[],
  store: MasteryProgressStore,
  courseProgress: CourseProgress,
  currentStudyDay: number,
  queuedCardKeys: Set<CardProgressKey>,
  promptsNeeded: number,
  random: () => number = defaultRandom,
): StudyUnit[] {
  if (promptsNeeded <= 0) {
    return [];
  }

  const dueReviewCardKeys = new Set<CardProgressKey>();
  const candidates = units.filter((unit) =>
    isPracticeCandidateUnit(
      unit,
      store,
      courseProgress,
      currentStudyDay,
      dueReviewCardKeys,
      queuedCardKeys,
    ),
  );
  const shuffled = shuffleQueueBlocks(candidates, random);
  const selected: StudyUnit[] = [];
  let selectedPromptCount = 0;

  for (const unit of shuffled) {
    if (selectedPromptCount >= promptsNeeded) {
      break;
    }

    selected.push(unit);
    selectedPromptCount += getStudyUnitCardKeys(unit).length;

    for (const cardKey of getStudyUnitCardKeys(unit)) {
      queuedCardKeys.add(cardKey);
    }
  }

  return selected;
}

export function selectRandomPracticeCards(
  introducedMuscleIds: string[],
  dueReviewQueue: QueuedCard[],
  coreQueue: QueuedCard[],
  promptsNeeded: number,
  random: () => number = defaultRandom,
): QueuedCard[] {
  if (promptsNeeded <= 0 || introducedMuscleIds.length === 0) {
    return [];
  }

  const dueReviewCardKeys = new Set(dueReviewQueue.map((card) => card.cardKey));
  const coreCardKeys = new Set(coreQueue.map((card) => card.cardKey));
  const pool = buildIntroducedMusclePracticePool(introducedMuscleIds).filter(
    (card) => !dueReviewCardKeys.has(card.cardKey),
  );

  if (pool.length === 0) {
    return [];
  }

  const uniqueNotInCore = shuffleQueueBlocks(
    pool.filter((card) => !coreCardKeys.has(card.cardKey)),
    random,
  );
  const practiceQueue: QueuedCard[] = [];

  for (const card of uniqueNotInCore) {
    if (practiceQueue.length >= promptsNeeded) {
      break;
    }

    practiceQueue.push({
      ...card,
      isPractice: true,
    });
  }

  const fillPool = shuffleQueueBlocks(pool, random);

  while (practiceQueue.length < promptsNeeded) {
    const nextIndex = Math.floor(random() * fillPool.length);
    const card = fillPool[nextIndex];

    practiceQueue.push({
      ...card,
      isPractice: true,
    });
  }

  return practiceQueue;
}

/** @deprecated Adaptive reduction removed; allowance is always the base value. */
export function applyAdaptiveNewMuscleAllowance(
  baseAllowance: number,
  _mandatoryPromptCount: number,
): number {
  return Math.max(0, baseAllowance);
}

export function planDailyWorkload(
  course: Course,
  courseProgress: CourseProgress,
  masteryStore: MasteryProgressStore,
  random: () => number = defaultRandom,
): DailyWorkloadPlan {
  const currentStudyDay = getCurrentStudyDay(courseProgress);
  const units = course.muscleProfileIds.flatMap((muscleId) =>
    buildStudyUnitsForMuscle(muscleId),
  );
  const newMuscleAllowance = getBaseDailyNewMuscleAllowance(
    courseProgress,
    course.muscleProfileIds,
    masteryStore,
  );
  const newMuscleIds = resolveNewMuscleIdsForQueue(
    course,
    courseProgress,
    currentStudyDay,
    newMuscleAllowance,
  );
  const newMuscleQueue = newMuscleIds.flatMap((muscleId) =>
    buildNewMuscleQueuedCards(muscleId),
  );
  const reviewCardLimit = Math.max(
    0,
    MAX_DAILY_GRADED_CARDS - newMuscleQueue.length,
  );
  const { queue: dueReviewQueue, totalDueCount } = buildReviewQueueUpToLimit(
    units,
    masteryStore,
    currentStudyDay,
    reviewCardLimit,
    random,
  );
  const mandatoryPromptCount = totalDueCount;
  const coreQueue = [...newMuscleQueue, ...dueReviewQueue];
  const promptsNeeded = Math.max(0, MIN_DAILY_GRADED_CARDS - coreQueue.length);
  const practiceCardLimit = Math.max(
    0,
    MAX_DAILY_GRADED_CARDS - coreQueue.length,
  );
  const practiceQueue = selectRandomPracticeCards(
    courseProgress.introducedMuscleIds,
    dueReviewQueue,
    coreQueue,
    Math.min(promptsNeeded, practiceCardLimit),
    random,
  );
  const queue = trimPlannedQueueToMax([...coreQueue, ...practiceQueue]);

  return {
    queue,
    mandatoryPromptCount,
    dueReviewPromptCount: mandatoryPromptCount,
    newMusclePromptCount: countQueuedPrompts(newMuscleQueue),
    fillerReviewPromptCount: countQueuedPrompts(practiceQueue),
    practicePromptCount: countQueuedPrompts(practiceQueue),
    plannedPromptCount: countQueuedPrompts(queue),
    newMuscleAllowance,
    showWorkloadWarning: shouldShowWorkloadWarning(mandatoryPromptCount),
  };
}
