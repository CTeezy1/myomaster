import { beforeEach, describe, expect, it, vi } from "vitest";
import { cervicalCourse } from "@/src/lib/course-controller";
import {
  advanceStudyDay,
  clearCourseProgress,
  createDefaultCourseProgress,
  COURSE_PROGRESS_STORAGE_KEY,
  getCourseProgress,
  isCurrentStudyDayCompleted,
  markStudyDayCompleted,
  writeCourseProgressStore,
} from "@/src/lib/course-progress";
import { planDailyWorkload } from "@/src/lib/daily-workload-planning";
import { canAdvanceStudyDay } from "@/src/lib/guided-scheduling";
import { computeDashboardStats } from "@/src/hooks/useDashboardStats";
import { buildStudyDayScheduledQueue } from "@/src/lib/study-day-session";
import type { MasteryProgressStore } from "@/src/lib/progress.types";

const emptyStore = (): MasteryProgressStore => ({
  version: 1,
  cards: {},
});

beforeEach(() => {
  const storage = new Map<string, string>();

  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };

  vi.stubGlobal("window", { localStorage });
  clearCourseProgress();
});

describe("study day completion", () => {
  it("marks the current study day complete and persists it", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: createDefaultCourseProgress("cervical"),
      },
    });

    const completedAt = new Date("2026-09-17T21:14:03.512Z");
    markStudyDayCompleted("cervical", undefined, completedAt);

    const progress = getCourseProgress("cervical");
    expect(progress.completedStudyDays).toEqual([1]);
    expect(progress.studyDayCompletions).toEqual([
      { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
    ]);
    expect(isCurrentStudyDayCompleted(progress)).toBe(true);
  });

  it("does not generate another planned queue after the day is complete", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          startedAt: "2026-01-01T12:00:00.000Z",
          completedStudyDays: [1],
        },
      },
    });
    const courseProgress = getCourseProgress("cervical");

    expect(
      buildStudyDayScheduledQueue(cervicalCourse, courseProgress, emptyStore()),
    ).toEqual([]);
    expect(
      planDailyWorkload(cervicalCourse, courseProgress, emptyStore())
        .plannedPromptCount,
    ).toBeGreaterThan(0);
    expect(computeDashboardStats(cervicalCourse).plannedPromptCount).toBe(0);
  });

  it("keeps the dashboard from offering another session after completion", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          startedAt: "2026-01-01T12:00:00.000Z",
          completedStudyDays: [1],
        },
      },
    });

    const stats = computeDashboardStats(cervicalCourse);

    expect(stats.isStudyDayComplete).toBe(true);
    expect(stats.canStartGuidedStudy).toBe(false);
    expect(stats.remainingNewMuscleAllowance).toBe(0);
  });

  it("treats refresh as idempotent by recomputing the same completed dashboard state", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          startedAt: "2026-01-01T12:00:00.000Z",
          completedStudyDays: [1],
        },
      },
    });

    const firstView = computeDashboardStats(cervicalCourse);
    const secondView = computeDashboardStats(cervicalCourse);

    expect(secondView).toEqual(firstView);
    expect(secondView.canStartGuidedStudy).toBe(false);
  });

  it("enables Start Next Study Day only after the current day is complete", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          startedAt: "2026-01-01T12:00:00.000Z",
        },
      },
    });

    expect(
      canAdvanceStudyDay(
        getCourseProgress("cervical"),
        cervicalCourse.muscleProfileIds,
        emptyStore(),
      ),
    ).toBe(false);

    markStudyDayCompleted("cervical");

    expect(
      canAdvanceStudyDay(
        getCourseProgress("cervical"),
        cervicalCourse.muscleProfileIds,
        emptyStore(),
      ),
    ).toBe(true);
  });

  it("increments the study day exactly once and unlocks a new queue", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          startedAt: "2026-01-01T12:00:00.000Z",
          completedStudyDays: [1],
        },
      },
    });

    const advancedOnce = advanceStudyDay("cervical");
    const advancedTwice = advanceStudyDay("cervical");

    expect(advancedOnce.currentStudyDay).toBe(2);
    expect(advancedTwice.currentStudyDay).toBe(2);
    expect(advancedOnce.studyDayCompletions).toEqual([]);
    expect(isCurrentStudyDayCompleted(advancedOnce)).toBe(false);
    expect(
      buildStudyDayScheduledQueue(cervicalCourse, advancedOnce, emptyStore()).length,
    ).toBeGreaterThan(0);
  });

  it("keeps due-review sessions separate from new-muscle assignment on completed days", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          startedAt: "2026-01-01T12:00:00.000Z",
          completedStudyDays: [1],
        },
      },
    });

    const stats = computeDashboardStats(cervicalCourse);

    expect(stats.canStartGuidedStudy).toBe(false);
    expect(stats.newMusclePromptCount).toBe(0);
    expect(stats.canStartReview).toBe(false);
  });

  it("persists completion through course progress storage", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: createDefaultCourseProgress("cervical"),
      },
    });

    markStudyDayCompleted("cervical", undefined, new Date("2026-09-17T21:14:03.512Z"));

    const raw = window.localStorage.getItem(COURSE_PROGRESS_STORAGE_KEY);
    expect(raw).toContain("completedStudyDays");
    expect(JSON.parse(raw!).courses.cervical.completedStudyDays).toEqual([1]);
    expect(JSON.parse(raw!).courses.cervical.studyDayCompletions).toEqual([
      { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
    ]);
  });
});
