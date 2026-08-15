import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import {
  getCourseProgress,
  getCurrentStudyDay,
  isCurrentStudyDayCompleted,
} from "@/src/lib/course-progress";
import type { CourseProgress } from "@/src/lib/progress.types";
import type { CardFeedbackState } from "@/src/lib/quiz-card-state";
import type { StudyDayObligationProgress } from "@/src/lib/study-day-obligation-progress";
import { createObligationProgressFromSession } from "@/src/lib/study-day-obligation-progress";
import {
  hasValidPresentableIndex,
  isSameSessionRelearnComplete,
  sanitizeSameSessionRelearnState,
  type SameSessionRelearnState,
} from "@/src/lib/same-session-relearn";
import type { QueuedCard } from "@/src/lib/review-queue";
import { notifyProgressChanged } from "@/src/lib/progress/progress-sync";

export const ACTIVE_STUDY_SESSION_STORAGE_KEY = "myomaster-active-study-session";
export const ACTIVE_STUDY_SESSION_VERSION = 2 as const;

export type ActiveStudyScreen = "brief" | "study-day" | "brief-review";

export type PersistedActiveStudySession = {
  version: typeof ACTIVE_STUDY_SESSION_VERSION;
  courseId: string;
  studyDay: number;
  savedAt: string;
  plannedStaticQueue: QueuedCard[];
  session: SameSessionRelearnState;
  screen: ActiveStudyScreen;
  currentMuscleIndex: number;
  cardFeedback: CardFeedbackState;
  feedbackQueuedCard: QueuedCard | null;
  feedbackPresentationKey: string | null;
  reviewProfileId: string | null;
  obligationProgress: StudyDayObligationProgress;
};

const CARD_CATEGORIES = new Set(["origin", "insertion", "action", "innervation"]);
const FEEDBACK_GRADES = new Set(["partial", "incorrect"]);
const ACTIVE_SCREENS = new Set<ActiveStudyScreen>([
  "brief",
  "study-day",
  "brief-review",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQueuedCard(value: unknown): value is QueuedCard {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.muscleId !== "string" || typeof value.cardKey !== "string") {
    return false;
  }

  if (
    typeof value.category !== "string" ||
    !CARD_CATEGORIES.has(value.category)
  ) {
    return false;
  }

  if (
    value.attachmentPairId !== undefined &&
    typeof value.attachmentPairId !== "string"
  ) {
    return false;
  }

  if (value.isPendingRetry !== undefined && typeof value.isPendingRetry !== "boolean") {
    return false;
  }

  if (value.isPractice !== undefined && typeof value.isPractice !== "boolean") {
    return false;
  }

  if (value.obligationId !== undefined && typeof value.obligationId !== "string") {
    return false;
  }

  return true;
}

function isStudyDayObligationProgress(
  value: unknown,
): value is StudyDayObligationProgress {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.total !== "number" || !Number.isInteger(value.total) || value.total < 0) {
    return false;
  }

  if (
    !Array.isArray(value.completedObligationIds) ||
    !value.completedObligationIds.every((entry) => typeof entry === "string")
  ) {
    return false;
  }

  return true;
}

function isSameSessionRelearnState(value: unknown): value is SameSessionRelearnState {
  if (!isObject(value)) {
    return false;
  }

  if (!Array.isArray(value.queue) || !value.queue.every(isQueuedCard)) {
    return false;
  }

  if (typeof value.index !== "number" || !Number.isInteger(value.index) || value.index < 0) {
    return false;
  }

  if (
    typeof value.gradedPromptCount !== "number" ||
    typeof value.staticGradedCount !== "number" ||
    typeof value.initialQueueLength !== "number" ||
    typeof value.initialStaticQueueLength !== "number" ||
    typeof value.dailyCapReached !== "boolean" ||
    typeof value.enforceDailyCap !== "boolean"
  ) {
    return false;
  }

  if (
    value.unresolvedKeys !== undefined &&
    !Array.isArray(value.unresolvedKeys)
  ) {
    return false;
  }

  if (!isObject(value.pairCorrectCounts)) {
    return false;
  }

  return true;
}

function isCardFeedbackState(value: unknown): value is CardFeedbackState {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.answerShown !== "boolean") {
    return false;
  }

  if (
    value.feedbackGrade !== null &&
    (typeof value.feedbackGrade !== "string" ||
      !FEEDBACK_GRADES.has(value.feedbackGrade))
  ) {
    return false;
  }

  return true;
}

