import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { computeDashboardStats } from "@/src/hooks/useDashboardStats";
import { cervicalCourse } from "@/src/lib/course-controller";
import {
  advanceStudyDay,
  clearCourseProgress,
  COURSE_PROGRESS_STORAGE_KEY,
  createDefaultCourseProgress,
  getCourseProgress,
  markStudyDayCompleted,
  writeCourseProgressStore,
} from "@/src/lib/course-progress";
import {
  COURSE_DAYS,
  getDailyNewMuscleTarget,
} from "@/src/lib/introduction-policy";
import { myomasterProgramCourse } from "@/src/data/courses/myomaster-program-course";
import { markMuscleBriefViewed } from "@/src/lib/muscle-brief-progress";
import {
  applyStudyStateToLocal,
  collectLocalStudyState,
  createDefaultPersistedLearnerProgress,
} from "@/src/lib/progress/learner-progress-snapshot";
import {
  createValidatedPersistedLearnerProgress,
  parsePersistedLearnerProgress,
} from "@/src/lib/progress/learner-progress-validation";
import { LEARNER_PROGRESS_SCHEMA_VERSION } from "@/src/lib/progress/learner-progress.types";
import {
  calendarDaysBetween,
  findDay1Completion,
  getCurrentWeeklyParticipation,
  getHistoricalWeeklyParticipation,
  getParticipationAnchorDate,
  getParticipationWeekIndex,
  getWeeklyParticipation,
  PARTICIPATION_GOAL_DAYS,
  PARTICIPATION_TIME_ZONE,
  toChicagoCivilDate,
} from "@/src/lib/participation";
import type { StudyDayCompletion } from "@/src/lib/progress.types";
import { EXPECTED_COURSE_STUDY_SESSIONS } from "@/src/lib/study-day-display";
import {
  ACTIVE_STUDY_SESSION_STORAGE_KEY,
  ACTIVE_STUDY_SESSION_VERSION,
  createPersistedActiveStudySession,
  readActiveStudySession,
  writeActiveStudySession,
} from "@/src/lib/active-study-session";
import { createInitialCardFeedbackState } from "@/src/lib/quiz-card-state";
import { createSameSessionRelearnState } from "@/src/lib/same-session-relearn";
import {
  createDefaultCardProgress,
  writeMasteryProgress,
} from "@/src/lib/mastery-progress";
import { buildMixedReviewQueue } from "@/src/lib/review-session";

function stubLocalStorage() {
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
}

function seedCourse(progress: ReturnType<typeof createDefaultCourseProgress>) {
  writeCourseProgressStore({
    version: 1,
    courses: {
      [progress.courseId]: progress,
    },
  });
}

function completeDay(studyDay: number, iso: string, courseId = "cervical") {
  return markStudyDayCompleted(courseId, studyDay, new Date(iso));
}

function lastIntroductionDay() {
  const totalMuscles = myomasterProgramCourse.muscleProfileIds.length;
  let introducedThisWeek = 0;
  let introducedCount = 0;
  let lastDay = 0;

  for (let courseDay = 1; courseDay <= COURSE_DAYS; courseDay += 1) {
    if (((courseDay - 1) % 7) + 1 === 1) {
      introducedThisWeek = 0;
    }

    const introductionsToday = Math.min(
      getDailyNewMuscleTarget(courseDay, introducedThisWeek, 0, null),
      totalMuscles - introducedCount,
    );

    if (introductionsToday > 0) {
      introducedCount += introductionsToday;
      introducedThisWeek += introductionsToday;
      lastDay = courseDay;
    }
  }

  return lastDay;
}

beforeEach(() => {
  stubLocalStorage();
  clearCourseProgress();
});

