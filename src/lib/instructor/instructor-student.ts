import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { getCurrentStudyDay } from "@/src/lib/course-progress";
import {
  getCurrentWeeklyParticipation,
  getHistoricalWeeklyParticipation,
  PARTICIPATION_GOAL_DAYS,
} from "@/src/lib/participation";
import {
  isCourseSection,
  type CourseSection,
} from "@/src/lib/profile.types";
import { parsePersistedLearnerProgress } from "@/src/lib/progress/learner-progress-validation";
import type { StudyDayCompletion } from "@/src/lib/progress.types";
import { EXPECTED_COURSE_STUDY_SESSIONS } from "@/src/lib/study-day-display";

export const DEFAULT_INSTRUCTOR_SECTION = "Kinesiology 1" satisfies CourseSection;
export const CURRENT_INSTRUCTOR_WEEK = "current" as const;
export const MAX_INSTRUCTOR_WEEK_INPUT = 999;

export type InstructorWeekSelection = typeof CURRENT_INSTRUCTOR_WEEK | number;

export type InstructorWeeklyParticipationDto =
  | {
      status: "complete" | "in-progress";
      weekNumber: number;
      completedDays: number;
      goalDays: typeof PARTICIPATION_GOAL_DAYS;
    }
  | {
      status: "not-reached";
      weekNumber: number;
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
  selectedWeek: InstructorWeekSelection;
  availableWeeks: number[];
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

export function parseInstructorWeekInput(
  value: unknown,
): { ok: true; week: InstructorWeekSelection } | { ok: false } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, week: CURRENT_INSTRUCTOR_WEEK };
  }

  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 1 || raw > MAX_INSTRUCTOR_WEEK_INPUT) {
      return { ok: false };
    }

    return { ok: true, week: raw };
  }

  if (typeof raw !== "string") {
    return { ok: false };
  }

  const text = raw.trim();

  if (text === "" || text === CURRENT_INSTRUCTOR_WEEK) {
    return { ok: true, week: CURRENT_INSTRUCTOR_WEEK };
  }

  if (!/^[1-9]\d{0,2}$/.test(text)) {
    return { ok: false };
  }

  const week = Number(text);

  if (week > MAX_INSTRUCTOR_WEEK_INPUT) {
    return { ok: false };
  }

  return { ok: true, week };
}

export function getAvailableInstructorWeeks(
  reachedWeekNumbers: Array<number | null | undefined>,
): number[] {
  let maxWeek = 0;

  for (const week of reachedWeekNumbers) {
    if (typeof week === "number" && week > maxWeek) {
      maxWeek = week;
    }
  }

  return Array.from({ length: maxWeek }, (_, index) => index + 1);
}

export function resolveInstructorWeekSelection(
  requestedWeek: InstructorWeekSelection,
  availableWeeks: number[],
): InstructorWeekSelection {
  if (requestedWeek === CURRENT_INSTRUCTOR_WEEK) {
    return CURRENT_INSTRUCTOR_WEEK;
  }

  return availableWeeks.includes(requestedWeek)
    ? requestedWeek
    : CURRENT_INSTRUCTOR_WEEK;
}

export function instructorDashboardPath(
  section: CourseSection,
  week: InstructorWeekSelection = CURRENT_INSTRUCTOR_WEEK,
): string {
  const params = new URLSearchParams();
  params.set("section", section);

  if (week !== CURRENT_INSTRUCTOR_WEEK) {
    params.set("week", String(week));
  }

  return `/instructor?${params.toString()}`;
}

function getInstructorCourse(progressData: unknown) {
  const parsed =
    progressData === null || progressData === undefined
      ? null
      : parsePersistedLearnerProgress(progressData);

  return parsed?.state.courseProgress.courses[DEFAULT_COURSE_ID] ?? null;
}

export function getInstructorReachedWeekNumber(
  progressData: unknown,
  now?: Date,
): number | null {
  const course = getInstructorCourse(progressData);

  if (!course) {
    return null;
  }

  return (
    getCurrentWeeklyParticipation(course.studyDayCompletions, now)?.weekNumber ??
    null
  );
}

export function mapInstructorWeeklyParticipation(
  completions: StudyDayCompletion[] | undefined,
  selectedWeek: InstructorWeekSelection = CURRENT_INSTRUCTOR_WEEK,
  now?: Date,
): InstructorWeeklyParticipationDto | null {
  if (selectedWeek === CURRENT_INSTRUCTOR_WEEK) {
    const current = getCurrentWeeklyParticipation(completions, now);

    if (!current) {
      return null;
    }

    return {
      status: "in-progress",
      weekNumber: current.weekNumber,
      completedDays: current.completedDays,
      goalDays: current.goalDays,
    };
  }

  const history = getHistoricalWeeklyParticipation(completions, now);

  if (history.length === 0) {
    return null;
  }

  const match = history.find((week) => week.weekNumber === selectedWeek);

  if (!match) {
    return {
      status: "not-reached",
      weekNumber: selectedWeek,
    };
  }

  const current = history[history.length - 1];
  const status =
    current && match.weekNumber === current.weekNumber
      ? "in-progress"
      : "complete";

  return {
    status,
    weekNumber: match.weekNumber,
    completedDays: match.completedDays,
    goalDays: match.goalDays,
  };
}

export function mapInstructorStudentRow(input: {
  username: string;
  section: CourseSection;
  progressData: unknown;
  selectedWeek?: InstructorWeekSelection;
  now?: Date;
}): InstructorStudentDto {
  const course = getInstructorCourse(input.progressData);
  const selectedWeek = input.selectedWeek ?? CURRENT_INSTRUCTOR_WEEK;

  if (!course) {
    return {
      username: input.username,
      section: input.section,
      currentStudyDay: null,
      expectedStudySessions: EXPECTED_COURSE_STUDY_SESSIONS,
      weeklyParticipation: null,
    };
  }

  return {
    username: input.username,
    section: input.section,
    currentStudyDay: getCurrentStudyDay(course),
    expectedStudySessions: EXPECTED_COURSE_STUDY_SESSIONS,
    weeklyParticipation: mapInstructorWeeklyParticipation(
      course.studyDayCompletions,
      selectedWeek,
      input.now,
    ),
  };
}

export function formatInstructorStudyProgress(row: InstructorStudentDto): string {
  if (row.currentStudyDay === null) {
    return "—";
  }

  return `Day ${row.currentStudyDay} / ${row.expectedStudySessions}`;
}

export function formatInstructorParticipationColumnLabel(
  selectedWeek: InstructorWeekSelection,
): string {
  if (selectedWeek === CURRENT_INSTRUCTOR_WEEK) {
    return "Weekly Participation";
  }

  return `Week ${selectedWeek} Participation`;
}

export function formatInstructorWeeklyParticipation(
  row: InstructorStudentDto,
  selectedWeek: InstructorWeekSelection = CURRENT_INSTRUCTOR_WEEK,
): string {
  if (!row.weeklyParticipation) {
    return "Not tracked";
  }

  if (row.weeklyParticipation.status === "not-reached") {
    return "Not reached";
  }

  const score = `${row.weeklyParticipation.completedDays}/${row.weeklyParticipation.goalDays}`;

  if (selectedWeek === CURRENT_INSTRUCTOR_WEEK) {
    return `Week ${row.weeklyParticipation.weekNumber} · ${score}`;
  }

  if (row.weeklyParticipation.status === "in-progress") {
    return `${score} · In progress`;
  }

  return score;
}
