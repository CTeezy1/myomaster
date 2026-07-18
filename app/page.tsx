"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseComplete } from "@/app/components/CourseComplete";
import { Dashboard } from "@/app/components/Dashboard";
import { MuscleBrief } from "@/app/components/MuscleBrief";
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
  hasNextMuscle,
} from "@/src/lib/course-controller";
import {
  getCardsForMuscleProfile,
  getModuleDisplayName,
} from "@/src/lib/study-session";

type Screen = "dashboard" | "brief" | "brief-review" | "study" | "course-complete";

type StudyCard = (typeof cards)[number];

function getQuestion(category: string) {
  return `What is the ${category.toLowerCase()}?`;
}

function getEstimatedMinutes(cardCount: number) {
  return Math.ceil((cardCount * 15) / 60);
}

function updateMastery(
  mastery: number,
  type: "correct" | "partial" | "incorrect",
) {
  if (type === "correct") return Math.min(mastery + 1, 5);
  if (type === "incorrect") return Math.max(mastery - 1, 0);
  return mastery;
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

  const selectedProfile = activeCourse
    ? getCourseProfileAtIndex(activeCourse, currentMuscleIndex)
    : undefined;
  const sessionCards = selectedProfile
    ? getCardsForMuscleProfile(studyCards, selectedProfile)
    : [];
  const currentCard = sessionCards[currentCardIndex];
  const estimatedMinutes = getEstimatedMinutes(studyCards.length);

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

  function beginMuscle(profile: MuscleProfile) {
    resetMuscleSession();

    if (hasViewed(profile.id)) {
      setScreen("study");
      return;
    }

    setScreen("brief");
  }

  function handleStartStudying() {
    const course = getCourseById(DEFAULT_COURSE_ID);

    if (!course) return;

    const firstProfile = getCourseProfileAtIndex(course, 0);

    if (!firstProfile) return;

    setActiveCourse(course);
    setCurrentMuscleIndex(0);
    beginMuscle(firstProfile);
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

    if (hasNextMuscle(activeCourse, currentMuscleIndex)) {
      const nextIndex = currentMuscleIndex + 1;
      const nextProfile = getCourseProfileAtIndex(activeCourse, nextIndex);

      if (!nextProfile) return;

      setCurrentMuscleIndex(nextIndex);
      beginMuscle(nextProfile);
      return;
    }

    resetMuscleSession();
    setScreen("course-complete");
  }

  function applyGrade(type: "correct" | "partial" | "incorrect") {
    if (!currentCard) return;

    if (type === "correct") setCorrectCount((count) => count + 1);
    if (type === "partial") setPartialCount((count) => count + 1);
    if (type === "incorrect") setIncorrectCount((count) => count + 1);

    const newMastery = updateMastery(currentCard.mastery, type);

    setStudyCards((prev) =>
      prev.map((card) =>
        card.id === currentCard.id
          ? { ...card, mastery: newMastery }
          : card,
      ),
    );
  }

  function handleGrade(type: "correct" | "partial" | "incorrect") {
    if (!currentCard || feedbackGrade !== null) return;

    applyGrade(type);

    if (type === "correct") {
      advanceToNextCard();
      return;
    }

    setFeedbackGrade(type);
  }

  function handleContinueAfterFeedback() {
    if (!feedbackGrade) return;

    advanceToNextCard();
  }

  function handleReviewBrief() {
    if (!currentCard || !feedbackGrade) return;

    const profile = getProfileForStudyCard(currentCard, activeCourse);

    if (!profile) return;

    setReviewProfile(profile);
    setScreen("brief-review");
  }

  function handleReturnToPractice() {
    setReviewProfile(null);
    setScreen("study");
  }

  function handleReturnToDashboard() {
    resetCourse();
    setScreen("dashboard");
  }

  return (
    <PageShell>
      {screen === "dashboard" && (
        <Dashboard
          cardCount={studyCards.length}
          estimatedMinutes={estimatedMinutes}
          onStartStudying={handleStartStudying}
          onOpenMuscleLibrary={() => router.push("/library")}
          onResetLearningProgress={resetProgress}
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