describe("America/Chicago civil-date conversion", () => {
  it("uses an explicit America/Chicago zone and YYYY-MM-DD civil dates", () => {
    expect(PARTICIPATION_TIME_ZONE).toBe("America/Chicago");
    expect(PARTICIPATION_GOAL_DAYS).toBe(5);

    const civilDate = toChicagoCivilDate("2026-09-17T21:14:03.512Z");

    expect(civilDate).toBe("2026-09-17");
    expect(civilDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps a completion immediately before Central midnight on the earlier civil date", () => {
    expect(toChicagoCivilDate("2026-09-18T04:59:59.000Z")).toBe("2026-09-17");
    expect(toChicagoCivilDate("2026-09-18T05:00:00.000Z")).toBe("2026-09-18");
  });

  it("does not treat a UTC date rollover as a Chicago participation date", () => {
    const utcFridayStillThursdayInChicago = "2026-09-18T04:30:00.000Z";

    expect(utcFridayStillThursdayInChicago.startsWith("2026-09-18")).toBe(true);
    expect(toChicagoCivilDate(utcFridayStillThursdayInChicago)).toBe("2026-09-17");
  });

  it("is independent of the device timezone because conversion names America/Chicago", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/participation.ts"),
      "utf8",
    );

    expect(source).toContain('timeZone: PARTICIPATION_TIME_ZONE');
    expect(source).toContain('"America/Chicago"');
    expect(source).not.toContain("getTimezoneOffset");
    expect(source).not.toContain("getCourseDay(");

    const utcDate = new Date("2026-09-18T04:30:00.000Z");

    expect(toChicagoCivilDate(utcDate)).toBe("2026-09-17");
    expect(toChicagoCivilDate(utcDate)).not.toBe(utcDate.toISOString().slice(0, 10));
  });
});

describe("DST-safe civil-day week arithmetic", () => {
  it("counts seven calendar days across the spring DST transition", () => {
    expect(calendarDaysBetween("2026-03-05", "2026-03-12")).toBe(7);
    expect(getParticipationWeekIndex("2026-03-05", "2026-03-12")).toBe(1);
    expect(getParticipationWeekIndex("2026-03-05", "2026-03-11")).toBe(0);

    const completions: StudyDayCompletion[] = [
      { studyDay: 1, completedAt: "2026-03-05T18:00:00.000Z" },
      { studyDay: 2, completedAt: "2026-03-12T17:00:00.000Z" },
    ];

    expect(toChicagoCivilDate(completions[0]!.completedAt)).toBe("2026-03-05");
    expect(toChicagoCivilDate(completions[1]!.completedAt)).toBe("2026-03-12");
    expect(getCurrentWeeklyParticipation(completions, new Date("2026-03-12T17:00:00.000Z"))).toMatchObject({
      weekNumber: 2,
      weekIndex: 1,
      completedDays: 1,
    });
  });

  it("counts seven calendar days across the fall DST transition", () => {
    expect(calendarDaysBetween("2026-10-29", "2026-11-05")).toBe(7);
    expect(getParticipationWeekIndex("2026-10-29", "2026-11-04")).toBe(0);
    expect(getParticipationWeekIndex("2026-10-29", "2026-11-05")).toBe(1);

    const completions: StudyDayCompletion[] = [
      { studyDay: 1, completedAt: "2026-10-29T17:00:00.000Z" },
      { studyDay: 2, completedAt: "2026-11-04T18:00:00.000Z" },
      { studyDay: 3, completedAt: "2026-11-05T18:00:00.000Z" },
    ];

    expect(getWeeklyParticipation(completions, 0)).toMatchObject({
      weekNumber: 1,
      completedDays: 2,
    });
    expect(getWeeklyParticipation(completions, 1)).toMatchObject({
      weekNumber: 2,
      completedDays: 1,
    });
  });
});

