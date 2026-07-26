export type CardFeedbackGrade = "partial" | "incorrect";

export type CardFeedbackState = {
  answerShown: boolean;
  feedbackGrade: CardFeedbackGrade | null;
};

export type CardPresentationIdentity = {
  cardKey: string;
  sessionIndex: number;
  isPendingRetry?: boolean;
  presentationSequence: number;
};

export function createInitialCardFeedbackState(): CardFeedbackState {
  return {
    answerShown: false,
    feedbackGrade: null,
  };
}

export function getCardPresentationKey(
  identity: CardPresentationIdentity,
): string {
  const retryLabel = identity.isPendingRetry ? "retry" : "static";

  return `${identity.presentationSequence}:${identity.sessionIndex}:${identity.cardKey}:${retryLabel}`;
}

export function shouldResetCardFeedbackForPresentation(
  previousKey: string | null,
  nextKey: string | null,
): boolean {
  if (nextKey === null) {
    return false;
  }

  if (previousKey === null) {
    return false;
  }

  return previousKey !== nextKey;
}

export function resolveCardFeedbackForPresentation(
  state: CardFeedbackState,
  previousKey: string | null,
  nextKey: string | null,
): CardFeedbackState {
  if (!shouldResetCardFeedbackForPresentation(previousKey, nextKey)) {
    return state;
  }

  return createInitialCardFeedbackState();
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
