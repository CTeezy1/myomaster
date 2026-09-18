import { COURSE_DAYS } from "@/src/lib/introduction-policy";

/**
 * Student-facing course expectation: 15 weeks × 5 study sessions.
 * Presentation/planning metadata only. Continued-review labeling still uses
 * COURSE_DAYS (105), not this expectation.
 */
export const EXPECTED_COURSE_STUDY_SESSIONS = 75;

export function isContinuedReviewStudyDay(studyDay: number): boolean {
  return studyDay > COURSE_DAYS;
}

export function formatStudyDayStatValue(
  currentStudyDay: number,
  expectedStudySessions: number = COURSE_DAYS,
): { primary: string; secondary?: string } {
  if (isContinuedReviewStudyDay(currentStudyDay)) {
    return {
      primary: String(currentStudyDay),
      secondary: "Continued Review",
    };
  }

  if (currentStudyDay <= expectedStudySessions) {
    return { primary: `${currentStudyDay} of ${expectedStudySessions}` };
  }

  return { primary: String(currentStudyDay) };
}
