import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { getMuscleProfileById, getMuscleProfilesForRegionId } from "@/src/data/muscle-profiles";
import { getStudyCourseForCurriculum } from "@/src/lib/curriculum";
import { getDueReviewPromptCount } from "@/src/lib/dashboard-progress";
import { shiftCardReviewStudyDays } from "@/src/lib/deferred-muscles";
import { getBaseDailyNewMuscleAllowance } from "@/src/lib/guided-scheduling";
import { OVERDUE_PROMPT_LIMIT } from "@/src/lib/introduction-policy";
import { getNewMuscleIdsForStudyDay } from "@/src/lib/new-muscle-queue";
import type { CourseSection } from "@/src/lib/profile.types";
import type { PersistedLearnerProgress } from "@/src/lib/progress/learner-progress.types";
import type {
  CourseProgress,
  MasteryProgressStore,
} from "@/src/lib/progress.types";

export const KINESIOLOGY_1_SECTION = "Kinesiology 1" satisfies CourseSection;
export const KINESIOLOGY_1_HIP_START_DAY = 20;
export const KINESIOLOGY_1_HIP_START_MUSCLE_ID = "gluteus-maximus";
export const KINESIOLOGY_1_HIP_ALIGNMENT_REASON =
  "Align Kinesiology 1 introductions to the hip section for current class content. This is an administrative curriculum adjustment, not a completed study day.";
export const KINESIOLOGY_1_FIRST_SESSION_NEW_MUSCLE_CAP = 3;

const HIP_MUSCLE_IDS = new Set(
  getMuscleProfilesForRegionId("hip").map((profile) => profile.id),
);

export function getKinesiology1StudyCourse() {
  return getStudyCourseForCurriculum("upper-first-v1");
}

export function hasReachedHipSection(progress: CourseProgress): boolean {
  return progress.introducedMuscleIds.some((muscleId) =>
    HIP_MUSCLE_IDS.has(muscleId),
  );
}

export function getUnintroducedPreHipMuscleIds(
  progress: CourseProgress,
): string[] {
  const course = getKinesiology1StudyCourse();
  const hipIndex = course.muscleProfileIds.indexOf(
    KINESIOLOGY_1_HIP_START_MUSCLE_ID,
  );
  const introduced = new Set(progress.introducedMuscleIds);

  return course.muscleProfileIds
    .slice(0, Math.max(0, hipIndex))
    .filter((muscleId) => !introduced.has(muscleId));
}

export function getProgramCourseProgress(
  progress: PersistedLearnerProgress,
): CourseProgress | null {
  return progress.state.courseProgress.courses[DEFAULT_COURSE_ID] ?? null;
}

export type Kinesiology1HipAlignmentPlan = {
  action: "unchanged" | "adjust";
  originalStudyDay: number;
  proposedStudyDay: number;
  deferredMuscleIds: string[];
  reviewDayDelta: number;
  clearActiveSession: boolean;
  progress: PersistedLearnerProgress;
};

export function planKinesiology1HipAlignment(
  progress: PersistedLearnerProgress,
  now: Date = new Date(),
): Kinesiology1HipAlignmentPlan {
  const courseProgress = getProgramCourseProgress(progress);

  if (!courseProgress) {
    return {
      action: "unchanged",
      originalStudyDay: 1,
      proposedStudyDay: 1,
      deferredMuscleIds: [],
      reviewDayDelta: 0,
      clearActiveSession: false,
      progress,
    };
  }

  if (hasReachedHipSection(courseProgress)) {
    return {
      action: "unchanged",
      originalStudyDay: courseProgress.currentStudyDay,
      proposedStudyDay: courseProgress.currentStudyDay,
      deferredMuscleIds: [],
      reviewDayDelta: 0,
      clearActiveSession: false,
      progress,
    };
  }

  const deferredMuscleIds = getUnintroducedPreHipMuscleIds(courseProgress);
  const originalStudyDay = courseProgress.currentStudyDay;
  const proposedStudyDay = Math.max(
    originalStudyDay,
    KINESIOLOGY_1_HIP_START_DAY,
  );
  const reviewDayDelta = proposedStudyDay - originalStudyDay;
  const mastery: MasteryProgressStore = reviewDayDelta
    ? shiftCardReviewStudyDays(progress.state.masteryProgress, reviewDayDelta)
    : progress.state.masteryProgress;

  return {
    action: "adjust",
    originalStudyDay,
    proposedStudyDay,
    deferredMuscleIds,
    reviewDayDelta,
    clearActiveSession: progress.state.activeStudySession !== null,
    progress: {
      ...progress,
      savedAt: now.toISOString(),
      state: {
        ...progress.state,
        activeStudySession: null,
        masteryProgress: mastery,
        courseProgress: {
          ...progress.state.courseProgress,
          courses: {
            ...progress.state.courseProgress.courses,
            [DEFAULT_COURSE_ID]: {
              ...courseProgress,
              currentStudyDay: proposedStudyDay,
              ...(deferredMuscleIds.length > 0 ? { deferredMuscleIds } : {}),
              curriculumAlignmentAudit: {
                originalStudyDay,
                adjustedStudyDay: proposedStudyDay,
                adjustedAt: now.toISOString(),
                reason: KINESIOLOGY_1_HIP_ALIGNMENT_REASON,
                section: KINESIOLOGY_1_SECTION,
                firstSessionNewMuscleCap:
                  KINESIOLOGY_1_FIRST_SESSION_NEW_MUSCLE_CAP,
              },
            },
          },
        },
      },
    },
  };
}

