import type { Grade } from "@/src/lib/progress.types";
import type { CardProgressKey } from "@/src/lib/card-progress-key";
import type { QueuedCard } from "@/src/lib/review-queue";

export type StudyDayObligationProgress = {
  total: number;
  completedObligationIds: string[];
};

export function createStudyDayObligationProgress(
  total: number,
  completedObligationIds: string[] = [],
): StudyDayObligationProgress {
  return {
    total,
    completedObligationIds: [...completedObligationIds],
  };
}

export function assignDailyObligationIds(scheduledQueue: QueuedCard[]): {
  queue: QueuedCard[];
  progress: StudyDayObligationProgress;
} {
  const queue = scheduledQueue.map((card, index) => ({
    ...card,
    obligationId: `obl-${index}`,
  }));

  return {
    queue,
    progress: createStudyDayObligationProgress(queue.length),
  };
}

export function findObligationIdForCardInInitialQueue(
  queue: QueuedCard[],
  cardKey: CardProgressKey,
  initialQueueLength: number,
): string | undefined {
  for (let index = 0; index < initialQueueLength && index < queue.length; index += 1) {
    const card = queue[index];

    if (card.cardKey === cardKey && card.obligationId) {
      return card.obligationId;
    }
  }

  return undefined;
}

export function annotateAttachmentPairRetryObligationIds(
  retryCards: QueuedCard[],
  queue: QueuedCard[],
  initialQueueLength: number,
  gradedCard: QueuedCard,
): QueuedCard[] {
  return retryCards.map((card) => ({
    ...card,
    obligationId:
      card.cardKey === gradedCard.cardKey
        ? gradedCard.obligationId
        : findObligationIdForCardInInitialQueue(
            queue,
            card.cardKey,
            initialQueueLength,
          ),
  }));
}

export function recordObligationCompletion(
  progress: StudyDayObligationProgress,
  obligationId: string | undefined,
  grade: Grade,
): StudyDayObligationProgress {
  if (grade !== "correct" || !obligationId) {
    return progress;
  }

  if (progress.completedObligationIds.includes(obligationId)) {
    return progress;
  }

  return {
    ...progress,
    completedObligationIds: [...progress.completedObligationIds, obligationId],
  };
}

export function getObligationProgressCounts(progress: StudyDayObligationProgress): {
  completed: number;
  total: number;
} {
  const completed = Math.min(
    progress.completedObligationIds.length,
    progress.total,
  );

  return {
    completed,
    total: progress.total,
  };
}

export function createObligationProgressFromSession(
  session: { initialQueueLength: number; queue: QueuedCard[] },
  completedObligationIds: string[] = [],
): StudyDayObligationProgress {
  return createStudyDayObligationProgress(
    session.initialQueueLength,
    completedObligationIds,
  );
}