function parsePersistedActiveStudySession(
  value: unknown,
): PersistedActiveStudySession | null {
  if (!isObject(value)) {
    return null;
  }

  if (value.version !== ACTIVE_STUDY_SESSION_VERSION) {
    return null;
  }

  if (typeof value.courseId !== "string" || typeof value.savedAt !== "string") {
    return null;
  }

  if (typeof value.studyDay !== "number" || !Number.isInteger(value.studyDay)) {
    return null;
  }

  if (
    !Array.isArray(value.plannedStaticQueue) ||
    !value.plannedStaticQueue.every(isQueuedCard) ||
    !isSameSessionRelearnState(value.session) ||
    typeof value.screen !== "string" ||
    !ACTIVE_SCREENS.has(value.screen as ActiveStudyScreen) ||
    typeof value.currentMuscleIndex !== "number" ||
    !Number.isInteger(value.currentMuscleIndex) ||
    value.currentMuscleIndex < 0 ||
    !isCardFeedbackState(value.cardFeedback) ||
    (value.feedbackQueuedCard !== null && !isQueuedCard(value.feedbackQueuedCard)) ||
    (value.feedbackPresentationKey !== null &&
      typeof value.feedbackPresentationKey !== "string") ||
    (value.reviewProfileId !== null && typeof value.reviewProfileId !== "string") ||
    !isStudyDayObligationProgress(value.obligationProgress)
  ) {
    return null;
  }

  return value as PersistedActiveStudySession;
}

export function readActiveStudySession(): PersistedActiveStudySession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ACTIVE_STUDY_SESSION_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return parsePersistedActiveStudySession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeActiveStudySession(
  session: PersistedActiveStudySession,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    ACTIVE_STUDY_SESSION_STORAGE_KEY,
    JSON.stringify(session),
  );
  notifyProgressChanged();
}

export function clearActiveStudySession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACTIVE_STUDY_SESSION_STORAGE_KEY);
  notifyProgressChanged({ immediate: true });
}

export function isActiveStudySessionComplete(
  persisted: PersistedActiveStudySession,
): boolean {
  return isSameSessionRelearnComplete(persisted.session);
}

export function isResumableActiveStudySession(
  persisted: PersistedActiveStudySession | null,
  courseId: string = DEFAULT_COURSE_ID,
  courseProgress: CourseProgress = getCourseProgress(courseId),
): persisted is PersistedActiveStudySession {
  if (!persisted) {
    return false;
  }

  if (persisted.courseId !== courseId) {
    return false;
  }

  if (persisted.studyDay !== getCurrentStudyDay(courseProgress)) {
    return false;
  }

  if (isCurrentStudyDayCompleted(courseProgress)) {
    return false;
  }

  if (isActiveStudySessionComplete(persisted)) {
    return false;
  }

  if (persisted.session.queue.length === 0) {
    return false;
  }

  const sanitized = sanitizeSameSessionRelearnState(persisted.session);

  if (!hasValidPresentableIndex(sanitized)) {
    return false;
  }

  if (sanitized.index > sanitized.queue.length) {
    return false;
  }

  return true;
}

export function createPersistedActiveStudySession(input: {
  courseId: string;
  studyDay: number;
  plannedStaticQueue: QueuedCard[];
  session: SameSessionRelearnState;
  screen: ActiveStudyScreen;
  currentMuscleIndex: number;
  cardFeedback: CardFeedbackState;
  feedbackQueuedCard?: QueuedCard | null;
  feedbackPresentationKey?: string | null;
  reviewProfileId?: string | null;
  obligationProgress?: StudyDayObligationProgress;
}): PersistedActiveStudySession {
  const session = sanitizeSameSessionRelearnState(input.session);
  const obligationProgress =
    input.obligationProgress ?? createObligationProgressFromSession(session);

  return {
    version: ACTIVE_STUDY_SESSION_VERSION,
    courseId: input.courseId,
    studyDay: input.studyDay,
    savedAt: new Date().toISOString(),
    plannedStaticQueue: input.plannedStaticQueue.map((card) => ({ ...card })),
    session: {
      ...session,
      queue: session.queue.map((card) => ({ ...card })),
      unresolvedKeys: [...session.unresolvedKeys],
      pairCorrectCounts: { ...session.pairCorrectCounts },
    },
    screen: input.screen,
    currentMuscleIndex: input.currentMuscleIndex,
    cardFeedback: { ...input.cardFeedback },
    feedbackQueuedCard: input.feedbackQueuedCard
      ? { ...input.feedbackQueuedCard }
      : null,
    feedbackPresentationKey: input.feedbackPresentationKey ?? null,
    reviewProfileId: input.reviewProfileId ?? null,
    obligationProgress: {
      total: obligationProgress.total,
      completedObligationIds: [...obligationProgress.completedObligationIds],
    },
  };
}

export function preparePersistedActiveStudySessionForRestore(
  persisted: PersistedActiveStudySession,
): PersistedActiveStudySession {
  const session = sanitizeSameSessionRelearnState(persisted.session);

  return {
    ...persisted,
    session: {
      ...session,
      queue: session.queue.map((card) => ({ ...card })),
      unresolvedKeys: [...session.unresolvedKeys],
      pairCorrectCounts: { ...session.pairCorrectCounts },
    },
    obligationProgress: {
      total: persisted.obligationProgress.total,
      completedObligationIds: [...persisted.obligationProgress.completedObligationIds],
    },
  };
}

export function getPlannedStaticQueueFromSession(
  session: SameSessionRelearnState,
): QueuedCard[] {
  return session.queue
    .filter((card) => !card.isPendingRetry)
    .slice(0, session.initialStaticQueueLength)
    .map((card) => ({ ...card }));
}
