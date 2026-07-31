"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CourseComplete } from "@/app/components/CourseComplete";
import { Dashboard } from "@/app/components/Dashboard";
import { MuscleBriefScreen } from "@/app/components/MuscleBriefScreen";
import { SessionComplete } from "@/app/components/SessionComplete";
import { StudySession } from "@/app/components/StudySession";
import { StudySessionErrorBoundary } from "@/app/components/StudySessionErrorBoundary";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { useDashboardStats } from "@/src/hooks/useDashboardStats";
import { useMuscleBriefProgress } from "@/src/hooks/useMuscleBriefProgress";
import { useLearnerProgress } from "@/src/lib/progress/LearnerProgressProvider";
import { notifyProgressChanged } from "@/src/lib/progress/progress-sync";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { cards } from "@/src/data/cards";
import { getMuscleProfileById } from "@/src/data/muscle-profiles";
import type { MuscleProfile } from "@/src/data/muscle-profile.types";
import type { Course } from "@/src/lib/course.types";
import {
  getCourseById,
  getCourseProfileAtIndex,
  getCourseProfiles,
  getProfileForStudyCard,
} from "@/src/lib/course-controller";
import { normalizeCardCategory } from "@/src/lib/card-progress-key";
import {
  addRecentGrade,
  advanceStudyDay,
  clearCarriedOverRetryKeys,
  getCourseProgress,
  getCurrentStudyDay,
  isCurrentStudyDayCompleted,
  markMuscleIntroduced,
  markStudyDayCompleted,
  setCarriedOverRetryKeys,
  startCourseIfNotStarted,
} from "@/src/lib/course-progress";
import {
  assignDailyObligationIds,
  getObligationProgressCounts,
  recordObligationCompletion,
  type StudyDayObligationProgress,
} from "@/src/lib/study-day-obligation-progress";
import {
  clearActiveStudySession,
  createPersistedActiveStudySession,
  getPlannedStaticQueueFromSession,
  isResumableActiveStudySession,
  preparePersistedActiveStudySessionForRestore,
  readActiveStudySession,
  writeActiveStudySession,
  type ActiveStudyScreen,
  type PersistedActiveStudySession,
} from "@/src/lib/active-study-session";
import { planDailyWorkload } from "@/src/lib/daily-workload-planning";
import {
  applyCardGrade,
  introduceMuscleCards,
} from "@/src/lib/mastery-engine";
import {
  readMasteryProgress,
  writeMasteryProgress,
} from "@/src/lib/mastery-progress";
import type { QueuedCard } from "@/src/lib/review-queue";
import {
  buildMixedReviewQueue,
  resolveQueuedCardToStudyCard,
} from "@/src/lib/review-session";
import {
  advanceSameSessionIndex,
  applySameSessionGrade,
  createSameSessionRelearnState,
  getCurrentSessionCard,
  isSameSessionRelearnComplete,
  sanitizeSameSessionRelearnState,
  type SameSessionRelearnState,
} from "@/src/lib/same-session-relearn";
import {
  buildStudyDayScheduledQueueForCourse,
  createStudyDaySessionFromQueue,
  getBriefMuscleIdForSessionIndex,
  getNewMuscleIdsForStudyDay,
  isStudyDaySessionComplete,
} from "@/src/lib/study-day-session";
import type { Grade } from "@/src/lib/progress.types";
import {
  createInitialCardFeedbackState,
  getCardPresentationKey,
  resolveCardFeedbackForPresentation,
  returnFromBriefReview,
  setCardFeedbackGrade,
  showCardAnswer,
  type CardFeedbackGrade,
  type CardFeedbackState,
} from "@/src/lib/quiz-card-state";

function getPersistableStudyScreen(screen: Screen): ActiveStudyScreen | null {
  if (screen === "brief" || screen === "study-day" || screen === "brief-review") {
    return screen;
  }

  return null;
}

type Screen =
  | "dashboard"
  | "brief"
  | "brief-review"
  | "study-day"
  | "course-complete"
  | "mixed-review"
  | "mixed-review-complete"
  | "study-day-complete";

type StudyCard = (typeof cards)[number];

function getQuestion(category: string) {
  return `What is the ${category.toLowerCase()}?`;
}

