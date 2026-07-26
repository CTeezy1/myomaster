import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

export type FeedbackGrade = "partial" | "incorrect";

type StudySessionProps = {
  moduleName?: string;
  muscle: string;
  question: string;
  answer: string;
  answerShown: boolean;
  feedbackGrade: FeedbackGrade | null;
  onShowAnswer: () => void;
  onGrade: (type: "correct" | "partial" | "incorrect") => void;
  onReviewBrief: () => void;
  onContinue: () => void;
};

export function StudySession({
  moduleName,
  muscle,
  question,
  answer,
  answerShown,
  feedbackGrade,
  onShowAnswer,
  onGrade,
  onReviewBrief,
  onContinue,
}: StudySessionProps) {
  const gradeLocked = feedbackGrade !== null;

  return (
    <div className="w-full">
      <Card className="space-y-7">
        {moduleName ? (
          <p className="text-sm font-semibold tracking-tight text-brand-700">
            {moduleName}
          </p>
        ) : null}

        <div className="space-y-2 pt-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Muscle
          </p>
          <h2 className="text-[2.125rem] font-semibold leading-tight tracking-tight text-text-primary sm:text-[2.375rem]">
            {muscle}
          </h2>
        </div>

        <div className="rounded-[var(--radius)] border border-border bg-surface-muted px-5 py-5 text-center">
          <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
            {question}
          </p>
        </div>

        {!answerShown ? (
          <Button fullWidth onClick={onShowAnswer}>
            Show Answer
          </Button>
        ) : (
          <div className="space-y-5">
            <div className="rounded-[var(--radius)] border border-brand-200 bg-brand-50 px-5 py-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                Answer
              </p>
              <p className="mt-2 text-base leading-relaxed text-text-primary">
                {answer}
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <p className="text-center text-sm font-medium text-text-muted">
                How well did you know this?
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="correct"
                  className="flex-1"
                  disabled={gradeLocked}
                  onClick={() => onGrade("correct")}
                >
                  Correct
                </Button>
                <Button
                  variant="partial"
                  className="flex-1"
                  aria-pressed={feedbackGrade === "partial"}
                  disabled={gradeLocked}
                  onClick={() => onGrade("partial")}
                >
                  Partially Correct
                </Button>
                <Button
                  variant="incorrect"
                  className="flex-1"
                  aria-pressed={feedbackGrade === "incorrect"}
                  disabled={gradeLocked}
                  onClick={() => onGrade("incorrect")}
                >
                  Incorrect
                </Button>
              </div>

              {feedbackGrade && (
                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    fullWidth
                    variant="secondary"
                    onClick={onReviewBrief}
                  >
                    Review Muscle Brief
                  </Button>
                  <Button fullWidth onClick={onContinue}>
                    Continue
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
