import { COURSE_DAYS } from "@/src/lib/introduction-policy";
import type {
  CourseProgress,
  CourseProgressStore,
  Grade,
} from "@/src/lib/progress.types";

export const COURSE_PROGRESS_STORAGE_KEY = "myomaster-course-progress";
export const MAX_RECENT_GRADES = 20;

const STORE_VERSION = 1 as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const GRADES = ["correct", "partial", "incorrect"] as const satisfies readonly Grade[];

const GRADE_SET = new Set<string>(GRADES);

function createEmptyStore(): CourseProgressStore {
  return {
    version: STORE_VERSION,
    courses: {},
  };
}

function toIsoString(date: Date): string {
  return date.toISOString();
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isNullableIsoTimestamp(value: unknown): value is string | null {
  if (value === null) {
    return true;
  }

  return isIsoTimestamp(value);
}

function isGrade(value: unknown): value is Grade {
  return typeof value === "string" && GRADE_SET.has(value);
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const trimmed = item.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function parseIntroductionDates(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const dates: Record<string, string> = {};

  for (const [muscleId, timestamp] of Object.entries(value)) {
    const normalizedMuscleId = muscleId.trim();

    if (!normalizedMuscleId || !isIsoTimestamp(timestamp)) {
      continue;
    }

    dates[normalizedMuscleId] = timestamp;
  }

  return dates;
}

function parseRecentGrades(value: unknown): Grade[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isGrade).slice(-MAX_RECENT_GRADES);
}

function parseCourseProgress(value: unknown): CourseProgress | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (record.version !== STORE_VERSION) {
    return null;
  }

  const courseId =
    typeof record.courseId === "string" ? record.courseId.trim() : "";

  if (!courseId) {
    return null;
  }

  if (!isNullableIsoTimestamp(record.startedAt)) {
    return null;
  }

  const introducedMuscleIds = parseStringArray(record.introducedMuscleIds);
  const introductionDates = parseIntroductionDates(record.introductionDates);
  const recentGrades = parseRecentGrades(record.recentGrades);

  const filteredIntroductionDates: Record<string, string> = {};

  for (const muscleId of introducedMuscleIds) {
    if (introductionDates[muscleId]) {
      filteredIntroductionDates[muscleId] = introductionDates[muscleId];
    }
  }

  return {
    version: STORE_VERSION,
    courseId,
    startedAt: record.startedAt,
    introducedMuscleIds,
    introductionDates: filteredIntroductionDates,
    recentGrades,
  };
}

function parseCourseProgressStore(value: unknown): CourseProgressStore {
  if (!value || typeof value !== "object") {
    return createEmptyStore();
  }

  const record = value as Record<string, unknown>;

  if (record.version !== STORE_VERSION) {
    return createEmptyStore();
  }

  if (!record.courses || typeof record.courses !== "object") {
    return createEmptyStore();
  }

  const courses: Record<string, CourseProgress> = {};

  for (const [rawCourseId, rawProgress] of Object.entries(record.courses)) {
    const progress = parseCourseProgress(rawProgress);

    if (!progress || progress.courseId !== rawCourseId) {
      continue;
    }

    courses[rawCourseId] = progress;
  }

  return {
    version: STORE_VERSION,
    courses,
  };
}

function readStore(): CourseProgressStore {
  if (typeof window === "undefined") {
    return createEmptyStore();
  }

  try {
    const raw = window.localStorage.getItem(COURSE_PROGRESS_STORAGE_KEY);

    if (!raw) {
      return createEmptyStore();
    }

    return parseCourseProgressStore(JSON.parse(raw));
  } catch {
    return createEmptyStore();
  }
}

function writeStore(store: CourseProgressStore) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    COURSE_PROGRESS_STORAGE_KEY,
    JSON.stringify(parseCourseProgressStore(store)),
  );
}

function writeCourseProgress(progress: CourseProgress) {
  const validated = parseCourseProgress(progress);

  if (!validated) {
    return;
  }

  const store = readStore();

  store.courses[validated.courseId] = validated;
  writeStore(store);
}

function getCourseWeek(courseDay: number): number {
  return Math.floor((courseDay - 1) / 7) + 1;
}

