"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseComplete } from "@/app/components/CourseComplete";
import { Dashboard } from "@/app/components/Dashboard";
import { MuscleBrief } from "@/app/components/MuscleBrief";
import { SessionComplete } from "@/app/components/SessionComplete";
import {
  StudySession,
  type FeedbackGrade,
} from "@/app/components/StudySession";
import { PageShell } from "@/app/components/ui/PageShell";
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
import { addRecentGrade, getCourseProgress, markMuscleIntroduced, startCourseIfNotStarted } from "@/src/lib/course-progress";
import {
  getDueReviewPromptCount,
  getIntroducedMuscleCount,
  getMasteredMuscleCount,
} from "@/src/lib/dashboard-progress";
import {
  findNextGuidedMuscleIndex,
  getGuidedDailyNewMuscleAllowance,
  getGuidedStudyButtonLabel,
  isMuscleGuidedComplete,
} from "@/src/lib/guided-scheduling";
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
import type { Grade } from "@/src/lib/progress.types";
import {
  getCardsForMuscleProfile,
  getModuleDisplayName,
} from "@/src/lib/study-session";

type Screen =
  | "dashboard"
  | "brief"
  | "brief-review"
  | "study"
  | "course-complete"
  | "mixed-review"
  | "mixed-review-complete";

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

