import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_STUDY_SESSION_STORAGE_KEY,
  ACTIVE_STUDY_SESSION_VERSION,
  readActiveStudySession,
} from "@/src/lib/active-study-session";
import { COURSE_PROGRESS_STORAGE_KEY } from "@/src/lib/course-progress";
import {
  applyStudyStateToLocal,
  collectLocalStudyState,
  createDefaultPersistedLearnerProgress,
} from "@/src/lib/progress/learner-progress-snapshot";
import { parsePersistedLearnerProgress } from "@/src/lib/progress/learner-progress-validation";

describe("learner progress snapshot", () => {
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

  it("collects and restores the full local study state envelope", () => {
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
            introductionStudyDays: { "psoas-major": 1 },
            recentGrades: ["correct"],
            carriedOverRetryKeys: [],
            completedStudyDays: [],
          },
        },
      }),
    );

    localStorage.setItem(
      ACTIVE_STUDY_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: ACTIVE_STUDY_SESSION_VERSION,
        courseId: "kinesiology-program",
        studyDay: 2,
        savedAt: "2026-07-30T00:00:00.000Z",
        plannedStaticQueue: [
          {
            muscleId: "psoas-major",
            cardKey: "psoas-major:origin",
            category: "origin",
            obligationId: "obl-0",
          },
        ],
        session: {
          queue: [
            {
              muscleId: "psoas-major",
              cardKey: "psoas-major:origin",
              category: "origin",
              obligationId: "obl-0",
            },
            {
              muscleId: "psoas-major",
              cardKey: "psoas-major:origin",
              category: "origin",
              isPendingRetry: true,
              obligationId: "obl-0",
            },
          ],
          index: 1,
          gradedPromptCount: 1,
          staticGradedCount: 1,
          unresolvedKeys: ["psoas-major:origin"],
          pairCorrectCounts: {},
          initialQueueLength: 2,
          initialStaticQueueLength: 1,
          dailyCapReached: false,
          enforceDailyCap: true,
        },
        screen: "study-day",
        currentMuscleIndex: 0,
        cardFeedback: {
          answerShown: false,
          feedbackGrade: null,
        },
        feedbackQueuedCard: null,
        feedbackPresentationKey: null,
        reviewProfileId: null,
        obligationProgress: {
          total: 1,
          completedObligationIds: [],
        },
      }),
    );

    const collected = collectLocalStudyState();
    localStorage.clear();
    applyStudyStateToLocal(collected);

    const restoredSession = readActiveStudySession();

    expect(restoredSession?.session.index).toBe(1);
    expect(restoredSession?.session.queue).toHaveLength(2);
    expect(restoredSession?.session.queue[1]?.isPendingRetry).toBe(true);
    expect(restoredSession?.obligationProgress.total).toBe(1);
    expect(restoredSession?.obligationProgress.completedObligationIds).toEqual([]);
  });

  it("does not include credentials or tokens in the progress payload", () => {
    const progress = createDefaultPersistedLearnerProgress();
    const serialized = JSON.stringify(progress);

    expect(serialized).not.toContain("@users.myomaster.local");
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("refresh_token");
    expect(serialized).not.toContain("password");
  });

  it("round-trips through validation", () => {
    const progress = createDefaultPersistedLearnerProgress();
    expect(parsePersistedLearnerProgress(progress)).not.toBeNull();
  });
});
