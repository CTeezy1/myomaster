import type { Course } from "@/src/lib/course.types";
import {
  calculateRecentAccuracy,
  countMusclesIntroducedDuringCurrentCourseWeek,
  getCurrentStudyDay,
  isCurrentStudyDayCompleted,
} from "@/src/lib/course-progress";
import { CARD_CATEGORIES, buildCardProgressKey } from "@/src/lib/card-progress-key";
import { getDueReviewPromptCount } from "@/src/lib/dashboard-progress";
import { getDailyNewMuscleTarget } from "@/src/lib/introduction-policy";
import type { CourseProgress, MasteryProgressStore } from "@/src/lib/progress.types";
import { applyAdaptiveNewMuscleAllowance } from "@/src/lib/daily-workload-planning";

export function countMusclesIntroducedOnCourseDay(
  progress: CourseProgress,
  courseDay: number,
): number {
  return progress.introducedMuscleIds.filter(
    (muscleId) => progress.introductionStudyDays[muscleId] === courseDay,
  ).length;
}

export function getBaseDailyNewMuscleAllowance(
  courseProgress: CourseProgress,
  muscleIds: string[],
  masteryStore: MasteryProgressStore,
): number {
  const courseDay = getCurrentStudyDay(courseProgress);
  const introducedThisWeek =
    countMusclesIntroducedDuringCurrentCourseWeek(courseProgress);
  const overduePromptCount = getDueReviewPromptCount(
    muscleIds,
    masteryStore,
    courseDay,
  );
  const recentAccuracy = calculateRecentAccuracy(courseProgress.recentGrades);
  const dailyTarget = getDailyNewMuscleTarget(
    courseDay,
    introducedThisWeek,
    overduePromptCount,
    recentAccuracy,
  );
  const introducedToday = countMusclesIntroducedOnCourseDay(
    courseProgress,
    courseDay,
  );
  const remaining = Math.max(0, dailyTarget - introducedToday);
  const alignedRemaining =
    getFirstAlignedSessionRemainingNewMuscles(courseProgress);

  if (alignedRemaining === null) {
    return remaining;
  }

  return Math.min(remaining, alignedRemaining);
}

export function getFirstAlignedSessionRemainingNewMuscles(
  progress: CourseProgress,
): number | null {
  const audit = progress.curriculumAlignmentAudit;
  const cap = audit?.firstSessionNewMuscleCap;

  if (
    !audit ||
    typeof cap !== "number" ||
    !Number.isInteger(cap) ||
    cap < 1 ||
    getCurrentStudyDay(progress) !== audit.adjustedStudyDay
  ) {
    return null;
  }

  const used = progress.introducedMuscleIds.filter((muscleId) => {
    if (progress.introductionStudyDays[muscleId] !== audit.adjustedStudyDay) {
      return false;
    }

    const introducedAt = progress.introductionDates[muscleId];
    return !introducedAt || introducedAt >= audit.adjustedAt;
  }).length;

  return Math.max(0, cap - used);
}

export function getGuidedDailyNewMuscleAllowance(
  courseProgress: CourseProgress,
  muscleIds: string[],
  masteryStore: MasteryProgressStore,
): number {
  const mandatoryPromptCount = getDueReviewPromptCount(
    muscleIds,
    masteryStore,
    getCurrentStudyDay(courseProgress),
  );
  const baseAllowance = getBaseDailyNewMuscleAllowance(
    courseProgress,
    muscleIds,
    masteryStore,
  );

  return applyAdaptiveNewMuscleAllowance(baseAllowance, mandatoryPromptCount);
}

export function isMuscleGuidedComplete(
  muscleId: string,
  masteryStore: MasteryProgressStore,
): boolean {
  return CARD_CATEGORIES.every((category) => {
    const key = buildCardProgressKey(muscleId, category);

    if (!key) {
      return false;
    }

    const progress = masteryStore.cards[key];

    return progress !== undefined && progress.totalAttempts > 0;
  });
}

export function hasIncompleteGuidedMuscle(
  course: Course,
  courseProgress: CourseProgress,
  masteryStore: MasteryProgressStore,
): boolean {
  return course.muscleProfileIds.some(
    (muscleId) =>
      courseProgress.introducedMuscleIds.includes(muscleId) &&
      !isMuscleGuidedComplete(muscleId, masteryStore),
  );
}

export function findNextGuidedMuscleIndex(
  course: Course,
  courseProgress: CourseProgress,
  masteryStore: MasteryProgressStore,
  remainingNewAllowance: number,
): { index: number; isNew: boolean } | null {
  for (let index = 0; index < course.muscleProfileIds.length; index += 1) {
    const muscleId = course.muscleProfileIds[index];

    if (
      courseProgress.introducedMuscleIds.includes(muscleId) &&
      !isMuscleGuidedComplete(muscleId, masteryStore)
    ) {
      return { index, isNew: false };
    }
  }

  if (remainingNewAllowance <= 0) {
    return null;
  }

  const deferred = new Set(courseProgress.deferredMuscleIds ?? []);

  for (let index = 0; index < course.muscleProfileIds.length; index += 1) {
    const muscleId = course.muscleProfileIds[index];

    if (
      !courseProgress.introducedMuscleIds.includes(muscleId) &&
      !deferred.has(muscleId)
    ) {
      return { index, isNew: true };
    }
  }

  for (let index = 0; index < course.muscleProfileIds.length; index += 1) {
    const muscleId = course.muscleProfileIds[index];

    if (
      !courseProgress.introducedMuscleIds.includes(muscleId) &&
      deferred.has(muscleId)
    ) {
      return { index, isNew: true };
    }
  }

  return null;
}

export function getGuidedStudyButtonLabel(
  nextMuscle: { index: number; isNew: boolean } | null,
): string {
  if (!nextMuscle) {
    return "No New Muscles Today";
  }

  if (!nextMuscle.isNew) {
    return "Continue Studying";
  }

  return "Start Studying";
}

export function canAdvanceStudyDay(
  courseProgress: CourseProgress,
  _muscleIds: string[],
  _masteryStore: MasteryProgressStore,
): boolean {
  return isCurrentStudyDayCompleted(courseProgress);
}
