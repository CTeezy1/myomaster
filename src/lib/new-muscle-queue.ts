import {
  buildCardProgressKey,
  CARD_CATEGORIES,
} from "@/src/lib/card-progress-key";
import type { Course } from "@/src/lib/course.types";
import type { CourseProgress } from "@/src/lib/progress.types";
import type { QueuedCard } from "@/src/lib/review-queue";

export function buildNewMuscleQueuedCards(muscleId: string): QueuedCard[] {
  return CARD_CATEGORIES.map((category) => {
    const cardKey = buildCardProgressKey(muscleId, category);

    if (!cardKey) {
      throw new Error(`Unable to build card key for ${muscleId}:${category}`);
    }

    const queued: QueuedCard = {
      muscleId,
      cardKey,
      category,
    };

    if (category === "origin" || category === "insertion") {
      queued.attachmentPairId = `${muscleId}:attachment-pair`;
    }

    return queued;
  });
}

export function getMuscleIdsIntroducedOnStudyDay(
  courseProgress: CourseProgress,
  studyDay: number,
): string[] {
  return courseProgress.introducedMuscleIds.filter(
    (muscleId) => courseProgress.introductionStudyDays[muscleId] === studyDay,
  );
}

export function getNewMuscleIdsForStudyDay(
  course: Course,
  courseProgress: CourseProgress,
  remainingNewAllowance: number,
): string[] {
  if (remainingNewAllowance <= 0) {
    return [];
  }

  const newMuscleIds: string[] = [];

  for (const muscleId of course.muscleProfileIds) {
    if (courseProgress.introducedMuscleIds.includes(muscleId)) {
      continue;
    }

    newMuscleIds.push(muscleId);

    if (newMuscleIds.length >= remainingNewAllowance) {
      break;
    }
  }

  return newMuscleIds;
}
