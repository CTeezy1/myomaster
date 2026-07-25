import {
  normalizeCardCategory,
  parseCardProgressKey,
  type CardCategory,
  type CardProgressKey,
} from "@/src/lib/card-progress-key";
import type {
  CardProgress,
  CreateDefaultCardProgressInput,
  LearningState,
  MasteryProgressStore,
} from "@/src/lib/progress.types";

export const MASTERY_PROGRESS_STORAGE_KEY = "myomaster-mastery-progress";

const STORE_VERSION = 1 as const;

const LEARNING_STATES = [
  "new",
  "learning",
  "review",
  "relearning",
  "mastered",
] as const satisfies readonly LearningState[];

const LEARNING_STATE_SET = new Set<string>(LEARNING_STATES);

function createEmptyStore(): MasteryProgressStore {
  return {
    version: STORE_VERSION,
    cards: {},
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNullableIsoTimestamp(value: unknown): value is string | null {
  if (value === null) {
    return true;
  }

  return typeof value === "string" && value.length > 0;
}

function isLearningState(value: unknown): value is LearningState {
  return typeof value === "string" && LEARNING_STATE_SET.has(value);
}

function parseCardProgress(value: unknown): CardProgress | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const key = record.key;

  if (typeof key !== "string") {
    return null;
  }

  const parsedKey = parseCardProgressKey(key as CardProgressKey);

  if (!parsedKey) {
    return null;
  }

  const muscleId =
    typeof record.muscleId === "string" ? record.muscleId.trim() : "";

  if (!muscleId) {
    return null;
  }

  const category = normalizeCardCategory(String(record.category ?? ""));

  if (!category || category !== parsedKey.category) {
    return null;
  }

  if (parsedKey.profileId !== muscleId) {
    return null;
  }

  if (!isLearningState(record.state)) {
    return null;
  }

  if (
    !isNonNegativeInteger(record.totalAttempts) ||
    !isNonNegativeInteger(record.correctAttempts) ||
    !isNonNegativeInteger(record.partialAttempts) ||
    !isNonNegativeInteger(record.incorrectAttempts) ||
    !isNonNegativeInteger(record.successfulReviewCount) ||
    !isNonNegativeInteger(record.currentIntervalDays) ||
    !isNullableIsoTimestamp(record.lastReviewedAt) ||
    !isNullableIsoTimestamp(record.nextReviewAt)
  ) {
    return null;
  }

  return {
    key: key as CardProgressKey,
    muscleId,
    category,
    state: record.state,
    totalAttempts: record.totalAttempts,
    correctAttempts: record.correctAttempts,
    partialAttempts: record.partialAttempts,
    incorrectAttempts: record.incorrectAttempts,
    successfulReviewCount: record.successfulReviewCount,
    currentIntervalDays: record.currentIntervalDays,
    lastReviewedAt: record.lastReviewedAt,
    nextReviewAt: record.nextReviewAt,
  };
}

function parseMasteryProgressStore(value: unknown): MasteryProgressStore {
  if (!value || typeof value !== "object") {
    return createEmptyStore();
  }

  const record = value as Record<string, unknown>;

  if (record.version !== STORE_VERSION) {
    return createEmptyStore();
  }

  if (!record.cards || typeof record.cards !== "object") {
    return createEmptyStore();
  }

  const cards: Record<CardProgressKey, CardProgress> = {};

  for (const [rawKey, rawProgress] of Object.entries(record.cards)) {
    const parsedKey = parseCardProgressKey(rawKey as CardProgressKey);

    if (!parsedKey) {
      continue;
    }

    const progress = parseCardProgress(rawProgress);

    if (!progress || progress.key !== rawKey) {
      continue;
    }

    cards[rawKey as CardProgressKey] = progress;
  }

  return {
    version: STORE_VERSION,
    cards,
  };
}

function readStore(): MasteryProgressStore {
  if (typeof window === "undefined") {
    return createEmptyStore();
  }

  try {
    const raw = window.localStorage.getItem(MASTERY_PROGRESS_STORAGE_KEY);

    if (!raw) {
      return createEmptyStore();
    }

    return parseMasteryProgressStore(JSON.parse(raw));
  } catch {
    return createEmptyStore();
  }
}

function writeStore(store: MasteryProgressStore) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    MASTERY_PROGRESS_STORAGE_KEY,
    JSON.stringify(store),
  );
}

export function createDefaultCardProgress({
  key,
  muscleId,
  category,
}: CreateDefaultCardProgressInput): CardProgress {
  return {
    key,
    muscleId,
    category,
    state: "new",
    totalAttempts: 0,
    correctAttempts: 0,
    partialAttempts: 0,
    incorrectAttempts: 0,
    successfulReviewCount: 0,
    currentIntervalDays: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
  };
}

export function readMasteryProgress(): MasteryProgressStore {
  return readStore();
}

export function writeMasteryProgress(store: MasteryProgressStore) {
  writeStore(parseMasteryProgressStore(store));
}

export function clearMasteryProgress() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(MASTERY_PROGRESS_STORAGE_KEY);
}

export function getCardProgress(
  key: CardProgressKey,
): CardProgress | undefined {
  return readStore().cards[key];
}

export function upsertCardProgress(progress: CardProgress) {
  const validated = parseCardProgress(progress);

  if (!validated) {
    return;
  }

  const store = readStore();

  store.cards[validated.key] = validated;
  writeStore(store);
}
