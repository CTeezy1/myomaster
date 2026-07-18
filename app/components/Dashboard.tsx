import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

type DashboardProps = {
  cardCount: number;
  estimatedMinutes: number;
  onStartStudying: () => void;
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
  cardCount,
  estimatedMinutes,
  onStartStudying,
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
              Cervical Muscles
            </h2>
            <p className="text-sm text-text-secondary">
              {cardCount} cards across origin, insertion, action, and
              innervation.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatItem label="New Cards" value={cardCount} highlight />
            <StatItem label="Review Cards" value={0} />
            <StatItem
              label="Estimated Time"
              value={`${estimatedMinutes} min`}
            />
          </div>

          <Button fullWidth className="mt-1" onClick={onStartStudying}>
            Start Studying
          </Button>

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
