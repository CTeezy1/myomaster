import { describe, expect, it, vi } from "vitest";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { createDefaultCourseProgress } from "@/src/lib/course-progress";
import {
  CURRENT_INSTRUCTOR_WEEK,
  DEFAULT_INSTRUCTOR_SECTION,
  formatInstructorParticipationColumnLabel,
  formatInstructorStudyProgress,
  formatInstructorWeeklyParticipation,
  getAvailableInstructorWeeks,
  mapInstructorStudentRow,
  parseInstructorSectionInput,
  parseInstructorWeekInput,
  resolveInstructorWeekSelection,
} from "@/src/lib/instructor/instructor-student";
import { loadInstructorRoster } from "@/src/lib/instructor/load-instructor-roster";
import { COURSE_DAYS } from "@/src/lib/introduction-policy";
import { COURSE_SECTIONS } from "@/src/lib/profile.types";
import { EXPECTED_COURSE_STUDY_SESSIONS } from "@/src/lib/study-day-display";
import { createDefaultPersistedLearnerProgress } from "@/src/lib/progress/learner-progress-snapshot";
import { LEARNER_PROGRESS_SCHEMA_VERSION } from "@/src/lib/progress/learner-progress.types";
import type { StudyDayCompletion } from "@/src/lib/progress.types";

const INSTRUCTOR_UUID = "514bf461-b2d6-416b-8310-5a8ace14e4e0";
const STUDENT_UUID = "11111111-2222-3333-4444-555555555555";

function progressEnvelope(options?: {
  currentStudyDay?: number;
  completedStudyDays?: number[];
  completions?: StudyDayCompletion[];
  extraFields?: Record<string, unknown>;
}) {
  const course = {
    ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
    currentStudyDay: options?.currentStudyDay ?? 1,
    completedStudyDays: options?.completedStudyDays ?? [],
    studyDayCompletions: options?.completions,
  };

  return {
    schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
    savedAt: "2026-08-01T00:00:00.000Z",
    state: {
      ...createDefaultPersistedLearnerProgress().state,
      courseProgress: {
        version: 1 as const,
        courses: {
          [DEFAULT_COURSE_ID]: course,
        },
      },
    },
    ...options?.extraFields,
  };
}

function createMockPrivilegedClient(options: {
  profiles: Array<{ id: string; username: string; section: string }>;
  progress: Array<{ user_id: string; progress_data: unknown }>;
}) {
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((column: string, value: string) => ({
            order: vi.fn(async () => ({
              data: options.profiles.filter(
                (profile) =>
                  column === "section" && profile.section === value,
              ),
              error: null,
            })),
          })),
        })),
      };
    }

    return {
      select: vi.fn(() => ({
        in: vi.fn(async (_column: string, ids: string[]) => ({
          data: options.progress.filter((row) => ids.includes(row.user_id)),
          error: null,
        })),
      })),
    };
  });

  return { from };
}

describe("instructor section parsing", () => {
  it("defaults to Kinesiology 1 and accepts every canonical section", () => {
    expect(DEFAULT_INSTRUCTOR_SECTION).toBe("Kinesiology 1");
    expect(parseInstructorSectionInput(undefined)).toEqual({
      ok: true,
      section: "Kinesiology 1",
    });
    expect(parseInstructorSectionInput("")).toEqual({
      ok: true,
      section: "Kinesiology 1",
    });

    for (const section of COURSE_SECTIONS) {
      expect(parseInstructorSectionInput(section)).toEqual({
        ok: true,
        section,
      });
    }

    expect(parseInstructorSectionInput("Testing")).toEqual({
      ok: true,
      section: "Testing",
    });
  });

  it("rejects an arbitrary section instead of using it as a filter", () => {
    expect(parseInstructorSectionInput("Kinesiology 3")).toEqual({ ok: false });
    expect(parseInstructorSectionInput("'; drop table profiles;--")).toEqual({
      ok: false,
    });
  });
});