function persistCardGrade(
  card: StudyCard,
  course: Course | null,
  grade: Grade,
) {
  try {
    const profile = getProfileForStudyCard(card, course);

    if (!profile) {
      return;
    }

    const category = normalizeCardCategory(card.category);

    if (!category) {
      return;
    }

    const store = readMasteryProgress();
    const updatedStore = applyCardGrade(
      store,
      profile.id,
      category,
      grade,
      new Date(),
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
  const { hasViewed, markViewed, resetProgress } = useMuscleBriefProgress();
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [currentMuscleIndex, setCurrentMuscleIndex] = useState(0);
  const [studyCards, setStudyCards] = useState<StudyCard[]>(() =>
    cards.map((card) => ({ ...card })),
  );
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [answerShown, setAnswerShown] = useState(false);
  const [feedbackGrade, setFeedbackGrade] = useState<FeedbackGrade | null>(
    null,
  );
  const [reviewProfile, setReviewProfile] = useState<MuscleProfile | null>(
    null,
  );
  const [correctCount, setCorrectCount] = useState(0);
  const [partialCount, setPartialCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [reviewQueue, setReviewQueue] = useState<QueuedCard[]>([]);
  const [reviewCardIndex, setReviewCardIndex] = useState(0);

  const selectedProfile = activeCourse
    ? getCourseProfileAtIndex(activeCourse, currentMuscleIndex)
    : undefined;
  const sessionCards = selectedProfile
    ? getCardsForMuscleProfile(studyCards, selectedProfile)
    : [];
  const currentCard = sessionCards[currentCardIndex];
  const dashboardCourse = getCourseById(DEFAULT_COURSE_ID);
  const dashboardMuscleIds = dashboardCourse?.muscleProfileIds ?? [];
  const dashboardMasteryStore = readMasteryProgress();
  const dashboardCourseProgress = getCourseProgress(DEFAULT_COURSE_ID);
  const dashboardNow = new Date();
  const dueReviewPromptCount = getDueReviewPromptCount(
    dashboardMuscleIds,
    dashboardMasteryStore,
    dashboardNow,
  );
  const introducedMuscleCount = getIntroducedMuscleCount(
    dashboardMuscleIds,
    dashboardCourseProgress.introducedMuscleIds,
  );
  const masteredMuscleCount = getMasteredMuscleCount(
    dashboardMuscleIds,
    dashboardMasteryStore,
  );
  const totalMuscleCount = dashboardMuscleIds.length;
  const remainingNewMuscleAllowance = dashboardCourse
    ? getGuidedDailyNewMuscleAllowance(
        dashboardCourseProgress,
        dashboardMuscleIds,
        dashboardMasteryStore,
        dashboardNow,
      )
    : 0;
  const nextGuidedMuscle = dashboardCourse
    ? findNextGuidedMuscleIndex(
        dashboardCourse,
        dashboardCourseProgress,
        dashboardMasteryStore,
        remainingNewMuscleAllowance,
      )
    : null;
  const canStartGuidedStudy = nextGuidedMuscle !== null;
  const guidedStudyLabel = getGuidedStudyButtonLabel(nextGuidedMuscle);
  const mixedReviewQueuedCard = reviewQueue[reviewCardIndex];
  const mixedReviewStudyCard =
    dashboardCourse && mixedReviewQueuedCard
      ? resolveQueuedCardToStudyCard(
          mixedReviewQueuedCard,
          studyCards,
          dashboardCourse,
        )
      : undefined;
  const isMixedReviewFlow =
    screen === "mixed-review" ||
    (screen === "brief-review" && reviewQueue.length > 0);
  const activeStudyCard = isMixedReviewFlow ? mixedReviewStudyCard : currentCard;

  function resetMixedReviewSession() {
    setReviewQueue([]);
    setReviewCardIndex(0);
  }

  function resetMuscleSession() {
    setCurrentCardIndex(0);
    setAnswerShown(false);
    setFeedbackGrade(null);
    setReviewProfile(null);
    setCorrectCount(0);
    setPartialCount(0);
    setIncorrectCount(0);
  }

  function resetCourse() {
    setActiveCourse(null);
    setCurrentMuscleIndex(0);
    resetMuscleSession();
  }

  function beginMuscle(profile: MuscleProfile, course: Course) {
    resetMuscleSession();
    persistMuscleIntroduction(profile.id);
    persistCourseMuscleIntroduction(course.id, profile.id);

    if (hasViewed(profile.id)) {
      setScreen("study");
      return;
    }

    setScreen("brief");
  }

  function handleStartMixedReview() {
    if (!dashboardCourse || dueReviewPromptCount === 0) {
      return;
    }

    const queue = buildMixedReviewQueue(
      dashboardMuscleIds,
      readMasteryProgress(),
      new Date(),
    ).filter(
      (queued) =>
        resolveQueuedCardToStudyCard(queued, studyCards, dashboardCourse) !==
        undefined,
    );

    if (queue.length === 0) {
      return;
    }

    resetMuscleSession();
    setReviewQueue(queue);
    setReviewCardIndex(0);
    setActiveCourse(dashboardCourse);
    setScreen("mixed-review");
  }

  function advanceMixedReviewCard() {
    setAnswerShown(false);
    setFeedbackGrade(null);

    const nextIndex = reviewCardIndex + 1;

    if (nextIndex >= reviewQueue.length) {
      setScreen("mixed-review-complete");
      return;
    }

    setReviewCardIndex(nextIndex);
  }

  function handleFinishMixedReview() {
    resetMixedReviewSession();
    resetMuscleSession();
    setActiveCourse(null);
    setScreen("dashboard");
  }

  function handleStartStudying() {
    const course = getCourseById(DEFAULT_COURSE_ID);

    if (!course) return;

    persistCourseStart(course.id);
    resetMixedReviewSession();

    const courseProgress = getCourseProgress(course.id);
    const masteryStore = readMasteryProgress();
    const now = new Date();
    const remainingNewAllowance = getGuidedDailyNewMuscleAllowance(
      courseProgress,
      course.muscleProfileIds,
      masteryStore,
      now,
    );
    const next = findNextGuidedMuscleIndex(
      course,
      courseProgress,
      masteryStore,
      remainingNewAllowance,
    );

    if (!next) return;

    const profile = getCourseProfileAtIndex(course, next.index);

    if (!profile) return;

    setActiveCourse(course);
    setCurrentMuscleIndex(next.index);
    beginMuscle(profile, course);
  }

  function handleStartPractice() {
    if (selectedProfile) {
      markViewed(selectedProfile.id);
    }

    resetMuscleSession();
    setScreen("study");
  }

  function advanceToNextCard() {
    setAnswerShown(false);
    setFeedbackGrade(null);

    const nextIndex = currentCardIndex + 1;
    setCurrentCardIndex(nextIndex);

    if (nextIndex >= sessionCards.length) {
      advanceCourseAfterMuscle();
    }
  }

  function advanceCourseAfterMuscle() {
    if (!activeCourse) return;

    const courseProgress = getCourseProgress(activeCourse.id);
    const masteryStore = readMasteryProgress();
    const now = new Date();
    const remainingNewAllowance = getGuidedDailyNewMuscleAllowance(
      courseProgress,
      activeCourse.muscleProfileIds,
      masteryStore,
      now,
    );
    const next = findNextGuidedMuscleIndex(
      activeCourse,
      courseProgress,
      masteryStore,
      remainingNewAllowance,
    );

    if (!next) {
      const allComplete = activeCourse.muscleProfileIds.every(
        (muscleId) =>
          courseProgress.introducedMuscleIds.includes(muscleId) &&
          isMuscleGuidedComplete(muscleId, masteryStore),
      );

      resetMuscleSession();

      if (allComplete) {
        setScreen("course-complete");
        return;
      }

      setActiveCourse(null);
      setScreen("dashboard");
      return;
    }

    setCurrentMuscleIndex(next.index);
    beginMuscle(getCourseProfileAtIndex(activeCourse, next.index)!, activeCourse);
  }

  function applyGrade(
    type: "correct" | "partial" | "incorrect",
    card: StudyCard,
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

    persistCardGrade(card, activeCourse, type);
  }

  function handleGrade(type: "correct" | "partial" | "incorrect") {
    if (!activeStudyCard || feedbackGrade !== null) return;

    applyGrade(type, activeStudyCard);

    if (type === "correct") {
      if (isMixedReviewFlow) {
        advanceMixedReviewCard();
        return;
      }

      advanceToNextCard();
      return;
    }

    setFeedbackGrade(type);
  }

  function handleContinueAfterFeedback() {
    if (!feedbackGrade) return;

    if (isMixedReviewFlow) {
      advanceMixedReviewCard();
      return;
    }

    advanceToNextCard();
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
    setScreen(isMixedReviewFlow ? "mixed-review" : "study");
  }

  function handleReturnToDashboard() {
    resetMixedReviewSession();
    resetCourse();
    setScreen("dashboard");
  }

  function handleResetLearningProgress() {
    resetProgress();
    resetMixedReviewSession();
    resetCourse();
    setStudyCards(cards.map((card) => ({ ...card })));
    setScreen("dashboard");
  }

  return (
    <PageShell>
      {screen === "dashboard" && dashboardCourse && (
        <Dashboard
          courseName={dashboardCourse.name}
          dueReviewPromptCount={dueReviewPromptCount}
          introducedMuscleCount={introducedMuscleCount}
          masteredMuscleCount={masteredMuscleCount}
          totalMuscleCount={totalMuscleCount}
          onStartStudying={handleStartStudying}
          guidedStudyLabel={guidedStudyLabel}
          canStartGuidedStudy={canStartGuidedStudy}
          remainingNewMuscleAllowance={remainingNewMuscleAllowance}
          onStartReview={handleStartMixedReview}
          canStartReview={dueReviewPromptCount > 0}
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

      {screen === "mixed-review" && activeStudyCard && dashboardCourse && (
        <StudySession
          moduleName={`${dashboardCourse.name} Review`}
          currentIndex={reviewCardIndex}
          totalCards={reviewQueue.length}
          muscle={activeStudyCard.muscle}
          question={getQuestion(activeStudyCard.category)}
          answer={activeStudyCard.answer}
          answerShown={answerShown}
          feedbackGrade={feedbackGrade}
          onShowAnswer={() => setAnswerShown(true)}
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

      {screen === "study" && selectedProfile && currentCard && (
        <StudySession
          moduleName={getModuleDisplayName(selectedProfile.region)}
          currentIndex={currentCardIndex}
          totalCards={sessionCards.length}
          muscle={currentCard.muscle}
          question={getQuestion(currentCard.category)}
          answer={currentCard.answer}
          answerShown={answerShown}
          feedbackGrade={feedbackGrade}
          onShowAnswer={() => setAnswerShown(true)}
          onGrade={handleGrade}
          onReviewBrief={handleReviewBrief}
          onContinue={handleContinueAfterFeedback}
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
