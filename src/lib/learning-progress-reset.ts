import { clearCourseProgress } from "@/src/lib/course-progress";
import { clearMasteryProgress } from "@/src/lib/mastery-progress";
import { clearMuscleBriefProgress } from "@/src/lib/muscle-brief-progress";

export function clearAllLearningProgress() {
  clearMuscleBriefProgress();
  clearMasteryProgress();
  clearCourseProgress();
}
