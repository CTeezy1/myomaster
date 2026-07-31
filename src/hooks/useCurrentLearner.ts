"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCurrentProfile } from "@/src/lib/auth/profile-client";
import type { Profile } from "@/src/lib/profile.types";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browser";

export type CurrentLearnerState =
  | { status: "loading" }
  | { status: "ready"; profile: Profile }
  | { status: "missing_profile"; message: string }
  | { status: "error"; message: string };

export function useCurrentLearner(): CurrentLearnerState & {
  reload: () => void;
} {
  const [state, setState] = useState<CurrentLearnerState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      const result = await fetchCurrentProfile(createBrowserSupabaseClient());

      if (!isActive) {
        return;
      }

      if (result.ok) {
        setState({ status: "ready", profile: result.profile });
        return;
      }

      if (result.kind === "missing_profile") {
        setState({
          status: "missing_profile",
          message: result.message,
        });
        return;
      }

      setState({
        status: "error",
        message: result.message,
      });
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [reloadToken]);

  return { ...state, reload };
}