describe("instructor student DTO mapping", () => {
  it("derives Study Progress against 75 expected sessions", () => {
    const row = mapInstructorStudentRow({
      username: "Agile Fox",
      section: "Kinesiology 1",
      progressData: progressEnvelope({ currentStudyDay: 8 }),
    });

    expect(row.expectedStudySessions).toBe(75);
    expect(row.expectedStudySessions).toBe(EXPECTED_COURSE_STUDY_SESSIONS);
    expect(row.expectedStudySessions).not.toBe(COURSE_DAYS);
    expect(row.currentStudyDay).toBe(8);
    expect(formatInstructorStudyProgress(row)).toBe("Day 8 / 75");
    expect(formatInstructorStudyProgress(row)).not.toContain("105");
  });

  it("returns null study progress when learner_progress is missing", () => {
    const row = mapInstructorStudentRow({
      username: "Bright Cedar",
      section: "Kinesiology 1",
      progressData: null,
    });

    expect(row.currentStudyDay).toBeNull();
    expect(row.weeklyParticipation).toBeNull();
    expect(formatInstructorStudyProgress(row)).toBe("—");
    expect(formatInstructorWeeklyParticipation(row)).toBe("Not tracked");
  });

  it("reuses participation.ts for Chicago dates, same-day dedupe, cap, and week number", () => {
    const now = new Date("2026-09-23T21:00:00.000Z");
    const row = mapInstructorStudentRow({
      username: "Agile Fox",
      section: "Kinesiology 1",
      now,
      progressData: progressEnvelope({
        currentStudyDay: 8,
        completedStudyDays: [1, 2, 3, 4, 5, 6, 7, 8],
        completions: [
          { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
          { studyDay: 2, completedAt: "2026-09-18T20:00:00.000Z" },
          { studyDay: 3, completedAt: "2026-09-19T15:00:00.000Z" },
          { studyDay: 4, completedAt: "2026-09-19T17:00:00.000Z" },
          { studyDay: 5, completedAt: "2026-09-19T22:00:00.000Z" },
          { studyDay: 6, completedAt: "2026-09-21T16:00:00.000Z" },
          { studyDay: 7, completedAt: "2026-09-23T16:00:00.000Z" },
          { studyDay: 8, completedAt: "2026-09-23T21:00:00.000Z" },
        ],
      }),
    });

    expect(row.currentStudyDay).toBe(8);
    expect(row.weeklyParticipation).toEqual({
      status: "in-progress",
      weekNumber: 1,
      completedDays: 5,
      goalDays: 5,
    });
    expect(formatInstructorWeeklyParticipation(row)).toBe("Week 1 · 5/5");
  });

  it("handles independent Day 1 anchors for different learners", () => {
    const now = new Date("2026-09-24T16:00:00.000Z");
    const thursdayAnchor = mapInstructorStudentRow({
      username: "Student A",
      section: "Kinesiology 1",
      now,
      progressData: progressEnvelope({
        currentStudyDay: 2,
        completions: [
          { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
        ],
      }),
    });
    const fridayAnchor = mapInstructorStudentRow({
      username: "Student B",
      section: "Kinesiology 1",
      now,
      progressData: progressEnvelope({
        currentStudyDay: 2,
        completions: [
          { studyDay: 1, completedAt: "2026-09-18T20:00:00.000Z" },
        ],
      }),
    });

    expect(thursdayAnchor.weeklyParticipation).toEqual({
      status: "in-progress",
      weekNumber: 2,
      completedDays: 0,
      goalDays: 5,
    });
    expect(fridayAnchor.weeklyParticipation).toEqual({
      status: "in-progress",
      weekNumber: 1,
      completedDays: 1,
      goalDays: 5,
    });
  });

  it("does not fabricate participation for unanchored legacy progress", () => {
    const row = mapInstructorStudentRow({
      username: "Legacy Learner",
      section: "Kinesiology 1",
      progressData: progressEnvelope({
        currentStudyDay: 12,
        completedStudyDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        extraFields: { savedAt: "2026-01-01T00:00:00.000Z" },
      }),
    });

    expect(row.currentStudyDay).toBe(12);
    expect(row.weeklyParticipation).toBeNull();
    expect(formatInstructorWeeklyParticipation(row)).toBe("Not tracked");
    expect(formatInstructorWeeklyParticipation(row)).not.toContain("0/5");
  });

  it("omits privileged and identifying fields from the DTO", () => {
    const row = mapInstructorStudentRow({
      username: "Agile Fox",
      section: "Kinesiology 1",
      progressData: progressEnvelope({
        currentStudyDay: 8,
        completions: [
          { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
        ],
      }),
    });
    const serialized = JSON.stringify(row);

    expect(Object.keys(row).sort()).toEqual([
      "currentStudyDay",
      "expectedStudySessions",
      "section",
      "username",
      "weeklyParticipation",
    ]);
    expect(row).not.toHaveProperty("id");
    expect(row).not.toHaveProperty("user_id");
    expect(row).not.toHaveProperty("progress_data");
    expect(serialized).not.toContain(STUDENT_UUID);
    expect(serialized).not.toContain("@users.myomaster.local");
    expect(serialized).not.toContain("masteryProgress");
    expect(serialized).not.toContain("activeStudySession");
    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialized).not.toContain("INSTRUCTOR_USER_IDS");
    expect(serialized).not.toContain("studyDayCompletions");
    expect(serialized).not.toContain("distinctDates");
    expect(serialized).not.toContain("completedAt");
  });
});

describe("loadInstructorRoster", () => {

  it("does not use the service-role client before instructor authorization", async () => {
    const createPrivilegedClient = vi.fn();

    const result = await loadInstructorRoster(
      { userId: STUDENT_UUID, section: "Kinesiology 1" },
      { createPrivilegedClient },
    );

    expect(result).toEqual({ ok: false, kind: "unauthorized" });
    expect(createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid section before querying", async () => {
    const createPrivilegedClient = vi.fn();

    const previous = process.env.INSTRUCTOR_USER_IDS;
    process.env.INSTRUCTOR_USER_IDS = INSTRUCTOR_UUID;

    const result = await loadInstructorRoster(
      { userId: INSTRUCTOR_UUID, section: "not-a-section" },
      { createPrivilegedClient },
    );

    if (previous === undefined) {
      delete process.env.INSTRUCTOR_USER_IDS;
    } else {
      process.env.INSTRUCTOR_USER_IDS = previous;
    }

    expect(result).toEqual({ ok: false, kind: "invalid_section" });
    expect(createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("returns only the selected section and ignores the instructor profile section", async () => {
    const previous = process.env.INSTRUCTOR_USER_IDS;
    process.env.INSTRUCTOR_USER_IDS = INSTRUCTOR_UUID;

    const client = createMockPrivilegedClient({
      profiles: [
        {
          id: "student-a",
          username: "Agile Fox",
          section: "Kinesiology 1",
        },
        {
          id: "student-b",
          username: "Other Section",
          section: "Testing",
        },
      ],
      progress: [
        {
          user_id: "student-a",
          progress_data: progressEnvelope({ currentStudyDay: 8 }),
        },
      ],
    });

    const result = await loadInstructorRoster(
      { userId: INSTRUCTOR_UUID, section: "Kinesiology 1" },
      { createPrivilegedClient: () => client as never },
    );

    if (previous === undefined) {
      delete process.env.INSTRUCTOR_USER_IDS;
    } else {
      process.env.INSTRUCTOR_USER_IDS = previous;
    }

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.roster.section).toBe("Kinesiology 1");
    expect(result.roster.selectedWeek).toBe(CURRENT_INSTRUCTOR_WEEK);
    expect(result.roster.availableWeeks).toEqual([]);
    expect(result.roster.students.map((student) => student.username)).toEqual([
      "Agile Fox",
    ]);
    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(client.from).toHaveBeenCalledWith("learner_progress");
  });

  it("handles a profile with no learner_progress row", async () => {
    const previous = process.env.INSTRUCTOR_USER_IDS;
    process.env.INSTRUCTOR_USER_IDS = INSTRUCTOR_UUID;

    const result = await loadInstructorRoster(
      { userId: INSTRUCTOR_UUID, section: "Testing" },
      {
        createPrivilegedClient: () =>
          createMockPrivilegedClient({
            profiles: [
              {
                id: "student-empty",
                username: "Calm River",
                section: "Testing",
              },
            ],
            progress: [],
          }) as never,
      },
    );

    if (previous === undefined) {
      delete process.env.INSTRUCTOR_USER_IDS;
    } else {
      process.env.INSTRUCTOR_USER_IDS = previous;
    }

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.roster.selectedWeek).toBe(CURRENT_INSTRUCTOR_WEEK);
    expect(result.roster.availableWeeks).toEqual([]);
    expect(result.roster.students).toEqual([
      {
        username: "Calm River",
        section: "Testing",
        currentStudyDay: null,
        expectedStudySessions: 75,
        weeklyParticipation: null,
      },
    ]);
  });

  it("rejects an invalid week before querying", async () => {
    const createPrivilegedClient = vi.fn();
    const previous = process.env.INSTRUCTOR_USER_IDS;
    process.env.INSTRUCTOR_USER_IDS = INSTRUCTOR_UUID;

    const result = await loadInstructorRoster(
      { userId: INSTRUCTOR_UUID, section: "Kinesiology 1", week: "not-a-week" },
      { createPrivilegedClient },
    );

    if (previous === undefined) {
      delete process.env.INSTRUCTOR_USER_IDS;
    } else {
      process.env.INSTRUCTOR_USER_IDS = previous;
    }

    expect(result).toEqual({ ok: false, kind: "invalid_week" });
    expect(createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("normalizes a week beyond the section's reached range to Current Week", async () => {
    const previous = process.env.INSTRUCTOR_USER_IDS;
    process.env.INSTRUCTOR_USER_IDS = INSTRUCTOR_UUID;
    const now = new Date("2026-09-23T21:00:00.000Z");

    const result = await loadInstructorRoster(
      {
        userId: INSTRUCTOR_UUID,
        section: "Testing",
        week: 9,
        now,
      },
      {
        createPrivilegedClient: () =>
          createMockPrivilegedClient({
            profiles: [
              {
                id: "student-a",
                username: "Lucky Pillow",
                section: "Testing",
              },
            ],
            progress: [
              {
                user_id: "student-a",
                progress_data: progressEnvelope({
                  currentStudyDay: 2,
                  completions: [
                    { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
                  ],
                }),
              },
            ],
          }) as never,
      },
    );

    if (previous === undefined) {
      delete process.env.INSTRUCTOR_USER_IDS;
    } else {
      process.env.INSTRUCTOR_USER_IDS = previous;
    }

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.roster.selectedWeek).toBe(CURRENT_INSTRUCTOR_WEEK);
    expect(result.roster.availableWeeks).toEqual([1]);
    expect(result.roster.students[0]?.weeklyParticipation).toEqual({
      status: "in-progress",
      weekNumber: 1,
      completedDays: 1,
      goalDays: 5,
    });
  });

  it("recalculates available weeks for the selected section only", async () => {
    const previous = process.env.INSTRUCTOR_USER_IDS;
    process.env.INSTRUCTOR_USER_IDS = INSTRUCTOR_UUID;
    const now = new Date("2026-10-08T16:00:00.000Z");
    const client = createMockPrivilegedClient({
      profiles: [
        {
          id: "kinesiology-student",
          username: "Week Four",
          section: "Kinesiology 1",
        },
        {
          id: "testing-student",
          username: "Week One",
          section: "Testing",
        },
      ],
      progress: [
        {
          user_id: "kinesiology-student",
          progress_data: progressEnvelope({
            currentStudyDay: 20,
            completions: [
              { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
            ],
          }),
        },
        {
          user_id: "testing-student",
          progress_data: progressEnvelope({
            currentStudyDay: 2,
            completions: [
              { studyDay: 1, completedAt: "2026-10-08T16:00:00.000Z" },
            ],
          }),
        },
      ],
    });

    const kinesiology = await loadInstructorRoster(
      { userId: INSTRUCTOR_UUID, section: "Kinesiology 1", now },
      { createPrivilegedClient: () => client as never },
    );
    const testing = await loadInstructorRoster(
      { userId: INSTRUCTOR_UUID, section: "Testing", now },
      { createPrivilegedClient: () => client as never },
    );

    if (previous === undefined) {
      delete process.env.INSTRUCTOR_USER_IDS;
    } else {
      process.env.INSTRUCTOR_USER_IDS = previous;
    }

    expect(kinesiology.ok && kinesiology.roster.availableWeeks).toEqual([
      1, 2, 3, 4,
    ]);
    expect(testing.ok && testing.roster.availableWeeks).toEqual([1]);
  });
});

describe("instructor week options", () => {
  it("offers Current Week only when no learner is anchored", () => {
    expect(getAvailableInstructorWeeks([null, undefined])).toEqual([]);
    expect(
      resolveInstructorWeekSelection(1, getAvailableInstructorWeeks([null])),
    ).toBe(CURRENT_INSTRUCTOR_WEEK);
  });

  it("offers Week 1 when the highest reached week is 1", () => {
    expect(getAvailableInstructorWeeks([1, null])).toEqual([1]);
  });

  it("offers Week 1 through Week 4 when the highest reached week is 4", () => {
    expect(getAvailableInstructorWeeks([2, 4, 1])).toEqual([1, 2, 3, 4]);
  });
});

describe("instructor week param validation", () => {
  it("defaults omitted or current values to Current Week", () => {
    expect(parseInstructorWeekInput(undefined)).toEqual({
      ok: true,
      week: CURRENT_INSTRUCTOR_WEEK,
    });
    expect(parseInstructorWeekInput("")).toEqual({
      ok: true,
      week: CURRENT_INSTRUCTOR_WEEK,
    });
    expect(parseInstructorWeekInput("current")).toEqual({
      ok: true,
      week: CURRENT_INSTRUCTOR_WEEK,
    });
  });

  it("accepts a positive integer week", () => {
    expect(parseInstructorWeekInput("1")).toEqual({ ok: true, week: 1 });
    expect(parseInstructorWeekInput(4)).toEqual({ ok: true, week: 4 });
  });

  it("rejects unsafe week values", () => {
    expect(parseInstructorWeekInput("0")).toEqual({ ok: false });
    expect(parseInstructorWeekInput("-1")).toEqual({ ok: false });
    expect(parseInstructorWeekInput("1.5")).toEqual({ ok: false });
    expect(parseInstructorWeekInput("01")).toEqual({ ok: false });
    expect(parseInstructorWeekInput("Week 1")).toEqual({ ok: false });
    expect(parseInstructorWeekInput("1000")).toEqual({ ok: false });
    expect(parseInstructorWeekInput("999999999")).toEqual({ ok: false });
  });
});

describe("historical instructor participation", () => {
  const thursday = "2026-09-17T21:14:03.512Z";
  const friday = "2026-09-18T20:00:00.000Z";
  const saturdayMorning = "2026-09-19T15:00:00.000Z";
  const saturdayAfternoon = "2026-09-19T17:00:00.000Z";
  const saturdayEvening = "2026-09-19T22:00:00.000Z";
  const monday = "2026-09-21T16:00:00.000Z";
  const wednesday = "2026-09-23T16:00:00.000Z";
  const nextThursday = "2026-09-24T16:00:00.000Z";
  const week4Now = new Date("2026-10-08T16:00:00.000Z");

  it("returns a completed Week 1 score of 5/5", () => {
    const row = mapInstructorStudentRow({
      username: "Agile Fox",
      section: "Kinesiology 1",
      selectedWeek: 1,
      now: new Date(nextThursday),
      progressData: progressEnvelope({
        currentStudyDay: 8,
        completions: [
          { studyDay: 1, completedAt: thursday },
          { studyDay: 2, completedAt: friday },
          { studyDay: 3, completedAt: saturdayMorning },
          { studyDay: 4, completedAt: saturdayAfternoon },
          { studyDay: 5, completedAt: saturdayEvening },
          { studyDay: 6, completedAt: monday },
          { studyDay: 7, completedAt: wednesday },
        ],
      }),
    });

    expect(row.weeklyParticipation).toEqual({
      status: "complete",
      weekNumber: 1,
      completedDays: 5,
      goalDays: 5,
    });
    expect(formatInstructorWeeklyParticipation(row, 1)).toBe("5/5");
  });

  it("returns a completed Week 1 score of 3/5 and ignores later Week 2 catch-up", () => {
    const row = mapInstructorStudentRow({
      username: "Bright Cedar",
      section: "Kinesiology 1",
      selectedWeek: 1,
      now: new Date(nextThursday),
      progressData: progressEnvelope({
        currentStudyDay: 8,
        completions: [
          { studyDay: 1, completedAt: thursday },
          { studyDay: 2, completedAt: friday },
          { studyDay: 3, completedAt: saturdayMorning },
          { studyDay: 4, completedAt: nextThursday },
          { studyDay: 5, completedAt: "2026-09-25T16:00:00.000Z" },
          { studyDay: 6, completedAt: "2026-09-26T16:00:00.000Z" },
        ],
      }),
    });

    expect(row.weeklyParticipation).toEqual({
      status: "complete",
      weekNumber: 1,
      completedDays: 3,
      goalDays: 5,
    });
    expect(row.currentStudyDay).toBe(8);
    expect(formatInstructorStudyProgress(row)).toBe("Day 8 / 75");
    expect(formatInstructorWeeklyParticipation(row, 1)).toBe("3/5");
  });

  it("counts the Day 1 anchor date once under participation.ts rules", () => {
    const row = mapInstructorStudentRow({
      username: "Calm River",
      section: "Kinesiology 1",
      selectedWeek: 1,
      now: new Date(nextThursday),
      progressData: progressEnvelope({
        currentStudyDay: 3,
        completions: [
          { studyDay: 1, completedAt: thursday },
          { studyDay: 2, completedAt: "2026-09-18T02:00:00.000Z" },
        ],
      }),
    });

    expect(row.weeklyParticipation).toEqual({
      status: "complete",
      weekNumber: 1,
      completedDays: 1,
      goalDays: 5,
    });
  });

  it("keeps the 5/5 cap and Chicago same-date dedupe for a completed week", () => {
    const row = mapInstructorStudentRow({
      username: "Agile Fox",
      section: "Kinesiology 1",
      selectedWeek: 1,
      now: new Date(nextThursday),
      progressData: progressEnvelope({
        currentStudyDay: 9,
        completions: [
          { studyDay: 1, completedAt: thursday },
          { studyDay: 2, completedAt: friday },
          { studyDay: 3, completedAt: saturdayMorning },
          { studyDay: 4, completedAt: saturdayAfternoon },
          { studyDay: 5, completedAt: saturdayEvening },
          { studyDay: 6, completedAt: monday },
          { studyDay: 7, completedAt: wednesday },
          { studyDay: 8, completedAt: "2026-09-23T21:00:00.000Z" },
          { studyDay: 9, completedAt: "2026-09-20T18:00:00.000Z" },
        ],
      }),
    });

    expect(row.weeklyParticipation).toEqual({
      status: "complete",
      weekNumber: 1,
      completedDays: 5,
      goalDays: 5,
    });
  });

  it("uses America/Chicago week boundaries for historical Week 2", () => {
    const row = mapInstructorStudentRow({
      username: "DST Learner",
      section: "Kinesiology 1",
      selectedWeek: 1,
      now: new Date("2026-03-12T17:00:00.000Z"),
      progressData: progressEnvelope({
        currentStudyDay: 2,
        completions: [
          { studyDay: 1, completedAt: "2026-03-05T18:00:00.000Z" },
          { studyDay: 2, completedAt: "2026-03-12T17:00:00.000Z" },
        ],
      }),
    });

    expect(row.weeklyParticipation).toEqual({
      status: "complete",
      weekNumber: 1,
      completedDays: 1,
      goalDays: 5,
    });
  });

  it("marks a selected past week complete, the current week in progress, and a future week not reached", () => {
    const progressData = progressEnvelope({
      currentStudyDay: 10,
      completions: [
        { studyDay: 1, completedAt: thursday },
        { studyDay: 2, completedAt: friday },
        { studyDay: 3, completedAt: nextThursday },
      ],
    });

    const complete = mapInstructorStudentRow({
      username: "Student A",
      section: "Kinesiology 1",
      selectedWeek: 1,
      now: new Date(nextThursday),
      progressData,
    });
    const inProgress = mapInstructorStudentRow({
      username: "Student A",
      section: "Kinesiology 1",
      selectedWeek: 2,
      now: new Date(nextThursday),
      progressData,
    });
    const future = mapInstructorStudentRow({
      username: "Student A",
      section: "Kinesiology 1",
      selectedWeek: 4,
      now: new Date(nextThursday),
      progressData,
    });

    expect(complete.weeklyParticipation).toEqual({
      status: "complete",
      weekNumber: 1,
      completedDays: 2,
      goalDays: 5,
    });
    expect(inProgress.weeklyParticipation).toEqual({
      status: "in-progress",
      weekNumber: 2,
      completedDays: 1,
      goalDays: 5,
    });
    expect(future.weeklyParticipation).toEqual({
      status: "not-reached",
      weekNumber: 4,
    });
    expect(formatInstructorWeeklyParticipation(complete, 1)).toBe("2/5");
    expect(formatInstructorWeeklyParticipation(inProgress, 2)).toBe(
      "1/5 · In progress",
    );
    expect(formatInstructorWeeklyParticipation(future, 4)).toBe("Not reached");
    expect(formatInstructorWeeklyParticipation(future, 4)).not.toContain("0/5");
  });

  it("shows 0/5 for an elapsed week with no qualifying days, not Not reached", () => {
    const row = mapInstructorStudentRow({
      username: "Student A",
      section: "Kinesiology 1",
      selectedWeek: 2,
      now: week4Now,
      progressData: progressEnvelope({
        currentStudyDay: 2,
        completions: [{ studyDay: 1, completedAt: thursday }],
      }),
    });

    expect(row.weeklyParticipation).toEqual({
      status: "complete",
      weekNumber: 2,
      completedDays: 0,
      goalDays: 5,
    });
    expect(formatInstructorWeeklyParticipation(row, 2)).toBe("0/5");
  });

  it("keeps unanchored learners as Not tracked for a historical week", () => {
    const row = mapInstructorStudentRow({
      username: "Legacy Learner",
      section: "Kinesiology 1",
      selectedWeek: 1,
      now: week4Now,
      progressData: progressEnvelope({
        currentStudyDay: 12,
        completedStudyDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      }),
    });

    expect(row.weeklyParticipation).toBeNull();
    expect(formatInstructorWeeklyParticipation(row, 1)).toBe("Not tracked");
    expect(formatInstructorWeeklyParticipation(row, 1)).not.toContain("0/5");
    expect(formatInstructorStudyProgress(row)).toBe("Day 12 / 75");
  });

  it("returns each learner's own Week 1 when anchors differ", () => {
    const now = new Date("2026-09-24T16:00:00.000Z");
    const studentA = mapInstructorStudentRow({
      username: "Student A",
      section: "Kinesiology 1",
      selectedWeek: 1,
      now,
      progressData: progressEnvelope({
        currentStudyDay: 4,
        completions: [
          { studyDay: 1, completedAt: thursday },
          { studyDay: 2, completedAt: friday },
          { studyDay: 3, completedAt: saturdayMorning },
        ],
      }),
    });
    const studentB = mapInstructorStudentRow({
      username: "Student B",
      section: "Kinesiology 1",
      selectedWeek: 1,
      now,
      progressData: progressEnvelope({
        currentStudyDay: 2,
        completions: [{ studyDay: 1, completedAt: nextThursday }],
      }),
    });

    expect(studentA.weeklyParticipation).toEqual({
      status: "complete",
      weekNumber: 1,
      completedDays: 3,
      goalDays: 5,
    });
    expect(studentB.weeklyParticipation).toEqual({
      status: "in-progress",
      weekNumber: 1,
      completedDays: 1,
      goalDays: 5,
    });
  });

  it("can show Week 3 complete for one learner and Not reached for a later joiner", () => {
    const advanced = mapInstructorStudentRow({
      username: "Student A",
      section: "Kinesiology 1",
      selectedWeek: 3,
      now: week4Now,
      progressData: progressEnvelope({
        currentStudyDay: 15,
        completions: [{ studyDay: 1, completedAt: thursday }],
      }),
    });
    const laterJoiner = mapInstructorStudentRow({
      username: "Student B",
      section: "Kinesiology 1",
      selectedWeek: 3,
      now: week4Now,
      progressData: progressEnvelope({
        currentStudyDay: 2,
        completions: [{ studyDay: 1, completedAt: "2026-10-02T16:00:00.000Z" }],
      }),
    });

    expect(advanced.weeklyParticipation).toEqual({
      status: "complete",
      weekNumber: 3,
      completedDays: 0,
      goalDays: 5,
    });
    expect(laterJoiner.weeklyParticipation).toEqual({
      status: "not-reached",
      weekNumber: 3,
    });
  });

  it("keeps Study Progress on the current /75 day while a historical week is selected", () => {
    const row = mapInstructorStudentRow({
      username: "Student A",
      section: "Kinesiology 1",
      selectedWeek: 1,
      now: week4Now,
      progressData: progressEnvelope({
        currentStudyDay: 27,
        completions: [{ studyDay: 1, completedAt: thursday }],
      }),
    });

    expect(row.currentStudyDay).toBe(27);
    expect(row.expectedStudySessions).toBe(EXPECTED_COURSE_STUDY_SESSIONS);
    expect(row.expectedStudySessions).not.toBe(COURSE_DAYS);
    expect(formatInstructorStudyProgress(row)).toBe("Day 27 / 75");
    expect(formatInstructorStudyProgress(row)).not.toContain("105");
    expect(formatInstructorParticipationColumnLabel(1)).toBe(
      "Week 1 Participation",
    );
    expect(formatInstructorParticipationColumnLabel(CURRENT_INSTRUCTOR_WEEK)).toBe(
      "Weekly Participation",
    );
  });
});