export type JsonValueDiff = {
  path: string;
  before: unknown;
  after: unknown;
};

export function diffJsonValues(
  before: unknown,
  after: unknown,
  path = "",
): JsonValueDiff[] {
  if (Object.is(before, after)) {
    return [];
  }

  const beforeIsObject = before !== null && typeof before === "object";
  const afterIsObject = after !== null && typeof after === "object";

  if (!beforeIsObject || !afterIsObject) {
    return [{ path: path || "(root)", before, after }];
  }

  const beforeIsArray = Array.isArray(before);
  const afterIsArray = Array.isArray(after);

  if (beforeIsArray !== afterIsArray) {
    return [{ path: path || "(root)", before, after }];
  }

  const diffs: JsonValueDiff[] = [];
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const keys = new Set([
    ...Object.keys(beforeRecord),
    ...Object.keys(afterRecord),
  ]);

  for (const key of keys) {
    const nextPath = path ? `${path}.${key}` : key;
    diffs.push(...diffJsonValues(beforeRecord[key], afterRecord[key], nextPath));
  }

  return diffs;
}

export type PredictedNextStudySession = {
  studyDay: number;
  dueReviewPromptCount: number;
  newMuscleAllowance: number;
  newMuscleIds: string[];
  newMuscleNames: string[];
  overdueBlocksNewMuscles: boolean;
  activeSessionCleared: boolean;
};

export function predictKinesiology1NextSession(
  progress: PersistedLearnerProgress,
  options?: { activeSessionCleared?: boolean },
): PredictedNextStudySession | null {
  const courseProgress = getProgramCourseProgress(progress);

  if (!courseProgress) {
    return null;
  }

  const course = getKinesiology1StudyCourse();
  const dueReviewPromptCount = getDueReviewPromptCount(
    course.muscleProfileIds,
    progress.state.masteryProgress,
    courseProgress.currentStudyDay,
  );
  const newMuscleAllowance = getBaseDailyNewMuscleAllowance(
    courseProgress,
    course.muscleProfileIds,
    progress.state.masteryProgress,
  );
  const newMuscleIds = getNewMuscleIdsForStudyDay(
    course,
    courseProgress,
    newMuscleAllowance,
  );

  return {
    studyDay: courseProgress.currentStudyDay,
    dueReviewPromptCount,
    newMuscleAllowance,
    newMuscleIds,
    newMuscleNames: newMuscleIds.map(
      (muscleId) => getMuscleProfileById(muscleId)?.name ?? muscleId,
    ),
    overdueBlocksNewMuscles: dueReviewPromptCount > OVERDUE_PROMPT_LIMIT,
    activeSessionCleared: options?.activeSessionCleared === true,
  };
}

export function countMasteryAttempts(store: MasteryProgressStore): number {
  return Object.values(store.cards).reduce(
    (sum, card) =>
      sum +
      card.totalAttempts +
      card.correctAttempts +
      card.partialAttempts +
      card.incorrectAttempts,
    0,
  );
}

export type Kinesiology1HipRollbackDecision =
  | {
      action: "restore";
      expectedRevision: number;
      progress: PersistedLearnerProgress;
    }
  | {
      action: "skip";
      reason:
        | "not-applied"
        | "student-activity-after-update"
        | "current-does-not-match-applied";
    };

export function planKinesiology1HipRollback(input: {
  originalProgress: PersistedLearnerProgress;
  originalRevision: number;
  appliedRevision: number;
  appliedProgress: PersistedLearnerProgress;
  currentProgress: PersistedLearnerProgress;
  currentRevision: number;
}): Kinesiology1HipRollbackDecision {
  const currentMatchesApplied =
    input.currentRevision === input.appliedRevision &&
    diffJsonValues(input.currentProgress, input.appliedProgress).length === 0;

  if (currentMatchesApplied) {
    return {
      action: "restore",
      expectedRevision: input.appliedRevision,
      progress: input.originalProgress,
    };
  }

  if (input.currentRevision === input.originalRevision) {
    return { action: "skip", reason: "not-applied" };
  }

  if (input.currentRevision > input.appliedRevision) {
    return { action: "skip", reason: "student-activity-after-update" };
  }

  return { action: "skip", reason: "current-does-not-match-applied" };
}

