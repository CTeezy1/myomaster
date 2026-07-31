import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLearnerProgressSaveQueue } from "@/src/lib/progress/learner-progress-save-queue";
import { LEARNER_PROGRESS_SCHEMA_VERSION } from "@/src/lib/progress/learner-progress.types";
import { COURSE_PROGRESS_STORAGE_KEY } from "@/src/lib/course-progress";
import * as learnerProgressRepository from "@/src/lib/progress/learner-progress-repository";
import type { SaveLearnerProgressResult } from "@/src/lib/progress/learner-progress-repository";

const savedProgress = {
  schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
  savedAt: "2026-07-30T00:00:00.000Z",
  state: {
    courseProgress: { version: 1, courses: {} },
    masteryProgress: { version: 1, cards: {} },
    activeStudySession: null,
    muscleBriefViewedIds: [],
  },
};

function createRevisionTrackingSaveClient(initialRevision = 1) {
  let revision = initialRevision;

  const client = {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn((_column: string, expectedRevision: number) => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => {
                if (expectedRevision !== revision) {
                  return { data: null, error: null };
                }

                revision += 1;

                return {
                  data: {
                    user_id: "user-a",
                    progress_data: savedProgress,
                    revision,
                    updated_at: "2026-07-30T02:00:00.000Z",
                  },
                  error: null,
                };
              }),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: {
              user_id: "user-a",
              progress_data: savedProgress,
              revision,
              updated_at: "2026-07-30T02:00:00.000Z",
            },
            error: null,
          })),
        })),
      })),
    })),
    getRevision: () => revision,
    setRevision: (nextRevision: number) => {
      revision = nextRevision;
    },
  };

  return client as unknown as SupabaseClient & {
    getRevision: () => number;
    setRevision: (nextRevision: number) => void;
  };
}

function createQueueOptions(
  client: SupabaseClient & { getRevision?: () => number },
  overrides: Partial<{
    onStatusChange: ReturnType<typeof vi.fn>;
    onConflict: ReturnType<typeof vi.fn>;
    getHasExistingRow: () => boolean;
    getExpectedRevision: () => number | null;
    setServerRow: ReturnType<typeof vi.fn>;
    initialRevision: number;
  }> = {},
) {
  let expectedRevision = overrides.initialRevision ?? 1;

  return {
    userId: "user-a",
    client,
    onStatusChange: overrides.onStatusChange ?? vi.fn(),
    onConflict: overrides.onConflict ?? vi.fn(),
    getHasExistingRow: overrides.getHasExistingRow ?? (() => true),
    getExpectedRevision:
      overrides.getExpectedRevision ?? (() => expectedRevision),
    setServerRow:
      overrides.setServerRow ??
      vi.fn((revision: number) => {
        expectedRevision = revision;
      }),
    getExpectedRevisionValue: () => expectedRevision,
    setExpectedRevisionValue: (revision: number) => {
      expectedRevision = revision;
    },
  };
}

function createSuccessfulSaveResult(revision: number): SaveLearnerProgressResult {
  return {
    ok: true,
    row: {
      user_id: "user-a",
      progress_data: savedProgress,
      revision,
      updated_at: "2026-07-30T02:00:00.000Z",
    },
  } as SaveLearnerProgressResult;
}

