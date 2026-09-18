import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_STUDY_SESSION_STORAGE_KEY,
  ACTIVE_STUDY_SESSION_VERSION,
  clearActiveStudySession,
  createPersistedActiveStudySession,
  isActiveStudySessionComplete,
  isResumableActiveStudySession,
  readActiveStudySession,
  writeActiveStudySession,
} from "@/src/lib/active-study-session";
import {
  createDefaultCourseProgress,
  getCourseProgress,
  isCurrentStudyDayCompleted,
  markStudyDayCompleted,
  writeCourseProgressStore,
} from "@/src/lib/course-progress";
import { createInitialCardFeedbackState } from "@/src/lib/quiz-card-state";
import type { QueuedCard } from "@/src/lib/review-queue";
import {
  advanceSameSessionIndex,
  applySameSessionGrade,
  createSameSessionRelearnState,
  isSameSessionRelearnComplete,
} from "@/src/lib/same-session-relearn";

const queue: QueuedCard[] = [
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
  {
    muscleId: "scalenes",
    cardKey: "scalenes:action",
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
});

describe("active study session persistence", () => {
  it("restores the same next card after several completed cards", () => {
    let session = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    session = applySameSessionGrade(session, queue[0], "correct");
    session = advanceSameSessionIndex(session);
    session = applySameSessionGrade(session, queue[1], "correct");
    session = advanceSameSessionIndex(session);

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    const restored = readActiveStudySession();

    expect(restored?.session.index).toBe(2);
    expect(restored?.session.queue[restored.session.index]?.cardKey).toBe(
      "scalenes:action",
    );
  });

  it("keeps the original randomized queue order on restore", () => {
    const shuffledQueue = [queue[2], queue[0], queue[1]];
    const session = createSameSessionRelearnState(shuffledQueue, {
      enforceDailyCap: true,
    });

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: shuffledQueue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    expect(readActiveStudySession()?.session.queue.map((card) => card.cardKey)).toEqual([
      "scalenes:action",
      "longus-colli:action",
      "longus-capitis:action",
    ]);
  });

  it("remains resumable after navigating away to the dashboard", () => {
    const session = createSameSessionRelearnState(queue, { enforceDailyCap: true });

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    expect(
      isResumableActiveStudySession(
        readActiveStudySession(),
        "cervical",
        getCourseProgress("cervical"),
      ),
    ).toBe(true);
  });

  it("does not mark the study day complete merely because the learner returned to the dashboard", () => {
    let session = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    session = applySameSessionGrade(session, queue[0], "correct");
    session = advanceSameSessionIndex(session);

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    const courseProgress = getCourseProgress("cervical");

    expect(isCurrentStudyDayCompleted(courseProgress)).toBe(false);
    expect(courseProgress.completedStudyDays).not.toContain(2);
    expect(
      isResumableActiveStudySession(
        readActiveStudySession(),
        "cervical",
        courseProgress,
      ),
    ).toBe(true);
    expect(readActiveStudySession()?.session.index).toBe(1);
  });

  it("remains resumable after leaving from Muscle Brief without completing the study day", () => {
    const session = createSameSessionRelearnState(queue, { enforceDailyCap: true });

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue,
        session,
        screen: "brief",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    const courseProgress = getCourseProgress("cervical");

    expect(isCurrentStudyDayCompleted(courseProgress)).toBe(false);
    expect(readActiveStudySession()?.screen).toBe("brief");
    expect(
      isResumableActiveStudySession(
        readActiveStudySession(),
        "cervical",
        courseProgress,
      ),
    ).toBe(true);
  });

  it("does not clear the saved session merely because the learner returned to the dashboard", () => {
    const session = createSameSessionRelearnState(queue, { enforceDailyCap: true });

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue,
        session,
        screen: "brief",
        currentMuscleIndex: 1,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    expect(readActiveStudySession()?.screen).toBe("brief");
  });

  it("preserves dynamically appended retries and unresolved keys", () => {
    let session = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    session = applySameSessionGrade(session, queue[0], "incorrect");

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    const restored = readActiveStudySession();

    expect(restored?.session.unresolvedKeys).toContain("longus-colli:action");
    expect(restored?.session.queue.at(-1)?.isPendingRetry).toBe(true);
  });

  it("continues recycling a repeatedly missed card after restoration", () => {
    let session = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    session = applySameSessionGrade(session, queue[0], "incorrect");
    session = advanceSameSessionIndex(session);

    while (
      session.index < session.queue.length &&
      !session.queue[session.index]?.isPendingRetry
    ) {
      session = applySameSessionGrade(session, session.queue[session.index], "correct");
      session = advanceSameSessionIndex(session);
    }

    session = applySameSessionGrade(session, session.queue[session.index], "incorrect");

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    const restored = readActiveStudySession();

    expect(isSameSessionRelearnComplete(restored!.session)).toBe(false);
    expect(restored?.session.unresolvedKeys).toContain("longus-colli:action");
  });

  it("clears the saved active session when the study day is complete", () => {
    let session = createSameSessionRelearnState(queue.slice(0, 1), {
      enforceDailyCap: true,
    });
    session = applySameSessionGrade(session, queue[0], "correct");
    session = advanceSameSessionIndex(session);

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue.slice(0, 1),
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    expect(isActiveStudySessionComplete(readActiveStudySession()!)).toBe(true);
    expect(
      isResumableActiveStudySession(
        readActiveStudySession(),
        "cervical",
        getCourseProgress("cervical"),
      ),
    ).toBe(false);
  });

  it("rejects an outdated persisted-session version", () => {
    window.localStorage.setItem(
      ACTIVE_STUDY_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: ACTIVE_STUDY_SESSION_VERSION + 1,
        courseId: "cervical",
        studyDay: 2,
        savedAt: "2026-01-01T12:00:00.000Z",
        plannedStaticQueue: queue,
        session: createSameSessionRelearnState(queue, { enforceDailyCap: true }),
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
        feedbackQueuedCard: null,
        feedbackPresentationKey: null,
        reviewProfileId: null,
      }),
    );

    expect(readActiveStudySession()).toBeNull();
  });

  it("does not resume a completed study day record", () => {
    markStudyDayCompleted("cervical");
    const session = createSameSessionRelearnState(queue, { enforceDailyCap: true });

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    expect(
      isResumableActiveStudySession(
        readActiveStudySession(),
        "cervical",
        getCourseProgress("cervical"),
      ),
    ).toBe(false);
  });

  it("preserves graded prompt count so a refresh cannot reapply the previous grade", () => {
    let session = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    session = applySameSessionGrade(session, queue[0], "correct");

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    expect(readActiveStudySession()?.session.gradedPromptCount).toBe(1);
    expect(readActiveStudySession()?.session.index).toBe(0);
  });

  it("cannot resume into a completed session while unresolved cards remain", () => {
    let session = createSameSessionRelearnState(queue, { enforceDailyCap: true });
    session = applySameSessionGrade(session, queue[0], "incorrect");

    writeActiveStudySession(
      createPersistedActiveStudySession({
        courseId: "cervical",
        studyDay: 2,
        plannedStaticQueue: queue,
        session,
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: createInitialCardFeedbackState(),
      }),
    );

    expect(isSameSessionRelearnComplete(readActiveStudySession()!.session)).toBe(
      false,
    );
  });
});
