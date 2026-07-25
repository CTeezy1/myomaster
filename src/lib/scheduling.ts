import type { CardProgress, Grade, LearningState } from "@/src/lib/progress.types";

export const INTERVAL_LADDER = [1, 3, 7, 14, 30, 60] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

function toIsoString(date: Date): string {
  return date.toISOString();
}

function getIntervalForSuccessfulReviewCount(count: number): number {
  if (count <= 0) {
    return 0;
  }

  const index = Math.min(count, INTERVAL_LADDER.length) - 1;

  return INTERVAL_LADDER[index];
}

function resolveStateAfterCorrect(
  intervalBeforeReview: number,
  nextIntervalDays: number,
): LearningState {
  if (intervalBeforeReview >= 14) {
    return "mastered";
  }

  if (nextIntervalDays >= 14) {
    return "review";
  }

  return "learning";
}

function resolveStateAfterPartial(previousState: LearningState): LearningState {
  if (
    previousState === "review" ||
    previousState === "relearning" ||
    previousState === "mastered"
  ) {
    return "relearning";
  }

  return "learning";
}

function applyCorrect(
  progress: CardProgress,
  reviewedAt: Date,
): CardProgress {
  const intervalBeforeReview = progress.currentIntervalDays;
  const successfulReviewCount = progress.successfulReviewCount + 1;
  const nextIntervalDays = getIntervalForSuccessfulReviewCount(
    successfulReviewCount,
  );
  const nextState = resolveStateAfterCorrect(
    intervalBeforeReview,
    nextIntervalDays,
  );

  return {
    ...progress,
    state: nextState,
    totalAttempts: progress.totalAttempts + 1,
    correctAttempts: progress.correctAttempts + 1,
    successfulReviewCount,
    currentIntervalDays: nextIntervalDays,
    lastReviewedAt: toIsoString(reviewedAt),
    nextReviewAt: toIsoString(addDays(reviewedAt, nextIntervalDays)),
  };
}

function applyPartial(
  progress: CardProgress,
  reviewedAt: Date,
): CardProgress {
  const baseInterval = Math.max(progress.currentIntervalDays, 1);
  const nextIntervalDays = Math.max(1, Math.floor(baseInterval / 2));

  return {
    ...progress,
    state: resolveStateAfterPartial(progress.state),
    totalAttempts: progress.totalAttempts + 1,
    partialAttempts: progress.partialAttempts + 1,
    currentIntervalDays: nextIntervalDays,
    lastReviewedAt: toIsoString(reviewedAt),
    nextReviewAt: toIsoString(addDays(reviewedAt, nextIntervalDays)),
  };
}

function applyIncorrect(
  progress: CardProgress,
  reviewedAt: Date,
): CardProgress {
  const nextIntervalDays = 1;

  return {
    ...progress,
    state: "relearning",
    totalAttempts: progress.totalAttempts + 1,
    incorrectAttempts: progress.incorrectAttempts + 1,
    currentIntervalDays: nextIntervalDays,
    lastReviewedAt: toIsoString(reviewedAt),
    nextReviewAt: toIsoString(addDays(reviewedAt, nextIntervalDays)),
  };
}

export function applyGradeToProgress(
  progress: CardProgress,
  grade: Grade,
  reviewedAt: Date,
): CardProgress {
  switch (grade) {
    case "correct":
      return applyCorrect(progress, reviewedAt);
    case "partial":
      return applyPartial(progress, reviewedAt);
    case "incorrect":
      return applyIncorrect(progress, reviewedAt);
  }
}

export function isCardDue(progress: CardProgress, now: Date): boolean {
  if (!progress.nextReviewAt) {
    return true;
  }

  const dueAt = Date.parse(progress.nextReviewAt);

  if (Number.isNaN(dueAt)) {
    return true;
  }

  return now.getTime() >= dueAt;
}

export function isCardMastered(progress: CardProgress): boolean {
  return progress.state === "mastered";
}

export function getDaysUntilDue(
  progress: CardProgress,
  now: Date,
): number | null {
  if (!progress.nextReviewAt) {
    return null;
  }

  const dueAt = Date.parse(progress.nextReviewAt);

  if (Number.isNaN(dueAt)) {
    return null;
  }

  const diffMs = dueAt - now.getTime();

  return Math.max(0, Math.ceil(diffMs / MS_PER_DAY));
}
