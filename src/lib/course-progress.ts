import { COURSE_DAYS } from "@/src/lib/introduction-policy";
import {
  DEFAULT_COURSE_ID,
  LEGACY_CERVICAL_COURSE_ID,
} from "@/src/config/study-flow";
import type {
  CardProgressKey,
} from "@/src/lib/card-progress-key";
import {
  courseProgressNeedsMuscleIdMigration,
  migrateCourseProgress,
} from "@/src/lib/muscle-id-migration";
import { notifyProgressChanged } from "@/src/lib/progress/progress-sync";
import type {
  CourseProgress,
  CourseProgressStore,
  Grade,
  StudyDayCompletion,
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

function parseIntroductionStudyDays(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const studyDays: Record<string, number> = {};

  for (const [muscleId, studyDay] of Object.entries(value)) {
    const normalizedMuscleId = muscleId.trim();

    if (
      !normalizedMuscleId ||
      typeof studyDay !== "number" ||
      !Number.isInteger(studyDay) ||
      studyDay < 1
    ) {
      continue;
    }

    studyDays[normalizedMuscleId] = studyDay;
  }

  return studyDays;
}

function clampStudyDay(studyDay: number): number {
  if (!Number.isInteger(studyDay) || studyDay < 1) {
    return 1;
  }

  return studyDay;
}

function parseCurrentStudyDay(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return 1;
  }

  return clampStudyDay(value);
}

function parseRecentGrades(value: unknown): Grade[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isGrade).slice(-MAX_RECENT_GRADES);
}

function parseCompletedStudyDays(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<number>();
  const studyDays: number[] = [];

  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isInteger(entry)) {
      continue;
    }

    const studyDay = clampStudyDay(entry);

    if (seen.has(studyDay)) {
      continue;
    }

    seen.add(studyDay);
    studyDays.push(studyDay);
  }

  return studyDays.sort((left, right) => left - right);
}

