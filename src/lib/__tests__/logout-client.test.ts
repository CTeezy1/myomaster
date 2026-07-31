import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LOGOUT_ERROR_MESSAGE,
  signOutLearner,
} from "@/src/lib/auth/logout-client";

function createLogoutClient(
  overrides: Partial<SupabaseClient> = {},
): SupabaseClient {
  return {
    auth: {
      signOut: vi.fn(async () => ({ error: null })),
    },
    ...overrides,
  } as unknown as SupabaseClient;
}

describe("signOutLearner", () => {
  it("calls Supabase signOut on logout", async () => {
    const client = createLogoutClient();
    const result = await signOutLearner(client);

    expect(result.ok).toBe(true);
    expect(client.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("returns a generic error when signOut fails", async () => {
    const client = createLogoutClient({
      auth: {
        signOut: vi.fn(async () => ({
          error: { message: "network timeout" },
        })),
      },
    } as unknown as Partial<SupabaseClient>);

    const result = await signOutLearner(client);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(LOGOUT_ERROR_MESSAGE);
      expect(result.message).not.toContain("network");
    }
  });
});
