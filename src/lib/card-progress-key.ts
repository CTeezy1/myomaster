import type { Card } from "@/src/data/cards";
import type { MuscleProfile } from "@/src/data/muscle-profile.types";
import { getProfileForStudyCard } from "@/src/lib/course-controller";
import type { Course } from "@/src/lib/course.types";

export const CARD_CATEGORIES = [
  "origin",
  "insertion",
  "action",
  "innervation",
] as const;

export type CardCategory = (typeof CARD_CATEGORIES)[number];

/**
 * Stable identifier for card-level progress.
 * Format: `<profileId>:<category>` (category is lowercase).
 */
export type CardProgressKey = `${string}:${CardCategory}`;

const CARD_CATEGORY_SET = new Set<string>(CARD_CATEGORIES);

export function normalizeCardCategory(
  category: string,
): CardCategory | null {
  const normalized = category.trim().toLowerCase();

  if (!CARD_CATEGORY_SET.has(normalized)) {
    return null;
  }

  return normalized as CardCategory;
}

export function buildCardProgressKey(
  profileId: string,
  category: string,
): CardProgressKey | null {
  const normalizedCategory = normalizeCardCategory(category);

  if (!normalizedCategory) {
    return null;
  }

  const normalizedProfileId = profileId.trim();

  if (!normalizedProfileId) {
    return null;
  }

  return `${normalizedProfileId}:${normalizedCategory}`;
}

export function getCardProgressKeyForProfile(
  profile: MuscleProfile,
  category: string,
): CardProgressKey | null {
  return buildCardProgressKey(profile.id, category);
}

export function getCardProgressKeyForCard(
  card: Card,
  profile: MuscleProfile,
): CardProgressKey | null {
  return buildCardProgressKey(profile.id, card.category);
}

export function resolveCardProgressKey(
  card: Card,
  course?: Course | null,
): CardProgressKey | null {
  const profile = getProfileForStudyCard(card, course);

  if (!profile) {
    return null;
  }

  return getCardProgressKeyForCard(card, profile);
}

export function parseCardProgressKey(
  key: CardProgressKey,
): { profileId: string; category: CardCategory } | null {
  const separatorIndex = key.lastIndexOf(":");

  if (separatorIndex <= 0 || separatorIndex === key.length - 1) {
    return null;
  }

  const profileId = key.slice(0, separatorIndex);
  const category = normalizeCardCategory(key.slice(separatorIndex + 1));

  if (!category) {
    return null;
  }

  return { profileId, category };
}