function updateMastery(
  mastery: number,
  type: "correct" | "partial" | "incorrect",
) {
  if (type === "correct") return Math.min(mastery + 1, 5);
  if (type === "incorrect") return Math.max(mastery - 1, 0);
  return mastery;
}

function persistCourseStart(courseId: string) {
  try {
    startCourseIfNotStarted(courseId, new Date());
  } catch {
    // Ignore storage failures so the course can continue.
  }
}

function persistCourseMuscleIntroduction(courseId: string, profileId: string) {
  try {
    markMuscleIntroduced(courseId, profileId, new Date());
  } catch {
    // Ignore storage failures so guided learning can continue.
  }
}

function persistMuscleIntroduction(profileId: string) {
  try {
    const store = readMasteryProgress();
    const updatedStore = introduceMuscleCards(store, profileId);

    writeMasteryProgress(updatedStore);
  } catch {
    // Ignore storage failures so first exposure can continue.
  }
}

function persistQueuedCardGrade(
  queuedCard: QueuedCard,
  course: Course | null,
  grade: Grade,
) {
  try {
    const category = normalizeCardCategory(queuedCard.category);

    if (!category) {
      return;
    }

    const store = readMasteryProgress();
    const currentStudyDay = course
      ? getCurrentStudyDay(getCourseProgress(course.id))
      : 1;
    const updatedStore = applyCardGrade(
      store,
      queuedCard.muscleId,
      category,
      grade,
      new Date(),
      currentStudyDay,
      { isPractice: queuedCard.isPractice ?? false },
    );

    writeMasteryProgress(updatedStore);

    if (course) {
      addRecentGrade(course.id, grade);
    }

    notifyProgressChanged({ immediate: true });
  } catch {
    // Ignore storage failures so grading can continue.
  }
}

