import type { SupabaseClient } from "@supabase/supabase-js";

export const LOGOUT_ERROR_MESSAGE =
  "Unable to log out right now. Please try again.";

export type LogoutResult =
  | { ok: true }
  | { ok: false; message: string };

export async function signOutLearner(
  client: SupabaseClient,
): Promise<LogoutResult> {
  try {
    const { error } = await client.auth.signOut();

    if (error) {
      return {
        ok: false,
        message: LOGOUT_ERROR_MESSAGE,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: LOGOUT_ERROR_MESSAGE,
    };
  }
}
