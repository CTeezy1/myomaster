"use client";

import { MuscleBriefScreen } from "@/app/components/MuscleBriefScreen";
import { getMuscleProfileById } from "@/src/data/muscle-profiles";

export default function MuscleBriefPreviewPage() {
  const profile = getMuscleProfileById("longus-colli");

  if (!profile) {
    return <p className="text-text-secondary">Muscle profile not found.</p>;
  }

  return (
    <MuscleBriefScreen
      profile={profile}
      mode="course"
      onPrimaryAction={() => {}}
    />
  );
}
