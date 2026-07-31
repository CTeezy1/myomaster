"use client";

import {
  getViewedMuscleBriefIds,
  hasViewedMuscleBrief,
  markMuscleBriefViewed,
} from "@/src/lib/muscle-brief-progress";
import { clearAllLearningProgress } from "@/src/lib/learning-progress-reset";
import { useCallback, useState } from "react";

export function useMuscleBriefProgress() {
  const [viewedIds, setViewedIds] = useState<string[]>(() =>
    getViewedMuscleBriefIds(),
  );

  const hasViewed = useCallback(
    (profileId: string) => hasViewedMuscleBrief(profileId),
    [],
  );

  const markViewed = useCallback((profileId: string) => {
    markMuscleBriefViewed(profileId);
    setViewedIds(getViewedMuscleBriefIds());
  }, []);

  const resetProgress = useCallback((options?: { clearStorage?: boolean }) => {
    if (options?.clearStorage !== false) {
      clearAllLearningProgress();
    }

    setViewedIds(getViewedMuscleBriefIds());
  }, []);

  const syncViewedFromStorage = useCallback(() => {
    setViewedIds(getViewedMuscleBriefIds());
  }, []);

  return { hasViewed, markViewed, resetProgress, syncViewedFromStorage };
}
