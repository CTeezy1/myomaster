import { hasViewedMuscleBrief } from "@/src/lib/muscle-brief-progress";

export type GuidedFirstExposureScreen = "brief" | "study";

export function shouldShowMuscleBriefForGuidedStudy(profileId: string): boolean {
  return !hasViewedMuscleBrief(profileId);
}

export function resolveGuidedFirstExposureScreen(
  profileId: string,
): GuidedFirstExposureScreen {
  return shouldShowMuscleBriefForGuidedStudy(profileId) ? "brief" : "study";
}
