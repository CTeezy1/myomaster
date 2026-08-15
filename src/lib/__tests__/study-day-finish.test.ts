import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardProgressKey } from "@/src/lib/card-progress-key";
import {
  preparePersistedActiveStudySessionForRestore,
  type PersistedActiveStudySession,
} from "@/src/lib/active-study-session";
import { cervicalCourse } from "@/src/lib/course-controller";
import {
  advanceStudyDay,
  clearCourseProgress,
  createDefaultCourseProgress,
  getCourseProgress,
  markStudyDayCompleted,
  writeCourseProgressStore,
} from "@/src/lib/course-progress";
import { planDailyWorkload, MIN_DAILY_GRADED_CARDS } from "@/src/lib/daily-workload-planning";
import { createInitialCardFeedbackState } from "@/src/lib/quiz-card-state";
import type { QueuedCard } from "@/src/lib/review-queue";
import {
  advanceSameSessionIndex,
  applySameSessionGrade,
  createSameSessionRelearnState,
  DAILY_GRADED_PROMPT_CAP,
  isSameSessionRelearnStateValue,
  isSameSessionRelearnComplete,
  sanitizeSameSessionRelearnState,
} from "@/src/lib/same-session-relearn";
import { isStudyDaySessionComplete } from "@/src/lib/study-day-session";
import { createDefaultCardProgress } from "@/src/lib/mastery-progress";

function buildCapQueue(size: number): QueuedCard[] {
  return Array.from({ length: size }, (_, index) => ({
    muscleId: "longus-colli",
    cardKey: `longus-colli:action-${index}` as CardProgressKey,
    category: "action" as const,
  }));
}

function completeCappedDayWithAllCorrect(queueSize: number) {
  let state = createSameSessionRelearnState(buildCapQueue(queueSize), {
    enforceDailyCap: true,
  });

  while (state.index < state.queue.length && !state.dailyCapReached) {
    const current = state.queue[state.index];
    state = applySameSessionGrade(state, current, "correct");
    state = advanceSameSessionIndex(state);
  }

  return state;
}

function buildLegacyPersistedSession(
  sessionOverrides: Record<string, unknown> = {},
): PersistedActiveStudySession {
  return {
    version: 2,
    courseId: "cervical",
    studyDay: 105,
    savedAt: "2026-01-01T12:00:00.000Z",
    plannedStaticQueue: [],
    session: {
      queue: [
        {
          muscleId: "longus-colli",
          cardKey: "longus-colli:action",
          category: "action",
        },
      ],
      index: 1,
      gradedPromptCount: 1,
      staticGradedCount: 1,
      pairCorrectCounts: {},
      initialQueueLength: 1,
      initialStaticQueueLength: 1,
      dailyCapReached: false,
      enforceDailyCap: true,
      ...sessionOverrides,
    } as unknown as PersistedActiveStudySession["session"],
    screen: "study-day",
    currentMuscleIndex: 0,
    cardFeedback: createInitialCardFeedbackState(),
    feedbackQueuedCard: null,
    feedbackPresentationKey: null,
    reviewProfileId: null,
    obligationProgress: {
      total: 1,
      completedObligationIds: [],
    },
  };
}

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

  clearCourseProgress();
});

