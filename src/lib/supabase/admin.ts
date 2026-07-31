import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleSupabaseEnv } from "@/src/lib/supabase/env";

export function createServiceRoleSupabaseClient(): SupabaseClient {
  const { url, serviceRoleKey } = getServiceRoleSupabaseEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