describe("weekly participation from Study Day 1 Thursday Chicago", () => {
  const thursday = "2026-09-17T21:14:03.512Z";
  const friday = "2026-09-18T20:00:00.000Z";
  const saturdayMorning = "2026-09-19T15:00:00.000Z";
  const saturdayAfternoon = "2026-09-19T17:00:00.000Z";
  const saturdayEvening = "2026-09-19T22:00:00.000Z";
  const monday = "2026-09-21T16:00:00.000Z";
  const wednesday = "2026-09-23T16:00:00.000Z";
  const wednesdayExtra = "2026-09-23T21:00:00.000Z";
  const sundaySameWeek = "2026-09-20T18:00:00.000Z";
  const nextThursday = "2026-09-24T16:00:00.000Z";

  it("records Day 1, preserves the UTC timestamp, and shows Week 1 as 1/5", () => {
    seedCourse(createDefaultCourseProgress("cervical"));

    const updated = completeDay(1, thursday);

    expect(updated.studyDayCompletions).toEqual([
      { studyDay: 1, completedAt: thursday },
    ]);
    expect(findDay1Completion(updated.studyDayCompletions)?.completedAt).toBe(
      thursday,
    );
    expect(getParticipationAnchorDate(updated.studyDayCompletions)).toBe(
      "2026-09-17",
    );

    const current = getCurrentWeeklyParticipation(
      updated.studyDayCompletions,
      new Date(thursday),
    );

    expect(current).toMatchObject({
      weekNumber: 1,
      weekIndex: 0,
      completedDays: 1,
      distinctDateCount: 1,
      goalDays: 5,
      isComplete: false,
    });
    expect(computeDashboardStats(cervicalCourse, new Date(thursday)).weeklyParticipation).toEqual(
      current,
    );
  });

  it("advances Friday, Saturday, Monday, and Wednesday as distinct participation days", () => {
    seedCourse(createDefaultCourseProgress("cervical"));

    completeDay(1, thursday);
    expect(
      getCurrentWeeklyParticipation(
        getCourseProgress("cervical").studyDayCompletions,
        new Date(friday),
      )?.completedDays,
    ).toBe(1);

    completeDay(2, friday);
    expect(
      getCurrentWeeklyParticipation(
        getCourseProgress("cervical").studyDayCompletions,
        new Date(friday),
      )?.completedDays,
    ).toBe(2);

    completeDay(3, saturdayMorning);
    completeDay(4, saturdayAfternoon);
    completeDay(5, saturdayEvening);

    const afterSaturday = getCourseProgress("cervical");

    expect(afterSaturday.studyDayCompletions).toHaveLength(5);
    expect(
      afterSaturday.studyDayCompletions?.map((event) => event.studyDay),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(
      getCurrentWeeklyParticipation(
        afterSaturday.studyDayCompletions,
        new Date(saturdayEvening),
      ),
    ).toMatchObject({
      completedDays: 3,
      distinctDateCount: 3,
    });

    completeDay(6, monday);
    expect(
      getCurrentWeeklyParticipation(
        getCourseProgress("cervical").studyDayCompletions,
        new Date(monday),
      )?.completedDays,
    ).toBe(4);

    completeDay(7, wednesday);
    expect(
      getCurrentWeeklyParticipation(
        getCourseProgress("cervical").studyDayCompletions,
        new Date(wednesday),
      ),
    ).toMatchObject({
      weekNumber: 1,
      completedDays: 5,
      isComplete: true,
    });
  });

  it("stores extra same-day and sixth-date completions without exceeding 5/5", () => {
    seedCourse(createDefaultCourseProgress("cervical"));
    completeDay(1, thursday);
    completeDay(2, friday);
    completeDay(3, saturdayMorning);
    completeDay(4, saturdayAfternoon);
    completeDay(5, saturdayEvening);
    completeDay(6, monday);
    completeDay(7, wednesday);
    completeDay(8, wednesdayExtra);

    const afterExtraWednesday = getCourseProgress("cervical");

    expect(afterExtraWednesday.studyDayCompletions).toHaveLength(8);
    expect(
      getCurrentWeeklyParticipation(
        afterExtraWednesday.studyDayCompletions,
        new Date(wednesdayExtra),
      ),
    ).toMatchObject({
      completedDays: 5,
      distinctDateCount: 5,
      isComplete: true,
    });

    completeDay(9, sundaySameWeek);

    const afterSixthDate = getCourseProgress("cervical");

    expect(afterSixthDate.studyDayCompletions).toHaveLength(9);
    expect(
      getCurrentWeeklyParticipation(
        afterSixthDate.studyDayCompletions,
        new Date(wednesdayExtra),
      ),
    ).toMatchObject({
      completedDays: 5,
      distinctDateCount: 6,
      isComplete: true,
    });
  });

  it("starts the next Thursday as Week 2 at 0/5, then 1/5, while Week 1 stays 5/5", () => {
    seedCourse(createDefaultCourseProgress("cervical"));
    completeDay(1, thursday);
    completeDay(2, friday);
    completeDay(3, saturdayMorning);
    completeDay(4, saturdayAfternoon);
    completeDay(5, saturdayEvening);
    completeDay(6, monday);
    completeDay(7, wednesday);
    completeDay(8, wednesdayExtra);
    completeDay(9, sundaySameWeek);

    const beforeWeek2Completion = getCurrentWeeklyParticipation(
      getCourseProgress("cervical").studyDayCompletions,
      new Date(nextThursday),
    );

    expect(beforeWeek2Completion).toMatchObject({
      weekNumber: 2,
      weekIndex: 1,
      completedDays: 0,
      distinctDateCount: 0,
      isComplete: false,
    });

    completeDay(10, nextThursday);

    const afterWeek2Completion = getCourseProgress("cervical").studyDayCompletions;

    expect(
      getCurrentWeeklyParticipation(afterWeek2Completion, new Date(nextThursday)),
    ).toMatchObject({
      weekNumber: 2,
      completedDays: 1,
    });
    expect(getWeeklyParticipation(afterWeek2Completion, 0)).toMatchObject({
      weekNumber: 1,
      completedDays: 5,
      distinctDateCount: 6,
    });

    const history = getHistoricalWeeklyParticipation(
      afterWeek2Completion,
      new Date(nextThursday),
    );

    expect(history.map((week) => `${week.weekNumber}:${week.completedDays}`)).toEqual([
      "1:5",
      "2:1",
    ]);
  });
});

describe("markStudyDayCompleted participation events", () => {
  it("writes exactly one completion event when called twice for the same Study Day", () => {
    seedCourse(createDefaultCourseProgress("cervical"));

    const first = markStudyDayCompleted(
      "cervical",
      1,
      new Date("2026-09-17T21:14:03.512Z"),
    );
    const second = markStudyDayCompleted(
      "cervical",
      1,
      new Date("2026-09-17T22:00:00.000Z"),
    );

    expect(first.studyDayCompletions).toHaveLength(1);
    expect(second.studyDayCompletions).toHaveLength(1);
    expect(second.studyDayCompletions?.[0]?.completedAt).toBe(
      "2026-09-17T21:14:03.512Z",
    );
  });

  it("does not create a completion event when advancing the study day", () => {
    seedCourse({
      ...createDefaultCourseProgress("cervical"),
      completedStudyDays: [1],
      studyDayCompletions: [
        { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
      ],
    });

    const advanced = advanceStudyDay("cervical");

    expect(advanced.currentStudyDay).toBe(2);
    expect(advanced.studyDayCompletions).toEqual([
      { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
    ]);
  });

  it("uses the actual completion time after a mid-session return and later resume/finish", () => {
    seedCourse(createDefaultCourseProgress("cervical"));

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 1,
        plannedStaticQueue: [
          {
            muscleId: "longus-colli",
            cardKey: "longus-colli:action",
            category: "action",
          },
        ],
        session: createSameSessionRelearnState([
          {
            muscleId: "longus-colli",
            cardKey: "longus-colli:action",
            category: "action",
          },
        ]),
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    expect(getCourseProgress("cervical").studyDayCompletions).toEqual([]);
    expect(readActiveStudySession()).not.toBeNull();

    const finished = markStudyDayCompleted(
      "cervical",
      1,
      new Date("2026-09-17T22:45:00.000Z"),
    );

    expect(finished.studyDayCompletions).toEqual([
      { studyDay: 1, completedAt: "2026-09-17T22:45:00.000Z" },
    ]);
  });
});

describe("non-completion flows do not grant participation", () => {
  it("does not write a completion event when returning to the dashboard mid-session", () => {
    seedCourse(createDefaultCourseProgress(DEFAULT_COURSE_ID));
    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: DEFAULT_COURSE_ID,
        studyDay: 1,
        plannedStaticQueue: [],
        session: createSameSessionRelearnState([
          {
            muscleId: "longus-colli",
            cardKey: "longus-colli:action",
            category: "action",
          },
        ]),
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    expect(getCourseProgress(DEFAULT_COURSE_ID).studyDayCompletions).toEqual([]);
    expect(readActiveStudySession()?.screen).toBe("study-day");
    expect(
      getCurrentWeeklyParticipation(
        getCourseProgress(DEFAULT_COURSE_ID).studyDayCompletions,
      ),
    ).toBeNull();
  });

  it("does not grant participation for Muscle Brief viewing", () => {
    seedCourse(createDefaultCourseProgress("cervical"));
    markMuscleBriefViewed("longus-colli");

    expect(getCourseProgress("cervical").studyDayCompletions).toEqual([]);
    expect(
      getCurrentWeeklyParticipation(getCourseProgress("cervical").studyDayCompletions),
    ).toBeNull();
  });

  it("does not grant participation for mixed review queue activity", () => {
    seedCourse({
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 8,
      startedAt: "2026-08-01T12:00:00.000Z",
    });
    const mixedReviewStore = {
      version: 1 as const,
      cards: {
        "longus-colli:action": {
          ...createDefaultCardProgress({
            key: "longus-colli:action",
            muscleId: "longus-colli",
            category: "action",
          }),
          totalAttempts: 3,
          nextReviewStudyDay: 1,
          state: "review" as const,
        },
      },
    };
    writeMasteryProgress(mixedReviewStore);

    const queue = buildMixedReviewQueue(["longus-colli"], mixedReviewStore, 8);

    expect(queue.length).toBeGreaterThan(0);
    expect(getCourseProgress("cervical").studyDayCompletions).toEqual([]);
  });

  it("does not wire Muscle Library or mixed-review finish to markStudyDayCompleted", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app/(authenticated)/page.tsx"),
      "utf8",
    );
    const libraryPage = readFileSync(
      path.join(process.cwd(), "app/(authenticated)/library/page.tsx"),
      "utf8",
    );
    const overview = readFileSync(
      path.join(process.cwd(), "app/components/library/MuscleLibraryOverview.tsx"),
      "utf8",
    );

    expect(page).toContain('onOpenMuscleLibrary={() => router.push("/library")}');
    expect(page).toContain("function handleFinishMixedReview()");
    expect(page).toContain("function handleReturnToDashboard()");
    expect(libraryPage).not.toContain("markStudyDayCompleted");
    expect(overview).not.toContain("markStudyDayCompleted");

    const mixedReviewFinish = page.slice(
      page.indexOf("function handleFinishMixedReview()"),
      page.indexOf("function handleStartStudying()"),
    );
    const returnToDashboard = page.slice(
      page.indexOf("function handleReturnToDashboard()"),
      page.indexOf("function handleAdvanceStudyDay()"),
    );

    expect(mixedReviewFinish).not.toContain("markStudyDayCompleted");
    expect(returnToDashboard).not.toContain("markStudyDayCompleted");
  });
});

describe("legacy progress without studyDayCompletions", () => {
  it("parses missing completion history as [] without resetting other progress", () => {
    window.localStorage.setItem(
      COURSE_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        courses: {
          cervical: {
            version: 1,
            courseId: "cervical",
            startedAt: "2026-08-01T12:00:00.000Z",
            currentStudyDay: 12,
            introducedMuscleIds: ["longus-colli"],
            introductionDates: {
              "longus-colli": "2026-08-01T12:00:00.000Z",
            },
            introductionStudyDays: {
              "longus-colli": 1,
            },
            recentGrades: ["correct"],
            carriedOverRetryKeys: ["longus-colli:action"],
            completedStudyDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          },
        },
      }),
    );

    const progress = getCourseProgress("cervical");

    expect(progress.currentStudyDay).toBe(12);
    expect(progress.introducedMuscleIds).toEqual(["longus-colli"]);
    expect(progress.introductionStudyDays["longus-colli"]).toBe(1);
    expect(progress.carriedOverRetryKeys).toEqual(["longus-colli:action"]);
    expect(progress.completedStudyDays).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(progress.studyDayCompletions).toEqual([]);
    expect(getParticipationAnchorDate(progress.studyDayCompletions)).toBeNull();
    expect(getCurrentWeeklyParticipation(progress.studyDayCompletions)).toBeNull();
    expect(computeDashboardStats(cervicalCourse).weeklyParticipation).toBeNull();
  });

  it("does not fabricate a Day 1 anchor for a learner already past Day 1", () => {
    seedCourse({
      ...createDefaultCourseProgress("cervical"),
      startedAt: "2026-08-01T12:00:00.000Z",
      currentStudyDay: 20,
      completedStudyDays: Array.from({ length: 19 }, (_, index) => index + 1),
      introducedMuscleIds: ["longus-colli"],
      introductionDates: {
        "longus-colli": "2026-08-01T12:00:00.000Z",
      },
      introductionStudyDays: {
        "longus-colli": 1,
      },
    });

    const progress = getCourseProgress("cervical");

    expect(findDay1Completion(progress.studyDayCompletions)).toBeNull();
    expect(getCurrentWeeklyParticipation(progress.studyDayCompletions)).toBeNull();
    expect(computeDashboardStats(cervicalCourse).weeklyParticipation).toBeNull();
  });

  it("preserves curriculum pin, mastery, and an active session alongside empty history", () => {
    window.localStorage.setItem(
      "myomaster-curriculum-id",
      "upper-first-v1",
    );
    writeMasteryProgress({
      version: 1,
      cards: {
        "longus-colli:action": {
          ...createDefaultCardProgress({
            key: "longus-colli:action",
            muscleId: "longus-colli",
            category: "action",
          }),
          totalAttempts: 3,
          state: "review",
        },
      },
    });
    window.localStorage.setItem(
      COURSE_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        courses: {
          [DEFAULT_COURSE_ID]: {
            version: 1,
            courseId: DEFAULT_COURSE_ID,
            startedAt: "2026-08-01T12:00:00.000Z",
            currentStudyDay: 4,
            introducedMuscleIds: ["longus-colli"],
            introductionDates: {},
            introductionStudyDays: { "longus-colli": 1 },
            recentGrades: [],
            carriedOverRetryKeys: [],
            completedStudyDays: [1, 2, 3],
          },
        },
      }),
    );
    window.localStorage.setItem(
      ACTIVE_STUDY_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: ACTIVE_STUDY_SESSION_VERSION,
        courseId: DEFAULT_COURSE_ID,
        studyDay: 4,
        savedAt: "2026-08-04T12:00:00.000Z",
        plannedStaticQueue: [],
        session: createSameSessionRelearnState([
          {
            muscleId: "longus-colli",
            cardKey: "longus-colli:action",
            category: "action",
          },
        ]),
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
        feedbackQueuedCard: null,
        feedbackPresentationKey: null,
        reviewProfileId: null,
        obligationProgress: { total: 1, completedObligationIds: [] },
      }),
    );

    const progress = getCourseProgress(DEFAULT_COURSE_ID);

    expect(progress.studyDayCompletions).toEqual([]);
    expect(progress.currentStudyDay).toBe(4);
    expect(progress.completedStudyDays).toEqual([1, 2, 3]);
    expect(window.localStorage.getItem("myomaster-curriculum-id")).toBe(
      "upper-first-v1",
    );
    expect(readActiveStudySession()?.studyDay).toBe(4);
    expect(
      JSON.parse(
        window.localStorage.getItem("myomaster-mastery-progress") ?? "{}",
      ).cards["longus-colli:action"].totalAttempts,
    ).toBe(3);
  });
});

