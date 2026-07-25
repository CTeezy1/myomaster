import { getMuscleMasteryState } from "@/src/lib/muscle-mastery";
import type { MasteryProgressStore } from "@/src/lib/progress.types";
import { buildReviewQueue } from "@/src/lib/review-queue";
import { buildStudyUnitsForMuscle } from "@/src/lib/study-units";

export function getDueReviewPromptCount(
  muscleIds: string[],
  masteryStore: MasteryProgressStore,
  currentStudyDay: number,
): number {
  const units = muscleIds.flatMap((muscleId) =>
    buildStudyUnitsForMuscle(muscleId),
  );

  return buildReviewQueue(units, masteryStore, currentStudyDay).length;
}

export function getMasteredMuscleCount(
  muscleIds: string[],
  masteryStore: MasteryProgressStore,
): number {
  return muscleIds.filter(
    (muscleId) =>
      getMuscleMasteryState(muscleId, masteryStore) === "mastered",
  ).length;
}

export function getIntroducedMuscleCount(
  muscleIds: string[],
  introducedMuscleIds: string[],
): number {
  const introduced = new Set(introducedMuscleIds);

  return muscleIds.filter((muscleId) => introduced.has(muscleId)).length;
}
