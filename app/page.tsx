"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CourseComplete } from "@/app/components/CourseComplete";
import { Dashboard } from "@/app/components/Dashboard";
import { MuscleBriefScreen } from "@/app/components/MuscleBriefScreen";
import { SessionComplete } from "@/app/components/SessionComplete";
import { StudySession } from "@/app/components/StudySession";
import { PageShell } from "@/app/components/ui/PageShell";
import { useDashboardStats } from "@/src/hooks/useDashboardStats";
import { useMuscleBriefProgress } from "@/src/hooks/useMuscleBriefProgress";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { cards } from "@/src/data/cards";
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
  isSameSessionRelearnComplete,
  type SameSessionRelearnState,
} from "@/src/lib/same-session-relearn";
import {
  buildStudyDaySession,
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
} from "@/src/lib/quiz-card-state";

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
  } catch {
    // Ignore storage failures so grading can continue.
  }
}

export default function Home() {
  const router = useRouter();
  const { markViewed, resetProgress } = useMuscleBriefProgress();
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
    isStudyDayComplete,
    canAdvanceStudyDay,
    refreshDashboardStats,
  } = useDashboardStats(screen === "dashboard");

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
    const briefMuscleId = getBriefMuscleIdForSessionIndex(
      session.queue,
      session.index,
    );

    if (briefMuscleId) {
      openBriefForMuscleId(course, briefMuscleId);
      return;
    }

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
    setActiveCourse(null);
    refreshDashboardStats();
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

    const masteryStore = readMasteryProgress();
    const workloadPlan = planDailyWorkload(
      course,
      courseProgress,
      masteryStore,
    );

    if (workloadPlan.queue.length === 0) {
      return;
    }

    introduceNewMusclesForSession(course, workloadPlan.newMuscleAllowance);
    resetSessionStats();
    const session = buildStudyDaySession(
      course,
      courseProgress,
      masteryStore,
    );
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
  }

  function handleResetLearningProgress() {
    resetProgress();
    resetReviewSession();
    resetStudyDaySession();
    resetCourse();
    setStudyCards(cards.map((card) => ({ ...card })));
    setScreen("dashboard");
    refreshDashboardStats();
  }

  return (
    <PageShell>
      {screen === "dashboard" && dashboardCourse && (
        <Dashboard
          currentStudyDay={currentStudyDay}
          totalStudyDays={totalStudyDays}
          introducedMuscleCount={introducedMuscleCount}
          totalMuscleCount={totalMuscleCount}
          onStartStudying={handleStartStudying}
          canStartGuidedStudy={canStartGuidedStudy}
          isStudyDayComplete={isStudyDayComplete}
          canAdvanceStudyDay={canAdvanceStudyDay}
          onAdvanceStudyDay={handleAdvanceStudyDay}
          onOpenMuscleLibrary={() => router.push("/library")}
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

      {screen === "study-day" && activeStudyCard && activeSession && activeCourse && (
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
    </PageShell>
  );
}