function gradeScore(grade: Grade): number {
  switch (grade) {
    case "correct":
      return 1;
    case "partial":
      return 0.5;
    case "incorrect":
      return 0;
  }
}

export function createDefaultCourseProgress(courseId: string): CourseProgress {
  return {
    version: STORE_VERSION,
    courseId,
    startedAt: null,
    introducedMuscleIds: [],
    introductionDates: {},
    recentGrades: [],
  };
}

export function readCourseProgressStore(): CourseProgressStore {
  return readStore();
}

export function writeCourseProgressStore(store: CourseProgressStore) {
  writeStore(parseCourseProgressStore(store));
}

export function clearCourseProgress() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(COURSE_PROGRESS_STORAGE_KEY);
}

export function getCourseProgress(courseId: string): CourseProgress {
  const progress = readStore().courses[courseId];

  return progress ?? createDefaultCourseProgress(courseId);
}

export function startCourseIfNotStarted(
  courseId: string,
  now: Date,
): CourseProgress {
  const progress = getCourseProgress(courseId);

  if (progress.startedAt) {
    return progress;
  }

  const started: CourseProgress = {
    ...progress,
    startedAt: toIsoString(now),
  };

  writeCourseProgress(started);

  return started;
}

export function getCourseDay(startedAt: string | null, now: Date): number | null {
  if (!startedAt) {
    return null;
  }

  const startedAtMs = Date.parse(startedAt);

  if (Number.isNaN(startedAtMs)) {
    return null;
  }

  const elapsedDays = Math.floor((now.getTime() - startedAtMs) / MS_PER_DAY);

  return Math.min(COURSE_DAYS, Math.max(1, elapsedDays + 1));
}

export function markMuscleIntroduced(
  courseId: string,
  muscleId: string,
  now: Date,
): CourseProgress {
  const normalizedMuscleId = muscleId.trim();

  if (!normalizedMuscleId) {
    return getCourseProgress(courseId);
  }

  const progress = getCourseProgress(courseId);

  if (progress.introducedMuscleIds.includes(normalizedMuscleId)) {
    return progress;
  }

  const updated: CourseProgress = {
    ...progress,
    introducedMuscleIds: [...progress.introducedMuscleIds, normalizedMuscleId],
    introductionDates: {
      ...progress.introductionDates,
      [normalizedMuscleId]: toIsoString(now),
    },
  };

  writeCourseProgress(updated);

  return updated;
}

export function countMusclesIntroducedDuringCurrentCourseWeek(
  progress: CourseProgress,
  now: Date,
): number {
  if (!progress.startedAt) {
    return 0;
  }

  const courseDay = getCourseDay(progress.startedAt, now);

  if (courseDay === null) {
    return 0;
  }

  const currentWeek = getCourseWeek(courseDay);
  const weekStartDay = (currentWeek - 1) * 7 + 1;
  const weekEndDay = currentWeek * 7;

  return progress.introducedMuscleIds.filter((muscleId) => {
    const introducedAt = progress.introductionDates[muscleId];

    if (!introducedAt) {
      return false;
    }

    const introductionCourseDay = getCourseDay(progress.startedAt, new Date(introducedAt));

    if (introductionCourseDay === null) {
      return false;
    }

    return (
      introductionCourseDay >= weekStartDay &&
      introductionCourseDay <= weekEndDay
    );
  }).length;
}

export function addRecentGrade(courseId: string, grade: Grade): CourseProgress {
  if (!isGrade(grade)) {
    return getCourseProgress(courseId);
  }

  const progress = getCourseProgress(courseId);
  const recentGrades = [...progress.recentGrades, grade].slice(-MAX_RECENT_GRADES);
  const updated: CourseProgress = {
    ...progress,
    recentGrades,
  };

  writeCourseProgress(updated);

  return updated;
}

export function calculateRecentAccuracy(
  recentGrades: Grade[],
): number | null {
  if (recentGrades.length === 0) {
    return null;
  }

  const totalScore = recentGrades.reduce(
    (sum, grade) => sum + gradeScore(grade),
    0,
  );

  return (totalScore / recentGrades.length) * 100;
}

export function getRecentAccuracyForCourse(courseId: string): number | null {
  return calculateRecentAccuracy(getCourseProgress(courseId).recentGrades);
}
