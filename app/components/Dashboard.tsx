import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

type DashboardProps = {
  currentStudyDay: number;
  totalStudyDays: number;
  introducedMuscleCount: number;
  totalMuscleCount: number;
  onStartStudying: () => void;
  canStartGuidedStudy: boolean;
  isStudyDayComplete: boolean;
  canAdvanceStudyDay: boolean;
  onAdvanceStudyDay?: () => void;
  onOpenMuscleLibrary: () => void;
  onResetLearningProgress?: () => void;
};

function StatItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-surface-muted px-4 py-3.5">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">
        {value}
      </p>
    </div>
  );
}

export function Dashboard({
  currentStudyDay,
  totalStudyDays,
  introducedMuscleCount,
  totalMuscleCount,
  onStartStudying,
  canStartGuidedStudy,
  isStudyDayComplete,
  canAdvanceStudyDay,
  onAdvanceStudyDay,
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
      </section>

      <Card variant="featured">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatItem
              label="Study Day"
              value={`${currentStudyDay} of ${totalStudyDays}`}
            />
            <StatItem
              label="Muscles Learned"
              value={`${introducedMuscleCount} of ${totalMuscleCount}`}
            />
          </div>

          {isStudyDayComplete && (
            <p className="rounded-[var(--radius)] border border-brand-200 bg-brand-50 px-4 py-3 text-center text-sm font-medium leading-relaxed text-brand-800">
              Study Day Complete
            </p>
          )}

          {!isStudyDayComplete && (
            <Button
              fullWidth
              className="mt-1"
              disabled={!canStartGuidedStudy}
              onClick={onStartStudying}
            >
              Begin Studying
            </Button>
          )}

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