export default function Home() {
  const router = useRouter();
  const { markViewed, resetProgress, syncViewedFromStorage } = useMuscleBriefProgress();
  const { progressState, resetLearningProgressRemote } = useLearnerProgress();
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [currentMuscleIndex, setCurrentMuscleIndex] = useState(0);
  const [studyCards, setStudyCards] = useState<StudyCard[]>(() =>
    cards.map((card) => ({ ...card })),
  );
  const [cardFeedback, setCardFeedback] = useState(createInitialCardFeedbackState);
  const [feedbackQueuedCard, setFeedbackQueuedCard] = useState<QueuedCard | null>(
    null,
  );
  const [feedbackPresentationKey, setFeedbackPresentationKey] = useState<
    string | null
  >(null);
  const lastSyncedPresentationKeyRef = useRef<string | null>(null);
  const answerShown = cardFeedback.answerShown;
  const feedbackGrade = cardFeedback.feedbackGrade;
  const [reviewProfile, setReviewProfile] = useState<MuscleProfile | null>(
    null,
  );
  const [correctCount, setCorrectCount] = useState(0);
  const [partialCount, setPartialCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [studyDaySession, setStudyDaySession] =
    useState<SameSessionRelearnState | null>(null);
  const [obligationProgress, setObligationProgress] =
    useState<StudyDayObligationProgress | null>(null);
  const [reviewSession, setReviewSession] =
    useState<SameSessionRelearnState | null>(null);
  const {
    dashboardCourse,
    totalMuscleCount,
    totalStudyDays,
    currentStudyDay,
    dueReviewPromptCount,
    introducedMuscleCount,
    canStartGuidedStudy,
    hasResumableStudySession,
    isStudyDayComplete,
    canAdvanceStudyDay,
    refreshDashboardStats,
  } = useDashboardStats(screen === "dashboard");
  const plannedStaticQueueRef = useRef<QueuedCard[]>([]);
  const hasRestoredSessionRef = useRef(false);

  const selectedProfile = activeCourse
    ? getCourseProfileAtIndex(activeCourse, currentMuscleIndex)
    : undefined;
  const activeSession =
    screen === "mixed-review" || (screen === "brief-review" && reviewSession)
      ? reviewSession
      : studyDaySession;
  const activeQueuedCard = activeSession?.queue[activeSession.index];
  const displayedQueuedCard =
    feedbackGrade !== null && feedbackQueuedCard
      ? feedbackQueuedCard
      : activeQueuedCard;
  const activeStudyCard =
    displayedQueuedCard && activeCourse
      ? resolveQueuedCardToStudyCard(
          displayedQueuedCard,
          studyCards,
          activeCourse,
        )
      : undefined;
  const currentPresentationKey =
    feedbackGrade === null && activeQueuedCard && activeSession
      ? getCardPresentationKey({
          cardKey: activeQueuedCard.cardKey,
          sessionIndex: activeSession.index,
          isPendingRetry: activeQueuedCard.isPendingRetry,
          presentationSequence: activeSession.gradedPromptCount,
        })
      : null;
  const studySessionPresentationKey =
    feedbackPresentationKey ?? currentPresentationKey ?? "study-card";
  const studyDayCardProgress =
    screen === "study-day" && obligationProgress
      ? getObligationProgressCounts(obligationProgress)
      : null;

  useEffect(() => {
    if (currentPresentationKey === null) {
      return;
    }

    setCardFeedback((state) =>
      resolveCardFeedbackForPresentation(
        state,
        lastSyncedPresentationKeyRef.current,
        currentPresentationKey,
      ),
    );
    lastSyncedPresentationKeyRef.current = currentPresentationKey;
  }, [currentPresentationKey]);
  const isMixedReviewFlow =
    screen === "mixed-review" ||
    (screen === "brief-review" && reviewSession !== null);

  function restoreStudySessionFromPersistence(
    persisted: PersistedActiveStudySession,
    course: Course,
  ) {
    const prepared = preparePersistedActiveStudySessionForRestore(persisted);

    plannedStaticQueueRef.current = prepared.plannedStaticQueue.map((card) => ({
      ...card,
    }));
    setObligationProgress({
      total: prepared.obligationProgress.total,
      completedObligationIds: [...prepared.obligationProgress.completedObligationIds],
    });
    setStudyDaySession(prepared.session);
    setActiveCourse(course);
    setCurrentMuscleIndex(prepared.currentMuscleIndex);
    setCardFeedback({ ...prepared.cardFeedback });
    setFeedbackQueuedCard(
      prepared.feedbackQueuedCard ? { ...prepared.feedbackQueuedCard } : null,
    );
    setFeedbackPresentationKey(prepared.feedbackPresentationKey);
    lastSyncedPresentationKeyRef.current =
      prepared.feedbackPresentationKey ??
      (prepared.screen === "study-day"
        ? getCardPresentationKey({
            cardKey:
              prepared.session.queue[prepared.session.index]?.cardKey ??
              "restored",
            sessionIndex: prepared.session.index,
            isPendingRetry:
              prepared.session.queue[prepared.session.index]?.isPendingRetry,
            presentationSequence: prepared.session.gradedPromptCount,
          })
        : null);

    if (prepared.reviewProfileId) {
      setReviewProfile(getMuscleProfileById(prepared.reviewProfileId) ?? null);
    } else {
      setReviewProfile(null);
    }

    setScreen(prepared.screen);
  }

  function recoverInvalidStudyPresentation() {
    if (!studyDaySession || !activeCourse) {
      setScreen("dashboard");
      return;
    }

    const sanitized = sanitizeSameSessionRelearnState(studyDaySession);
    setStudyDaySession(sanitized);
    resetSessionStats();
    proceedToSessionCard(sanitized, activeCourse);
  }

  function persistActiveStudySessionState(
    overrides: Partial<{
      session: SameSessionRelearnState;
      screen: Screen;
      currentMuscleIndex: number;
      cardFeedback: CardFeedbackState;
      feedbackQueuedCard: QueuedCard | null;
      feedbackPresentationKey: string | null;
      reviewProfile: MuscleProfile | null;
      obligationProgress: StudyDayObligationProgress | null;
    }> = {},
  ) {
    const session = overrides.session ?? studyDaySession;
    const course = activeCourse;

    if (!session || !course) {
      return;
    }

    const persistableScreen = getPersistableStudyScreen(
      overrides.screen ?? screen,
    );

    if (!persistableScreen) {
      return;
    }

    if (isStudyDaySessionComplete(session)) {
      clearActiveStudySession();
      return;
    }

    const courseProgress = getCourseProgress(course.id);

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: course.id,
        studyDay: getCurrentStudyDay(courseProgress),
        plannedStaticQueue: plannedStaticQueueRef.current,
        session,
        screen: persistableScreen,
        currentMuscleIndex: overrides.currentMuscleIndex ?? currentMuscleIndex,
        cardFeedback: overrides.cardFeedback ?? cardFeedback,
        feedbackQueuedCard:
          overrides.feedbackQueuedCard ?? feedbackQueuedCard,
        feedbackPresentationKey:
          overrides.feedbackPresentationKey ?? feedbackPresentationKey,
        reviewProfileId: (overrides.reviewProfile ?? reviewProfile)?.id ?? null,
        obligationProgress:
          overrides.obligationProgress ??
          obligationProgress ??
          undefined,
      }),
    );
  }

  useEffect(() => {
    if (progressState.status !== "ready") {
      return;
    }

    const course = getCourseById(DEFAULT_COURSE_ID);

    if (!course) {
      return;
    }

    const courseProgress = getCourseProgress(course.id);
    const persisted = readActiveStudySession();

    if (!isResumableActiveStudySession(persisted, course.id, courseProgress)) {
      if (persisted) {
        clearActiveStudySession();
      }

      resetStudyDaySession();
      resetReviewSession();
      resetCourse();
      hasRestoredSessionRef.current = true;
      return;
    }

    hasRestoredSessionRef.current = true;
    restoreStudySessionFromPersistence(persisted, course);
  }, [
    progressState.status,
    progressState.status === "ready" ? progressState.hydrationVersion : 0,
  ]);

  useEffect(() => {
    if (!studyDaySession || !activeCourse) {
      return;
    }

    persistActiveStudySessionState();
  }, [
    studyDaySession,
    activeCourse,
    screen,
    cardFeedback,
    feedbackQueuedCard,
    feedbackPresentationKey,
    currentMuscleIndex,
    reviewProfile,
    obligationProgress,
  ]);

  function resetSessionStats() {
    setCardFeedback(createInitialCardFeedbackState());
    setFeedbackQueuedCard(null);
    setFeedbackPresentationKey(null);
    lastSyncedPresentationKeyRef.current = null;
    setReviewProfile(null);
    setCorrectCount(0);
    setPartialCount(0);
    setIncorrectCount(0);
  }

  function advanceToNextCard(session: SameSessionRelearnState) {
    setFeedbackQueuedCard(null);
    setFeedbackPresentationKey(null);
    lastSyncedPresentationKeyRef.current = null;
    setCardFeedback(createInitialCardFeedbackState());
    completeActiveSession(advanceSameSessionIndex(session));
  }

  function resetStudyDaySession() {
    setStudyDaySession(null);
    setObligationProgress(null);
  }

  function resetReviewSession() {
    setReviewSession(null);
  }

  function resetCourse() {
    setActiveCourse(null);
    setCurrentMuscleIndex(0);
    resetStudyDaySession();
    resetReviewSession();
    resetSessionStats();
  }

  function setMuscleIndexForId(course: Course, muscleId: string) {
    const index = course.muscleProfileIds.indexOf(muscleId);

    if (index >= 0) {
      setCurrentMuscleIndex(index);
    }
  }

  function introduceNewMusclesForSession(
    course: Course,
    remainingNewAllowance: number,
  ) {
    const courseProgress = getCourseProgress(course.id);
    const newMuscleIds = getNewMuscleIdsForStudyDay(
      course,
      courseProgress,
      remainingNewAllowance,
    );

    for (const muscleId of newMuscleIds) {
      persistMuscleIntroduction(muscleId);
      persistCourseMuscleIntroduction(course.id, muscleId);
    }
  }

  function openBriefForMuscleId(course: Course, muscleId: string) {
    setMuscleIndexForId(course, muscleId);
    setScreen("brief");
  }

  function proceedToSessionCard(session: SameSessionRelearnState, course: Course) {
    const sanitized = sanitizeSameSessionRelearnState(session);
    const currentCard = getCurrentSessionCard(sanitized);

    if (!currentCard && sanitized.unresolvedKeys.length > 0) {
      setStudyDaySession(sanitized);
      setScreen("study-day");
      return;
    }

    const briefMuscleId = getBriefMuscleIdForSessionIndex(
      sanitized.queue,
      sanitized.index,
    );

    if (briefMuscleId) {
      setStudyDaySession(sanitized);
      openBriefForMuscleId(course, briefMuscleId);
      return;
    }

    setStudyDaySession(sanitized);
    setScreen(isMixedReviewFlow ? "mixed-review" : "study-day");
  }

  function finishStudyDaySession(
    session?: SameSessionRelearnState | null,
    courseId?: string,
  ) {
    const resolvedCourseId = courseId ?? activeCourse?.id;

    if (resolvedCourseId) {
      markStudyDayCompleted(resolvedCourseId);

      if (session && session.dailyCapReached && session.unresolvedKeys.length > 0) {
        setCarriedOverRetryKeys(resolvedCourseId, session.unresolvedKeys);
      } else if (session && session.unresolvedKeys.length === 0) {
        clearCarriedOverRetryKeys(resolvedCourseId);
      }
    }

    resetStudyDaySession();
    resetSessionStats();
    clearActiveStudySession();
    setActiveCourse(null);
    refreshDashboardStats();
    notifyProgressChanged({ immediate: true });
  }

  function handleFinishStudyDayComplete(session?: SameSessionRelearnState | null) {
    finishStudyDaySession(session ?? studyDaySession);
    setScreen("dashboard");
  }

  function handleStartMixedReview() {
    if (!dashboardCourse || dueReviewPromptCount === 0) {
      return;
    }

    const courseProgress = getCourseProgress(dashboardCourse.id);
    const currentStudyDayValue = getCurrentStudyDay(courseProgress);
    const queue = buildMixedReviewQueue(
      dashboardCourse.muscleProfileIds,
      readMasteryProgress(),
      currentStudyDayValue,
    ).filter(
      (queued) =>
        resolveQueuedCardToStudyCard(queued, studyCards, dashboardCourse) !==
        undefined,
    );

    if (queue.length === 0) {
      return;
    }

    resetSessionStats();
    setReviewSession(createSameSessionRelearnState(queue));
    resetStudyDaySession();
    setActiveCourse(dashboardCourse);
    setScreen("mixed-review");
  }

  function handleFinishMixedReview() {
    resetReviewSession();
    resetSessionStats();
    setActiveCourse(null);
    setScreen("dashboard");
  }

  function handleStartStudying() {
    const course = getCourseById(DEFAULT_COURSE_ID);

    if (!course) return;

    persistCourseStart(course.id);
    resetReviewSession();

    const courseProgress = getCourseProgress(course.id);

    if (isCurrentStudyDayCompleted(courseProgress)) {
      return;
    }

    const persisted = readActiveStudySession();

    if (isResumableActiveStudySession(persisted, course.id, courseProgress)) {
      hasRestoredSessionRef.current = true;
      restoreStudySessionFromPersistence(persisted, course);
      return;
    }

    clearActiveStudySession();

    const masteryStore = readMasteryProgress();
    const workloadPlan = planDailyWorkload(course, courseProgress, masteryStore);

    if (workloadPlan.plannedPromptCount === 0) {
      return;
    }

    introduceNewMusclesForSession(course, workloadPlan.newMuscleAllowance);
    resetSessionStats();

    const scheduledQueue = buildStudyDayScheduledQueueForCourse(
      course,
      readMasteryProgress(),
    );

    if (scheduledQueue.length === 0) {
      return;
    }

    const { queue: scheduledQueueWithIds, progress } =
      assignDailyObligationIds(scheduledQueue);
    const session = createStudyDaySessionFromQueue(scheduledQueueWithIds);
    plannedStaticQueueRef.current = getPlannedStaticQueueFromSession(session);
    setObligationProgress(progress);

    setStudyDaySession(session);
    setActiveCourse(course);
    proceedToSessionCard(session, course);
  }

  function handleStartPractice() {
    if (selectedProfile) {
      markViewed(selectedProfile.id);
    }

    resetSessionStats();

    if (studyDaySession && activeCourse) {
      setScreen("study-day");
      return;
    }

    setScreen("study-day");
  }

  function applyGradeToCard(
    type: "correct" | "partial" | "incorrect",
    card: StudyCard,
    queuedCard: QueuedCard,
  ) {
    if (type === "correct") setCorrectCount((count) => count + 1);
    if (type === "partial") setPartialCount((count) => count + 1);
    if (type === "incorrect") setIncorrectCount((count) => count + 1);

    const newMastery = updateMastery(card.mastery, type);

    setStudyCards((prev) =>
      prev.map((entry) =>
        entry.id === card.id ? { ...entry, mastery: newMastery } : entry,
      ),
    );

    persistQueuedCardGrade(queuedCard, activeCourse, type);
  }

  function completeActiveSession(session: SameSessionRelearnState) {
    if (isMixedReviewFlow) {
      if (isSameSessionRelearnComplete(session)) {
        setReviewSession(session);
        setScreen("mixed-review-complete");
        return;
      }

      setReviewSession(session);
      setScreen("mixed-review");
      return;
    }

    if (isStudyDaySessionComplete(session)) {
      if (activeCourse) {
        markStudyDayCompleted(activeCourse.id);
      }

      setStudyDaySession(session);
      clearActiveStudySession();

      if (session.dailyCapReached) {
        setScreen("study-day-complete");
        return;
      }

      handleFinishStudyDayComplete(session);
      return;
    }

    setStudyDaySession(session);

    if (activeCourse) {
      proceedToSessionCard(session, activeCourse);
    }
  }

  function handleGrade(type: "correct" | "partial" | "incorrect") {
    if (
      !activeStudyCard ||
      !activeQueuedCard ||
      !activeSession ||
      feedbackGrade !== null
    ) {
      return;
    }

    applyGradeToCard(type, activeStudyCard, activeQueuedCard);

    if (!isMixedReviewFlow && obligationProgress) {
      setObligationProgress((current) =>
        current
          ? recordObligationCompletion(
              current,
              activeQueuedCard.obligationId,
              type,
            )
          : current,
      );
    }

    const gradedSession = applySameSessionGrade(
      activeSession,
      activeQueuedCard,
      type,
    );

    if (type === "correct") {
      advanceToNextCard(gradedSession);
      return;
    }

    setFeedbackQueuedCard(activeQueuedCard);
    setFeedbackPresentationKey(
      getCardPresentationKey({
        cardKey: activeQueuedCard.cardKey,
        sessionIndex: activeSession.index,
        isPendingRetry: activeQueuedCard.isPendingRetry,
        presentationSequence: activeSession.gradedPromptCount,
      }),
    );

    if (isMixedReviewFlow) {
      setReviewSession(gradedSession);
    } else {
      setStudyDaySession(gradedSession);
    }

    setCardFeedback((state) => setCardFeedbackGrade(state, type as CardFeedbackGrade));
  }

  function handleContinueAfterFeedback() {
    if (!feedbackGrade || !activeSession) return;

    advanceToNextCard(activeSession);
  }

  function handleReviewBrief() {
    if (!activeStudyCard || !feedbackGrade) return;

    const profile = getProfileForStudyCard(activeStudyCard, activeCourse);

    if (!profile) return;

    setReviewProfile(profile);
    setScreen("brief-review");
  }

  function handleReturnToPractice() {
    setReviewProfile(null);
    setCardFeedback((state) => returnFromBriefReview(state));
    setScreen(isMixedReviewFlow ? "mixed-review" : "study-day");
  }

  function handleReturnToDashboard() {
    if (studyDaySession && activeCourse && getPersistableStudyScreen(screen)) {
      persistActiveStudySessionState();
    }

    resetReviewSession();
    resetStudyDaySession();
    resetCourse();
    setScreen("dashboard");
  }

  function handleAdvanceStudyDay() {
    if (!dashboardCourse || !canAdvanceStudyDay) {
      return;
    }

    advanceStudyDay(dashboardCourse.id);
    refreshDashboardStats();
    notifyProgressChanged({ immediate: true });
  }

  async function handleResetLearningProgress() {
    const success = await resetLearningProgressRemote();

    if (!success) {
      return;
    }

    resetProgress({ clearStorage: false });
    syncViewedFromStorage();
    resetReviewSession();
    resetStudyDaySession();
    resetCourse();
    hasRestoredSessionRef.current = false;
    plannedStaticQueueRef.current = [];
    setStudyCards(cards.map((card) => ({ ...card })));
    setScreen("dashboard");
    refreshDashboardStats();
  }

  function handleReturnToDashboardFromError() {
    if (studyDaySession && activeCourse) {
      persistActiveStudySessionState();
    }

    resetReviewSession();
    resetStudyDaySession();
    resetCourse();
    setScreen("dashboard");
  }

  return (
    <StudySessionErrorBoundary onReturnToDashboard={handleReturnToDashboardFromError}>
      {screen === "dashboard" && dashboardCourse && (
        <Dashboard
          currentStudyDay={currentStudyDay}
          totalStudyDays={totalStudyDays}
          introducedMuscleCount={introducedMuscleCount}
          totalMuscleCount={totalMuscleCount}
          onStartStudying={handleStartStudying}
          canStartGuidedStudy={canStartGuidedStudy}
          hasResumableStudySession={hasResumableStudySession}
          isStudyDayComplete={isStudyDayComplete}
          canAdvanceStudyDay={canAdvanceStudyDay}
          onAdvanceStudyDay={handleAdvanceStudyDay}
          onOpenMuscleLibrary={() => router.push("/library")}
          onOpenMemoryCode={() => router.push("/memory-code")}
          onResetLearningProgress={handleResetLearningProgress}
        />
      )}

      {(screen === "brief" && selectedProfile) ||
      (screen === "brief-review" && reviewProfile) ? (
        <MuscleBriefScreen
          profile={
            screen === "brief-review" ? reviewProfile! : selectedProfile!
          }
          mode={screen === "brief-review" ? "review" : "course"}
          onPrimaryAction={
            screen === "brief-review"
              ? handleReturnToPractice
              : handleStartPractice
          }
        />
      ) : null}

      {screen === "mixed-review" && activeStudyCard && activeSession && dashboardCourse && (
        <StudySession
          key={studySessionPresentationKey}
          muscle={activeStudyCard.muscle}
          question={getQuestion(activeStudyCard.category)}
          answer={activeStudyCard.answer}
          answerShown={answerShown}
          feedbackGrade={feedbackGrade}
          onShowAnswer={() =>
            setCardFeedback((state) => showCardAnswer(state))
          }
          onGrade={handleGrade}
          onReviewBrief={handleReviewBrief}
          onContinue={handleContinueAfterFeedback}
        />
      )}

      {screen === "mixed-review-complete" && (
        <SessionComplete
          title="Review complete"
          showStudyAgain={false}
          onReturnToDashboard={handleFinishMixedReview}
        />
      )}

      {screen === "study-day" &&
        activeSession &&
        activeCourse &&
        !activeStudyCard && (
          <Card className="space-y-4 text-center">
            <h2 className="text-xl font-semibold text-text-primary">
              Restoring your place
            </h2>
            <p className="text-sm leading-relaxed text-text-secondary">
              The current card could not be displayed safely. Recover your saved
              session to continue studying.
            </p>
            <Button fullWidth onClick={recoverInvalidStudyPresentation}>
              Recover Session
            </Button>
          </Card>
        )}

      {screen === "study-day" && activeStudyCard && activeSession && activeCourse && (
        <StudySession
          key={studySessionPresentationKey}
          muscle={activeStudyCard.muscle}
          question={getQuestion(activeStudyCard.category)}
          answer={activeStudyCard.answer}
          answerShown={answerShown}
          feedbackGrade={feedbackGrade}
          cardProgressCompleted={studyDayCardProgress?.completed}
          cardProgressTotal={studyDayCardProgress?.total}
          onShowAnswer={() =>
            setCardFeedback((state) => showCardAnswer(state))
          }
          onGrade={handleGrade}
          onReviewBrief={handleReviewBrief}
          onContinue={handleContinueAfterFeedback}
        />
      )}

      {screen === "study-day-complete" && (
        <SessionComplete
          title="Study day complete"
          onReturnToDashboard={handleFinishStudyDayComplete}
        />
      )}

      {screen === "course-complete" && activeCourse && (
        <CourseComplete
          courseName={activeCourse.name}
          muscleCount={getCourseProfiles(activeCourse).length}
          onReturnToDashboard={handleReturnToDashboard}
        />
      )}
      </StudySessionErrorBoundary>
  );
}
