import {
  parseCardProgressKey,
  type CardProgressKey,
} from "@/src/lib/card-progress-key";
import type { CardProgress, CourseProgress, LearningState } from "@/src/lib/progress.types";
import type { MasteryProgressStore } from "@/src/lib/progress.types";

export const LEGACY_MUSCLE_ID_MIGRATIONS = {
  "pectoral-minor": "pectoralis-minor",
  caracobrachialis: "coracobrachialis",
} as const;

export type LegacyMuscleId = keyof typeof LEGACY_MUSCLE_ID_MIGRATIONS;
export type CanonicalMuscleId =
  (typeof LEGACY_MUSCLE_ID_MIGRATIONS)[LegacyMuscleId];

const STATE_RANK: Record<LearningState, number> = {
  new: 0,
  learning: 1,
  relearning: 2,
  review: 3,
  mastered: 4,
};

export function migrateMuscleId(muscleId: string): string {
  return (
    LEGACY_MUSCLE_ID_MIGRATIONS[
      muscleId as LegacyMuscleId
    ] ?? muscleId
  );
}

export function migrateCardProgressKey(key: CardProgressKey): CardProgressKey {
  const parsed = parseCardProgressKey(key);

  if (!parsed) {
    return key;
  }

  const migratedProfileId = migrateMuscleId(parsed.profileId);

  if (migratedProfileId === parsed.profileId) {
    return key;
  }

  return `${migratedProfileId}:${parsed.category}`;
}

function pickLatestIsoTimestamp(
  left: string | null,
  right: string | null,
): string | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function pickEarlierStudyDay(
  left: number | null,
  right: number | null,
): number | null {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return Math.min(left, right);
}

function mergeCardProgress(
  left: CardProgress,
  right: CardProgress,
): CardProgress {
  const [primary, secondary] =
    left.totalAttempts >= right.totalAttempts ? [left, right] : [right, left];

  return {
    ...primary,
    key: primary.key,
    muscleId: migrateMuscleId(primary.muscleId),
    totalAttempts: primary.totalAttempts + secondary.totalAttempts,
    correctAttempts: primary.correctAttempts + secondary.correctAttempts,
    partialAttempts: primary.partialAttempts + secondary.partialAttempts,
    incorrectAttempts: primary.incorrectAttempts + secondary.incorrectAttempts,
    successfulReviewCount: Math.max(
      primary.successfulReviewCount,
      secondary.successfulReviewCount,
    ),
    currentIntervalDays: Math.max(
      primary.currentIntervalDays,
      secondary.currentIntervalDays,
    ),
    state:
      STATE_RANK[primary.state] >= STATE_RANK[secondary.state]
        ? primary.state
        : secondary.state,
    lastReviewedAt: pickLatestIsoTimestamp(
      primary.lastReviewedAt,
      secondary.lastReviewedAt,
    ),
    nextReviewAt: pickLatestIsoTimestamp(primary.nextReviewAt, secondary.nextReviewAt),
    nextReviewStudyDay: pickEarlierStudyDay(
      primary.nextReviewStudyDay,
      secondary.nextReviewStudyDay,
    ),
  };
}

export function migrateMasteryProgressStore(
  store: MasteryProgressStore,
): MasteryProgressStore {
  const cards: Record<CardProgressKey, CardProgress> = {};

  for (const progress of Object.values(store.cards)) {
    const migratedKey = migrateCardProgressKey(progress.key);
    const migratedProgress: CardProgress = {
      ...progress,
      key: migratedKey,
      muscleId: migrateMuscleId(progress.muscleId),
    };
    const existing = cards[migratedKey];

    cards[migratedKey] = existing
      ? mergeCardProgress(existing, migratedProgress)
      : migratedProgress;
  }

  return {
    ...store,
    cards,
  };
}

export function hasLegacyMuscleIds(muscleIds: string[]): boolean {
  return muscleIds.some(
    (muscleId) => muscleId in LEGACY_MUSCLE_ID_MIGRATIONS,
  );
}

function migrateUniqueMuscleIds(muscleIds: string[]): string[] {
  const seen = new Set<string>();
  const migrated: string[] = [];

  for (const muscleId of muscleIds) {
    const nextId = migrateMuscleId(muscleId);

    if (seen.has(nextId)) {
      continue;
    }

    seen.add(nextId);
    migrated.push(nextId);
  }

  return migrated;
}

function migrateRecordKeys<T>(record: Record<string, T>): Record<string, T> {
  const migrated: Record<string, T> = {};

  for (const [key, value] of Object.entries(record)) {
    const nextKey = migrateMuscleId(key);

    if (!(nextKey in migrated)) {
      migrated[nextKey] = value;
    }
  }

  return migrated;
}

export function migrateCarriedOverRetryKeys(
  keys: CardProgressKey[],
): CardProgressKey[] {
  const seen = new Set<CardProgressKey>();
  const migrated: CardProgressKey[] = [];

  for (const key of keys) {
    const nextKey = migrateCardProgressKey(key);

    if (seen.has(nextKey)) {
      continue;
    }

    seen.add(nextKey);
    migrated.push(nextKey);
  }

  return migrated;
}

export function migrateCourseProgress(progress: CourseProgress): CourseProgress {
  return {
    ...progress,
    introducedMuscleIds: migrateUniqueMuscleIds(progress.introducedMuscleIds),
    introductionDates: migrateRecordKeys(progress.introductionDates),
    introductionStudyDays: migrateRecordKeys(progress.introductionStudyDays),
    carriedOverRetryKeys: migrateCarriedOverRetryKeys(progress.carriedOverRetryKeys),
    completedStudyDays: progress.completedStudyDays ?? [],
  };
}

export function migrateViewedMuscleBriefIds(ids: string[]): string[] {
  return migrateUniqueMuscleIds(ids);
}

export function masteryStoreNeedsMuscleIdMigration(
  store: MasteryProgressStore,
): boolean {
  return Object.values(store.cards).some(
    (progress) =>
      progress.muscleId !== migrateMuscleId(progress.muscleId) ||
      progress.key !== migrateCardProgressKey(progress.key),
  );
}

export function courseProgressNeedsMuscleIdMigration(
  progress: CourseProgress,
): boolean {
  return (
    hasLegacyMuscleIds(progress.introducedMuscleIds) ||
    Object.keys(progress.introductionDates).some(
      (muscleId) => muscleId in LEGACY_MUSCLE_ID_MIGRATIONS,
    ) ||
    Object.keys(progress.introductionStudyDays).some(
      (muscleId) => muscleId in LEGACY_MUSCLE_ID_MIGRATIONS,
    ) ||
    progress.carriedOverRetryKeys.some(
      (key) => key !== migrateCardProgressKey(key),
    )
  );
}

export function viewedMuscleBriefIdsNeedMigration(ids: string[]): boolean {
  return hasLegacyMuscleIds(ids);
}