describe("local and snapshot persistence", () => {
  it("reloads completion events from localStorage", () => {
    seedCourse(createDefaultCourseProgress("cervical"));
    completeDay(1, "2026-09-17T21:14:03.512Z");
    completeDay(2, "2026-09-18T20:00:00.000Z");

    const raw = window.localStorage.getItem(COURSE_PROGRESS_STORAGE_KEY);
    const parsed = JSON.parse(raw!);

    expect(parsed.courses.cervical.studyDayCompletions).toEqual([
      { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
      { studyDay: 2, completedAt: "2026-09-18T20:00:00.000Z" },
    ]);
    expect(getCourseProgress("cervical").studyDayCompletions).toEqual(
      parsed.courses.cervical.studyDayCompletions,
    );
  });

  it("round-trips completion events through a validated learner-progress snapshot", () => {
    seedCourse(createDefaultCourseProgress(DEFAULT_COURSE_ID));
    markStudyDayCompleted(
      DEFAULT_COURSE_ID,
      1,
      new Date("2026-09-17T21:14:03.512Z"),
    );

    const collected = collectLocalStudyState();
    const envelope = createValidatedPersistedLearnerProgress(collected);
    const parsed = parsePersistedLearnerProgress(envelope);

    expect(envelope.schemaVersion).toBe(LEARNER_PROGRESS_SCHEMA_VERSION);
    expect(LEARNER_PROGRESS_SCHEMA_VERSION).toBe(1);
    expect(
      parsed?.state.courseProgress.courses[DEFAULT_COURSE_ID]?.studyDayCompletions,
    ).toEqual([
      { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
    ]);

    window.localStorage.clear();
    applyStudyStateToLocal(parsed!.state);

    expect(getCourseProgress(DEFAULT_COURSE_ID).studyDayCompletions).toEqual([
      { studyDay: 1, completedAt: "2026-09-17T21:14:03.512Z" },
    ]);
  });

  it("accepts a snapshot that omits studyDayCompletions without invalidating the row", () => {
    const parsed = parsePersistedLearnerProgress({
      schemaVersion: 1,
      savedAt: "2026-09-17T00:00:00.000Z",
      state: {
        courseProgress: {
          version: 1,
          courses: {
            cervical: {
              version: 1,
              courseId: "cervical",
              startedAt: "2026-08-01T12:00:00.000Z",
              currentStudyDay: 8,
              introducedMuscleIds: ["longus-colli"],
              introductionDates: {},
              introductionStudyDays: { "longus-colli": 1 },
              recentGrades: [],
              carriedOverRetryKeys: [],
              completedStudyDays: [1, 2, 3, 4, 5, 6, 7],
            },
          },
        },
        masteryProgress: { version: 1, cards: {} },
        activeStudySession: null,
        muscleBriefViewedIds: [],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.schemaVersion).toBe(1);
    expect(
      parsed?.state.courseProgress.courses.cervical?.studyDayCompletions,
    ).toBeUndefined();

    applyStudyStateToLocal(parsed!.state);

    expect(getCourseProgress("cervical").studyDayCompletions).toEqual([]);
    expect(getCourseProgress("cervical").currentStudyDay).toBe(8);
    expect(getCourseProgress("cervical").completedStudyDays).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });
});

describe("unchanged course architecture", () => {
  it("keeps COURSE_DAYS at 105, final introductions on Day 71, and the 75-session presentation", () => {
    expect(COURSE_DAYS).toBe(105);
    expect(lastIntroductionDay()).toBe(71);
    expect(EXPECTED_COURSE_STUDY_SESSIONS).toBe(75);
    expect(createDefaultPersistedLearnerProgress().schemaVersion).toBe(1);
  });
});
