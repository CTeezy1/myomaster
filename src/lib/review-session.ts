import type { Card } from "@/src/data/cards";
import { resolveCardProgressKey } from "@/src/lib/card-progress-key";
import type { Course } from "@/src/lib/course.types";
import type { MasteryProgressStore } from "@/src/lib/progress.types";
import {
  buildReviewQueue,
  type QueuedCard,
} from "@/src/lib/review-queue";
import { buildStudyUnitsForMuscle } from "@/src/lib/study-units";

export function resolveQueuedCardToStudyCard(
  queued: QueuedCard,
  allCards: Card[],
  course: Course,
): Card | undefined {
  return allCards.find(
    (card) => resolveCardProgressKey(card, course) === queued.cardKey,
  );
}

export function buildMixedReviewQueue(
  muscleIds: string[],
  masteryStore: MasteryProgressStore,
  now: Date,
  random?: () => number,
): QueuedCard[] {
  const units = muscleIds.flatMap((muscleId) =>
    buildStudyUnitsForMuscle(muscleId),
  );

  return buildReviewQueue(units, masteryStore, now, random);
}