export const APPLY_KINESIOLOGY_1_HIP_ALIGNMENT_ENV =
  "CONFIRM_KINESIOLOGY_1_HIP_ALIGNMENT";
export const APPLY_KINESIOLOGY_1_HIP_ALIGNMENT_VALUE =
  "I_APPROVE_PRODUCTION_WRITE";
export const ROLLBACK_KINESIOLOGY_1_HIP_ALIGNMENT_ENV =
  "CONFIRM_KINESIOLOGY_1_HIP_ROLLBACK";
export const ROLLBACK_KINESIOLOGY_1_HIP_ALIGNMENT_VALUE =
  "I_APPROVE_PRODUCTION_WRITE";

export type Kinesiology1HipStudentReport = {
  userId: string;
  username: string;
  section: string;
  revision: number | null;
  action: "unchanged" | "adjust" | "missing-progress" | "unparsed-progress";
  originalStudyDay: number | null;
  proposedStudyDay: number | null;
  reviewDayDelta: number;
  deferredMuscleIds: string[];
  deferredMuscleNames: string[];
  clearActiveSession: boolean;
  introducedMuscleIdsUnchanged: boolean;
  completedStudyDaysUnchanged: boolean;
  studyDayCompletionsUnchanged: boolean;
  recentGradesUnchanged: boolean;
  masteryAttemptsUnchanged: boolean;
  jsonDiffs: JsonValueDiff[];
  predictedNextSession: PredictedNextStudySession | null;
};

export function buildKinesiology1HipStudentReport(input: {
  userId: string;
  username: string;
  section: string;
  revision: number | null;
  original: PersistedLearnerProgress | null;
  plan: Kinesiology1HipAlignmentPlan | null;
}): Kinesiology1HipStudentReport {
  if (!input.original) {
    return {
      userId: input.userId,
      username: input.username,
      section: input.section,
      revision: input.revision,
      action: input.revision === null ? "missing-progress" : "unparsed-progress",
      originalStudyDay: null,
      proposedStudyDay: null,
      reviewDayDelta: 0,
      deferredMuscleIds: [],
      deferredMuscleNames: [],
      clearActiveSession: false,
      introducedMuscleIdsUnchanged: true,
      completedStudyDaysUnchanged: true,
      studyDayCompletionsUnchanged: true,
      recentGradesUnchanged: true,
      masteryAttemptsUnchanged: true,
      jsonDiffs: [],
      predictedNextSession: null,
    };
  }

  const plan =
    input.plan ??
    ({
      action: "unchanged",
      originalStudyDay: getProgramCourseProgress(input.original)?.currentStudyDay ?? 1,
      proposedStudyDay: getProgramCourseProgress(input.original)?.currentStudyDay ?? 1,
      deferredMuscleIds: [],
      reviewDayDelta: 0,
      clearActiveSession: false,
      progress: input.original,
    } satisfies Kinesiology1HipAlignmentPlan);

  const beforeCourse = getProgramCourseProgress(input.original);
  const afterCourse = getProgramCourseProgress(plan.progress);

  return {
    userId: input.userId,
    username: input.username,
    section: input.section,
    revision: input.revision,
    action: plan.action,
    originalStudyDay: plan.originalStudyDay,
    proposedStudyDay: plan.proposedStudyDay,
    reviewDayDelta: plan.reviewDayDelta,
    deferredMuscleIds: plan.deferredMuscleIds,
    deferredMuscleNames: plan.deferredMuscleIds.map(
      (muscleId) => getMuscleProfileById(muscleId)?.name ?? muscleId,
    ),
    clearActiveSession: plan.clearActiveSession,
    introducedMuscleIdsUnchanged:
      JSON.stringify(beforeCourse?.introducedMuscleIds ?? []) ===
      JSON.stringify(afterCourse?.introducedMuscleIds ?? []),
    completedStudyDaysUnchanged:
      JSON.stringify(beforeCourse?.completedStudyDays ?? []) ===
      JSON.stringify(afterCourse?.completedStudyDays ?? []),
    studyDayCompletionsUnchanged:
      JSON.stringify(beforeCourse?.studyDayCompletions ?? []) ===
      JSON.stringify(afterCourse?.studyDayCompletions ?? []),
    recentGradesUnchanged:
      JSON.stringify(beforeCourse?.recentGrades ?? []) ===
      JSON.stringify(afterCourse?.recentGrades ?? []),
    masteryAttemptsUnchanged:
      countMasteryAttempts(input.original.state.masteryProgress) ===
      countMasteryAttempts(plan.progress.state.masteryProgress),
    jsonDiffs: diffJsonValues(input.original, plan.progress),
    predictedNextSession: predictKinesiology1NextSession(plan.progress, {
      activeSessionCleared: plan.clearActiveSession,
    }),
  };
}
