import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { getCurrentStudyDay } from "@/src/lib/course-progress";
import {
  getCurrentWeeklyParticipation,
  PARTICIPATION_GOAL_DAYS,
} from "@/src/lib/participation";
import {
  isCourseSection,
  type CourseSection,
} from "@/src/lib/profile.types";
import { parsePersistedLearnerProgress } from "@/src/lib/progress/learner-progress-validation";
import { EXPECTED_COURSE_STUDY_SESSIONS } from "@/src/lib/study-day-display";

export const DEFAULT_INSTRUCTOR_SECTION = "Kinesiology 1" satisfies CourseSection;

export type InstructorWeeklyParticipationDto = {
  weekNumber: number;
  completedDays: number;
  goalDays: typeof PARTICIPATION_GOAL_DAYS;
};

export type InstructorStudentDto = {
  username: string;
  section: CourseSection;
  currentStudyDay: number | null;
  expectedStudySessions: typeof EXPECTED_COURSE_STUDY_SESSIONS;
  weeklyParticipation: InstructorWeeklyParticipationDto | null;
};

export type InstructorRosterDto = {
  section: CourseSection;
  students: InstructorStudentDto[];
};

export function parseInstructorSectionInput(
  value: unknown,
): { ok: true; section: CourseSection } | { ok: false } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, section: DEFAULT_INSTRUCTOR_SECTION };
  }

  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw !== "string" || !isCourseSection(raw)) {
    return { ok: false };
  }

  return { ok: true, section: raw };
}

export function mapInstructorStudentRow(input: {
  username: string;
  section: CourseSection;
  progressData: unknown;
  now?: Date;
}): InstructorStudentDto {
  const parsed =
    input.progressData === null || input.progressData === undefined
      ? null
      : parsePersistedLearnerProgress(input.progressData);

  const course = parsed?.state.courseProgress.courses[DEFAULT_COURSE_ID];

  if (!course) {
    return {
      username: input.username,
      section: input.section,
      currentStudyDay: null,
      expectedStudySessions: EXPECTED_COURSE_STUDY_SESSIONS,
      weeklyParticipation: null,
    };
  }

  const participation = getCurrentWeeklyParticipation(
    course.studyDayCompletions,
    input.now,
  );

  return {
    username: input.username,
    section: input.section,
    currentStudyDay: getCurrentStudyDay(course),
    expectedStudySessions: EXPECTED_COURSE_STUDY_SESSIONS,
    weeklyParticipation: participation
      ? {
          weekNumber: participation.weekNumber,
          completedDays: participation.completedDays,
          goalDays: participation.goalDays,
        }
      : null,
  };
}

export function formatInstructorStudyProgress(row: InstructorStudentDto): string {
  if (row.currentStudyDay === null) {
    return "—";
  }

  return `Day ${row.currentStudyDay} / ${row.expectedStudySessions}`;
}

export function formatInstructorWeeklyParticipation(
  row: InstructorStudentDto,
): string {
  if (!row.weeklyParticipation) {
    return "Not tracked";
  }

  return `Week ${row.weeklyParticipation.weekNumber} · ${row.weeklyParticipation.completedDays}/${row.weeklyParticipation.goalDays}`;
}
