import { describe, expect, it } from "vitest";
import {
  advanceToNextCard,
  createInitialCardFeedbackState,
  returnFromBriefReview,
  setCardFeedbackGrade,
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
