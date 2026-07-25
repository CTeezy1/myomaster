import {
  buildCardProgressKey,
  CARD_CATEGORIES,
  type CardCategory,
  type CardProgressKey,
} from "@/src/lib/card-progress-key";
import { createDefaultCardProgress } from "@/src/lib/mastery-progress";
import type {
  Grade,
  MasteryProgressStore,
} from "@/src/lib/progress.types";
import { applyGradeToProgress } from "@/src/lib/scheduling";

function getOrCreateCardProgress(
  store: MasteryProgressStore,
  muscleId: string,
  category: CardCategory,
): { key: CardProgressKey; progress: ReturnType<typeof createDefaultCardProgress> } | null {
  const key = buildCardProgressKey(muscleId, category);

  if (!key) {
    return null;
  }

  const existing = store.cards[key];

  if (existing) {
    return { key, progress: existing };
  }

  return {
    key,
    progress: createDefaultCardProgress({
      key,
      muscleId,
      category,
    }),
  };
}

export function introduceMuscleCards(
  store: MasteryProgressStore,
  muscleId: string,
): MasteryProgressStore {
  const normalizedMuscleId = muscleId.trim();

  if (!normalizedMuscleId) {
    return store;
  }

  const cards = { ...store.cards };

  for (const category of CARD_CATEGORIES) {
    const key = buildCardProgressKey(normalizedMuscleId, category);

    if (!key || cards[key]) {
      continue;
    }

    cards[key] = createDefaultCardProgress({
      key,
      muscleId: normalizedMuscleId,
      category,
    });
  }

  return {
    ...store,
    cards,
  };
}

export function applyCardGrade(
  store: MasteryProgressStore,
  muscleId: string,
  category: CardCategory,
  grade: Grade,
  reviewedAt: Date,
): MasteryProgressStore {
  const entry = getOrCreateCardProgress(store, muscleId, category);

  if (!entry) {
    return store;
  }

  const updatedProgress = applyGradeToProgress(
    entry.progress,
    grade,
    reviewedAt,
  );

  return {
    ...store,
    cards: {
      ...store.cards,
      [entry.key]: updatedProgress,
    },
  };
}
