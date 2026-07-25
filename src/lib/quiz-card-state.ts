export type CardFeedbackGrade = "partial" | "incorrect";

export type CardFeedbackState = {
  answerShown: boolean;
  feedbackGrade: CardFeedbackGrade | null;
};

export function createInitialCardFeedbackState(): CardFeedbackState {
  return {
    answerShown: false,
    feedbackGrade: null,
  };
}

export function showCardAnswer(state: CardFeedbackState): CardFeedbackState {
  return {
    ...state,
    answerShown: true,
  };
}

export function setCardFeedbackGrade(
  state: CardFeedbackState,
  grade: CardFeedbackGrade,
): CardFeedbackState {
  return {
    ...state,
    feedbackGrade: grade,
  };
}

export function advanceToNextCard(
  _state: CardFeedbackState,
): CardFeedbackState {
  return createInitialCardFeedbackState();
}

export function returnFromBriefReview(
  state: CardFeedbackState,
): CardFeedbackState {
  return state;
}
