import type { StudyDayCompletion } from "@/src/lib/progress.types";

export const PARTICIPATION_TIME_ZONE = "America/Chicago";
export const PARTICIPATION_GOAL_DAYS = 5;

export type WeeklyParticipation = {
  weekNumber: number;
  weekIndex: number;
  completedDays: number;
  distinctDateCount: number;
  distinctDates: string[];
  goalDays: typeof PARTICIPATION_GOAL_DAYS;
  isComplete: boolean;
};

const chicagoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PARTICIPATION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_CIVIL_DAY = 24 * 60 * 60 * 1000;

export function toChicagoCivilDate(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return chicagoDateFormatter.format(date);
}

function parseCivilDateParts(
  civilDate: string,
): { year: number; month: number; day: number } | null {
  const match = CIVIL_DATE_PATTERN.exec(civilDate);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function calendarDaysBetween(
  fromCivilDate: string,
  toCivilDate: string,
): number | null {
  const from = parseCivilDateParts(fromCivilDate);
  const to = parseCivilDateParts(toCivilDate);

  if (!from || !to) {
    return null;
  }

  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);

  return Math.round((toUtc - fromUtc) / MS_PER_CIVIL_DAY);
}

export function findDay1Completion(
  completions: StudyDayCompletion[] | undefined,
): StudyDayCompletion | null {
  if (!completions) {
    return null;
  }

  return completions.find((event) => event.studyDay === 1) ?? null;
}

export function getParticipationAnchorDate(
  completions: StudyDayCompletion[] | undefined,
): string | null {
  const day1 = findDay1Completion(completions);

  if (!day1) {
    return null;
  }

  return toChicagoCivilDate(day1.completedAt);
}

export function getParticipationWeekIndex(
  anchorCivilDate: string,
  completionCivilDate: string,
): number | null {
  const daysSinceAnchor = calendarDaysBetween(
    anchorCivilDate,
    completionCivilDate,
  );

  if (daysSinceAnchor === null || daysSinceAnchor < 0) {
    return null;
  }

  return Math.floor(daysSinceAnchor / 7);
}

function summarizeWeek(
  completions: StudyDayCompletion[],
  anchorCivilDate: string,
  weekIndex: number,
): WeeklyParticipation {
  const distinctDates = new Set<string>();

  for (const event of completions) {
    const civilDate = toChicagoCivilDate(event.completedAt);

    if (!civilDate) {
      continue;
    }

    if (getParticipationWeekIndex(anchorCivilDate, civilDate) === weekIndex) {
      distinctDates.add(civilDate);
    }
  }

  const sortedDates = [...distinctDates].sort();
  const distinctDateCount = sortedDates.length;
  const completedDays = Math.min(distinctDateCount, PARTICIPATION_GOAL_DAYS);

  return {
    weekNumber: weekIndex + 1,
    weekIndex,
    completedDays,
    distinctDateCount,
    distinctDates: sortedDates,
    goalDays: PARTICIPATION_GOAL_DAYS,
    isComplete: completedDays >= PARTICIPATION_GOAL_DAYS,
  };
}

export function getWeeklyParticipation(
  completions: StudyDayCompletion[] | undefined,
  weekIndex: number,
): WeeklyParticipation | null {
  const anchorCivilDate = getParticipationAnchorDate(completions);

  if (!anchorCivilDate || weekIndex < 0) {
    return null;
  }

  return summarizeWeek(completions ?? [], anchorCivilDate, weekIndex);
}

export function getCurrentWeeklyParticipation(
  completions: StudyDayCompletion[] | undefined,
  now: Date = new Date(),
): WeeklyParticipation | null {
  const anchorCivilDate = getParticipationAnchorDate(completions);
  const today = toChicagoCivilDate(now);

  if (!anchorCivilDate || !today) {
    return null;
  }

  const weekIndex = getParticipationWeekIndex(anchorCivilDate, today);

  if (weekIndex === null) {
    return null;
  }

  return summarizeWeek(completions ?? [], anchorCivilDate, weekIndex);
}

export function getHistoricalWeeklyParticipation(
  completions: StudyDayCompletion[] | undefined,
  now: Date = new Date(),
): WeeklyParticipation[] {
  const current = getCurrentWeeklyParticipation(completions, now);

  if (!current) {
    return [];
  }

  const weeks: WeeklyParticipation[] = [];

  for (let weekIndex = 0; weekIndex <= current.weekIndex; weekIndex += 1) {
    const summary = getWeeklyParticipation(completions, weekIndex);

    if (summary) {
      weeks.push(summary);
    }
  }

  return weeks;
}
