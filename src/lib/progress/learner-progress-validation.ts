import {
  ACTIVE_STUDY_SESSION_VERSION,
  type PersistedActiveStudySession,
} from "@/src/lib/active-study-session";
import {
  LEARNER_PROGRESS_SCHEMA_VERSION,
  type PersistedLearnerProgress,
  type PersistedStudyState,
} from "@/src/lib/progress/learner-progress.types";
import {
  createDefaultPersistedLearnerProgress,
  sanitizeActiveSessionForState,
} from "@/src/lib/progress/learner-progress-snapshot";
import type {
  CourseProgress,
  CourseProgressStore,
  MasteryProgressStore,
} from "@/src/lib/progress.types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isCourseProgress(value: unknown): value is CourseProgress {
  if (!isObject(value)) {
    return false;
  }

  return (
    value.version === 1 &&
    typeof value.courseId === "string" &&
    (value.startedAt === null || typeof value.startedAt === "string") &&
    typeof value.currentStudyDay === "number" &&
    isStringArray(value.introducedMuscleIds) &&
    isObject(value.introductionDates) &&
    isObject(value.introductionStudyDays) &&
    Array.isArray(value.recentGrades) &&
    isStringArray(value.carriedOverRetryKeys) &&
    Array.isArray(value.completedStudyDays)
  );
}

function isCourseProgressStore(value: unknown): value is CourseProgressStore {
  if (!isObject(value) || value.version !== 1 || !isObject(value.courses)) {
    return false;
  }

  return Object.values(value.courses).every(isCourseProgress);
}

function isMasteryProgressStore(value: unknown): value is MasteryProgressStore {
  if (!isObject(value) || value.version !== 1 || !isObject(value.cards)) {
    return false;
  }

  return true;
}

function isActiveStudySession(value: unknown): value is PersistedActiveStudySession {
  if (!isObject(value)) {
    return false;
  }

  return (
    value.version === ACTIVE_STUDY_SESSION_VERSION &&
    typeof value.courseId === "string" &&
    typeof value.studyDay === "number" &&
    typeof value.savedAt === "string" &&
    Array.isArray(value.plannedStaticQueue) &&
    isObject(value.session) &&
    typeof value.screen === "string" &&
    typeof value.currentMuscleIndex === "number" &&
    isObject(value.cardFeedback) &&
    isObject(value.obligationProgress)
  );
}

export function parsePersistedStudyState(value: unknown): PersistedStudyState | null {
  if (!isObject(value)) {
    return null;
  }

  if (!isCourseProgressStore(value.courseProgress)) {
    return null;
  }

  if (!isMasteryProgressStore(value.masteryProgress)) {
    return null;
  }

  if (!isStringArray(value.muscleBriefViewedIds)) {
    return null;
  }

  let activeStudySession: PersistedActiveStudySession | null = null;

  if (value.activeStudySession !== null && value.activeStudySession !== undefined) {
    if (!isActiveStudySession(value.activeStudySession)) {
      return null;
    }

    activeStudySession = sanitizeActiveSessionForState(value.activeStudySession);
  }

  return {
    courseProgress: value.courseProgress,
    masteryProgress: value.masteryProgress,
    activeStudySession,
    muscleBriefViewedIds: value.muscleBriefViewedIds,
  };
}

export function parsePersistedLearnerProgress(
  value: unknown,
): PersistedLearnerProgress | null {
  if (!isObject(value)) {
    return null;
  }

  if (value.schemaVersion !== LEARNER_PROGRESS_SCHEMA_VERSION) {
    return null;
  }

  if (typeof value.savedAt !== "string") {
    return null;
  }

  const state = parsePersistedStudyState(value.state);

  if (!state) {
    return null;
  }

  return {
    schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
    savedAt: value.savedAt,
    state,
  };
}

export function parseLearnerProgressRowData(value: unknown): PersistedLearnerProgress | null {
  return parsePersistedLearnerProgress(value);
}

export function createValidatedPersistedLearnerProgress(
  state: PersistedStudyState,
): PersistedLearnerProgress {
  const parsed = parsePersistedStudyState(state);

  if (!parsed) {
    return createDefaultPersistedLearnerProgress();
  }

  return {
    schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    state: parsed,
  };
}
