import type { Card } from "@/src/data/cards";
import type { MuscleProfile } from "@/src/data/muscle-profile.types";
import { getRegionById } from "@/src/data/regions";

export function normalizeMuscleName(name: string) {
  return name.trim().toLowerCase();
}

function normalizeRegion(region: string) {
  return region.trim().toLowerCase();
}

export function getCardsForMuscleProfile(
  allCards: Card[],
  profile: MuscleProfile,
): Card[] {
  const targetName = normalizeMuscleName(profile.name);
  const targetRegion = normalizeRegion(profile.region);

  return allCards.filter(
    (card) =>
      normalizeMuscleName(card.muscle) === targetName &&
      normalizeRegion(card.region) === targetRegion,
  );
}

export function getModuleDisplayName(regionId: string) {
  const region = getRegionById(regionId);
  const displayName = region?.name ?? regionId;

  return `${displayName} Muscles`;
}
