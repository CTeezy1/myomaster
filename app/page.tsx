"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseComplete } from "@/app/components/CourseComplete";
import { Dashboard } from "@/app/components/Dashboard";
import { MuscleBrief } from "@/app/components/MuscleBrief";
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
  markMuscleIntroduced,
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
  getDisplayedQuestionNumber,
  getDisplayedQuestionTotal,
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
    plannedPromptCount,
    dueReviewPromptCount,
    newMusclePromptCount,
    showWorkloadWarning,
    introducedMuscleCount,
    masteredMuscleCount,
    remainingNewMuscleAllowance,
    canStartGuidedStudy,
    guidedStudyLabel,
    canStartReview,
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
  const activeStudyCard =
    activeQueuedCard && activeCourse
      ? resolveQueuedCardToStudyCard(
          activeQueuedCard,
          studyCards,
          activeCourse,
        )
      : undefined;
  const isMixedReviewFlow =
    screen === "mixed-review" ||
    (screen === "brief-review" && reviewSession !== null);

  function resetSessionStats() {
    setCardFeedback(createInitialCardFeedbackState());
    setReviewProfile(null);
    setCorrectCount(0);
    setPartialCount(0);
    setIncorrectCount(0);
  }

  function advanceToNextCard(session: SameSessionRelearnState) {
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

  function finishStudyDaySession(session?: SameSessionRelearnState | null) {
    if (session && activeCourse) {
      if (session.dailyCapReached && session.unresolvedKeys.length > 0) {
        setCarriedOverRetryKeys(activeCourse.id, session.unresolvedKeys);
      } else if (session.unresolvedKeys.length === 0) {
        clearCarriedOverRetryKeys(activeCourse.id);
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
      feedbackGrade !== null ||
      activeSession.dailyCapReached
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
          courseName={dashboardCourse.name}
          currentStudyDay={currentStudyDay}
          totalStudyDays={totalStudyDays}
          plannedPromptCount={plannedPromptCount}
          dueReviewPromptCount={dueReviewPromptCount}
          newMusclePromptCount={newMusclePromptCount}
          showWorkloadWarning={showWorkloadWarning}
          introducedMuscleCount={introducedMuscleCount}
          masteredMuscleCount={masteredMuscleCount}
          totalMuscleCount={totalMuscleCount}
          onStartStudying={handleStartStudying}
          guidedStudyLabel={guidedStudyLabel}
          canStartGuidedStudy={canStartGuidedStudy}
          remainingNewMuscleAllowance={remainingNewMuscleAllowance}
          canAdvanceStudyDay={canAdvanceStudyDay}
          onAdvanceStudyDay={handleAdvanceStudyDay}
          onStartReview={handleStartMixedReview}
          canStartReview={canStartReview}
          onOpenMuscleLibrary={() => router.push("/library")}
          onResetLearningProgress={handleResetLearningProgress}
        />
      )}

      {screen === "brief" && selectedProfile && (
        <MuscleBrief
          profile={selectedProfile}
          mode="course"
          onPrimaryAction={handleStartPractice}
        />
      )}

      {screen === "brief-review" && reviewProfile && (
        <MuscleBrief
          profile={reviewProfile}
          mode="review"
          onPrimaryAction={handleReturnToPractice}
        />
      )}

      {screen === "mixed-review" && activeStudyCard && activeSession && dashboardCourse && (
        <StudySession
          moduleName={`${dashboardCourse.name} Review`}
          currentIndex={activeSession.index}
          totalCards={activeSession.queue.length}
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
          correctCount={correctCount}
          partialCount={partialCount}
          incorrectCount={incorrectCount}
          title="Review complete"
          showStudyAgain={false}
          onReturnToDashboard={handleFinishMixedReview}
        />
      )}

      {screen === "study-day" && activeStudyCard && activeSession && activeCourse && (
        <StudySession
          moduleName={`${activeCourse.name} · Study Day ${currentStudyDay}`}
          currentIndex={getDisplayedQuestionNumber(activeSession) - 1}
          totalCards={getDisplayedQuestionTotal(activeSession)}
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
          correctCount={correctCount}
          partialCount={partialCount}
          incorrectCount={incorrectCount}
          title="Study day complete"
          description="Today's 40-question limit is complete. Unresolved cards will return first next study day."
          showStudyAgain={false}
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
