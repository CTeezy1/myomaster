export const WEEKLY_NEW_MUSCLE_TARGETS = [
  14, 14, 10, 10, 8, 8, 6, 6, 5, 4, 3, 0, 0, 0, 0,
] as const;

export const COURSE_DAYS = 105;
export const COURSE_WEEKS = 15;
export const OVERDUE_PROMPT_LIMIT = 40;
export const ACCURACY_THRESHOLD_PERCENT = 70;

function sanitizeNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function getWeekNumberFromCourseDay(courseDay: number): number | null {
  if (!Number.isInteger(courseDay) || courseDay < 1 || courseDay > COURSE_DAYS) {
    return null;
  }

  return Math.floor((courseDay - 1) / 7) + 1;
}

function getDayInWeek(courseDay: number): number {
  return ((courseDay - 1) % 7) + 1;
}

function shouldReduceForAccuracy(
  recentAccuracyPercent: number | null,
): boolean {
  if (recentAccuracyPercent === null || !Number.isFinite(recentAccuracyPercent)) {
    return false;
  }

  if (recentAccuracyPercent < 0 || recentAccuracyPercent > 100) {
    return false;
  }

  return recentAccuracyPercent < ACCURACY_THRESHOLD_PERCENT;
}

export function getWeeklyNewMuscleTarget(weekNumber: number): number {
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > COURSE_WEEKS) {
    return 0;
  }

  return WEEKLY_NEW_MUSCLE_TARGETS[weekNumber - 1];
}

export function getDailyNewMuscleTarget(
  courseDay: number,
  introducedThisWeek: number,
  overduePromptCount: number,
  recentAccuracyPercent: number | null,
): number {
  const weekNumber = getWeekNumberFromCourseDay(courseDay);

  if (weekNumber === null) {
    return 0;
  }

  const weeklyTarget = getWeeklyNewMuscleTarget(weekNumber);

  if (weeklyTarget === 0) {
    return 0;
  }

  const overduePrompts = sanitizeNonNegativeInteger(overduePromptCount);

  if (overduePrompts > OVERDUE_PROMPT_LIMIT) {
    return 0;
  }

  const introducedCount = sanitizeNonNegativeInteger(introducedThisWeek);
  const remainingWeeklyTarget = weeklyTarget - introducedCount;

  if (remainingWeeklyTarget <= 0) {
    return 0;
  }

  const dayInWeek = getDayInWeek(courseDay);
  const remainingDaysInWeek = 7 - dayInWeek + 1;
  let dailyTarget = Math.ceil(remainingWeeklyTarget / remainingDaysInWeek);

  if (shouldReduceForAccuracy(recentAccuracyPercent)) {
    dailyTarget = Math.floor(dailyTarget * 0.5);
  }

  return Math.min(Math.max(0, dailyTarget), remainingWeeklyTarget);
}
