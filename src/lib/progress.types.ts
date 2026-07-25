import type { CardCategory, CardProgressKey } from "@/src/lib/card-progress-key";

export type LearningState =
  | "new"
  | "learning"
  | "review"
  | "relearning"
  | "mastered";

export type Grade = "correct" | "partial" | "incorrect";

export interface CardProgress {
  key: CardProgressKey;
  muscleId: string;
  category: CardCategory;
  state: LearningState;
  totalAttempts: number;
  correctAttempts: number;
  partialAttempts: number;
  incorrectAttempts: number;
  successfulReviewCount: number;
  currentIntervalDays: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
}

export interface MasteryProgressStore {
  version: 1;
  cards: Record<CardProgressKey, CardProgress>;
}

export type CreateDefaultCardProgressInput = {
  key: CardProgressKey;
  muscleId: string;
  category: CardCategory;
};

export interface CourseProgress {
  version: 1;
  courseId: string;
  startedAt: string | null;
  introducedMuscleIds: string[];
  introductionDates: Record<string, string>;
  recentGrades: Grade[];
}

export interface CourseProgressStore {
  version: 1;
  courses: Record<string, CourseProgress>;
}
