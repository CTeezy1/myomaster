"use client";

import { useState } from "react";
import { cards } from "@/src/data/cards";

type Screen = "dashboard" | "study" | "complete";

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
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [studyCards, setStudyCards] = useState<StudyCard[]>(() =>
    cards.map((card) => ({ ...card })),
  );
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [answerShown, setAnswerShown] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [partialCount, setPartialCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);

  const currentCard = studyCards[currentCardIndex];
  const estimatedMinutes = getEstimatedMinutes(studyCards.length);

  function resetSession() {
    setCurrentCardIndex(0);
    setAnswerShown(false);
    setCorrectCount(0);
    setPartialCount(0);
    setIncorrectCount(0);
  }

  function handleStartStudying() {
    resetSession();
    setScreen("study");
  }

  function handleGrade(type: "correct" | "partial" | "incorrect") {
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

    setAnswerShown(false);

    const nextIndex = currentCardIndex + 1;
    setCurrentCardIndex(nextIndex);

    if (nextIndex >= studyCards.length) {
      setScreen("complete");
    }
  }

  function handleStudyAgain() {
    resetSession();
    setScreen("study");
  }

  function handleReturnToDashboard() {
    setScreen("dashboard");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          MyoMaster
        </h1>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {screen === "dashboard" && (
            <div>
              <p className="text-lg text-slate-700">Welcome, Student!</p>

              <h2 className="mt-8 text-xl font-semibold text-slate-900">
                Today&apos;s Study Session
              </h2>

              <div className="mt-6 space-y-3 text-left text-base text-slate-700">
                <p>
                  New Cards:{" "}
                  <span className="font-medium text-slate-900">
                    {studyCards.length}
                  </span>
                </p>
                <p>
                  Review Cards:{" "}
                  <span className="font-medium text-slate-900">0</span>
                </p>
                <p>
                  Estimated Time:{" "}
                  <span className="font-medium text-slate-900">
                    {estimatedMinutes} {estimatedMinutes === 1 ? "minute" : "minutes"}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartStudying}
                className="mt-8 w-full rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Start Studying
              </button>
            </div>
          )}

          {screen === "study" && currentCard && (
            <>
              <p className="text-sm font-medium text-slate-500">
                Question {currentCardIndex + 1} of {studyCards.length}
              </p>

              <p className="mt-6 text-sm font-medium uppercase tracking-wider text-slate-500">
                Muscle
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {currentCard.muscle}
              </h2>

              <p className="mt-8 text-lg text-slate-700">
                {getQuestion(currentCard.category)}
              </p>

              {!answerShown ? (
                <button
                  type="button"
                  onClick={() => setAnswerShown(true)}
                  className="mt-8 w-full rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  Show Answer
                </button>
              ) : (
                <div className="mt-8">
                  <p className="rounded-lg bg-slate-50 px-4 py-3 text-base font-medium text-slate-900">
                    {currentCard.answer}
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleGrade("correct")}
                      className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
                    >
                      Correct
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGrade("partial")}
                      className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
                    >
                      Partially Correct
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGrade("incorrect")}
                      className="flex-1 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-800 transition-colors hover:bg-rose-100"
                    >
                      Incorrect
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {screen === "complete" && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Session Complete
              </h2>

              <div className="mt-8 space-y-2 text-left text-base text-slate-700">
                <p>
                  Correct:{" "}
                  <span className="font-medium text-emerald-700">
                    {correctCount}
                  </span>
                </p>
                <p>
                  Partial:{" "}
                  <span className="font-medium text-amber-700">
                    {partialCount}
                  </span>
                </p>
                <p>
                  Incorrect:{" "}
                  <span className="font-medium text-rose-700">
                    {incorrectCount}
                  </span>
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleStudyAgain}
                  className="w-full rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  Study Again
                </button>
                <button
                  type="button"
                  onClick={handleReturnToDashboard}
                  className="w-full rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
