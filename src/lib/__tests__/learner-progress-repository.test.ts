import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchLearnerProgressRow,
  insertLearnerProgressRow,
  replaceLearnerProgressRow,
  saveLearnerProgressRow,
  updateLearnerProgressRow,
} from "@/src/lib/progress/learner-progress-repository";
import { LEARNER_PROGRESS_SCHEMA_VERSION } from "@/src/lib/progress/learner-progress.types";
import type { PersistedLearnerProgress } from "@/src/lib/progress/learner-progress.types";

const progressPayload: PersistedLearnerProgress = {
  schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
  savedAt: "2026-07-30T00:00:00.000Z",
  state: {
    courseProgress: { version: 1, courses: {} },
    masteryProgress: { version: 1, cards: {} },
    activeStudySession: null,
    muscleBriefViewedIds: [],
  },
};

function createMockClient(handlers: {
  selectResult?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
  upsertResult?: { data: unknown; error: unknown };
}): SupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => handlers.selectResult ?? { data: null, error: null }),
          single: vi.fn(async () => handlers.selectResult ?? { data: null, error: null }),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => handlers.insertResult ?? { data: null, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn((column: string, value: unknown) => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => {
                if (
                  handlers.updateResult &&
                  column === "revision" &&
                  handlers.updateResult.data === null
                ) {
                  return handlers.updateResult;
                }

                return handlers.updateResult ?? { data: null, error: null };
              }),
            })),
          })),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => handlers.upsertResult ?? { data: null, error: null }),
        })),
      })),
    })),
  } as unknown as SupabaseClient;
}

describe("learner progress repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads an existing database row for the authenticated learner", async () => {
    const client = createMockClient({
      selectResult: {
        data: {
          user_id: "user-a",
          progress_data: progressPayload,
          revision: 3,
          updated_at: "2026-07-30T01:00:00.000Z",
        },
        error: null,
      },
    });

    const result = await fetchLearnerProgressRow(client, "user-a");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row?.user_id).toBe("user-a");
      expect(result.row?.revision).toBe(3);
    }
  });

  it("returns null when no row exists", async () => {
    const client = createMockClient({
      selectResult: { data: null, error: null },
    });

    const result = await fetchLearnerProgressRow(client, "user-a");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row).toBeNull();
    }
  });

  it("detects update conflicts via revision", async () => {
    const client = createMockClient({
      updateResult: { data: null, error: null },
    });

    const result = await updateLearnerProgressRow(
      client,
      "user-a",
      progressPayload,
      2,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("conflict");
    }
  });

  it("returns an incremented revision after a successful update", async () => {
    const client = createMockClient({
      updateResult: {
        data: {
          user_id: "user-a",
          progress_data: progressPayload,
          revision: 4,
          updated_at: "2026-07-30T02:00:00.000Z",
        },
        error: null,
      },
    });

    const result = await updateLearnerProgressRow(
      client,
      "user-a",
      progressPayload,
      3,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.revision).toBe(4);
    }
  });

  it("uses the authenticated user ID from the caller without accepting alternate IDs in payload", async () => {
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((column: string, value: string) => {
          expect(column).toBe("user_id");
          expect(value).toBe("user-a");
          return {
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          };
        }),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: {
              user_id: "user-a",
              progress_data: progressPayload,
              revision: 1,
              updated_at: "2026-07-30T01:00:00.000Z",
            },
            error: null,
          })),
        })),
      })),
    }));

    const client = { from } as unknown as SupabaseClient;
    const result = await saveLearnerProgressRow(client, "user-a", progressPayload, {
      hasExistingRow: false,
      expectedRevision: null,
    });

    expect(result.ok).toBe(true);
  });

  it("returns the existing row when a concurrent insert hits the primary key", async () => {
    const from = vi.fn((table: string) => {
      if (table !== "learner_progress") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: { code: "23505", message: "duplicate key value" },
            })),
          })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                user_id: "user-a",
                progress_data: progressPayload,
                revision: 2,
                updated_at: "2026-07-30T01:00:00.000Z",
              },
              error: null,
            })),
          })),
        })),
      };
    });

    const client = { from } as unknown as SupabaseClient;
    const result = await insertLearnerProgressRow(client, "user-a", progressPayload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.user_id).toBe("user-a");
      expect(result.row.revision).toBe(2);
    }
  });

  it("queries only the provided authenticated user id", async () => {
    const eq = vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    }));

    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq })),
      })),
    } as unknown as SupabaseClient;

    await fetchLearnerProgressRow(client, "user-a");

    expect(eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("returns the latest revision after replace", async () => {
    const client = createMockClient({
      upsertResult: {
        data: {
          user_id: "user-a",
          progress_data: progressPayload,
          revision: 7,
          updated_at: "2026-07-30T03:00:00.000Z",
        },
        error: null,
      },
    });

    const result = await replaceLearnerProgressRow(client, "user-a", progressPayload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.revision).toBe(7);
    }
  });
});
