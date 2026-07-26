import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

type SessionCompleteProps = {
  correctCount?: number;
  partialCount?: number;
  incorrectCount?: number;
  title?: string;
  description?: string;
  showResultStats?: boolean;
  showStudyAgain?: boolean;
  onStudyAgain?: () => void;
  onReturnToDashboard: () => void;
};

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "error";
}) {
  const toneStyles = {
    success: "border-success-border bg-success-bg text-success-text",
    warning: "border-warning-border bg-warning-bg text-warning-text",
    error: "border-error-border bg-error-bg text-error-text",
  };

  return (
    <div
      className={`rounded-[var(--radius)] border px-4 py-3.5 text-center ${toneStyles[tone]}`}
    >
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function SessionComplete({
  correctCount = 0,
  partialCount = 0,
  incorrectCount = 0,
  title = "Nice work!",
  description,
  showResultStats = false,
  showStudyAgain = true,
  onStudyAgain,
  onReturnToDashboard,
}: SessionCompleteProps) {
  const total = correctCount + partialCount + incorrectCount;
  const summary =
    description ??
    (showResultStats
      ? `You reviewed ${total} ${total === 1 ? "card" : "cards"} this session.`
      : "You're done for today.");

  return (
    <div className="w-full">
      <Card className="space-y-6 text-center">
        <div className="space-y-1.5">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
            Session complete
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            {title}
          </h2>
          <p className="text-sm text-text-secondary sm:text-base">
            {summary}
          </p>
        </div>

        {showResultStats && (
          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Correct" value={correctCount} tone="success" />
            <ResultStat label="Partial" value={partialCount} tone="warning" />
            <ResultStat label="Incorrect" value={incorrectCount} tone="error" />
          </div>
        )}

        <div className="flex flex-col gap-3 pt-1">
          {showStudyAgain && onStudyAgain && (
            <Button fullWidth onClick={onStudyAgain}>
              Study Again
            </Button>
          )}
          <Button fullWidth variant="secondary" onClick={onReturnToDashboard}>
            Return to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
