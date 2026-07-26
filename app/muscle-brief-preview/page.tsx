"use client";

import { MuscleBriefScreen } from "@/app/components/MuscleBriefScreen";
import { PageShell } from "@/app/components/ui/PageShell";
import { getMuscleProfileById } from "@/src/data/muscle-profiles";

export default function MuscleBriefPreviewPage() {
  const profile = getMuscleProfileById("longus-colli");

  if (!profile) {
    return (
      <PageShell>
        <p className="text-text-secondary">Muscle profile not found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <MuscleBriefScreen
        profile={profile}
        mode="course"
        onPrimaryAction={() => {}}
      />
    </PageShell>
  );
}
