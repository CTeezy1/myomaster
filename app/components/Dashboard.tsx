import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { formatStudyDayStatValue } from "@/src/lib/study-day-display";
import type { WeeklyParticipation } from "@/src/lib/participation";

type DashboardProps = {
  currentStudyDay: number;
  totalStudyDays: number;
  introducedMuscleCount: number;
  totalMuscleCount: number;
  onStartStudying: () => void;
  canStartGuidedStudy: boolean;
  hasResumableStudySession: boolean;
  isStudyDayComplete: boolean;
  canAdvanceStudyDay: boolean;
  onAdvanceStudyDay?: () => void;
  onOpenMuscleLibrary: () => void;
  onOpenMemoryCode: () => void;
  weeklyParticipation?: WeeklyParticipation | null;
};

function StatItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-surface-muted px-4 py-3.5">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-sm font-medium text-text-secondary">{detail}</p>
      ) : null}
    </div>
  );
}

function WeeklyParticipationPanel({
  participation,
}: {
  participation: WeeklyParticipation;
}) {
  const remaining = participation.goalDays - participation.completedDays;

  return (
    <div className="rounded-[var(--radius)] border border-brand-200 bg-brand-50 px-4 py-3.5 text-center sm:text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
        This week
      </p>
      {participation.isComplete ? (
        <>
          <p className="mt-1 text-sm font-medium text-brand-800">
            Weekly Goal Complete ✓
          </p>
          <p className="mt-1 text-sm font-medium text-brand-800">
            {participation.goalDays} of {participation.goalDays} study days
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-lg font-semibold tracking-tight text-text-primary">
            {participation.completedDays} of {participation.goalDays} study days
            complete
          </p>
          <div
            className="mt-2 flex justify-center gap-2 sm:justify-start"
            aria-hidden="true"
          >
            {Array.from({ length: participation.goalDays }, (_, index) => (
              <span
                key={index}
                className={`h-2.5 w-2.5 rounded-full ${
                  index < participation.completedDays
                    ? "bg-brand-700"
                    : "border border-brand-300 bg-surface"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-brand-800">
            Complete {remaining} more study{" "}
            {remaining === 1 ? "day" : "days"} this week to reach your goal.
          </p>
        </>
      )}
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
  hasResumableStudySession,
  isStudyDayComplete,
  canAdvanceStudyDay,
  onAdvanceStudyDay,
  onOpenMuscleLibrary,
  onOpenMemoryCode,
  weeklyParticipation = null,
}: DashboardProps) {
  const studyDayDisplay = formatStudyDayStatValue(
    currentStudyDay,
    totalStudyDays,
  );

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
              value={studyDayDisplay.primary}
              detail={studyDayDisplay.secondary}
            />
            <StatItem
              label="Muscles Learned"
              value={`${introducedMuscleCount} of ${totalMuscleCount}`}
            />
          </div>

          {weeklyParticipation ? (
            <WeeklyParticipationPanel participation={weeklyParticipation} />
          ) : null}

          <p className="text-sm leading-relaxed text-text-secondary">
            Build long-term mastery with 5 MyoMaster study sessions each week.
            Complete them on any 5 days that work for you.
          </p>

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
              {hasResumableStudySession ? "Resume Studying" : "Begin Studying"}
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

          <Button fullWidth variant="secondary" onClick={onOpenMemoryCode}>
            Memory Code
          </Button>
        </div>
      </Card>
    </div>
  );
}
