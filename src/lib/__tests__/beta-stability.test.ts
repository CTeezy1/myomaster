import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_STUDY_SESSION_STORAGE_KEY,
  clearActiveStudySession,
  createPersistedActiveStudySession,
  isResumableActiveStudySession,
  preparePersistedActiveStudySessionForRestore,
  readActiveStudySession,
  writeActiveStudySession,
} from "@/src/lib/active-study-session";
import {
  createDefaultCourseProgress,
  getCourseProgress,
  writeCourseProgressStore,
} from "@/src/lib/course-progress";
import { cervicalCourse } from "@/src/lib/course-controller";
import { planDailyWorkload } from "@/src/lib/daily-workload-planning";
import { clearAllLearningProgress } from "@/src/lib/learning-progress-reset";
import { introduceMuscleCards } from "@/src/lib/mastery-engine";
import { createInitialCardFeedbackState } from "@/src/lib/quiz-card-state";
import type { QueuedCard } from "@/src/lib/review-queue";
import {
  advanceSameSessionIndex,
  applySameSessionGrade,
  countPendingRetriesForCard,
  createSameSessionRelearnState,
  dedupePendingRetriesInQueue,
  findPresentableSessionIndex,
  hasValidPresentableIndex,
  sanitizeSameSessionRelearnState,
} from "@/src/lib/same-session-relearn";
import { buildStudyDayScheduledQueueForCourse } from "@/src/lib/study-day-session";
import { getDailyNewMuscleTarget } from "@/src/lib/introduction-policy";
import { getNewMuscleIdsForStudyDay } from "@/src/lib/new-muscle-queue";

const baseQueue: QueuedCard[] = [
  {
    muscleId: "longus-colli",
    cardKey: "longus-colli:action",
    category: "action",
  },
  {
    muscleId: "longus-capitis",
    cardKey: "longus-capitis:action",
    category: "action",
  },
];

beforeEach(() => {
  const storage = new Map<string, string>();

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });

  clearActiveStudySession();
});

describe("repeated missed-card resilience", () => {
  it("handles ten misses on the same card without invalid index state", () => {
    let state = createSameSessionRelearnState(baseQueue, { enforceDailyCap: true });

    for (let miss = 0; miss < 10; miss += 1) {
      while (
        state.index < state.queue.length &&
        state.queue[state.index]?.cardKey !== "longus-colli:action"
      ) {
        state = applySameSessionGrade(state, state.queue[state.index], "correct");
        state = advanceSameSessionIndex(state);
      }

      expect(hasValidPresentableIndex(state)).toBe(true);

      const card = state.queue[state.index];
      expect(card?.cardKey).toBe("longus-colli:action");

      state = applySameSessionGrade(
        state,
        card,
        miss % 2 === 0 ? "incorrect" : "partial",
      );
      expect(hasValidPresentableIndex(state)).toBe(true);
      expect(countPendingRetriesForCard(state.queue, "longus-colli:action")).toBeLessThanOrEqual(
        1,
      );

      state = advanceSameSessionIndex(state);
      expect(hasValidPresentableIndex(state)).toBe(true);
    }

    expect(state.queue.length).toBeLessThanOrEqual(baseQueue.length + 1);
  });

  it("does not accumulate duplicate pending retries for the same card", () => {
    let state = createSameSessionRelearnState(baseQueue, { enforceDailyCap: true });

    for (let miss = 0; miss < 5; miss += 1) {
      while (
        state.index < state.queue.length &&
        state.queue[state.index]?.cardKey !== "longus-colli:action"
      ) {
        state = applySameSessionGrade(state, state.queue[state.index], "correct");
        state = advanceSameSessionIndex(state);
      }

      state = applySameSessionGrade(state, state.queue[state.index], "incorrect");
      expect(countPendingRetriesForCard(state.queue, "longus-colli:action")).toBe(1);
      state = advanceSameSessionIndex(state);
    }

    const deduped = dedupePendingRetriesInQueue(state.queue);
    expect(countPendingRetriesForCard(deduped, "longus-colli:action")).toBe(1);
  });

  it("repairs index-at-end state with unresolved retries", () => {
    let state = createSameSessionRelearnState(baseQueue, { enforceDailyCap: true });
    state = applySameSessionGrade(state, baseQueue[0], "incorrect");
    state = {
      ...state,
      index: state.queue.length,
    };

    const sanitized = sanitizeSameSessionRelearnState(state);

    expect(sanitized.index).toBeLessThan(sanitized.queue.length);
    expect(sanitized.queue[sanitized.index]?.isPendingRetry).toBe(true);
  });

  it("persists and restores a heavily missed session", () => {
    let state = createSameSessionRelearnState(baseQueue, { enforceDailyCap: true });

    for (let miss = 0; miss < 4; miss += 1) {
      state = applySameSessionGrade(state, state.queue[state.index], "partial");
      state = advanceSameSessionIndex(state);
    }

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: baseQueue,
        session: state,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          currentStudyDay: 2,
          startedAt: "2026-01-01T12:00:00.000Z",
        },
      },
    });

    const restored = preparePersistedActiveStudySessionForRestore(
      readActiveStudySession()!,
    );

    expect(hasValidPresentableIndex(restored.session)).toBe(true);
    expect(restored.session.queue.length).toBeGreaterThan(baseQueue.length);
    expect(
      isResumableActiveStudySession(
        readActiveStudySession(),
        "cervical",
        getCourseProgress("cervical"),
      ),
    ).toBe(true);
  });
});

