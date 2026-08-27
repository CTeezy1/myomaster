import { describe, expect, it } from "vitest";
import { cards } from "@/src/data/cards";
import { allMuscleProfiles } from "@/src/data/muscle-profiles";
import { myomasterProgramCourse } from "@/src/data/courses/myomaster-program-course";
import type { MuscleProfileCoreFacts } from "@/src/data/muscle-profile.types";
import { CARD_CATEGORIES, type CardCategory } from "@/src/lib/card-progress-key";
import { getProfileForStudyCard } from "@/src/lib/course-controller";
import { getCardsForMuscleProfile } from "@/src/lib/study-session";

const CORE_FACT_KEYS = {
  origin: "origin",
  insertion: "insertion",
  action: "action",
  innervation: "innervation",
} as const satisfies Record<CardCategory, keyof MuscleProfileCoreFacts>;

const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  origin: "Origin",
  insertion: "Insertion",
  action: "Action",
  innervation: "Innervation",
};

function serializeCoreFact(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).join("\n");
  }

  return value.trim();
}

function formatMismatch(details: {
  muscleId: string;
  muscleName: string;
  category: string;
  profileValue: string;
  cardValue: string;
}) {
  return [
    `Profile/card mismatch for ${details.muscleId} (${details.muscleName}) ${details.category}:`,
    `  profile: ${JSON.stringify(details.profileValue)}`,
    `  card:    ${JSON.stringify(details.cardValue)}`,
  ].join("\n");
}

describe("profile and flashcard anatomy consistency", () => {
  it("covers all 84 canonical muscles", () => {
    expect(allMuscleProfiles).toHaveLength(84);
    expect(myomasterProgramCourse.muscleProfileIds).toHaveLength(84);
    expect(new Set(allMuscleProfiles.map((profile) => profile.id))).toEqual(
      new Set(myomasterProgramCourse.muscleProfileIds),
    );
  });

  it("keeps every canonical muscle's origin, insertion, action, and innervation aligned with its flashcards", () => {
    const mismatches: string[] = [];
    const unresolvedCards: string[] = [];
    const resolvedCardIds = new Set<number>();

    for (const profile of allMuscleProfiles) {
      const muscleCards = getCardsForMuscleProfile(cards, profile);

      for (const category of CARD_CATEGORIES) {
        const categoryCards = muscleCards.filter(
          (card) => card.category.trim().toLowerCase() === category,
        );

        if (categoryCards.length === 0) {
          mismatches.push(
            formatMismatch({
              muscleId: profile.id,
              muscleName: profile.name,
              category: CARD_CATEGORY_LABELS[category],
              profileValue: serializeCoreFact(profile.coreFacts[CORE_FACT_KEYS[category]]),
              cardValue: "<missing card>",
            }),
          );
          continue;
        }

        const profileValue = serializeCoreFact(
          profile.coreFacts[CORE_FACT_KEYS[category]],
        );

        for (const card of categoryCards) {
          resolvedCardIds.add(card.id);

          const resolvedProfile = getProfileForStudyCard(
            card,
            myomasterProgramCourse,
          );

          if (!resolvedProfile || resolvedProfile.id !== profile.id) {
            unresolvedCards.push(
              `Card ${card.id} (${card.region}:${card.muscle}:${card.category}) did not resolve to canonical profile ${profile.id}`,
            );
            continue;
          }

          const cardValue = card.answer.trim();

          if (profileValue !== cardValue) {
            mismatches.push(
              formatMismatch({
                muscleId: profile.id,
                muscleName: profile.name,
                category: CARD_CATEGORY_LABELS[category],
                profileValue,
                cardValue,
              }),
            );
          }
        }
      }
    }

    for (const card of cards) {
      if (resolvedCardIds.has(card.id)) {
        continue;
      }

      const profile = getProfileForStudyCard(card, myomasterProgramCourse);

      unresolvedCards.push(
        profile
          ? `Card ${card.id} (${card.region}:${card.muscle}:${card.category}) resolved to ${profile.id} but was not matched by canonical profile lookup`
          : `Card ${card.id} (${card.region}:${card.muscle}:${card.category}) cannot resolve to a canonical profile`,
      );
    }

    expect(unresolvedCards, unresolvedCards.join("\n")).toEqual([]);
    expect(mismatches, mismatches.join("\n\n")).toEqual([]);
  });
});
