import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/src/lib/supabase/env";

let browserClient: SupabaseClient | undefined;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getPublicSupabaseEnv();

  browserClient = createBrowserClient(url, anonKey);

  return browserClient;
}

export function resetBrowserSupabaseClientForTests(): void {
  browserClient = undefined;
}
