"use client";

import { useRouter } from "next/navigation";
import { MuscleBriefScreen } from "@/app/components/MuscleBriefScreen";
import type { MuscleProfile } from "@/src/data/muscle-profile.types";

type LibraryMuscleBriefViewProps = {
  profile: MuscleProfile;
  regionId: string;
  regionName: string;
};

export function LibraryMuscleBriefView({
  profile,
  regionId,
  regionName,
}: LibraryMuscleBriefViewProps) {
  const router = useRouter();

  return (
    <MuscleBriefScreen
      profile={profile}
      mode="library"
      libraryRegionName={regionName}
      onPrimaryAction={() => router.push(`/library/${regionId}`)}
    />
  );
}
