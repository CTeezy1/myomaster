import { describe, expect, it } from "vitest";
import { createDefaultCourseProgress } from "@/src/lib/course-progress";
import { createDefaultCardProgress } from "@/src/lib/mastery-progress";
import {
  migrateCardProgressKey,
  migrateCarriedOverRetryKeys,
  migrateCourseProgress,
  migrateMasteryProgressStore,
  migrateMuscleId,
  migrateViewedMuscleBriefIds,
} from "@/src/lib/muscle-id-migration";
import { getMuscleProfileById } from "@/src/data/muscle-profiles";
import { resolveCardProgressKey } from "@/src/lib/card-progress-key";
import { cards } from "@/src/data/cards";
import { hipCourse } from "@/src/data/courses/hip-course";
import { shoulderCourse } from "@/src/data/courses/shoulder-course";

describe("muscle id migration", () => {
  it("remaps legacy muscle IDs to canonical IDs", () => {
    expect(migrateMuscleId("pectoral-minor")).toBe("pectoralis-minor");
    expect(migrateMuscleId("caracobrachialis")).toBe("coracobrachialis");
    expect(migrateMuscleId("adductor-magus")).toBe("adductor-magnus");
  });

  it("remaps legacy card progress keys without losing categories", () => {
    expect(migrateCardProgressKey("pectoral-minor:action")).toBe(
      "pectoralis-minor:action",
    );
    expect(migrateCardProgressKey("caracobrachialis:origin")).toBe(
      "coracobrachialis:origin",
    );
  });

  it("migrates mastery progress keys and muscle IDs together", () => {
    const migrated = migrateMasteryProgressStore({
      version: 1,
      cards: {
        "pectoral-minor:action": createDefaultCardProgress({
          key: "pectoral-minor:action",
          muscleId: "pectoral-minor",
          category: "action",
        }),
        "caracobrachialis:innervation": {
          ...createDefaultCardProgress({
            key: "caracobrachialis:innervation",
            muscleId: "caracobrachialis",
            category: "innervation",
          }),
          totalAttempts: 3,
          successfulReviewCount: 2,
          state: "review",
        },
      },
    });

    expect(migrated.cards["pectoralis-minor:action"]?.muscleId).toBe(
      "pectoralis-minor",
    );
    expect(migrated.cards["coracobrachialis:innervation"]?.totalAttempts).toBe(3);
    expect(migrated.cards["coracobrachialis:innervation"]?.state).toBe("review");
    expect(migrated.cards["pectoral-minor:action"]).toBeUndefined();
  });

  it("merges duplicate progress when old and new keys both exist", () => {
    const migrated = migrateMasteryProgressStore({
      version: 1,
      cards: {
        "pectoral-minor:action": {
          ...createDefaultCardProgress({
            key: "pectoral-minor:action",
            muscleId: "pectoral-minor",
            category: "action",
          }),
          totalAttempts: 2,
          correctAttempts: 1,
          successfulReviewCount: 1,
          state: "learning",
        },
        "pectoralis-minor:action": {
          ...createDefaultCardProgress({
            key: "pectoralis-minor:action",
            muscleId: "pectoralis-minor",
            category: "action",
          }),
          totalAttempts: 1,
          correctAttempts: 1,
          successfulReviewCount: 1,
          state: "review",
        },
      },
    });

    expect(migrated.cards["pectoralis-minor:action"]?.totalAttempts).toBe(3);
    expect(migrated.cards["pectoralis-minor:action"]?.state).toBe("review");
  });

  it("migrates introduced muscle IDs and brief-viewed IDs", () => {
    const migrated = migrateCourseProgress({
      ...createDefaultCourseProgress("shoulder"),
      introducedMuscleIds: ["pectoral-minor", "caracobrachialis", "deltoid"],
      introductionDates: {
        "pectoral-minor": "2026-01-01T12:00:00.000Z",
      },
      introductionStudyDays: {
        caracobrachialis: 2,
      },
      carriedOverRetryKeys: ["pectoral-minor:action", "caracobrachialis:origin"],
    });

    expect(migrated.introducedMuscleIds).toEqual([
      "pectoralis-minor",
      "coracobrachialis",
      "deltoid",
    ]);
    expect(migrated.introductionDates["pectoralis-minor"]).toBe(
      "2026-01-01T12:00:00.000Z",
    );
    expect(migrated.introductionStudyDays.coracobrachialis).toBe(2);
    expect(migrateViewedMuscleBriefIds(["pectoral-minor", "caracobrachialis"])).toEqual([
      "pectoralis-minor",
      "coracobrachialis",
    ]);
    expect(migrateCarriedOverRetryKeys(["pectoral-minor:action"])).toEqual([
      "pectoralis-minor:action",
    ]);
  });

  it("resolves corrected shoulder cards to canonical profile IDs", () => {
    const coracobrachialisCard = cards.find(
      (card) => card.muscle === "Coracobrachialis" && card.region === "shoulder",
    );
    const pectoralisMinorCard = cards.find(
      (card) => card.muscle === "Pectoralis minor" && card.region === "shoulder",
    );

    expect(coracobrachialisCard).toBeDefined();
    expect(pectoralisMinorCard).toBeDefined();

    expect(resolveCardProgressKey(coracobrachialisCard!, shoulderCourse)).toBe(
      "coracobrachialis:origin",
    );
    expect(resolveCardProgressKey(pectoralisMinorCard!, shoulderCourse)).toBe(
      "pectoralis-minor:origin",
    );
    expect(getMuscleProfileById("coracobrachialis")?.name).toBe("Coracobrachialis");
    expect(getMuscleProfileById("pectoralis-minor")?.name).toBe("Pectoralis minor");
  });

  it("resolves corrected hip cards to canonical profile IDs", () => {
    const adductorMagnusCard = cards.find(
      (card) => card.muscle === "Adductor magnus" && card.region === "hip",
    );

    expect(adductorMagnusCard).toBeDefined();
    expect(resolveCardProgressKey(adductorMagnusCard!, hipCourse)).toBe(
      "adductor-magnus:origin",
    );
    expect(getMuscleProfileById("adductor-magnus")?.name).toBe("Adductor magnus");
    expect(getMuscleProfileById("adductor-magnus")?.images.anatomy).toBe(
      "/images/muscles/hip/adductor-magnus/anatomy.png",
    );
    expect(getMuscleProfileById("adductor-magnus")?.images.memory).toBe(
      "/images/muscles/hip/adductor-magnus/memory.png",
    );
    expect(getMuscleProfileById("adductor-magus")).toBeUndefined();
  });
});
