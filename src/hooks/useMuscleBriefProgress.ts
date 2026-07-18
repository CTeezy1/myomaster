"use client";

import {
  clearMuscleBriefProgress,
  getViewedMuscleBriefIds,
  markMuscleBriefViewed,
} from "@/src/lib/muscle-brief-progress";
import { useCallback, useState } from "react";

export function useMuscleBriefProgress() {
  const [viewedIds, setViewedIds] = useState<string[]>(() =>
    getViewedMuscleBriefIds(),
  );

  const hasViewed = useCallback(
    (profileId: string) => viewedIds.includes(profileId),
    [viewedIds],
  );

  const markViewed = useCallback((profileId: string) => {
    markMuscleBriefViewed(profileId);
    setViewedIds(getViewedMuscleBriefIds());
  }, []);

  const resetProgress = useCallback(() => {
    clearMuscleBriefProgress();
    setViewedIds([]);
  }, []);

  return { hasViewed, markViewed, resetProgress };
}
