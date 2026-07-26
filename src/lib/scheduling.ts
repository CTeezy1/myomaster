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

function resolveNextReviewStudyDay(
  currentStudyDay: number,
  intervalDays: number,
): number {
  return currentStudyDay + intervalDays;
}

function applyCorrect(
  progress: CardProgress,
  reviewedAt: Date,
  currentStudyDay: number,
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
    nextReviewStudyDay: resolveNextReviewStudyDay(
      currentStudyDay,
      nextIntervalDays,
    ),
  };
}

function applyPartial(
  progress: CardProgress,
  reviewedAt: Date,
): CardProgress {
  return {
    ...progress,
    totalAttempts: progress.totalAttempts + 1,
    partialAttempts: progress.partialAttempts + 1,
    lastReviewedAt: toIsoString(reviewedAt),
  };
}

function applyIncorrect(
  progress: CardProgress,
  reviewedAt: Date,
  currentStudyDay: number,
): CardProgress {
  const successfulReviewCount = Math.max(0, progress.successfulReviewCount - 2);
  const nextIntervalDays = Math.max(
    1,
    getIntervalForSuccessfulReviewCount(successfulReviewCount),
  );

  return {
    ...progress,
    state: "relearning",
    totalAttempts: progress.totalAttempts + 1,
    incorrectAttempts: progress.incorrectAttempts + 1,
    successfulReviewCount,
    currentIntervalDays: nextIntervalDays,
    lastReviewedAt: toIsoString(reviewedAt),
    nextReviewAt: toIsoString(addDays(reviewedAt, nextIntervalDays)),
    nextReviewStudyDay: resolveNextReviewStudyDay(
      currentStudyDay,
      nextIntervalDays,
    ),
  };
}

export function applyGradeToProgress(
  progress: CardProgress,
  grade: Grade,
  reviewedAt: Date,
  currentStudyDay: number,
): CardProgress {
  switch (grade) {
    case "correct":
      return applyCorrect(progress, reviewedAt, currentStudyDay);
    case "partial":
      return applyPartial(progress, reviewedAt);
    case "incorrect":
      return applyIncorrect(progress, reviewedAt, currentStudyDay);
  }
}

export function applyPracticeCorrect(
  progress: CardProgress,
  reviewedAt: Date,
): CardProgress {
  return {
    ...progress,
    totalAttempts: progress.totalAttempts + 1,
    correctAttempts: progress.correctAttempts + 1,
    lastReviewedAt: toIsoString(reviewedAt),
  };
}

export function applyPracticePartial(
  progress: CardProgress,
  reviewedAt: Date,
): CardProgress {
  return applyPartial(progress, reviewedAt);
}

export function isCardDue(
  progress: CardProgress,
  currentStudyDay: number,
): boolean {
  if (progress.nextReviewStudyDay === null) {
    return true;
  }

  return currentStudyDay >= progress.nextReviewStudyDay;
}

export function isCardMastered(progress: CardProgress): boolean {
  return progress.state === "mastered";
}

export function getDaysUntilDue(
  progress: CardProgress,
  currentStudyDay: number,
): number | null {
  if (progress.nextReviewStudyDay === null) {
    return null;
  }

  return Math.max(0, progress.nextReviewStudyDay - currentStudyDay);
}
