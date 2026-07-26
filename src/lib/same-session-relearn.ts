import {
  buildCardProgressKey,
  type CardCategory,
  type CardProgressKey,
} from "@/src/lib/card-progress-key";
import type { Grade } from "@/src/lib/progress.types";
import type { QueuedCard } from "@/src/lib/review-queue";

export const DAILY_GRADED_PROMPT_CAP = 40;

export type SameSessionRelearnState = {
  queue: QueuedCard[];
  index: number;
  gradedPromptCount: number;
  staticGradedCount: number;
  unresolvedKeys: CardProgressKey[];
  pairCorrectCounts: Record<string, number>;
  initialQueueLength: number;
  initialStaticQueueLength: number;
  dailyCapReached: boolean;
  enforceDailyCap: boolean;
};

export function createSameSessionRelearnState(
  queue: QueuedCard[],
  options: { enforceDailyCap?: boolean } = {},
): SameSessionRelearnState {
  const initialStaticQueueLength = countNonRetryCards(queue);

  return {
    queue,
    index: 0,
    gradedPromptCount: 0,
    staticGradedCount: 0,
    unresolvedKeys: [],
    pairCorrectCounts: {},
    initialQueueLength: queue.length,
    initialStaticQueueLength,
    dailyCapReached: false,
    enforceDailyCap: options.enforceDailyCap ?? false,
  };
}

function cloneQueuedCard(card: QueuedCard): QueuedCard {
  return { ...card };
}

function cloneQueuedCards(cards: QueuedCard[]): QueuedCard[] {
  return cards.map(cloneQueuedCard);
}

export function buildQueuedCardFromKey(cardKey: CardProgressKey): QueuedCard | null {
  const separatorIndex = cardKey.indexOf(":");

  if (separatorIndex <= 0) {
    return null;
  }

  const muscleId = cardKey.slice(0, separatorIndex);
  const category = cardKey.slice(separatorIndex + 1) as CardCategory;
  const card: QueuedCard = {
    muscleId,
    cardKey,
    category,
  };

  if (category === "origin" || category === "insertion") {
    card.attachmentPairId = `${muscleId}:attachment-pair`;
  }

  return card;
}

function shuffleAttachmentPair(
  cards: QueuedCard[],
  random: () => number,
): QueuedCard[] {
  if (cards.length !== 2) {
    return cloneQueuedCards(cards);
  }

  return random() < 0.5
    ? cloneQueuedCards(cards)
    : cloneQueuedCards([cards[1], cards[0]]);
}

function buildAttachmentPairRetryCards(
  gradedCard: QueuedCard,
  random: () => number,
): QueuedCard[] {
  const muscleId = gradedCard.muscleId;
  const originKey = buildCardProgressKey(muscleId, "origin");
  const insertionKey = buildCardProgressKey(muscleId, "insertion");
  const attachmentPairId = gradedCard.attachmentPairId ?? `${muscleId}:attachment-pair`;

  if (!originKey || !insertionKey) {
    return [cloneQueuedCard({ ...gradedCard, isPendingRetry: true })];
  }

  return shuffleAttachmentPair(
    [
      {
        muscleId,
        cardKey: originKey,
        category: "origin",
        attachmentPairId,
        isPendingRetry: true,
      },
      {
        muscleId,
        cardKey: insertionKey,
        category: "insertion",
        attachmentPairId,
        isPendingRetry: true,
      },
    ],
    random,
  );
}

export function removePendingRetriesForCard(
  queue: QueuedCard[],
  cardKey: CardProgressKey,
): QueuedCard[] {
  return queue.filter(
    (card) => !(card.isPendingRetry && card.cardKey === cardKey),
  );
}

export function removePendingRetriesForPair(
  queue: QueuedCard[],
  attachmentPairId: string,
): QueuedCard[] {
  return queue.filter(
    (card) =>
      !(card.isPendingRetry && card.attachmentPairId === attachmentPairId),
  );
}

export function appendPendingRetryAtEnd(
  queue: QueuedCard[],
  retryCards: QueuedCard[],
): QueuedCard[] {
  if (retryCards.length === 0) {
    return queue;
  }

  return [...queue, ...cloneQueuedCards(retryCards)];
}

function addUnresolvedKeys(
  unresolvedKeys: CardProgressKey[],
  keys: CardProgressKey[],
): CardProgressKey[] {
  const next = new Set(unresolvedKeys);

  for (const key of keys) {
    next.add(key);
  }

  return [...next];
}

function removeUnresolvedKey(
  unresolvedKeys: CardProgressKey[],
  key: CardProgressKey,
): CardProgressKey[] {
  return unresolvedKeys.filter((entry) => entry !== key);
}

