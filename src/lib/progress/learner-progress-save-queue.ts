import type { SupabaseClient } from "@supabase/supabase-js";
import {
  collectLocalStudyState,
} from "@/src/lib/progress/learner-progress-snapshot";
import {
  createValidatedPersistedLearnerProgress,
} from "@/src/lib/progress/learner-progress-validation";
import {
  saveLearnerProgressRow,
  type SaveLearnerProgressResult,
} from "@/src/lib/progress/learner-progress-repository";
import type { LearnerProgressSaveStatus } from "@/src/lib/progress/learner-progress.types";

const DEBOUNCE_MS = 500;

export type SaveQueueState = {
  status: LearnerProgressSaveStatus;
  hasExistingRow: boolean;
  expectedRevision: number | null;
  writeGeneration: number;
  pendingImmediate: boolean;
};

export type LearnerProgressSaveQueueOptions = {
  userId: string;
  client: SupabaseClient;
  onStatusChange: (status: LearnerProgressSaveStatus) => void;
  onConflict: () => void;
  getHasExistingRow: () => boolean;
  getExpectedRevision: () => number | null;
  setServerRow: (revision: number, hasExistingRow: boolean) => void;
};

export function createLearnerProgressSaveQueue(
  options: LearnerProgressSaveQueueOptions,
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let followUpQueued = false;
  let saveInProgress = false;
  let invalidationEpoch = 0;
  let destroyed = false;
  let serialSaveTail: Promise<void> = Promise.resolve();

  function setStatus(status: LearnerProgressSaveStatus) {
    options.onStatusChange(status);
  }

  async function performSave(
    saveEpoch: number,
  ): Promise<SaveLearnerProgressResult | null> {
    if (destroyed) {
      return null;
    }

    const progress = createValidatedPersistedLearnerProgress(collectLocalStudyState());

    const result = await saveLearnerProgressRow(
      options.client,
      options.userId,
      progress,
      {
        hasExistingRow: options.getHasExistingRow(),
        expectedRevision: options.getExpectedRevision(),
      },
    );

    if (destroyed || saveEpoch !== invalidationEpoch) {
      return null;
    }

    if (result.ok) {
      options.setServerRow(result.row.revision, true);
      setStatus("saved");
      return result;
    }

    if (result.kind === "conflict") {
      setStatus("conflict");
      options.onConflict();
      return result;
    }

    setStatus("error");
    return result;
  }

  async function executeSave(): Promise<SaveLearnerProgressResult | null> {
    if (destroyed) {
      return null;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    followUpQueued = false;
    saveInProgress = true;
    const saveEpoch = invalidationEpoch;
    setStatus("saving");

    try {
      let result = await performSave(saveEpoch);

      while (followUpQueued && !destroyed) {
        followUpQueued = false;
        result = await performSave(invalidationEpoch);
      }

      return result;
    } finally {
      saveInProgress = false;
    }
  }

  function enqueueSave(): Promise<SaveLearnerProgressResult | null> {
    const next = serialSaveTail.then(() => executeSave());
    serialSaveTail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  function flushInternal(): Promise<SaveLearnerProgressResult | null> {
    return enqueueSave();
  }

  function scheduleSave(immediate = false) {
    if (destroyed) {
      return;
    }

    if (immediate) {
      void enqueueSave();
      return;
    }

    if (saveInProgress) {
      followUpQueued = true;
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    setStatus("saving");
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void enqueueSave();
    }, DEBOUNCE_MS);
  }

  function invalidatePendingWrites() {
    invalidationEpoch += 1;
    followUpQueued = false;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function hasPendingSave(): boolean {
    if (destroyed) {
      return false;
    }

    return debounceTimer !== null || followUpQueued || saveInProgress;
  }

  function destroy() {
    destroyed = true;
    invalidationEpoch += 1;
    followUpQueued = false;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  return {
    scheduleSave,
    flush: flushInternal,
    invalidatePendingWrites,
    hasPendingSave,
    destroy,
  };
}

export const LEARNER_PROGRESS_DEBOUNCE_MS = DEBOUNCE_MS;