function parseStudyDayCompletions(value: unknown): StudyDayCompletion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const completions: StudyDayCompletion[] = [];
  const seenStudyDays = new Set<number>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;

    if (typeof record.studyDay !== "number" || !Number.isInteger(record.studyDay)) {
      continue;
    }

    const studyDay = clampStudyDay(record.studyDay);

    if (seenStudyDays.has(studyDay) || !isIsoTimestamp(record.completedAt)) {
      continue;
    }

    seenStudyDays.add(studyDay);
    completions.push({
      studyDay,
      completedAt: record.completedAt,
    });
  }

  return completions;
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
  const introductionStudyDays = parseIntroductionStudyDays(
    record.introductionStudyDays,
  );
  const recentGrades = parseRecentGrades(record.recentGrades);
  const currentStudyDay = parseCurrentStudyDay(record.currentStudyDay);
  const carriedOverRetryKeys = parseStringArray(
    record.carriedOverRetryKeys,
  ) as CardProgressKey[];
  const completedStudyDays = parseCompletedStudyDays(record.completedStudyDays);
  const studyDayCompletions = parseStudyDayCompletions(record.studyDayCompletions);

  const filteredIntroductionDates: Record<string, string> = {};
  const filteredIntroductionStudyDays: Record<string, number> = {};

  for (const muscleId of introducedMuscleIds) {
    if (introductionDates[muscleId]) {
      filteredIntroductionDates[muscleId] = introductionDates[muscleId];
    }

    if (introductionStudyDays[muscleId]) {
      filteredIntroductionStudyDays[muscleId] = introductionStudyDays[muscleId];
    }
  }

  return {
    version: STORE_VERSION,
    courseId,
    startedAt: record.startedAt,
    currentStudyDay,
    introducedMuscleIds,
    introductionDates: filteredIntroductionDates,
    introductionStudyDays: filteredIntroductionStudyDays,
    recentGrades,
    carriedOverRetryKeys,
    completedStudyDays,
    studyDayCompletions,
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
  notifyProgressChanged();
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

function hasStoredCourseActivity(progress: CourseProgress | undefined): boolean {
  if (!progress) {
    return false;
  }

  return (
    progress.startedAt !== null ||
    progress.introducedMuscleIds.length > 0 ||
    progress.recentGrades.length > 0
  );
}

export function migrateLegacyCourseProgressIfNeeded(
  programCourseId: string = DEFAULT_COURSE_ID,
  legacyCourseIds: string[] = [LEGACY_CERVICAL_COURSE_ID],
): void {
  if (typeof window === "undefined") {
    return;
  }

  const store = readStore();

  if (hasStoredCourseActivity(store.courses[programCourseId])) {
    return;
  }

  for (const legacyCourseId of legacyCourseIds) {
    const legacyProgress = store.courses[legacyCourseId];

    if (!hasStoredCourseActivity(legacyProgress)) {
      continue;
    }

    const migrated: CourseProgress = normalizeCourseProgress({
      ...legacyProgress!,
      courseId: programCourseId,
    });

    store.courses[programCourseId] = migrated;
    writeStore(store);
    return;
  }
}

function normalizeCourseProgress(progress: CourseProgress): CourseProgress {
  const normalized: CourseProgress = {
    ...progress,
    currentStudyDay: clampStudyDay(progress.currentStudyDay ?? 1),
    introductionStudyDays: { ...progress.introductionStudyDays },
    carriedOverRetryKeys: progress.carriedOverRetryKeys ?? [],
    completedStudyDays: progress.completedStudyDays ?? [],
    studyDayCompletions: progress.studyDayCompletions ?? [],
  };

  for (const muscleId of normalized.introducedMuscleIds) {
    if (normalized.introductionStudyDays[muscleId]) {
      continue;
    }

    const introducedAt = normalized.introductionDates[muscleId];

    if (!introducedAt || !normalized.startedAt) {
      normalized.introductionStudyDays[muscleId] = 1;
      continue;
    }

    normalized.introductionStudyDays[muscleId] =
      getCourseDay(normalized.startedAt, new Date(introducedAt)) ?? 1;
  }

  const hasLegacyCalendarProgress =
    normalized.startedAt !== null &&
    (progress.currentStudyDay === undefined ||
      progress.introductionStudyDays === undefined);

  if (hasLegacyCalendarProgress) {
    const calendarDay = getCourseDay(normalized.startedAt, new Date());

    if (calendarDay !== null) {
      normalized.currentStudyDay = calendarDay;
    }
  }

  normalized.currentStudyDay = clampStudyDay(normalized.currentStudyDay);

  return migrateCourseProgress(normalized);
}

export function createDefaultCourseProgress(courseId: string): CourseProgress {
  return {
    version: STORE_VERSION,
    courseId,
    startedAt: null,
    currentStudyDay: 1,
    introducedMuscleIds: [],
    introductionDates: {},
    introductionStudyDays: {},
    recentGrades: [],
    carriedOverRetryKeys: [],
    completedStudyDays: [],
    studyDayCompletions: [],
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
  notifyProgressChanged({ immediate: true });
}

export function getCourseProgress(courseId: string): CourseProgress {
  if (courseId === DEFAULT_COURSE_ID) {
    migrateLegacyCourseProgressIfNeeded(courseId);
  }

  const store = readStore();
  const progress = store.courses[courseId];

  if (progress && courseProgressNeedsMuscleIdMigration(progress)) {
    store.courses[courseId] = normalizeCourseProgress(progress);
    writeStore(store);
  }

  return normalizeCourseProgress(
    progress ?? createDefaultCourseProgress(courseId),
  );
}

export function getCurrentStudyDay(progress: CourseProgress): number {
  return clampStudyDay(progress.currentStudyDay);
}

export function isStudyDayCompleted(
  progress: CourseProgress,
  studyDay: number = getCurrentStudyDay(progress),
): boolean {
  return progress.completedStudyDays.includes(clampStudyDay(studyDay));
}

export function isCurrentStudyDayCompleted(progress: CourseProgress): boolean {
  return isStudyDayCompleted(progress, getCurrentStudyDay(progress));
}

export function markStudyDayCompleted(
  courseId: string,
  studyDay?: number,
  now: Date = new Date(),
): CourseProgress {
  const progress = getCourseProgress(courseId);
  const targetStudyDay = clampStudyDay(studyDay ?? progress.currentStudyDay);

  if (progress.completedStudyDays.includes(targetStudyDay)) {
    return progress;
  }

  const updated: CourseProgress = {
    ...progress,
    completedStudyDays: [...progress.completedStudyDays, targetStudyDay].sort(
      (left, right) => left - right,
    ),
    studyDayCompletions: [
      ...(progress.studyDayCompletions ?? []),
      {
        studyDay: targetStudyDay,
        completedAt: toIsoString(now),
      },
    ],
  };

  writeCourseProgress(updated);

  return updated;
}

export function advanceStudyDay(courseId: string): CourseProgress {
  const progress = getCourseProgress(courseId);

  if (!isCurrentStudyDayCompleted(progress)) {
    return progress;
  }

  const updated: CourseProgress = {
    ...progress,
    currentStudyDay: progress.currentStudyDay + 1,
  };

  writeCourseProgress(updated);

  return updated;
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
    introductionStudyDays: {
      ...progress.introductionStudyDays,
      [normalizedMuscleId]: getCurrentStudyDay(progress),
    },
  };

  writeCourseProgress(updated);

  return updated;
}

export function countMusclesIntroducedDuringCurrentCourseWeek(
  progress: CourseProgress,
): number {
  const courseDay = getCurrentStudyDay(progress);
  const currentWeek = getCourseWeek(courseDay);
  const weekStartDay = (currentWeek - 1) * 7 + 1;
  const weekEndDay = currentWeek * 7;

  return progress.introducedMuscleIds.filter((muscleId) => {
    const introductionStudyDay = progress.introductionStudyDays[muscleId];

    if (!introductionStudyDay) {
      return false;
    }

    return (
      introductionStudyDay >= weekStartDay &&
      introductionStudyDay <= weekEndDay
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

export function setCarriedOverRetryKeys(
  courseId: string,
  keys: CardProgressKey[],
): CourseProgress {
  const progress = getCourseProgress(courseId);
  const carriedOverRetryKeys = parseStringArray(keys) as CardProgressKey[];
  const updated: CourseProgress = {
    ...progress,
    carriedOverRetryKeys,
  };

  writeCourseProgress(updated);

  return updated;
}

export function clearCarriedOverRetryKeys(courseId: string): CourseProgress {
  return setCarriedOverRetryKeys(courseId, []);
}

export function consumeCarriedOverRetryKeys(
  courseId: string,
): CardProgressKey[] {
  const progress = getCourseProgress(courseId);
  const keys = progress.carriedOverRetryKeys;

  if (keys.length > 0) {
    clearCarriedOverRetryKeys(courseId);
  }

  return keys;
}
