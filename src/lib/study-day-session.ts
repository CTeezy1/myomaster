import type { CardProgressKey } from "@/src/lib/card-progress-key";
import type { Course } from "@/src/lib/course.types";
import { consumeCarriedOverRetryKeys, getCourseProgress, isCurrentStudyDayCompleted } from "@/src/lib/course-progress";
import { planDailyWorkload } from "@/src/lib/daily-workload-planning";
import type { CourseProgress, MasteryProgressStore } from "@/src/lib/progress.types";
import { hasViewedMuscleBrief } from "@/src/lib/muscle-brief-progress";
import type { QueuedCard } from "@/src/lib/review-queue";
import {
  buildCarriedOverRetryQueue,
  createSameSessionRelearnState,
  isSameSessionRelearnComplete,
  type SameSessionRelearnState,
} from "@/src/lib/same-session-relearn";

export {
  buildNewMuscleQueuedCards,
  getNewMuscleIdsForStudyDay,
} from "@/src/lib/new-muscle-queue";

function collectCarriedOverCardKeys(keys: CardProgressKey[]): Set<CardProgressKey> {
  const carriedKeys = new Set<CardProgressKey>();

  for (const key of keys) {
    carriedKeys.add(key);

    const separatorIndex = key.indexOf(":");

    if (separatorIndex <= 0) {
      continue;
    }

    const muscleId = key.slice(0, separatorIndex);
    const category = key.slice(separatorIndex + 1);

    if (category === "origin" || category === "insertion") {
      carriedKeys.add(`${muscleId}:origin` as CardProgressKey);
      carriedKeys.add(`${muscleId}:insertion` as CardProgressKey);
    }
  }

  return carriedKeys;
}

function mergeCarriedOverQueueWithPlan(
  carriedQueue: QueuedCard[],
  plannedQueue: QueuedCard[],
  carriedKeys: CardProgressKey[],
): QueuedCard[] {
  const carriedKeySet = collectCarriedOverCardKeys(carriedKeys);
  const filteredPlanned = plannedQueue.filter(
    (card) => !carriedKeySet.has(card.cardKey),
  );

  return [...filteredPlanned, ...carriedQueue];
}

export function buildStudyDayScheduledQueue(
  course: Course,
  courseProgress: CourseProgress,
  masteryStore: MasteryProgressStore,
  carriedOverRetryKeys: CardProgressKey[] = courseProgress.carriedOverRetryKeys,
  random: () => number = Math.random,
): QueuedCard[] {
  if (isCurrentStudyDayCompleted(courseProgress)) {
    return [];
  }

  const carriedQueue = buildCarriedOverRetryQueue(carriedOverRetryKeys, random);
  const plannedQueue = planDailyWorkload(
    course,
    courseProgress,
    masteryStore,
    random,
  ).queue;

  return mergeCarriedOverQueueWithPlan(
    carriedQueue,
    plannedQueue,
    carriedOverRetryKeys,
  );
}

export function getBriefMuscleIdForSessionIndex(
  queue: QueuedCard[],
  index: number,
): string | null {
  const card = queue[index];

  if (!card) {
    return null;
  }

  if (hasViewedMuscleBrief(card.muscleId)) {
    return null;
  }

  for (let scanIndex = 0; scanIndex < index; scanIndex += 1) {
    if (queue[scanIndex].muscleId === card.muscleId) {
      return null;
    }
  }

  return card.muscleId;
}

export function buildStudyDaySession(
  course: Course,
  _courseProgress: CourseProgress,
  masteryStore: MasteryProgressStore,
  random: () => number = Math.random,
): SameSessionRelearnState {
  const courseProgress = getCourseProgress(course.id);
  const carriedOverRetryKeys = consumeCarriedOverRetryKeys(course.id);
  const queue = buildStudyDayScheduledQueue(
    course,
    {
      ...courseProgress,
      carriedOverRetryKeys,
    },
    masteryStore,
    carriedOverRetryKeys,
    random,
  );

  return createSameSessionRelearnState(queue, { enforceDailyCap: true });
}

export function isStudyDaySessionComplete(
  state: SameSessionRelearnState,
): boolean {
  return isSameSessionRelearnComplete(state);
}

export function countUniquePrompts(state: SameSessionRelearnState): number {
  return new Set(state.queue.map((card) => card.cardKey)).size;
}

export function getSessionCardKeys(state: SameSessionRelearnState): CardProgressKey[] {
  return state.queue.map((card) => card.cardKey);
}

export type { SameSessionRelearnState };