describe("study day finish regression", () => {
  it("completes a capped day with unresolvedKeys = [] after 40 static cards", () => {
    const state = completeCappedDayWithAllCorrect(60);

    expect(state.staticGradedCount).toBe(DAILY_GRADED_PROMPT_CAP);
    expect(state.dailyCapReached).toBe(true);
    expect(state.unresolvedKeys).toEqual([]);
    expect(isSameSessionRelearnComplete(state)).toBe(true);
    expect(isStudyDaySessionComplete(state)).toBe(true);
  });

  it("does not complete a capped day while unresolved retries remain", () => {
    const queue = buildCapQueue(40);
    queue[39] = {
      muscleId: "longus-colli",
      cardKey: "longus-colli:action",
      category: "action",
    };

    let state = createSameSessionRelearnState(queue, { enforceDailyCap: true });

    for (let index = 0; index < 39; index += 1) {
      state = applySameSessionGrade(state, state.queue[state.index], "correct");
      state = advanceSameSessionIndex(state);
    }

    state = applySameSessionGrade(state, state.queue[state.index], "incorrect");

    expect(state.staticGradedCount).toBe(DAILY_GRADED_PROMPT_CAP);
    expect(state.dailyCapReached).toBe(true);
    expect(state.unresolvedKeys).toContain("longus-colli:action");
    expect(isStudyDaySessionComplete(state)).toBe(false);
  });

  it("sanitizes legacy persisted sessions missing unresolvedKeys to an empty array", () => {
    const restored = preparePersistedActiveStudySessionForRestore(
      buildLegacyPersistedSession(),
    );

    expect(restored.session.unresolvedKeys).toEqual([]);
  });

  it("rejects non-session click event payloads at the finish boundary", () => {
    const clickEvent = {
      type: "click",
      target: {},
      preventDefault() {},
    };

    expect(isSameSessionRelearnStateValue(clickEvent)).toBe(false);
    expect(isSameSessionRelearnStateValue(completeCappedDayWithAllCorrect(40))).toBe(
      true,
    );
  });

  it("defaults missing unresolvedKeys during sanitize", () => {
    const sanitized = sanitizeSameSessionRelearnState({
      queue: [
        {
          muscleId: "longus-colli",
          cardKey: "longus-colli:action",
          category: "action",
        },
      ],
      index: 1,
      gradedPromptCount: 1,
      staticGradedCount: 1,
      unresolvedKeys: undefined as unknown as CardProgressKey[],
      pairCorrectCounts: {},
      initialQueueLength: 1,
      initialStaticQueueLength: 1,
      dailyCapReached: true,
      enforceDailyCap: true,
    });

    expect(sanitized.unresolvedKeys).toEqual([]);
    expect(() => sanitized.unresolvedKeys.length).not.toThrow();
  });

  it("finishes day 105 and advances to day 106 after completion", () => {
    writeCourseProgressStore({
      version: 1,
      courses: {
        cervical: {
          ...createDefaultCourseProgress("cervical"),
          currentStudyDay: 105,
          startedAt: "2026-01-01T12:00:00.000Z",
        },
      },
    });

    markStudyDayCompleted("cervical");
    const advanced = advanceStudyDay("cervical");

    expect(getCourseProgress("cervical").completedStudyDays).toContain(105);
    expect(advanced.currentStudyDay).toBe(106);
  });

  it("builds and completes a day 106 review session normally", () => {
    const muscleIds = cervicalCourse.muscleProfileIds.slice(0, 8);
    const courseProgress = {
      ...createDefaultCourseProgress("cervical"),
      currentStudyDay: 106,
      startedAt: "2026-01-01T12:00:00.000Z",
      introducedMuscleIds: muscleIds,
      introductionStudyDays: Object.fromEntries(
        muscleIds.map((muscleId) => [muscleId, 1]),
      ),
    };
    const masteryStore = {
      version: 1 as const,
      cards: Object.fromEntries(
        muscleIds.flatMap((muscleId) =>
          (["origin", "insertion", "action", "innervation"] as const).map(
            (category) => {
              const key = `${muscleId}:${category}` as CardProgressKey;

              return [
                key,
                {
                  ...createDefaultCardProgress({
                    key,
                    muscleId,
                    category,
                  }),
                  totalAttempts: 1,
                  correctAttempts: 1,
                  successfulReviewCount: 1,
                  currentIntervalDays: 7,
                  nextReviewStudyDay: 106,
                },
              ];
            },
          ),
        ),
      ),
    };

    const plan = planDailyWorkload(cervicalCourse, courseProgress, masteryStore);

    expect(plan.newMusclePromptCount).toBe(0);
    expect(plan.plannedPromptCount).toBeGreaterThanOrEqual(MIN_DAILY_GRADED_CARDS);

    const state = completeCappedDayWithAllCorrect(40);

    expect(state.dailyCapReached).toBe(true);
    expect(state.unresolvedKeys).toEqual([]);
    expect(isStudyDaySessionComplete(state)).toBe(true);
  });
});
