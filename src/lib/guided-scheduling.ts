import type { Course } from "@/src/lib/course.types";
import {
  calculateRecentAccuracy,
  countMusclesIntroducedDuringCurrentCourseWeek,
  getCourseDay,
} from "@/src/lib/course-progress";
import { CARD_CATEGORIES, buildCardProgressKey } from "@/src/lib/card-progress-key";
import { getDueReviewPromptCount } from "@/src/lib/dashboard-progress";
import { getDailyNewMuscleTarget } from "@/src/lib/introduction-policy";
import type { CourseProgress, MasteryProgressStore } from "@/src/lib/progress.types";

export function countMusclesIntroducedOnCourseDay(
  progress: CourseProgress,
  courseDay: number,
  now: Date,
): number {
  if (!progress.startedAt) {
    return 0;
  }

  return progress.introducedMuscleIds.filter((muscleId) => {
    const introducedAt = progress.introductionDates[muscleId];

    if (!introducedAt) {
      return false;
    }

    return getCourseDay(progress.startedAt, new Date(introducedAt)) === courseDay;
  }).length;
}

export function getGuidedDailyNewMuscleAllowance(
  courseProgress: CourseProgress,
  muscleIds: string[],
  masteryStore: MasteryProgressStore,
  now: Date,
): number {
  const courseDay = courseProgress.startedAt
    ? getCourseDay(courseProgress.startedAt, now)
    : 1;

  if (courseDay === null) {
    return 0;
  }

  const introducedThisWeek = courseProgress.startedAt
    ? countMusclesIntroducedDuringCurrentCourseWeek(courseProgress, now)
    : 0;
  const overduePromptCount = getDueReviewPromptCount(
    muscleIds,
    masteryStore,
    now,
  );
  const recentAccuracy = calculateRecentAccuracy(courseProgress.recentGrades);
  const dailyTarget = getDailyNewMuscleTarget(
    courseDay,
    introducedThisWeek,
    overduePromptCount,
    recentAccuracy,
  );
  const introducedToday = courseProgress.startedAt
    ? countMusclesIntroducedOnCourseDay(courseProgress, courseDay, now)
    : 0;

  return Math.max(0, dailyTarget - introducedToday);
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

  for (let index = 0; index < course.muscleProfileIds.length; index += 1) {
    const muscleId = course.muscleProfileIds[index];

    if (!courseProgress.introducedMuscleIds.includes(muscleId)) {
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
