import {
  buildCardProgressKey,
  type CardProgressKey,
} from "@/src/lib/card-progress-key";
import type { MasteryProgressStore } from "@/src/lib/progress.types";

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

function getCardDueDate(
  progressStore: MasteryProgressStore,
  key: CardProgressKey,
): string | null {
  const progress = progressStore.cards[key];

  if (!progress?.nextReviewAt) {
    return null;
  }

  return progress.nextReviewAt;
}

function getEarlierDueDate(
  firstDueDate: string,
  secondDueDate: string,
): string | null {
  const firstDueAt = Date.parse(firstDueDate);
  const secondDueAt = Date.parse(secondDueDate);

  if (Number.isNaN(firstDueAt) || Number.isNaN(secondDueAt)) {
    return null;
  }

  return firstDueAt <= secondDueAt ? firstDueDate : secondDueDate;
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

export function getStudyUnitDueDate(
  unit: StudyUnit,
  progressStore: MasteryProgressStore,
): string | null {
  if (unit.type === "single") {
    return getCardDueDate(progressStore, unit.cardKey);
  }

  const originDueDate = getCardDueDate(progressStore, unit.originKey);
  const insertionDueDate = getCardDueDate(progressStore, unit.insertionKey);

  if (!originDueDate || !insertionDueDate) {
    return null;
  }

  return getEarlierDueDate(originDueDate, insertionDueDate);
}

export function isStudyUnitDue(
  unit: StudyUnit,
  progressStore: MasteryProgressStore,
  now: Date,
): boolean {
  const dueDate = getStudyUnitDueDate(unit, progressStore);

  if (!dueDate) {
    return true;
  }

  const dueAt = Date.parse(dueDate);

  if (Number.isNaN(dueAt)) {
    return true;
  }

  return now.getTime() >= dueAt;
}
