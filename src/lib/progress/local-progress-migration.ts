import {
  LOCAL_MIGRATION_MARKER_PREFIX,
  LOCAL_PROGRESS_OWNER_STORAGE_KEY,
} from "@/src/lib/progress/learner-progress.types";
import {
  collectLocalStudyState,
  localStudyStateHasActivity,
} from "@/src/lib/progress/learner-progress-snapshot";
import { createValidatedPersistedLearnerProgress } from "@/src/lib/progress/learner-progress-validation";
import type { PersistedLearnerProgress } from "@/src/lib/progress/learner-progress.types";

/**
 * Migration behavior:
 * - Import browser localStorage progress only when the signed-in learner has no database row yet.
 * - Never overwrite an existing database row with localStorage automatically.
 * - Record a per-user migration marker after a successful import so the same user is not re-imported.
 * - Track which authenticated user owns the current browser cache to prevent a second account
 *   on the same browser from inheriting another learner's local cache.
 * - Legacy localStorage without an owner is treated as anonymous beta data and may import once.
 * - Legacy localStorage is retained until import succeeds; after successful database persistence,
 *   the browser cache becomes a mirror of the authenticated learner's database row.
 */

export function getLocalMigrationMarkerKey(userId: string): string {
  return `${LOCAL_MIGRATION_MARKER_PREFIX}${userId}`;
}

export function hasCompletedLocalMigration(userId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getLocalMigrationMarkerKey(userId)) === "1";
}

export function markLocalMigrationComplete(userId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getLocalMigrationMarkerKey(userId), "1");
}

export function getLocalProgressOwner(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(LOCAL_PROGRESS_OWNER_STORAGE_KEY);
}

export function setLocalProgressOwner(userId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_PROGRESS_OWNER_STORAGE_KEY, userId);
}

export function canImportLocalProgressForUser(userId: string): boolean {
  if (hasCompletedLocalMigration(userId)) {
    return false;
  }

  if (!localStudyStateHasActivity()) {
    return false;
  }

  const owner = getLocalProgressOwner();

  if (owner === null) {
    return true;
  }

  return owner === userId;
}

export function buildImportedLearnerProgressFromLocal(): PersistedLearnerProgress {
  return createValidatedPersistedLearnerProgress(collectLocalStudyState());
}

export function shouldUseLocalImport(userId: string, hasDatabaseRow: boolean): boolean {
  return !hasDatabaseRow && canImportLocalProgressForUser(userId);
}
