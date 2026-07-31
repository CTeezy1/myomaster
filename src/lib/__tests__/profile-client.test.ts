import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchCurrentProfile,
  PROFILE_LOAD_ERROR_MESSAGE,
  PROFILE_MISSING_MESSAGE,
} from "@/src/lib/auth/profile-client";

function createProfileClient(
  overrides: Partial<SupabaseClient> = {},
): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-123" } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: {
              id: "user-123",
              username: "Energetic Pencil",
              username_slug: "energetic-pencil",
              section: "Kinesiology 1",
              created_at: "2026-07-30T00:00:00.000Z",
            },
            error: null,
          })),
        })),
      })),
    })),
    ...overrides,
  } as unknown as SupabaseClient;
}

describe("fetchCurrentProfile", () => {
  it("returns the learner profile for a valid session", async () => {
    const client = createProfileClient();
    const result = await fetchCurrentProfile(client);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.username).toBe("Energetic Pencil");
      expect(result.profile.section).toBe("Kinesiology 1");
    }
  });

  it("returns a safe missing-profile state when no profile row exists", async () => {
    const client = createProfileClient({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: null,
            })),
          })),
        })),
      })),
    } as unknown as Partial<SupabaseClient>);

    const result = await fetchCurrentProfile(client);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("missing_profile");
      expect(result.message).toBe(PROFILE_MISSING_MESSAGE);
    }
  });

  it("returns a generic load error without technical details", async () => {
    const client = createProfileClient({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: { message: "permission denied for table profiles" },
            })),
          })),
        })),
      })),
    } as unknown as Partial<SupabaseClient>);

    const result = await fetchCurrentProfile(client);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("load_error");
      expect(result.message).toBe(PROFILE_LOAD_ERROR_MESSAGE);
      expect(result.message).not.toContain("permission");
    }
  });
});
