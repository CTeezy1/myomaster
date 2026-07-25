import type { MuscleProfile } from "@/src/data/muscle-profile.types";
import { ankleAndFootMuscleProfiles } from "@/src/data/muscle-profiles/ankle-and-foot";
import { cervicalMuscleProfiles } from "@/src/data/muscle-profiles/cervical";
import { elbowAndForearmMuscleProfiles } from "@/src/data/muscle-profiles/elbow-and-forearm";
import { hipMuscleProfiles } from "@/src/data/muscle-profiles/hip";
import { kneeMuscleProfiles } from "@/src/data/muscle-profiles/knee";
import { lumbarAndThoracicMuscleProfiles } from "@/src/data/muscle-profiles/lumbar-and-thoracic";
import { shoulderMuscleProfiles } from "@/src/data/muscle-profiles/shoulder";
import { wristAndHandMuscleProfiles } from "@/src/data/muscle-profiles/wrist-and-hand";
import type { RegionId } from "@/src/data/regions";

const profilesByRegion: Record<RegionId, MuscleProfile[]> = {
  cervical: cervicalMuscleProfiles,
  shoulder: shoulderMuscleProfiles,
  "elbow-and-forearm": elbowAndForearmMuscleProfiles,
  "wrist-and-hand": wristAndHandMuscleProfiles,
  "lumbar-and-thoracic": lumbarAndThoracicMuscleProfiles,
  hip: hipMuscleProfiles,
  knee: kneeMuscleProfiles,
  "ankle-and-foot": ankleAndFootMuscleProfiles,
};

export const allMuscleProfiles: MuscleProfile[] = Object.values(
  profilesByRegion,
).flat();

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export function getMuscleProfileById(id: string): MuscleProfile | undefined {
  return allMuscleProfiles.find((profile) => profile.id === id);
}

export function getMuscleProfileByName(
  name: string,
): MuscleProfile | undefined {
  const normalized = normalizeName(name);

  return allMuscleProfiles.find(
    (profile) => normalizeName(profile.name) === normalized,
  );
}

export function getMuscleProfileByNameAndRegion(
  name: string,
  region: string,
): MuscleProfile | undefined {
  const normalizedName = normalizeName(name);
  const normalizedRegion = normalizeName(region);

  return allMuscleProfiles.find(
    (profile) =>
      normalizeName(profile.name) === normalizedName &&
      normalizeName(profile.region) === normalizedRegion,
  );
}

export function getMuscleProfilesByRegion(region: string): MuscleProfile[] {
  const normalized = normalizeName(region);

  return allMuscleProfiles
    .filter((profile) => normalizeName(profile.region) === normalized)
    .sort((a, b) => a.order - b.order);
}

export function getMuscleProfilesForRegionId(
  regionId: RegionId,
): MuscleProfile[] {
  return [...profilesByRegion[regionId]].sort((a, b) => a.order - b.order);
}