describe("reset and day 1 queue planning", () => {
  it("clears persisted active session on reset", () => {
    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "myomaster-program",
        studyDay: 1,
        plannedStaticQueue: baseQueue,
        session: createSameSessionRelearnState(baseQueue, { enforceDailyCap: true }),
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    clearAllLearningProgress();

    expect(readActiveStudySession()).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_STUDY_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("builds 16 initial prompts on day 1 after muscles are introduced", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        "myomaster-program": {
          ...createDefaultCourseProgress("myomaster-program"),
          currentStudyDay: 1,
          startedAt: "2026-01-01T12:00:00.000Z",
        },
      },
    });

    let masteryStore = { version: 1 as const, cards: {} };
    const courseProgress = getCourseProgress("myomaster-program");
    const dayOneAllowance = getDailyNewMuscleTarget(1, 0, 0, null);
    const newMuscleIds = getNewMuscleIdsForStudyDay(
      cervicalCourse,
      courseProgress,
      dayOneAllowance,
    ).slice(0, 2);

    for (const muscleId of newMuscleIds) {
      masteryStore = introduceMuscleCards(masteryStore, muscleId);
    }

    const introducedProgress = {
      ...courseProgress,
      introducedMuscleIds: newMuscleIds,
      introductionStudyDays: Object.fromEntries(
        newMuscleIds.map((muscleId) => [muscleId, 1]),
      ),
    };

    const plan = planDailyWorkload(
      cervicalCourse,
      introducedProgress,
      masteryStore,
    );

    expect(plan.newMusclePromptCount).toBe(8);
    expect(plan.practicePromptCount).toBe(8);
    expect(plan.plannedPromptCount).toBe(16);
  });

  it("does not restore a stale pre-reset queue after reset", () => {
    const staleQueue: QueuedCard[] = [
      {
        muscleId: "levator-scapulae",
        cardKey: "levator-scapulae:action",
        category: "action",
      },
    ];

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "myomaster-program",
        studyDay: 7,
        plannedStaticQueue: staleQueue,
        session: createSameSessionRelearnState(staleQueue, { enforceDailyCap: true }),
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    clearAllLearningProgress();

    writeCourseProgressStore({
      version: 1,
      courses: {
        "myomaster-program": {
          ...createDefaultCourseProgress("myomaster-program"),
          currentStudyDay: 1,
          startedAt: "2026-01-01T12:00:00.000Z",
        },
      },
    });

    expect(readActiveStudySession()).toBeNull();

    const freshQueue = buildStudyDayScheduledQueueForCourse(
      cervicalCourse,
      { version: 1, cards: {} },
    );

    expect(freshQueue.some((card) => card.cardKey === "levator-scapulae:action")).toBe(
      false,
    );
  });
});
