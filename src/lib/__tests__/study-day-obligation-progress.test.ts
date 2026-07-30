import { describe, expect, it } from "vitest";
import {
  createPersistedActiveStudySession,
  readActiveStudySession,
  writeActiveStudySession,
} from "@/src/lib/active-study-session";
import { createInitialCardFeedbackState } from "@/src/lib/quiz-card-state";
import type { QueuedCard } from "@/src/lib/review-queue";
import {
  advanceSameSessionIndex,
  applySameSessionGrade,
  createSameSessionRelearnState,
} from "@/src/lib/same-session-relearn";
import {
  assignDailyObligationIds,
  createStudyDayObligationProgress,
  getObligationProgressCounts,
  recordObligationCompletion,
} from "@/src/lib/study-day-obligation-progress";

function makeQueue(count: number, duplicateSecond = false): QueuedCard[] {
  return Array.from({ length: count }, (_, index) => ({
    muscleId: `muscle-${index}`,
    cardKey: duplicateSecond && index === 1
      ? "shared-muscle:action"
      : duplicateSecond && index === 2
        ? "shared-muscle:action"
        : (`muscle-${index}:action` as QueuedCard["cardKey"]),
    category: "action" as const,
    ...(duplicateSecond && index >= 1 && index <= 2 ? { isPractice: true } : {}),
  }));
}

function gradeCurrentCard(
  state: ReturnType<typeof createSameSessionRelearnState>,
  grade: "correct" | "partial" | "incorrect",
) {
  const card = state.queue[state.index];

  if (!card) {
    throw new Error("No card at current index");
  }

  return applySameSessionGrade(state, card, grade);
}

describe("study day obligation progress", () => {
  it("starts day 1 at Card 0 of 16", () => {
    const queue = makeQueue(16);
    const { progress } = assignDailyObligationIds(queue);

    expect(getObligationProgressCounts(progress)).toEqual({
      completed: 0,
      total: 16,
    });
  });

  it("increases progress by one on correct", () => {
    let progress = createStudyDayObligationProgress(16);

    progress = recordObligationCompletion(progress, "obl-0", "correct");

    expect(getObligationProgressCounts(progress)).toEqual({
      completed: 1,
      total: 16,
    });
  });

  it("does not increase progress on partial", () => {
    let progress = createStudyDayObligationProgress(16);

    progress = recordObligationCompletion(progress, "obl-0", "partial");

    expect(getObligationProgressCounts(progress).completed).toBe(0);
  });

  it("does not increase progress on incorrect", () => {
    let progress = createStudyDayObligationProgress(16);

    progress = recordObligationCompletion(progress, "obl-0", "incorrect");

    expect(getObligationProgressCounts(progress).completed).toBe(0);
  });

  it("increases progress once when a retry is eventually answered correctly", () => {
    const { queue } = assignDailyObligationIds(makeQueue(1));
    let session = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    let progress = createStudyDayObligationProgress(1);

    session = gradeCurrentCard(session, "partial");
    progress = recordObligationCompletion(progress, "obl-0", "partial");
    session = advanceSameSessionIndex(session);

    expect(getObligationProgressCounts(progress)).toEqual({
      completed: 0,
      total: 1,
    });

    const retry = session.queue.find((card) => card.isPendingRetry);
    expect(retry?.obligationId).toBe("obl-0");

    session = applySameSessionGrade(session, retry!, "correct");
    progress = recordObligationCompletion(progress, retry!.obligationId, "correct");

    expect(getObligationProgressCounts(progress)).toEqual({
      completed: 1,
      total: 1,
    });
    expect(progress.completedObligationIds).toEqual(["obl-0"]);
  });

  it("does not change progress on repeated missed retries", () => {
    const { queue, progress: initialProgress } = assignDailyObligationIds(makeQueue(2));
    let session = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    let progress = initialProgress;

    session = gradeCurrentCard(session, "incorrect");
    progress = recordObligationCompletion(
      progress,
      "obl-0",
      "incorrect",
    );

    const firstRetryIndex = session.queue.findIndex((card) => card.isPendingRetry);
    session = {
      ...session,
      index: firstRetryIndex,
    };

    session = applySameSessionGrade(session, session.queue[firstRetryIndex], "incorrect");
    progress = recordObligationCompletion(
      progress,
      session.queue[firstRetryIndex].obligationId,
      "incorrect",
    );

    expect(getObligationProgressCounts(progress).completed).toBe(0);
    expect(session.queue.length).toBeGreaterThan(session.initialQueueLength);
  });

  it("does not increase the denominator when a retry is added", () => {
    const { queue, progress } = assignDailyObligationIds(makeQueue(4));
    let session = createSameSessionRelearnState(queue, { enforceDailyCap: true });

    session = gradeCurrentCard(session, "partial");

    expect(session.queue.length).toBeGreaterThan(session.initialQueueLength);
    expect(getObligationProgressCounts(progress).total).toBe(4);
  });

  it("counts repeated practice copies with the same cardKey as separate obligations", () => {
    const { queue, progress } = assignDailyObligationIds(makeQueue(4, true));

    expect(queue[1].cardKey).toBe("shared-muscle:action");
    expect(queue[2].cardKey).toBe("shared-muscle:action");
    expect(queue[1].obligationId).toBe("obl-1");
    expect(queue[2].obligationId).toBe("obl-2");

    let nextProgress = recordObligationCompletion(progress, "obl-1", "correct");

    expect(nextProgress.completedObligationIds).toEqual(["obl-1"]);
    expect(getObligationProgressCounts(nextProgress).completed).toBe(1);
  });

  it("restores the same progress after persistence roundtrip", () => {
    const storage = new Map<string, string>();

    globalThis.window = {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    } as Window & typeof globalThis;

    const { queue, progress } = assignDailyObligationIds(makeQueue(5));
    const session = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    const completedProgress = recordObligationCompletion(progress, "obl-0", "correct");

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 1,
        plannedStaticQueue: queue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
        obligationProgress: completedProgress,
      }),
    );

    const restored = readActiveStudySession();

    expect(restored?.obligationProgress).toEqual({
      total: 5,
      completedObligationIds: ["obl-0"],
    });
    expect(getObligationProgressCounts(restored!.obligationProgress)).toEqual({
      completed: 1,
      total: 5,
    });
  });

  it("completes at Y of Y and never exceeds Y", () => {
    const { queue, progress: initialProgress } = assignDailyObligationIds(makeQueue(4));
    let progress = initialProgress;

    for (const obligationId of ["obl-0", "obl-1", "obl-2", "obl-3"]) {
      progress = recordObligationCompletion(progress, obligationId, "correct");
    }

    expect(getObligationProgressCounts(progress)).toEqual({
      completed: 4,
      total: 4,
    });

    progress = recordObligationCompletion(progress, "obl-3", "correct");

    expect(getObligationProgressCounts(progress)).toEqual({
      completed: 4,
      total: 4,
    });
    expect(progress.completedObligationIds).toHaveLength(4);
  });

  it("assigns stable obligation IDs in queue order", () => {
    const { queue } = assignDailyObligationIds(makeQueue(3));

    expect(queue.map((card) => card.obligationId)).toEqual([
      "obl-0",
      "obl-1",
      "obl-2",
    ]);
  });

  it("retains the original obligation ID on a single-card retry", () => {
    const { queue } = assignDailyObligationIds(makeQueue(2));
    let session = createSameSessionRelearnState(queue, { enforceDailyCap: true });

    session = gradeCurrentCard(session, "incorrect");

    const retry = session.queue.find((card) => card.isPendingRetry);

    expect(retry?.obligationId).toBe("obl-0");
  });
});
