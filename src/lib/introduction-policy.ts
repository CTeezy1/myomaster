import { myomasterProgramCourse } from "@/src/data/courses/myomaster-program-course";

export const COURSE_DAYS = 105;
export const COURSE_WEEKS = 15;
export const REVIEW_PERIOD_DAYS = 28;
export const REVIEW_WEEKS = REVIEW_PERIOD_DAYS / 7;
export const INTRODUCTION_PERIOD_DAYS = COURSE_DAYS - REVIEW_PERIOD_DAYS;
export const INTRODUCTION_WEEKS = COURSE_WEEKS - REVIEW_WEEKS;
export const OVERDUE_PROMPT_LIMIT = 40;
export const ACCURACY_THRESHOLD_PERCENT = 70;

export function buildWeeklyNewMuscleTargets(
  totalMuscles: number,
  introductionWeeks: number,
  courseWeeks: number,
): number[] {
  if (introductionWeeks <= 0 || totalMuscles <= 0) {
    return Array.from({ length: courseWeeks }, () => 0);
  }

  const weights = Array.from(
    { length: introductionWeeks },
    (_, index) => introductionWeeks - index,
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const introTargets = weights.map((weight) =>
    Math.floor((totalMuscles * weight) / totalWeight),
  );

  let remainder =
    totalMuscles - introTargets.reduce((sum, target) => sum + target, 0);

  for (let index = 0; index < introTargets.length && remainder > 0; index += 1) {
    introTargets[index] += 1;
    remainder -= 1;
  }

  const reviewWeeks = courseWeeks - introductionWeeks;

  return [...introTargets, ...Array.from({ length: reviewWeeks }, () => 0)];
}

export const WEEKLY_NEW_MUSCLE_TARGETS = buildWeeklyNewMuscleTargets(
  myomasterProgramCourse.muscleProfileIds.length,
  INTRODUCTION_WEEKS,
  COURSE_WEEKS,
);

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

  return WEEKLY_NEW_MUSCLE_TARGETS[weekNumber - 1] ?? 0;
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
