import { describe, expect, it, vi } from "vitest";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { createDefaultCourseProgress } from "@/src/lib/course-progress";
import {
  DEFAULT_INSTRUCTOR_SECTION,
  formatInstructorStudyProgress,
  formatInstructorWeeklyParticipation,
  mapInstructorStudentRow,
  parseInstructorSectionInput,
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
      weekNumber: 2,
      completedDays: 0,
      goalDays: 5,
    });
    expect(fridayAnchor.weeklyParticipation).toEqual({
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
});
