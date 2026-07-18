import { cn } from "@/lib/cn";

type ProgressBarProps = {
  moduleName: string;
  current: number;
  total: number;
  className?: string;
};

export function ProgressBar({
  moduleName,
  current,
  total,
  className,
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <p className="text-sm font-semibold tracking-tight text-brand-700">
          {moduleName}
        </p>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-text-secondary">
            Question {current} of {total}
          </span>
          <span className="text-text-muted">{Math.round(percentage)}%</span>
        </div>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-brand-100"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${moduleName}: question ${current} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-standard)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