describe("learner progress save queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("debounces rapid saves", async () => {
    const onStatusChange = vi.fn();
    const queue = createLearnerProgressSaveQueue({
      userId: "user-a",
      client: createRevisionTrackingSaveClient(),
      onStatusChange,
      onConflict: vi.fn(),
      getHasExistingRow: () => true,
      getExpectedRevision: () => 1,
      setServerRow: vi.fn(),
    });

    queue.scheduleSave(false);
    queue.scheduleSave(false);

    await vi.advanceTimersByTimeAsync(500);
    queue.destroy();

    expect(onStatusChange).toHaveBeenCalledWith("saved");
  });

  it("reports pending work while a debounced save is queued", () => {
    const queue = createLearnerProgressSaveQueue({
      userId: "user-a",
      client: createRevisionTrackingSaveClient(),
      onStatusChange: vi.fn(),
      onConflict: vi.fn(),
      getHasExistingRow: () => true,
      getExpectedRevision: () => 1,
      setServerRow: vi.fn(),
    });

    expect(queue.hasPendingSave()).toBe(false);
    queue.scheduleSave(false);
    expect(queue.hasPendingSave()).toBe(true);
    queue.destroy();
  });

  it("invalidates stale queued writes after reset", async () => {
    const setServerRow = vi.fn();
    const queue = createLearnerProgressSaveQueue({
      userId: "user-a",
      client: createRevisionTrackingSaveClient(),
      onStatusChange: vi.fn(),
      onConflict: vi.fn(),
      getHasExistingRow: () => true,
      getExpectedRevision: () => 1,
      setServerRow,
    });

    localStorage.setItem(
      COURSE_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        courses: {},
      }),
    );

    queue.scheduleSave(false);
    queue.invalidatePendingWrites();
    await vi.advanceTimersByTimeAsync(500);
    queue.destroy();

    expect(setServerRow).not.toHaveBeenCalled();
  });

  it("supports several consecutive saves in one session", async () => {
    const client = createRevisionTrackingSaveClient(1);
    const options = createQueueOptions(client, { initialRevision: 1 });
    const queue = createLearnerProgressSaveQueue(options);

    for (let index = 0; index < 3; index += 1) {
      await queue.flush();
    }

    queue.destroy();

    expect(options.getExpectedRevisionValue()).toBe(4);
    expect(client.getRevision()).toBe(4);
  });

  it("uses the newest revision for queued saves after an in-flight save", async () => {
    const client = createRevisionTrackingSaveClient(5);
    const options = createQueueOptions(client, { initialRevision: 5 });
    const setServerRow = vi.fn((revision: number, _hasExistingRow: boolean) => {
      options.setExpectedRevisionValue(revision);
    });
    const queue = createLearnerProgressSaveQueue({
      ...options,
      setServerRow,
    });

    await queue.flush();
    expect(options.getExpectedRevisionValue()).toBe(6);

    queue.scheduleSave(false);
    await vi.advanceTimersByTimeAsync(500);

    expect(setServerRow).toHaveBeenCalledTimes(2);
    expect(setServerRow).toHaveBeenNthCalledWith(1, 6, true);
    expect(setServerRow).toHaveBeenNthCalledWith(2, 7, true);
    expect(options.getExpectedRevisionValue()).toBe(7);

    queue.destroy();
  });

  it("reports a conflict when a stale revision is used", async () => {
    const onConflict = vi.fn();
    const onStatusChange = vi.fn();
    const queue = createLearnerProgressSaveQueue({
      userId: "user-a",
      client: createRevisionTrackingSaveClient(5),
      onStatusChange,
      onConflict,
      getHasExistingRow: () => true,
      getExpectedRevision: () => 3,
      setServerRow: vi.fn(),
    });

    await queue.flush();
    queue.destroy();

    expect(onStatusChange).toHaveBeenCalledWith("conflict");
    expect(onConflict).toHaveBeenCalledTimes(1);
  });

  it("increments the in-memory revision after each successful save", async () => {
    const client = createRevisionTrackingSaveClient(10);
    const options = createQueueOptions(client, { initialRevision: 10 });
    const queue = createLearnerProgressSaveQueue(options);

    await queue.flush();
    expect(options.getExpectedRevisionValue()).toBe(11);

    await queue.flush();
    expect(options.getExpectedRevisionValue()).toBe(12);

    queue.destroy();
  });

  it("replace refreshes the in-memory revision used for subsequent saves", async () => {
    const client = createRevisionTrackingSaveClient(3);
    const options = createQueueOptions(client, { initialRevision: 3 });
    const queue = createLearnerProgressSaveQueue(options);

    await queue.flush();
    expect(options.getExpectedRevisionValue()).toBe(4);

    client.setRevision(8);
    options.setExpectedRevisionValue(8);

    await queue.flush();
    expect(options.getExpectedRevisionValue()).toBe(9);

    queue.destroy();
  });

  describe("generation discard regression", () => {
    it("applies Save A revision before Save B begins when Save B arrives during Save A", async () => {
      let serverRevision = 5;
      let releaseFirstSave: (() => void) | null = null;
      const firstSaveGate = new Promise<void>((resolve) => {
        releaseFirstSave = resolve;
      });
      const saveCalls: number[] = [];

      vi.spyOn(learnerProgressRepository, "saveLearnerProgressRow").mockImplementation(
        async (_client, _userId, _progress, options) => {
          saveCalls.push(options.expectedRevision ?? -1);

          if (saveCalls.length === 1) {
            await firstSaveGate;
          }

          if (options.expectedRevision !== serverRevision) {
            return { ok: false, kind: "conflict" };
          }

          serverRevision += 1;

          return createSuccessfulSaveResult(serverRevision);
        },
      );

      const options = createQueueOptions(createRevisionTrackingSaveClient(5), {
        initialRevision: 5,
      });
      const setServerRow = vi.fn((revision: number, _hasExistingRow: boolean) => {
        options.setExpectedRevisionValue(revision);
      });
      const onConflict = vi.fn();
      const queue = createLearnerProgressSaveQueue({
        ...options,
        setServerRow,
        onConflict,
      });

      const firstFlush = queue.flush();
      await Promise.resolve();
      expect(saveCalls).toEqual([5]);

      queue.scheduleSave(true);
      releaseFirstSave!();
      await firstFlush;
      await vi.runAllTimersAsync();

      queue.destroy();

      expect(setServerRow).toHaveBeenCalledTimes(2);
      expect(setServerRow).toHaveBeenNthCalledWith(1, 6, true);
      expect(setServerRow).toHaveBeenNthCalledWith(2, 7, true);
      expect(saveCalls).toEqual([5, 6]);
      expect(onConflict).not.toHaveBeenCalled();
      expect(options.getExpectedRevisionValue()).toBe(7);
    });

    it("serializes multiple rapid immediate notifications without stale revision conflicts", async () => {
      let serverRevision = 10;
      let inFlightCount = 0;
      let maxInFlightCount = 0;

      vi.spyOn(learnerProgressRepository, "saveLearnerProgressRow").mockImplementation(
        async (_client, _userId, _progress, options) => {
          inFlightCount += 1;
          maxInFlightCount = Math.max(maxInFlightCount, inFlightCount);
          await Promise.resolve();

          if (options.expectedRevision !== serverRevision) {
            inFlightCount -= 1;
            return { ok: false, kind: "conflict" };
          }

          serverRevision += 1;
          inFlightCount -= 1;

          return createSuccessfulSaveResult(serverRevision);
        },
      );

      const options = createQueueOptions(createRevisionTrackingSaveClient(10), {
        initialRevision: 10,
      });
      const onConflict = vi.fn();
      const queue = createLearnerProgressSaveQueue({
        ...options,
        onConflict,
      });

      queue.scheduleSave(true);
      queue.scheduleSave(true);
      queue.scheduleSave(true);
      await vi.runAllTimersAsync();

      queue.destroy();

      expect(maxInFlightCount).toBe(1);
      expect(onConflict).not.toHaveBeenCalled();
      expect(options.getExpectedRevisionValue()).toBe(13);
    });

    it("queues debounced notification during an in-flight immediate save", async () => {
      let serverRevision = 2;
      let releaseFirstSave: (() => void) | null = null;
      const firstSaveGate = new Promise<void>((resolve) => {
        releaseFirstSave = resolve;
      });
      const saveCalls: number[] = [];

      vi.spyOn(learnerProgressRepository, "saveLearnerProgressRow").mockImplementation(
        async (_client, _userId, _progress, options) => {
          saveCalls.push(options.expectedRevision ?? -1);

          if (saveCalls.length === 1) {
            await firstSaveGate;
          }

          if (options.expectedRevision !== serverRevision) {
            return { ok: false, kind: "conflict" };
          }

          serverRevision += 1;
          return createSuccessfulSaveResult(serverRevision);
        },
      );

      const options = createQueueOptions(createRevisionTrackingSaveClient(2), {
        initialRevision: 2,
      });
      const onConflict = vi.fn();
      const queue = createLearnerProgressSaveQueue({
        ...options,
        onConflict,
      });

      const firstFlush = queue.flush();
      await Promise.resolve();
      queue.scheduleSave(false);
      releaseFirstSave!();
      await firstFlush;
      await vi.advanceTimersByTimeAsync(500);

      queue.destroy();

      expect(saveCalls).toEqual([2, 3]);
      expect(onConflict).not.toHaveBeenCalled();
      expect(options.getExpectedRevisionValue()).toBe(4);
    });

    it("explicit invalidation still discards obsolete results", async () => {
      let releaseSave: (() => void) | null = null;
      const saveGate = new Promise<void>((resolve) => {
        releaseSave = resolve;
      });

      vi.spyOn(learnerProgressRepository, "saveLearnerProgressRow").mockImplementation(
        async () => {
          await saveGate;
          return createSuccessfulSaveResult(99);
        },
      );

      const setServerRow = vi.fn();
      const queue = createLearnerProgressSaveQueue({
        userId: "user-a",
        client: createRevisionTrackingSaveClient(1),
        onStatusChange: vi.fn(),
        onConflict: vi.fn(),
        getHasExistingRow: () => true,
        getExpectedRevision: () => 1,
        setServerRow,
      });

      const pendingFlush = queue.flush();
      await Promise.resolve();
      queue.invalidatePendingWrites();
      releaseSave!();
      await pendingFlush;
      await vi.runAllTimersAsync();

      queue.destroy();

      expect(setServerRow).not.toHaveBeenCalled();
    });

    it("destroyed queue does not start follow-up saves", async () => {
      let releaseSave: (() => void) | null = null;
      const saveGate = new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      let saveCount = 0;

      vi.spyOn(learnerProgressRepository, "saveLearnerProgressRow").mockImplementation(
        async () => {
          saveCount += 1;
          await saveGate;
          return createSuccessfulSaveResult(saveCount + 1);
        },
      );

      const queue = createLearnerProgressSaveQueue({
        userId: "user-a",
        client: createRevisionTrackingSaveClient(1),
        onStatusChange: vi.fn(),
        onConflict: vi.fn(),
        getHasExistingRow: () => true,
        getExpectedRevision: () => 1,
        setServerRow: vi.fn(),
      });

      const pendingFlush = queue.flush();
      await Promise.resolve();
      queue.scheduleSave(true);
      queue.destroy();
      releaseSave!();
      await pendingFlush;
      await vi.runAllTimersAsync();

      expect(saveCount).toBe(1);
    });

    it("still reports genuine stale revision conflicts", async () => {
      const onConflict = vi.fn();
      const onStatusChange = vi.fn();
      const queue = createLearnerProgressSaveQueue({
        userId: "user-a",
        client: createRevisionTrackingSaveClient(8),
        onStatusChange,
        onConflict,
        getHasExistingRow: () => true,
        getExpectedRevision: () => 4,
        setServerRow: vi.fn(),
      });

      await queue.flush();
      queue.destroy();

      expect(onStatusChange).toHaveBeenCalledWith("conflict");
      expect(onConflict).toHaveBeenCalledTimes(1);
    });
  });
});
