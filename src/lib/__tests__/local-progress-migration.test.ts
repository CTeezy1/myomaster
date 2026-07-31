import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canImportLocalProgressForUser,
  getLocalMigrationMarkerKey,
  hasCompletedLocalMigration,
  markLocalMigrationComplete,
  setLocalProgressOwner,
  shouldUseLocalImport,
} from "@/src/lib/progress/local-progress-migration";
import { COURSE_PROGRESS_STORAGE_KEY } from "@/src/lib/course-progress";

describe("local progress migration", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    const storage = {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
      clear() {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      },
      get length() {
        return Object.keys(store).length;
      },
    };

    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { localStorage: storage });
  });

  it("imports only when no database row and migration not completed", () => {
    localStorage.setItem(
      COURSE_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        courses: {
          "kinesiology-program": {
            version: 1,
            courseId: "kinesiology-program",
            startedAt: "2026-07-30T00:00:00.000Z",
            currentStudyDay: 2,
            introducedMuscleIds: ["psoas-major"],
            introductionDates: {},
            introductionStudyDays: {},
            recentGrades: [],
            carriedOverRetryKeys: [],
            completedStudyDays: [],
          },
        },
      }),
    );

    expect(shouldUseLocalImport("user-a", false)).toBe(true);
    expect(shouldUseLocalImport("user-a", true)).toBe(false);
  });

  it("does not repeat migration for the same user", () => {
    markLocalMigrationComplete("user-a");

    expect(hasCompletedLocalMigration("user-a")).toBe(true);
    expect(canImportLocalProgressForUser("user-a")).toBe(false);
  });

  it("prevents a second user from importing another learner's local cache", () => {
    localStorage.setItem(
      COURSE_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        courses: {
          "kinesiology-program": {
            version: 1,
            courseId: "kinesiology-program",
            startedAt: "2026-07-30T00:00:00.000Z",
            currentStudyDay: 3,
            introducedMuscleIds: ["psoas-major"],
            introductionDates: {},
            introductionStudyDays: {},
            recentGrades: ["correct"],
            carriedOverRetryKeys: [],
            completedStudyDays: [1],
          },
        },
      }),
    );

    setLocalProgressOwner("user-a");

    expect(canImportLocalProgressForUser("user-b")).toBe(false);
    expect(getLocalMigrationMarkerKey("user-b")).toBe(
      "myomaster-progress-migrated:user-b",
    );
  });
});
