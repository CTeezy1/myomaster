import type { CardProgressKey } from "@/src/lib/card-progress-key";
import type { Course } from "@/src/lib/course.types";
import { getCurrentStudyDay } from "@/src/lib/course-progress";
import { getBaseDailyNewMuscleAllowance } from "@/src/lib/guided-scheduling";
import type { CourseProgress, MasteryProgressStore } from "@/src/lib/progress.types";
import {
  buildNewMuscleQueuedCards,
  getNewMuscleIdsForStudyDay,
} from "@/src/lib/new-muscle-queue";
import {
  buildReviewQueue,
  buildReviewQueueFromUnits,
  isUnitReviewEligible,
  type QueuedCard,
} from "@/src/lib/review-queue";
import {
  buildStudyUnitsForMuscle,
  getStudyUnitCardKeys,
  getStudyUnitDueStudyDay,
  isStudyUnitDue,
  type StudyUnit,
} from "@/src/lib/study-units";

export const MIN_STARTING_QUEUE = 20;
export const NORMAL_RANGE_MAX = 30;
export const HEAVY_LOAD_WARNING_THRESHOLD = 40;
export const FILLER_NEAR_DUE_STUDY_DAYS = 3;

export type DailyWorkloadPlan = {
  queue: QueuedCard[];
  mandatoryPromptCount: number;
  dueReviewPromptCount: number;
  newMusclePromptCount: number;
  fillerReviewPromptCount: number;
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

function collectQueuedCardKeys(cards: QueuedCard[]): Set<CardProgressKey> {
  return new Set(cards.map((card) => card.cardKey));
}

export function applyAdaptiveNewMuscleAllowance(
  baseAllowance: number,
  mandatoryPromptCount: number,
): number {
  if (mandatoryPromptCount > 30) {
    return 0;
  }

  if (mandatoryPromptCount >= 20) {
    return Math.max(0, Math.floor(baseAllowance / 2));
  }

  return Math.max(0, baseAllowance);
}

export function shouldShowWorkloadWarning(
  mandatoryPromptCount: number,
): boolean {
  return mandatoryPromptCount > HEAVY_LOAD_WARNING_THRESHOLD;
}

function isUnitMastered(unit: StudyUnit, store: MasteryProgressStore): boolean {
  return getStudyUnitCardKeys(unit).every(
    (cardKey) => store.cards[cardKey]?.state === "mastered",
  );
}

function getUnitWeaknessScore(
  unit: StudyUnit,
  store: MasteryProgressStore,
): number {
  const progresses = getStudyUnitCardKeys(unit)
    .map((cardKey) => store.cards[cardKey])
    .filter((progress) => progress !== undefined);

  if (progresses.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return (
    progresses.reduce(
      (sum, progress) => sum + progress.successfulReviewCount,
      0,
    ) / progresses.length
  );
}

function getUnitDaysUntilDue(
  unit: StudyUnit,
  store: MasteryProgressStore,
  currentStudyDay: number,
): number {
  const dueStudyDay = getStudyUnitDueStudyDay(unit, store);

  if (dueStudyDay === null) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.max(0, dueStudyDay - currentStudyDay);
}

function compareFillerUnits(
  left: StudyUnit,
  right: StudyUnit,
  store: MasteryProgressStore,
  currentStudyDay: number,
): number {
  const leftMastered = isUnitMastered(left, store);
  const rightMastered = isUnitMastered(right, store);

  if (leftMastered !== rightMastered) {
    return leftMastered ? 1 : -1;
  }

  const leftDays = getUnitDaysUntilDue(left, store, currentStudyDay);
  const rightDays = getUnitDaysUntilDue(right, store, currentStudyDay);
  const leftNearDueScore =
    leftDays <= FILLER_NEAR_DUE_STUDY_DAYS ? leftDays : leftDays + 100;
  const rightNearDueScore =
    rightDays <= FILLER_NEAR_DUE_STUDY_DAYS ? rightDays : rightDays + 100;

  if (leftNearDueScore !== rightNearDueScore) {
    return leftNearDueScore - rightNearDueScore;
  }

  return (
    getUnitWeaknessScore(left, store) - getUnitWeaknessScore(right, store)
  );
}

function isFillerCandidateUnit(
  unit: StudyUnit,
  store: MasteryProgressStore,
  currentStudyDay: number,
  queuedCardKeys: Set<CardProgressKey>,
  includeMastered: boolean,
): boolean {
  if (!isUnitReviewEligible(unit, store)) {
    return false;
  }

  if (isStudyUnitDue(unit, store, currentStudyDay)) {
    return false;
  }

  if (
    getStudyUnitCardKeys(unit).some((cardKey) => queuedCardKeys.has(cardKey))
  ) {
    return false;
  }

  if (!includeMastered && isUnitMastered(unit, store)) {
    return false;
  }

  return true;
}

export function selectFillerReviewUnits(
  units: StudyUnit[],
  store: MasteryProgressStore,
  currentStudyDay: number,
  queuedCardKeys: Set<CardProgressKey>,
  promptsNeeded: number,
): StudyUnit[] {
  if (promptsNeeded <= 0) {
    return [];
  }

  let includeMastered = false;
  const selected: StudyUnit[] = [];
  let selectedPromptCount = 0;

  while (selectedPromptCount < promptsNeeded) {
    const candidates = units.filter((unit) =>
      isFillerCandidateUnit(
        unit,
        store,
        currentStudyDay,
        queuedCardKeys,
        includeMastered,
      ),
    );

    if (candidates.length === 0) {
      if (includeMastered) {
        break;
      }

      includeMastered = true;
      continue;
    }

    candidates.sort((left, right) =>
      compareFillerUnits(left, right, store, currentStudyDay),
    );

    const nextUnit = candidates[0];
    selected.push(nextUnit);
    selectedPromptCount += getStudyUnitCardKeys(nextUnit).length;

    for (const cardKey of getStudyUnitCardKeys(nextUnit)) {
      queuedCardKeys.add(cardKey);
    }
  }

  return selected;
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
  const dueReviewQueue = buildReviewQueue(
    units,
    masteryStore,
    currentStudyDay,
    random,
  );
  const mandatoryPromptCount = countQueuedPrompts(dueReviewQueue);
  const baseNewMuscleAllowance = getBaseDailyNewMuscleAllowance(
    courseProgress,
    course.muscleProfileIds,
    masteryStore,
  );
  const newMuscleAllowance = applyAdaptiveNewMuscleAllowance(
    baseNewMuscleAllowance,
    mandatoryPromptCount,
  );
  const newMuscleIds = getNewMuscleIdsForStudyDay(
    course,
    courseProgress,
    newMuscleAllowance,
  );
  const newMuscleQueue = newMuscleIds.flatMap((muscleId) =>
    buildNewMuscleQueuedCards(muscleId),
  );
  const mandatoryWithNew = [...dueReviewQueue, ...newMuscleQueue];
  const queuedCardKeys = collectQueuedCardKeys(mandatoryWithNew);
  const promptsNeeded = Math.max(
    0,
    MIN_STARTING_QUEUE - mandatoryWithNew.length,
  );
  const fillerUnits = selectFillerReviewUnits(
    units,
    masteryStore,
    currentStudyDay,
    queuedCardKeys,
    promptsNeeded,
  );
  const fillerReviewQueue = buildReviewQueueFromUnits(fillerUnits, random);
  const queue = [...mandatoryWithNew, ...fillerReviewQueue];

  return {
    queue,
    mandatoryPromptCount,
    dueReviewPromptCount: mandatoryPromptCount,
    newMusclePromptCount: countQueuedPrompts(newMuscleQueue),
    fillerReviewPromptCount: countQueuedPrompts(fillerReviewQueue),
    plannedPromptCount: countQueuedPrompts(queue),
    newMuscleAllowance,
    showWorkloadWarning: shouldShowWorkloadWarning(mandatoryPromptCount),
  };
}
