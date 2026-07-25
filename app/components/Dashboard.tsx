import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

type DashboardProps = {
  courseName: string;
  currentStudyDay: number;
  totalStudyDays: number;
  plannedPromptCount: number;
  dueReviewPromptCount: number;
  newMusclePromptCount: number;
  showWorkloadWarning: boolean;
  introducedMuscleCount: number;
  masteredMuscleCount: number;
  totalMuscleCount: number;
  onStartStudying: () => void;
  guidedStudyLabel: string;
  canStartGuidedStudy: boolean;
  remainingNewMuscleAllowance: number;
  canAdvanceStudyDay: boolean;
  onAdvanceStudyDay?: () => void;
  onStartReview?: () => void;
  canStartReview?: boolean;
  onOpenMuscleLibrary: () => void;
  onResetLearningProgress?: () => void;
};

function StatItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-surface-muted px-4 py-3.5">
      <p className="text-sm text-text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight ${
          highlight ? "text-brand-700" : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function Dashboard({
  courseName,
  currentStudyDay,
  totalStudyDays,
  plannedPromptCount,
  dueReviewPromptCount,
  newMusclePromptCount,
  showWorkloadWarning,
  introducedMuscleCount,
  masteredMuscleCount,
  totalMuscleCount,
  onStartStudying,
  guidedStudyLabel,
  canStartGuidedStudy,
  remainingNewMuscleAllowance,
  canAdvanceStudyDay,
  onAdvanceStudyDay,
  onStartReview,
  canStartReview = false,
  onOpenMuscleLibrary,
  onResetLearningProgress,
}: DashboardProps) {
  return (
    <div className="w-full space-y-5">
      <section className="space-y-1.5 text-center sm:text-left">
        <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
          Welcome back
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          Ready to study?
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
          Welcome, Student! Review muscle origins, insertions, actions, and
          innervations at your own pace.
        </p>
      </section>

      <Card variant="featured">
        <div className="space-y-5">
          <div className="space-y-1 border-b border-border pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
              Today&apos;s Study Session
            </p>
            <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">
              {courseName}
            </h2>
            <p className="text-sm text-text-secondary">
              {totalMuscleCount} muscles in this course. Study day {currentStudyDay}{" "}
              of {totalStudyDays}.
            </p>
          </div>

          <p className="text-sm leading-relaxed text-text-secondary">
            For best retention, complete about one study day per calendar day.
          </p>

          {showWorkloadWarning && (
            <p className="rounded-[var(--radius)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
              Heavy review load today ({dueReviewPromptCount} due prompts). New
              muscle introductions are paused until your due workload eases.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <StatItem
              label="Study Day"
              value={`${currentStudyDay} / ${totalStudyDays}`}
              highlight
            />
            <StatItem
              label="Planned Prompts"
              value={plannedPromptCount}
              highlight
            />
            <StatItem
              label="Due Review Prompts"
              value={dueReviewPromptCount}
              highlight
            />
            <StatItem
              label="New Muscle Prompts"
              value={newMusclePromptCount}
            />
            <StatItem
              label="Introduced Muscles"
              value={introducedMuscleCount}
            />
            <StatItem label="Mastered Muscles" value={masteredMuscleCount} />
            <StatItem label="Total Muscles" value={totalMuscleCount} />
            <StatItem
              label="New Muscles Remaining Today"
              value={remainingNewMuscleAllowance}
            />
          </div>

          <Button
            fullWidth
            className="mt-1"
            disabled={!canStartGuidedStudy}
            onClick={onStartStudying}
          >
            {guidedStudyLabel}
          </Button>

          {onAdvanceStudyDay && (
            <Button
              fullWidth
              variant="secondary"
              disabled={!canAdvanceStudyDay}
              onClick={onAdvanceStudyDay}
            >
              Start Next Study Day
            </Button>
          )}

          {onStartReview && (
            <Button
              fullWidth
              variant="secondary"
              disabled={!canStartReview}
              onClick={onStartReview}
            >
              Review Due Cards
            </Button>
          )}

          <Button fullWidth variant="secondary" onClick={onOpenMuscleLibrary}>
            Muscle Library
          </Button>
        </div>
      </Card>

      {onResetLearningProgress && (
        <div className="pt-2 text-center sm:text-left">
          <button
            type="button"
            onClick={onResetLearningProgress}
            className="text-xs text-text-muted underline-offset-2 transition-colors hover:text-text-secondary hover:underline"
          >
            Reset Learning Progress
          </button>
        </div>
      )}
    </div>
  );
}
