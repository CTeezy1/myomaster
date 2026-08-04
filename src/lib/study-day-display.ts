import { COURSE_DAYS } from "@/src/lib/introduction-policy";

export function isContinuedReviewStudyDay(studyDay: number): boolean {
  return studyDay > COURSE_DAYS;
}

export function formatStudyDayStatValue(
  currentStudyDay: number,
  totalStudyDays: number = COURSE_DAYS,
): { primary: string; secondary?: string } {
  if (currentStudyDay <= totalStudyDays) {
    return { primary: `${currentStudyDay} of ${totalStudyDays}` };
  }

  return {
    primary: String(currentStudyDay),
    secondary: "Continued Review",
  };
}
