import {
  getCurriculumIdForSection,
  getStudyCourseForCurriculum,
  parseCurriculumId,
  type CurriculumId,
} from "@/src/lib/curriculum";
import type { Course } from "@/src/lib/course.types";
import type { CourseSection } from "@/src/lib/profile.types";
import { readCurriculumAssignment } from "@/src/lib/progress/learner-progress-snapshot";
import type {
  PersistedLearnerProgress,
  PersistedStudyState,
} from "@/src/lib/progress/learner-progress.types";
import type { CourseProgress, CourseProgressStore } from "@/src/lib/progress.types";

export const LEGACY_CURRICULUM_ID = "legacy-canonical-v1" satisfies CurriculumId;

export type ResolveCurriculumAssignmentResult =
  | {
      ok: true;
      curriculumId: CurriculumId;
      source: "pinned" | "legacy" | "section";
    }
  | { ok: false; kind: "invalid_curriculum" };

export type AppliedCurriculumAssignment =
  | {
      ok: true;
      progress: PersistedLearnerProgress;
      didAssign: boolean;
      source: "pinned" | "legacy" | "section";
    }
  | { ok: false; kind: "invalid_curriculum" };

function courseHasMeaningfulProgress(progress: CourseProgress): boolean {
  return (
    progress.startedAt !== null ||
    progress.introducedMuscleIds.length > 0 ||
    progress.completedStudyDays.length > 0 ||
    progress.currentStudyDay > 1 ||
    progress.recentGrades.length > 0
  );
}

function courseStoreHasMeaningfulProgress(
  store: CourseProgressStore,
): boolean {
  return Object.values(store.courses).some(courseHasMeaningfulProgress);
}

export function hasMeaningfulCurriculumProgress(
  state: PersistedStudyState,
): boolean {
  return (
    courseStoreHasMeaningfulProgress(state.courseProgress) ||
    Object.keys(state.masteryProgress.cards).length > 0 ||
    state.activeStudySession !== null ||
    state.muscleBriefViewedIds.length > 0
  );
}

export function readExistingCurriculumId(
  progress: Pick<PersistedLearnerProgress, "curriculumId" | "state">,
): unknown {
  return progress.curriculumId ?? progress.state.curriculumId;
}

export function resolveCurriculumAssignment(input: {
  existingCurriculumId?: unknown;
  section: CourseSection;
  state: PersistedStudyState;
}): ResolveCurriculumAssignmentResult {
  if (input.existingCurriculumId !== undefined) {
    if (typeof input.existingCurriculumId !== "string") {
      return { ok: false, kind: "invalid_curriculum" };
    }

    const pinned = parseCurriculumId(input.existingCurriculumId);

    if (!pinned) {
      return { ok: false, kind: "invalid_curriculum" };
    }

    return { ok: true, curriculumId: pinned, source: "pinned" };
  }

  if (hasMeaningfulCurriculumProgress(input.state)) {
    return {
      ok: true,
      curriculumId: LEGACY_CURRICULUM_ID,
      source: "legacy",
    };
  }

  return {
    ok: true,
    curriculumId: getCurriculumIdForSection(input.section),
    source: "section",
  };
}

export function withCurriculumId(
  progress: PersistedLearnerProgress,
  curriculumId: CurriculumId,
): PersistedLearnerProgress {
  return {
    ...progress,
    curriculumId,
    state: {
      ...progress.state,
      curriculumId,
    },
  };
}

export function applyCurriculumAssignment(
  progress: PersistedLearnerProgress,
  section: CourseSection,
): AppliedCurriculumAssignment {
  const existingCurriculumId = readExistingCurriculumId(progress);
  const resolved = resolveCurriculumAssignment({
    existingCurriculumId,
    section,
    state: progress.state,
  });

  if (!resolved.ok) {
    return resolved;
  }

  return {
    ok: true,
    progress: withCurriculumId(progress, resolved.curriculumId),
    didAssign: existingCurriculumId === undefined,
    source: resolved.source,
  };
}

export function createFreshProgressWithPinnedCurriculum(
  createProgress: () => PersistedLearnerProgress,
  section: CourseSection,
  pinnedCurriculumId?: CurriculumId | null,
): PersistedLearnerProgress {
  const curriculumId =
    pinnedCurriculumId ?? getCurriculumIdForSection(section);
  const progress = createProgress();

  return withCurriculumId(progress, curriculumId);
}

export function resolvePinnedStudyCourse(): Course | null {
  const curriculumId = readCurriculumAssignment();

  if (process.env.NODE_ENV === "development") {
    console.debug("[myomaster] pinned curriculum", curriculumId);
  }

  if (!curriculumId) {
    return null;
  }

  return getStudyCourseForCurriculum(curriculumId);
}