function removeAttachmentPairFromUnresolved(
  unresolvedKeys: CardProgressKey[],
  attachmentPairId: string,
): CardProgressKey[] {
  const muscleId = attachmentPairId.replace(":attachment-pair", "");
  const originKey = buildCardProgressKey(muscleId, "origin");
  const insertionKey = buildCardProgressKey(muscleId, "insertion");
  const pairKeys = new Set(
    [originKey, insertionKey].filter((key): key is CardProgressKey => key !== null),
  );

  return unresolvedKeys.filter((key) => !pairKeys.has(key));
}

export function countPendingRetriesForCard(
  queue: QueuedCard[],
  cardKey: CardProgressKey,
): number {
  return queue.filter(
    (card) => card.isPendingRetry && card.cardKey === cardKey,
  ).length;
}

function countPendingRetriesForPair(
  queue: QueuedCard[],
  attachmentPairId: string,
): number {
  return queue.filter(
    (card) => card.isPendingRetry && card.attachmentPairId === attachmentPairId,
  ).length;
}

export function countNonRetryCards(queue: QueuedCard[]): number {
  return queue.filter((card) => !card.isPendingRetry).length;
}

export function areAttachmentPairsAdjacent(queue: QueuedCard[]): boolean {
  for (let index = 0; index < queue.length - 1; index += 1) {
    const current = queue[index];
    const next = queue[index + 1];

    if (!current.attachmentPairId || current.attachmentPairId !== next.attachmentPairId) {
      continue;
    }

    const categories = new Set([current.category, next.category]);

    if (!categories.has("origin") || !categories.has("insertion")) {
      return false;
    }
  }

  return true;
}

function shouldAppendRetry(_state: SameSessionRelearnState): boolean {
  return true;
}

function applyCapAfterGrade(
  state: SameSessionRelearnState,
  gradedCard: QueuedCard,
): Pick<
  SameSessionRelearnState,
  "gradedPromptCount" | "staticGradedCount" | "dailyCapReached"
> {
  const gradedPromptCount = state.gradedPromptCount + 1;
  const staticGradedCount =
    state.staticGradedCount + (gradedCard.isPendingRetry ? 0 : 1);
  const dailyCapReached =
    state.enforceDailyCap && staticGradedCount >= DAILY_GRADED_PROMPT_CAP;

  return {
    gradedPromptCount,
    staticGradedCount,
    dailyCapReached,
  };
}

function handleCorrectGrade(
  state: SameSessionRelearnState,
  gradedCard: QueuedCard,
): SameSessionRelearnState {
  if (gradedCard.attachmentPairId) {
    const pairId = gradedCard.attachmentPairId;
    const nextPairCorrectCounts = {
      ...state.pairCorrectCounts,
      [pairId]: (state.pairCorrectCounts[pairId] ?? 0) + 1,
    };

    if (nextPairCorrectCounts[pairId] >= 2) {
      return {
        ...state,
        queue: removePendingRetriesForPair(state.queue, pairId),
        pairCorrectCounts: {
          ...nextPairCorrectCounts,
          [pairId]: 0,
        },
        unresolvedKeys: removeAttachmentPairFromUnresolved(
          state.unresolvedKeys,
          pairId,
        ),
      };
    }

    return {
      ...state,
      pairCorrectCounts: nextPairCorrectCounts,
    };
  }

  return {
    ...state,
    queue: removePendingRetriesForCard(state.queue, gradedCard.cardKey),
    unresolvedKeys: removeUnresolvedKey(
      state.unresolvedKeys,
      gradedCard.cardKey,
    ),
  };
}

function resolveIndexAfterMissedRetry(
  state: SameSessionRelearnState,
  queue: QueuedCard[],
  gradedCard: QueuedCard,
  retryCardCount: number,
): number {
  if (!gradedCard.isPendingRetry || retryCardCount <= 0) {
    return state.index;
  }

  const retryStartIndex = queue.length - retryCardCount;

  return Math.max(0, retryStartIndex - 1);
}

