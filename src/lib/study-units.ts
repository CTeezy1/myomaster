import {
  buildCardProgressKey,
  type CardProgressKey,
} from "@/src/lib/card-progress-key";
import type { MasteryProgressStore } from "@/src/lib/progress.types";
import { isCardDue } from "@/src/lib/scheduling";

export type StudyUnit =
  | {
      type: "single";
      muscleId: string;
      cardKey: CardProgressKey;
      category: "action" | "innervation";
    }
  | {
      type: "attachment-pair";
      muscleId: string;
      originKey: CardProgressKey;
      insertionKey: CardProgressKey;
    };

function getCardDueStudyDay(
  progressStore: MasteryProgressStore,
  key: CardProgressKey,
): number | null {
  const progress = progressStore.cards[key];

  if (!progress) {
    return null;
  }

  return progress.nextReviewStudyDay;
}

function getEarlierDueStudyDay(
  firstDueStudyDay: number,
  secondDueStudyDay: number,
): number {
  return Math.min(firstDueStudyDay, secondDueStudyDay);
}

export function buildStudyUnitsForMuscle(profileId: string): StudyUnit[] {
  const originKey = buildCardProgressKey(profileId, "origin");
  const insertionKey = buildCardProgressKey(profileId, "insertion");
  const actionKey = buildCardProgressKey(profileId, "action");
  const innervationKey = buildCardProgressKey(profileId, "innervation");

  if (!originKey || !insertionKey || !actionKey || !innervationKey) {
    return [];
  }

  return [
    {
      type: "attachment-pair",
      muscleId: profileId,
      originKey,
      insertionKey,
    },
    {
      type: "single",
      muscleId: profileId,
      cardKey: actionKey,
      category: "action",
    },
    {
      type: "single",
      muscleId: profileId,
      cardKey: innervationKey,
      category: "innervation",
    },
  ];
}

export function getStudyUnitCardKeys(unit: StudyUnit): CardProgressKey[] {
  if (unit.type === "single") {
    return [unit.cardKey];
  }

  return [unit.originKey, unit.insertionKey];
}

export function getStudyUnitDueStudyDay(
  unit: StudyUnit,
  progressStore: MasteryProgressStore,
): number | null {
  if (unit.type === "single") {
    return getCardDueStudyDay(progressStore, unit.cardKey);
  }

  const originDueStudyDay = getCardDueStudyDay(progressStore, unit.originKey);
  const insertionDueStudyDay = getCardDueStudyDay(
    progressStore,
    unit.insertionKey,
  );

  if (originDueStudyDay === null || insertionDueStudyDay === null) {
    return null;
  }

  return getEarlierDueStudyDay(originDueStudyDay, insertionDueStudyDay);
}

/** @deprecated Use getStudyUnitDueStudyDay for scheduling. Kept for history display. */
export function getStudyUnitDueDate(
  unit: StudyUnit,
  progressStore: MasteryProgressStore,
): string | null {
  if (unit.type === "single") {
    const progress = progressStore.cards[unit.cardKey];
    return progress?.nextReviewAt ?? null;
  }

  const originDueDate = progressStore.cards[unit.originKey]?.nextReviewAt;
  const insertionDueDate = progressStore.cards[unit.insertionKey]?.nextReviewAt;

  if (!originDueDate || !insertionDueDate) {
    return null;
  }

  const originDueAt = Date.parse(originDueDate);
  const insertionDueAt = Date.parse(insertionDueDate);

  if (Number.isNaN(originDueAt) || Number.isNaN(insertionDueAt)) {
    return null;
  }

  return originDueAt <= insertionDueAt ? originDueDate : insertionDueDate;
}

export function isStudyUnitDue(
  unit: StudyUnit,
  progressStore: MasteryProgressStore,
  currentStudyDay: number,
): boolean {
  if (unit.type === "single") {
    const progress = progressStore.cards[unit.cardKey];

    if (!progress) {
      return false;
    }

    return isCardDue(progress, currentStudyDay);
  }

  const originProgress = progressStore.cards[unit.originKey];
  const insertionProgress = progressStore.cards[unit.insertionKey];

  if (!originProgress || !insertionProgress) {
    return false;
  }

  return (
    isCardDue(originProgress, currentStudyDay) ||
    isCardDue(insertionProgress, currentStudyDay)
  );
}
