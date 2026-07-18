import type { Card } from "@/src/data/cards";
import type { MuscleProfile } from "@/src/data/muscle-profile.types";

export function normalizeMuscleName(name: string) {
  return name.trim().toLowerCase();
}

export function getCardsForMuscleProfile(
  allCards: Card[],
  profile: MuscleProfile,
): Card[] {
  const targetName = normalizeMuscleName(profile.name);

  return allCards.filter(
    (card) => normalizeMuscleName(card.muscle) === targetName,
  );
}

export function getModuleDisplayName(region: string) {
  const formattedRegion =
    region.charAt(0).toUpperCase() + region.slice(1).toLowerCase();

  return `${formattedRegion} Muscles`;
}
