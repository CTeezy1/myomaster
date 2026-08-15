import type { CardCategory, CardProgressKey } from "@/src/lib/card-progress-key";
import type { MasteryProgressStore } from "@/src/lib/progress.types";
import {
  isStudyUnitDue,
  type StudyUnit,
} from "@/src/lib/study-units";

export interface QueuedCard {
  muscleId: string;
  cardKey: CardProgressKey;
  category: CardCategory;
  attachmentPairId?: string;
  isPendingRetry?: boolean;
  isPractice?: boolean;
  obligationId?: string;
}

export type ReviewUnit =
  | { kind: "single"; cards: [QueuedCard] }
  | { kind: "attachmentPair"; cards: [QueuedCard, QueuedCard] };

function defaultRandom(): number {
  return Math.random();
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function isUnitReviewEligible(
  unit: StudyUnit,
  progressStore: MasteryProgressStore,
): boolean {
  if (unit.type === "single") {
    const progress = progressStore.cards[unit.cardKey];

    return progress !== undefined && progress.totalAttempts > 0;
  }

  const originProgress = progressStore.cards[unit.originKey];
  const insertionProgress = progressStore.cards[unit.insertionKey];

  return (
    originProgress !== undefined &&
    insertionProgress !== undefined &&
    originProgress.totalAttempts > 0 &&
    insertionProgress.totalAttempts > 0
  );
}

function buildAttachmentPairCards(
  unit: Extract<StudyUnit, { type: "attachment-pair" }>,
  random: () => number,
): [QueuedCard, QueuedCard] {
  const attachmentPairId = `${unit.muscleId}:attachment-pair`;
  const originCard: QueuedCard = {
    muscleId: unit.muscleId,
    cardKey: unit.originKey,
    category: "origin",
    attachmentPairId,
  };
  const insertionCard: QueuedCard = {
    muscleId: unit.muscleId,
    cardKey: unit.insertionKey,
    category: "insertion",
    attachmentPairId,
  };

  return random() < 0.5
    ? [originCard, insertionCard]
    : [insertionCard, originCard];
}

export function studyUnitToReviewUnit(
  unit: StudyUnit,
  random: () => number = defaultRandom,
): ReviewUnit {
  if (unit.type === "single") {
    return {
      kind: "single",
      cards: [
        {
          muscleId: unit.muscleId,
          cardKey: unit.cardKey,
          category: unit.category,
        },
      ],
    };
  }

  return {
    kind: "attachmentPair",
    cards: buildAttachmentPairCards(unit, random),
  };
}

export function buildDueReviewUnits(
  units: StudyUnit[],
  progressStore: MasteryProgressStore,
  currentStudyDay: number,
  random: () => number = defaultRandom,
): ReviewUnit[] {
  return units
    .filter(
      (unit) =>
        isUnitReviewEligible(unit, progressStore) &&
        isStudyUnitDue(unit, progressStore, currentStudyDay),
    )
    .map((unit) => studyUnitToReviewUnit(unit, random));
}

export function shuffleReviewUnits(
  units: ReviewUnit[],
  random: () => number = defaultRandom,
): ReviewUnit[] {
  return shuffle(units, random);
}

export function flattenReviewUnits(units: ReviewUnit[]): QueuedCard[] {
  return units.flatMap((unit) => unit.cards);
}

export function selectReviewUnitsUpToCardLimit(
  units: ReviewUnit[],
  maxCards: number,
): QueuedCard[] {
  if (maxCards <= 0) {
    return [];
  }

  const selected: QueuedCard[] = [];

  for (const unit of units) {
    const unitCards = flattenReviewUnits([unit]);

    if (selected.length + unitCards.length > maxCards) {
      continue;
    }

    selected.push(...unitCards);
  }

  return selected;
}

export function buildReviewQueue(
  units: StudyUnit[],
  progressStore: MasteryProgressStore,
  currentStudyDay: number,
  random: () => number = defaultRandom,
): QueuedCard[] {
  const reviewUnits = buildDueReviewUnits(
    units,
    progressStore,
    currentStudyDay,
    random,
  );

  if (reviewUnits.length === 0) {
    return [];
  }

  return flattenReviewUnits(shuffleReviewUnits(reviewUnits, random));
}

export function buildReviewQueueUpToLimit(
  units: StudyUnit[],
  progressStore: MasteryProgressStore,
  currentStudyDay: number,
  maxCards: number,
  random: () => number = defaultRandom,
): { queue: QueuedCard[]; totalDueCount: number } {
  const reviewUnits = buildDueReviewUnits(
    units,
    progressStore,
    currentStudyDay,
    random,
  );

  if (reviewUnits.length === 0) {
    return { queue: [], totalDueCount: 0 };
  }

  const shuffledUnits = shuffleReviewUnits(reviewUnits, random);
  const totalDueCount = flattenReviewUnits(shuffledUnits).length;

  return {
    queue: selectReviewUnitsUpToCardLimit(shuffledUnits, maxCards),
    totalDueCount,
  };
}

export function buildReviewQueueFromUnits(
  units: StudyUnit[],
  random: () => number = defaultRandom,
): QueuedCard[] {
  if (units.length === 0) {
    return [];
  }

  const reviewUnits = units.map((unit) => studyUnitToReviewUnit(unit, random));

  return flattenReviewUnits(shuffleReviewUnits(reviewUnits, random));
}

export { isUnitReviewEligible, shuffle as shuffleQueueBlocks };
