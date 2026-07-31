import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/src/lib/profile.types";

export const PROFILE_LOAD_ERROR_MESSAGE =
  "Unable to load your account right now. Please try again.";

export const PROFILE_MISSING_MESSAGE =
  "Your account profile is unavailable. Please log out and contact your instructor.";

export type CurrentProfileResult =
  | { ok: true; profile: Profile }
  | { ok: false; kind: "missing_profile"; message: string }
  | { ok: false; kind: "load_error"; message: string };

export async function fetchCurrentProfile(
  client: SupabaseClient,
): Promise<CurrentProfileResult> {
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError || !authData.user) {
    return {
      ok: false,
      kind: "load_error",
      message: PROFILE_LOAD_ERROR_MESSAGE,
    };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, username, username_slug, section, created_at")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      kind: "load_error",
      message: PROFILE_LOAD_ERROR_MESSAGE,
    };
  }

  if (!profile) {
    return {
      ok: false,
      kind: "missing_profile",
      message: PROFILE_MISSING_MESSAGE,
    };
  }

  return { ok: true, profile: profile as Profile };
}
