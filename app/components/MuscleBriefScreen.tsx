import { MuscleBrief, type MuscleBriefProps } from "@/app/components/MuscleBrief";

export type MuscleBriefScreenProps = MuscleBriefProps;

/**
 * Single entry point for every Muscle Brief surface in the app.
 * All layout and styling live in MuscleBrief.tsx.
 */
export function MuscleBriefScreen(props: MuscleBriefScreenProps) {
  return <MuscleBrief {...props} />;
}

export type { MuscleBriefProps };
