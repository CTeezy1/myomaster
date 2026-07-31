"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browser";

export function useRedirectAuthenticatedLearner(homePath = "/") {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function checkExistingSession() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getUser();

        if (!isActive) {
          return;
        }

        if (data.user) {
          router.replace(homePath);
          return;
        }
      } catch {
        // Fall through to the auth form if session lookup fails.
      }

      if (isActive) {
        setIsCheckingSession(false);
      }
    }

    void checkExistingSession();

    return () => {
      isActive = false;
    };
  }, [homePath, router]);

  return { isCheckingSession };
}