function handleMissedGrade(
  state: SameSessionRelearnState,
  gradedCard: QueuedCard,
  random: () => number,
): SameSessionRelearnState {
  if (gradedCard.attachmentPairId) {
    const pairId = gradedCard.attachmentPairId;
    let queue = removePendingRetriesForPair(state.queue, pairId);
    const retryCards = buildAttachmentPairRetryCards(gradedCard, random);

    if (shouldAppendRetry(state)) {
      queue = appendPendingRetryAtEnd(queue, retryCards);
    }

    return {
      ...state,
      queue,
      index: resolveIndexAfterMissedRetry(
        state,
        queue,
        gradedCard,
        retryCards.length,
      ),
      unresolvedKeys: addUnresolvedKeys(
        state.unresolvedKeys,
        retryCards.map((card) => card.cardKey),
      ),
      pairCorrectCounts: {
        ...state.pairCorrectCounts,
        [pairId]: 0,
      },
    };
  }

  let queue = removePendingRetriesForCard(state.queue, gradedCard.cardKey);
  const retryCard: QueuedCard = {
    ...gradedCard,
    isPendingRetry: true,
  };
  const retryCards = [retryCard];

  if (shouldAppendRetry(state)) {
    queue = appendPendingRetryAtEnd(queue, retryCards);
  }

  return {
    ...state,
    queue,
    index: resolveIndexAfterMissedRetry(
      state,
      queue,
      gradedCard,
      retryCards.length,
    ),
    unresolvedKeys: addUnresolvedKeys(state.unresolvedKeys, [gradedCard.cardKey]),
  };
}

export function applySameSessionGrade(
  state: SameSessionRelearnState,
  gradedCard: QueuedCard,
  grade: Grade,
  random: () => number = Math.random,
): SameSessionRelearnState {
  const capUpdate = applyCapAfterGrade(state, gradedCard);
  let nextState: SameSessionRelearnState = {
    ...state,
    ...capUpdate,
  };

  if (grade === "correct") {
    return handleCorrectGrade(nextState, gradedCard);
  }

  return handleMissedGrade(nextState, gradedCard, random);
}

export function advanceSameSessionIndex(
  state: SameSessionRelearnState,
): SameSessionRelearnState {
  return {
    ...state,
    index: state.index + 1,
  };
}

export function isSameSessionRelearnComplete(
  state: SameSessionRelearnState,
): boolean {
  if (state.unresolvedKeys.length > 0) {
    return false;
  }

  if (state.enforceDailyCap && state.dailyCapReached) {
    return true;
  }

  return state.index >= state.queue.length;
}

export function getCurrentSessionCard(
  state: SameSessionRelearnState,
): QueuedCard | null {
  return state.queue[state.index] ?? null;
}

export function getDisplayedQuestionNumber(
  state: SameSessionRelearnState,
): number {
  if (state.enforceDailyCap) {
    return Math.min(state.gradedPromptCount + 1, DAILY_GRADED_PROMPT_CAP);
  }

  return state.gradedPromptCount + 1;
}

export function getDisplayedQuestionTotal(
  state: SameSessionRelearnState,
): number {
  if (state.enforceDailyCap) {
    return DAILY_GRADED_PROMPT_CAP;
  }

  return state.queue.length;
}

export function getQueuedCategoriesForPair(
  queue: QueuedCard[],
  attachmentPairId: string,
): CardCategory[] {
  return queue
    .filter((card) => card.attachmentPairId === attachmentPairId)
    .map((card) => card.category);
}

export function buildCarriedOverRetryQueue(
  keys: CardProgressKey[],
  random: () => number = Math.random,
): QueuedCard[] {
  const queue: QueuedCard[] = [];
  const seenPairs = new Set<string>();
  const seenSingles = new Set<CardProgressKey>();

  for (const key of keys) {
    const card = buildQueuedCardFromKey(key);

    if (!card) {
      continue;
    }

    if (card.attachmentPairId) {
      if (seenPairs.has(card.attachmentPairId)) {
        continue;
      }

      seenPairs.add(card.attachmentPairId);
      queue.push(
        ...buildAttachmentPairRetryCards(card, random).map((entry) => ({
          ...entry,
          isPendingRetry: true,
        })),
      );
      continue;
    }

    if (seenSingles.has(card.cardKey)) {
      continue;
    }

    seenSingles.add(card.cardKey);
    queue.push({ ...card, isPendingRetry: true });
  }

  return queue;
}

/** @deprecated Retries append at queue end; kept for test migration only. */
export function insertRelearnCards(
  queue: QueuedCard[],
  _afterIndex: number,
  relearnCards: QueuedCard[],
): QueuedCard[] {
  const deduped = relearnCards[0]?.attachmentPairId
    ? removePendingRetriesForPair(queue, relearnCards[0].attachmentPairId)
    : relearnCards[0]
      ? removePendingRetriesForCard(queue, relearnCards[0].cardKey)
      : queue;

  return appendPendingRetryAtEnd(
    deduped,
    relearnCards.map((card) => ({ ...card, isPendingRetry: true })),
  );
}
