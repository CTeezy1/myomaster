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
}

type QueueBlock = {
  muscleId: string;
  cards: QueuedCard[];
  isAttachmentPair: boolean;
};

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
): QueuedCard[] {
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

function unitToBlock(unit: StudyUnit, random: () => number): QueueBlock {
  if (unit.type === "single") {
    return {
      muscleId: unit.muscleId,
      isAttachmentPair: false,
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
    muscleId: unit.muscleId,
    isAttachmentPair: true,
    cards: buildAttachmentPairCards(unit, random),
  };
}

function hasAlternativeMuscleBlock(
  remaining: QueueBlock[],
  excluded: QueueBlock,
  muscleId: string,
): boolean {
  return remaining.some(
    (block) => block !== excluded && block.muscleId !== muscleId,
  );
}

function canPlaceBlock(
  block: QueueBlock,
  previous: QueueBlock | null,
  remaining: QueueBlock[],
): boolean {
  if (!previous) {
    return true;
  }

  if (block.muscleId !== previous.muscleId) {
    return true;
  }

  return !hasAlternativeMuscleBlock(remaining, block, previous.muscleId);
}

function arrangeBlocks(
  blocks: QueueBlock[],
  random: () => number,
): QueueBlock[] {
  if (blocks.length <= 1) {
    return blocks;
  }

  const remaining = shuffle(blocks, random);
  const arranged: QueueBlock[] = [];

  while (remaining.length > 0) {
    const previous = arranged[arranged.length - 1] ?? null;
    const candidates = remaining.filter((block) =>
      canPlaceBlock(block, previous, remaining),
    );

    const pool = candidates.length > 0 ? candidates : remaining;
    const selectedIndex = Math.floor(random() * pool.length);
    const selected = pool[selectedIndex];

    arranged.push(selected);
    remaining.splice(remaining.indexOf(selected), 1);
  }

  return arranged;
}

export function buildReviewQueue(
  units: StudyUnit[],
  progressStore: MasteryProgressStore,
  currentStudyDay: number,
  random: () => number = defaultRandom,
): QueuedCard[] {
  const eligibleUnits = units.filter(
    (unit) =>
      isUnitReviewEligible(unit, progressStore) &&
      isStudyUnitDue(unit, progressStore, currentStudyDay),
  );

  if (eligibleUnits.length === 0) {
    return [];
  }

  const blocks = eligibleUnits.map((unit) => unitToBlock(unit, random));
  const arrangedBlocks = arrangeBlocks(blocks, random);

  return arrangedBlocks.flatMap((block) => block.cards);
}

export function buildReviewQueueFromUnits(
  units: StudyUnit[],
  random: () => number = defaultRandom,
): QueuedCard[] {
  if (units.length === 0) {
    return [];
  }

  const blocks = units.map((unit) => unitToBlock(unit, random));
  const arrangedBlocks = arrangeBlocks(blocks, random);

  return arrangedBlocks.flatMap((block) => block.cards);
}

export { isUnitReviewEligible };
