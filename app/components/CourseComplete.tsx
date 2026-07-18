import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

type CourseCompleteProps = {
  courseName: string;
  muscleCount: number;
  onReturnToDashboard: () => void;
};

export function CourseComplete({
  courseName,
  muscleCount,
  onReturnToDashboard,
}: CourseCompleteProps) {
  return (
    <div className="w-full">
      <Card className="space-y-6 text-center">
        <div className="space-y-1.5">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
            Course complete
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            {courseName} Complete
          </h2>
          <p className="text-sm text-text-secondary sm:text-base">
            You completed all {muscleCount} muscles in this course.
          </p>
        </div>

        <Button fullWidth onClick={onReturnToDashboard}>
          Return to Dashboard
        </Button>
      </Card>
    </div>
  );
}
