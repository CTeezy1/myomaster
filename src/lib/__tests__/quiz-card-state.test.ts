import { describe, expect, it } from "vitest";
import {
  advanceToNextCard,
  createInitialCardFeedbackState,
  getCardPresentationKey,
  resolveCardFeedbackForPresentation,
  returnFromBriefReview,
  setCardFeedbackGrade,
  shouldResetCardFeedbackForPresentation,
  showCardAnswer,
} from "@/src/lib/quiz-card-state";

describe("quiz card feedback state", () => {
  it("first card starts hidden", () => {
    expect(createInitialCardFeedbackState()).toEqual({
      answerShown: false,
      feedbackGrade: null,
    });
  });

  it("second card starts hidden after advancing from a revealed card", () => {
    const firstCard = showCardAnswer(createInitialCardFeedbackState());
    const secondCard = advanceToNextCard(firstCard);

    expect(secondCard).toEqual({
      answerShown: false,
      feedbackGrade: null,
    });
  });

  it("card after Continue starts hidden", () => {
    const afterContinue = advanceToNextCard(
      setCardFeedbackGrade(showCardAnswer(createInitialCardFeedbackState()), "partial"),
    );

    expect(afterContinue).toEqual({
      answerShown: false,
      feedbackGrade: null,
    });
  });

  it("relearning repeat starts hidden", () => {
    const afterRelearn = advanceToNextCard(
      setCardFeedbackGrade(showCardAnswer(createInitialCardFeedbackState()), "incorrect"),
    );

    expect(afterRelearn).toEqual({
      answerShown: false,
      feedbackGrade: null,
    });
  });

  it("returning from Review Muscle Brief preserves the current revealed state", () => {
    const duringFeedback = setCardFeedbackGrade(
      showCardAnswer(createInitialCardFeedbackState()),
      "partial",
    );

    expect(returnFromBriefReview(duringFeedback)).toEqual(duringFeedback);
  });
});

describe("card presentation identity", () => {
  const cardAStatic = {
    cardKey: "longus-colli:action",
    sessionIndex: 0,
    isPendingRetry: false,
    presentationSequence: 0,
  };
  const cardBStatic = {
    cardKey: "longus-capitis:action",
    sessionIndex: 1,
    isPendingRetry: false,
    presentationSequence: 1,
  };
  const cardARetry = {
    cardKey: "longus-colli:action",
    sessionIndex: 3,
    isPendingRetry: true,
    presentationSequence: 3,
  };
  const cardARetryAgain = {
    cardKey: "longus-colli:action",
    sessionIndex: 3,
    isPendingRetry: true,
    presentationSequence: 4,
  };

  it("revealing card A and grading it causes card B to start unrevealed", () => {
    const cardAKey = getCardPresentationKey(cardAStatic);
    const cardBKey = getCardPresentationKey(cardBStatic);
    const revealed = showCardAnswer(createInitialCardFeedbackState());

    expect(
      resolveCardFeedbackForPresentation(revealed, cardAKey, cardBKey),
    ).toEqual(createInitialCardFeedbackState());
  });

  it("revealing a normal card and moving to its retry starts the retry unrevealed", () => {
    const cardAKey = getCardPresentationKey(cardAStatic);
    const retryKey = getCardPresentationKey(cardARetry);
    const revealed = showCardAnswer(createInitialCardFeedbackState());

    expect(
      resolveCardFeedbackForPresentation(revealed, cardAKey, retryKey),
    ).toEqual(createInitialCardFeedbackState());
  });

  it("missing a pending retry again starts the newly appended retry unrevealed", () => {
    const firstRetryKey = getCardPresentationKey(cardARetry);
    const secondRetryKey = getCardPresentationKey(cardARetryAgain);
    const revealed = showCardAnswer(createInitialCardFeedbackState());

    expect(firstRetryKey).not.toBe(secondRetryKey);
    expect(
      resolveCardFeedbackForPresentation(revealed, firstRetryKey, secondRetryKey),
    ).toEqual(createInitialCardFeedbackState());
  });

  it("a correct grade followed by the next card resets reveal state", () => {
    const cardAKey = getCardPresentationKey(cardAStatic);
    const cardBKey = getCardPresentationKey(cardBStatic);
    const afterCorrectAdvance = advanceToNextCard(
      showCardAnswer(createInitialCardFeedbackState()),
    );

    expect(afterCorrectAdvance).toEqual(createInitialCardFeedbackState());
    expect(
      shouldResetCardFeedbackForPresentation(cardAKey, cardBKey),
    ).toBe(true);
    expect(
      resolveCardFeedbackForPresentation(
        showCardAnswer(createInitialCardFeedbackState()),
        cardAKey,
        cardBKey,
      ),
    ).toEqual(createInitialCardFeedbackState());
  });

  it("does not reset reveal state when the presentation identity is unchanged", () => {
    const cardAKey = getCardPresentationKey(cardAStatic);
    const revealed = showCardAnswer(createInitialCardFeedbackState());

    expect(
      resolveCardFeedbackForPresentation(revealed, cardAKey, cardAKey),
    ).toEqual(revealed);
  });

  it("does not keep the answer visible across a presentation identity change", () => {
    const cardAKey = getCardPresentationKey(cardAStatic);
    const cardBKey = getCardPresentationKey(cardBStatic);
    const revealed = showCardAnswer(createInitialCardFeedbackState());

    expect(revealed.answerShown).toBe(true);
    expect(
      resolveCardFeedbackForPresentation(revealed, cardAKey, cardBKey).answerShown,
    ).toBe(false);
  });
});
