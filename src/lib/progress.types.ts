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
  nextReviewStudyDay: number | null;
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

export type StudyDayCompletion = {
  studyDay: number;
  completedAt: string;
};

export type CurriculumAlignmentAudit = {
  originalStudyDay: number;
  adjustedStudyDay: number;
  adjustedAt: string;
  reason: string;
  section: string;
  firstSessionNewMuscleCap?: number;
};

export interface CourseProgress {
  version: 1;
  courseId: string;
  startedAt: string | null;
  currentStudyDay: number;
  introducedMuscleIds: string[];
  introductionDates: Record<string, string>;
  introductionStudyDays: Record<string, number>;
  recentGrades: Grade[];
  carriedOverRetryKeys: CardProgressKey[];
  completedStudyDays: number[];
  studyDayCompletions?: StudyDayCompletion[];
  deferredMuscleIds?: string[];
  curriculumAlignmentAudit?: CurriculumAlignmentAudit;
}

export interface CourseProgressStore {
  version: 1;
  courses: Record<string, CourseProgress>;
}
