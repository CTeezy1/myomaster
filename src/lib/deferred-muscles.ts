import type { CardProgressKey } from "@/src/lib/card-progress-key";
import type { Course } from "@/src/lib/course.types";
import type {
  CourseProgress,
  CurriculumAlignmentAudit,
  MasteryProgressStore,
} from "@/src/lib/progress.types";

export function parseDeferredMuscleIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const ids: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const muscleId = item.trim();

    if (!muscleId || seen.has(muscleId)) {
      continue;
    }

    seen.add(muscleId);
    ids.push(muscleId);
  }

  return ids;
}

export function parseCurriculumAlignmentAudit(
  value: unknown,
): CurriculumAlignmentAudit | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.originalStudyDay !== "number" ||
    !Number.isInteger(record.originalStudyDay) ||
    record.originalStudyDay < 1 ||
    typeof record.adjustedStudyDay !== "number" ||
    !Number.isInteger(record.adjustedStudyDay) ||
    record.adjustedStudyDay < 1 ||
    typeof record.adjustedAt !== "string" ||
    typeof record.reason !== "string" ||
    typeof record.section !== "string"
  ) {
    return undefined;
  }

  return {
    originalStudyDay: record.originalStudyDay,
    adjustedStudyDay: record.adjustedStudyDay,
    adjustedAt: record.adjustedAt,
    reason: record.reason,
    section: record.section,
  };
}

export function getDeferredMuscleIds(progress: CourseProgress): string[] {
  return parseDeferredMuscleIds(progress.deferredMuscleIds);
}

export function isMuscleDeferred(
  progress: CourseProgress,
  muscleId: string,
): boolean {
  return getDeferredMuscleIds(progress).includes(muscleId);
}

function isUnintroduced(progress: CourseProgress, muscleId: string): boolean {
  return !progress.introducedMuscleIds.includes(muscleId);
}

export function selectNewMuscleIds(
  course: Course,
  courseProgress: CourseProgress,
  remainingNewAllowance: number,
): string[] {
  if (remainingNewAllowance <= 0) {
    return [];
  }

  const deferred = new Set(getDeferredMuscleIds(courseProgress));
  const selected: string[] = [];

  const take = (predicate: (muscleId: string) => boolean) => {
    for (const muscleId of course.muscleProfileIds) {
      if (selected.length >= remainingNewAllowance) {
        return;
      }

      if (!isUnintroduced(courseProgress, muscleId) || !predicate(muscleId)) {
        continue;
      }

      selected.push(muscleId);
    }
  };

  take((muscleId) => !deferred.has(muscleId));

  if (selected.length < remainingNewAllowance) {
    take((muscleId) => deferred.has(muscleId));
  }

  return selected;
}

export function withoutIntroducedDeferredMuscles(
  progress: CourseProgress,
  muscleId?: string,
): string[] {
  const introduced = new Set(progress.introducedMuscleIds);

  if (muscleId) {
    introduced.add(muscleId);
  }

  return getDeferredMuscleIds(progress).filter((id) => !introduced.has(id));
}

export function shiftCardReviewStudyDays(
  store: MasteryProgressStore,
  delta: number,
): MasteryProgressStore {
  if (delta === 0) {
    return store;
  }

  const cards: MasteryProgressStore["cards"] = {};

  for (const [rawKey, card] of Object.entries(store.cards)) {
    const key = rawKey as CardProgressKey;
    cards[key] =
      card.nextReviewStudyDay === null
        ? card
        : {
            ...card,
            nextReviewStudyDay: card.nextReviewStudyDay + delta,
          };
  }

  return {
    ...store,
    cards,
  };
}
