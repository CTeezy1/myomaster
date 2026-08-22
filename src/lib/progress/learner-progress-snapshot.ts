import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import {
  readActiveStudySession,
  writeActiveStudySession,
  clearActiveStudySession,
  preparePersistedActiveStudySessionForRestore,
  type PersistedActiveStudySession,
} from "@/src/lib/active-study-session";
import {
  createDefaultCourseProgress,
  readCourseProgressStore,
  writeCourseProgressStore,
  clearCourseProgress,
} from "@/src/lib/course-progress";
import {
  readMasteryProgress,
  writeMasteryProgress,
  clearMasteryProgress,
} from "@/src/lib/mastery-progress";
import {
  clearMuscleBriefProgress,
  getViewedMuscleBriefIds,
} from "@/src/lib/muscle-brief-progress";
import { runWithoutProgressSync } from "@/src/lib/progress/progress-sync";
import { parseCurriculumId, type CurriculumId } from "@/src/lib/curriculum";
import {
  CURRICULUM_ASSIGNMENT_STORAGE_KEY,
  LEARNER_PROGRESS_SCHEMA_VERSION,
  type PersistedLearnerProgress,
  type PersistedStudyState,
} from "@/src/lib/progress/learner-progress.types";
import type { CourseProgressStore, MasteryProgressStore } from "@/src/lib/progress.types";

export function createEmptyStudyState(
  curriculumId?: CurriculumId,
): PersistedStudyState {
  return {
    courseProgress: {
      version: 1,
      courses: {},
    },
    masteryProgress: {
      version: 1,
      cards: {},
    },
    activeStudySession: null,
    muscleBriefViewedIds: [],
    ...(curriculumId ? { curriculumId } : {}),
  };
}

export function createDefaultPersistedLearnerProgress(options?: {
  curriculumId?: CurriculumId;
}): PersistedLearnerProgress {
  const curriculumId = options?.curriculumId;

  return {
    schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    ...(curriculumId ? { curriculumId } : {}),
    state: createEmptyStudyState(curriculumId),
  };
}

export function readCurriculumAssignment(): CurriculumId | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(CURRICULUM_ASSIGNMENT_STORAGE_KEY);
  return stored ? parseCurriculumId(stored) : null;
}

export function writeCurriculumAssignment(curriculumId: CurriculumId): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CURRICULUM_ASSIGNMENT_STORAGE_KEY, curriculumId);
}

export function clearCurriculumAssignment(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CURRICULUM_ASSIGNMENT_STORAGE_KEY);
}

export function collectLocalStudyState(): PersistedStudyState {
  const activeStudySession = readActiveStudySession();
  const curriculumId = readCurriculumAssignment();

  return {
    courseProgress: readCourseProgressStore(),
    masteryProgress: readMasteryProgress(),
    activeStudySession,
    muscleBriefViewedIds: getViewedMuscleBriefIds(),
    ...(curriculumId ? { curriculumId } : {}),
  };
}

export function applyStudyStateToLocal(state: PersistedStudyState): void {
  runWithoutProgressSync(() => {
    writeCourseProgressStore(state.courseProgress);
    writeMasteryProgress(state.masteryProgress);

    if (state.activeStudySession) {
      writeActiveStudySession(
        preparePersistedActiveStudySessionForRestore(state.activeStudySession),
      );
    } else {
      clearActiveStudySession();
    }

    if (state.muscleBriefViewedIds.length > 0) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "myomaster-muscle-brief-viewed",
          JSON.stringify(state.muscleBriefViewedIds),
        );
      }
    } else {
      clearMuscleBriefProgress();
    }

    if (state.curriculumId) {
      writeCurriculumAssignment(state.curriculumId);
    }
  });
}

export function clearLocalStudyState(): void {
  clearCourseProgress();
  clearMasteryProgress();
  clearActiveStudySession();
  clearMuscleBriefProgress();
  clearCurriculumAssignment();
}

function courseStoreHasActivity(store: CourseProgressStore): boolean {
  return Object.values(store.courses).some((course) => {
    return (
      course.startedAt !== null ||
      course.introducedMuscleIds.length > 0 ||
      course.recentGrades.length > 0 ||
      course.completedStudyDays.length > 0
    );
  });
}

function masteryStoreHasActivity(store: MasteryProgressStore): boolean {
  return Object.keys(store.cards).length > 0;
}

export function localStudyStateHasActivity(
  state: PersistedStudyState = collectLocalStudyState(),
): boolean {
  return (
    courseStoreHasActivity(state.courseProgress) ||
    masteryStoreHasActivity(state.masteryProgress) ||
    state.activeStudySession !== null ||
    state.muscleBriefViewedIds.length > 0
  );
}

export function ensureDefaultCourseInState(
  progress: PersistedLearnerProgress,
  courseId: string = DEFAULT_COURSE_ID,
): PersistedLearnerProgress {
  if (progress.state.courseProgress.courses[courseId]) {
    return progress;
  }

  return {
    ...progress,
    state: {
      ...progress.state,
      courseProgress: {
        ...progress.state.courseProgress,
        courses: {
          ...progress.state.courseProgress.courses,
          [courseId]: createDefaultCourseProgress(courseId),
        },
      },
    },
  };
}

export function sanitizeActiveSessionForState(
  session: PersistedActiveStudySession | null,
): PersistedActiveStudySession | null {
  if (!session) {
    return null;
  }

  try {
    return preparePersistedActiveStudySessionForRestore(session);
  } catch {
    return null;
  }
}
