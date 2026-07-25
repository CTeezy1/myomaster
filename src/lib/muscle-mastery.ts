import {
  buildCardProgressKey,
  CARD_CATEGORIES,
} from "@/src/lib/card-progress-key";
import type {
  CardProgress,
  LearningState,
  MasteryProgressStore,
} from "@/src/lib/progress.types";

export type MuscleMasteryState =
  | "not-started"
  | "learning"
  | "review"
  | "mastered";

function getMuscleCardProgress(
  muscleId: string,
  store: MasteryProgressStore,
): (CardProgress | undefined)[] {
  return CARD_CATEGORIES.map((category) => {
    const key = buildCardProgressKey(muscleId, category);

    if (!key) {
      return undefined;
    }

    return store.cards[key];
  });
}

function hasAnyCardProgress(
  progressEntries: (CardProgress | undefined)[],
): boolean {
  return progressEntries.some((progress) => progress !== undefined);
}

function hasAllCardProgress(
  progressEntries: (CardProgress | undefined)[],
): progressEntries is CardProgress[] {
  return progressEntries.every((progress) => progress !== undefined);
}

function isMasteredState(state: LearningState): boolean {
  return state === "mastered";
}

function isReviewOrMasteredState(state: LearningState): boolean {
  return state === "review" || state === "mastered";
}

function scoreForLearningState(state: LearningState | undefined): number {
  if (!state) {
    return 0;
  }

  switch (state) {
    case "mastered":
      return 100;
    case "review":
      return 75;
    case "learning":
    case "relearning":
      return 40;
    case "new":
      return 0;
  }
}

export function getMuscleMasteryState(
  muscleId: string,
  store: MasteryProgressStore,
): MuscleMasteryState {
  const progressEntries = getMuscleCardProgress(muscleId, store);

  if (!hasAnyCardProgress(progressEntries)) {
    return "not-started";
  }

  if (
    hasAllCardProgress(progressEntries) &&
    progressEntries.every((progress) => isMasteredState(progress.state))
  ) {
    return "mastered";
  }

  if (
    hasAllCardProgress(progressEntries) &&
    progressEntries.some((progress) => isReviewOrMasteredState(progress.state))
  ) {
    return "review";
  }

  return "learning";
}

export function getMuscleMasteryPercent(
  muscleId: string,
  store: MasteryProgressStore,
): number {
  const progressEntries = getMuscleCardProgress(muscleId, store);
  const totalScore = progressEntries.reduce(
    (sum, progress) => sum + scoreForLearningState(progress?.state),
    0,
  );

  return totalScore / CARD_CATEGORIES.length;
}
