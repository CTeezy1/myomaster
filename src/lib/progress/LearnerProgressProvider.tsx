"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browser";
import {
  applyCurriculumAssignment,
  createFreshProgressWithPinnedCurriculum,
} from "@/src/lib/progress/curriculum-assignment";
import {
  applyStudyStateToLocal,
  createDefaultPersistedLearnerProgress,
  ensureDefaultCourseInState,
  readCurriculumAssignment,
} from "@/src/lib/progress/learner-progress-snapshot";
import {
  fetchLearnerProgressRow,
  replaceLearnerProgressRow,
  saveLearnerProgressRow,
} from "@/src/lib/progress/learner-progress-repository";
import { createLearnerProgressSaveQueue } from "@/src/lib/progress/learner-progress-save-queue";
import {
  buildImportedLearnerProgressFromLocal,
  markLocalMigrationComplete,
  setLocalProgressOwner,
  shouldUseLocalImport,
} from "@/src/lib/progress/local-progress-migration";
import {
  registerProgressSyncHandlers,
  resetProgressSyncHandlersForTests,
} from "@/src/lib/progress/progress-sync";
import {
  PROGRESS_CONFLICT_MESSAGE,
  PROGRESS_LOAD_ERROR_MESSAGE,
  PROGRESS_SAVE_ERROR_MESSAGE,
  type LearnerProgressSaveStatus,
} from "@/src/lib/progress/learner-progress.types";
import type { Profile } from "@/src/lib/profile.types";

export type LearnerProgressContextState =
  | { status: "loading" }
  | { status: "ready"; hydrationVersion: number }
  | { status: "invalid"; message: string }
  | { status: "conflict"; message: string };

type LearnerProgressContextValue = {
  progressState: LearnerProgressContextState;
  saveStatus: LearnerProgressSaveStatus;
  saveStatusLabel: string | null;
  reloadProgress: () => void;
  startFreshProgress: () => Promise<boolean>;
  retrySave: () => Promise<void>;
  resetLearningProgressRemote: () => Promise<boolean>;
  flushProgressBeforeLogout: () => Promise<boolean>;
  confirmStartFreshOpen: boolean;
  requestStartFresh: () => void;
  cancelStartFresh: () => void;
};

const LearnerProgressContext = createContext<LearnerProgressContextValue | null>(
  null,
);

export function resetLearnerProgressContextForTests() {
  resetProgressSyncHandlersForTests();
}

function getSaveStatusLabel(status: LearnerProgressSaveStatus): string | null {
  switch (status) {
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "error":
      return PROGRESS_SAVE_ERROR_MESSAGE;
    case "conflict":
      return PROGRESS_CONFLICT_MESSAGE;
    default:
      return null;
  }
}

type LearnerProgressProviderProps = {
  profile: Profile;
  children: ReactNode;
};

export function LearnerProgressProvider({
  profile,
  children,
}: LearnerProgressProviderProps) {
  const [progressState, setProgressState] = useState<LearnerProgressContextState>({
    status: "loading",
  });
  const [saveStatus, setSaveStatus] = useState<LearnerProgressSaveStatus>("idle");
  const [confirmStartFreshOpen, setConfirmStartFreshOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [hydrationVersion, setHydrationVersion] = useState(0);

  const hasExistingRowRef = useRef(false);
  const expectedRevisionRef = useRef<number | null>(null);
  const hydrationGenerationRef = useRef(0);
  const saveQueueRef = useRef<ReturnType<typeof createLearnerProgressSaveQueue> | null>(
    null,
  );

  const reloadProgress = useCallback(() => {
    saveQueueRef.current?.invalidatePendingWrites();
    setProgressState({ status: "loading" });
    setReloadToken((current) => current + 1);
  }, []);

  const hydrateProgress = useCallback(async () => {
    const generation = ++hydrationGenerationRef.current;
    const client = createBrowserSupabaseClient();
    const fetchResult = await fetchLearnerProgressRow(client, profile.id);

    if (generation !== hydrationGenerationRef.current) {
      return;
    }

    if (!fetchResult.ok) {
      setProgressState({
        status: "invalid",
        message: PROGRESS_LOAD_ERROR_MESSAGE,
      });
      return;
    }

    let progress = fetchResult.row?.progress_data ?? null;
    hasExistingRowRef.current = Boolean(fetchResult.row);
    expectedRevisionRef.current = fetchResult.row?.revision ?? null;

    if (!progress) {
      if (shouldUseLocalImport(profile.id, false)) {
        const imported = applyCurriculumAssignment(
          ensureDefaultCourseInState(buildImportedLearnerProgressFromLocal()),
          profile.section,
        );

        if (!imported.ok) {
          setProgressState({
            status: "invalid",
            message: PROGRESS_LOAD_ERROR_MESSAGE,
          });
          return;
        }

        progress = imported.progress;
        const importResult = await saveLearnerProgressRow(
          client,
          profile.id,
          progress,
          { hasExistingRow: false, expectedRevision: null },
        );

        if (generation !== hydrationGenerationRef.current) {
          return;
        }

        if (!importResult.ok) {
          setProgressState({
            status: "invalid",
            message: PROGRESS_LOAD_ERROR_MESSAGE,
          });
          return;
        }

        hasExistingRowRef.current = true;
        expectedRevisionRef.current = importResult.row.revision;
        markLocalMigrationComplete(profile.id);
      } else {
        const assignedNew = applyCurriculumAssignment(
          ensureDefaultCourseInState(createDefaultPersistedLearnerProgress()),
          profile.section,
        );

        if (!assignedNew.ok) {
          setProgressState({
            status: "invalid",
            message: PROGRESS_LOAD_ERROR_MESSAGE,
          });
          return;
        }

        progress = assignedNew.progress;
        const createResult = await saveLearnerProgressRow(
          client,
          profile.id,
          progress,
          { hasExistingRow: false, expectedRevision: null },
        );

        if (generation !== hydrationGenerationRef.current) {
          return;
        }

        if (!createResult.ok) {
          setProgressState({
            status: "invalid",
            message: PROGRESS_LOAD_ERROR_MESSAGE,
          });
          return;
        }

        hasExistingRowRef.current = true;
        expectedRevisionRef.current = createResult.row.revision;
      }
    } else {
      const assignedExisting = applyCurriculumAssignment(
        ensureDefaultCourseInState(progress),
        profile.section,
      );

      if (!assignedExisting.ok) {
        setProgressState({
          status: "invalid",
          message: PROGRESS_LOAD_ERROR_MESSAGE,
        });
        return;
      }

      progress = assignedExisting.progress;

      if (assignedExisting.didAssign) {
        const pinResult = await saveLearnerProgressRow(
          client,
          profile.id,
          progress,
          {
            hasExistingRow: hasExistingRowRef.current,
            expectedRevision: expectedRevisionRef.current,
          },
        );

        if (generation !== hydrationGenerationRef.current) {
          return;
        }

        if (pinResult.ok) {
          expectedRevisionRef.current = pinResult.row.revision;
          hasExistingRowRef.current = true;
        }
      }
    }

    if (generation !== hydrationGenerationRef.current) {
      return;
    }

    applyStudyStateToLocal(progress.state);
    setLocalProgressOwner(profile.id);
    setHydrationVersion((current) => {
      const next = current + 1;
      setProgressState({ status: "ready", hydrationVersion: next });
      return next;
    });
  }, [profile.id, profile.section]);

  useEffect(() => {
    let isActive = true;

    async function load() {
      await hydrateProgress();

      if (!isActive) {
        return;
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [hydrateProgress, reloadToken]);

  useEffect(() => {
    const client = createBrowserSupabaseClient();

    const queue = createLearnerProgressSaveQueue({
      userId: profile.id,
      client,
      onStatusChange: setSaveStatus,
      onConflict: () => {
        setProgressState({
          status: "conflict",
          message: PROGRESS_CONFLICT_MESSAGE,
        });
      },
      getHasExistingRow: () => hasExistingRowRef.current,
      getExpectedRevision: () => expectedRevisionRef.current,
      setServerRow: (revision, hasExistingRow) => {
        expectedRevisionRef.current = revision;
        hasExistingRowRef.current = hasExistingRow;
        setLocalProgressOwner(profile.id);
      },
    });

    saveQueueRef.current = queue;

    registerProgressSyncHandlers({
      onChange: () => queue.scheduleSave(false),
      onImmediateChange: () => queue.scheduleSave(true),
    });

    return () => {
      queue.destroy();
      saveQueueRef.current = null;
      registerProgressSyncHandlers(null);
    };
  }, [profile.id]);

  const startFreshProgress = useCallback(async () => {
    const client = createBrowserSupabaseClient();
    const freshProgress = ensureDefaultCourseInState(
      createFreshProgressWithPinnedCurriculum(
        createDefaultPersistedLearnerProgress,
        profile.section,
        readCurriculumAssignment(),
      ),
    );

    saveQueueRef.current?.invalidatePendingWrites();

    const result = await replaceLearnerProgressRow(client, profile.id, freshProgress);

    if (!result.ok) {
      return false;
    }

    hasExistingRowRef.current = true;
    expectedRevisionRef.current = result.row.revision;
    applyStudyStateToLocal(freshProgress.state);
    setLocalProgressOwner(profile.id);
    setConfirmStartFreshOpen(false);
    setSaveStatus("saved");
    setHydrationVersion((current) => {
      const next = current + 1;
      setProgressState({ status: "ready", hydrationVersion: next });
      return next;
    });
    return true;
  }, [profile.id, profile.section]);

  const resetLearningProgressRemote = useCallback(async () => {
    saveQueueRef.current?.invalidatePendingWrites();
    return startFreshProgress();
  }, [startFreshProgress]);

  const retrySave = useCallback(async () => {
    await saveQueueRef.current?.flush();
  }, []);

  const flushProgressBeforeLogout = useCallback(async () => {
    const queue = saveQueueRef.current;

    if (!queue) {
      return true;
    }

    if (!queue.hasPendingSave()) {
      return saveStatus !== "error";
    }

    const result = await queue.flush();

    if (result === null) {
      return false;
    }

    return result.ok;
  }, [saveStatus]);

  const value = useMemo<LearnerProgressContextValue>(
    () => ({
      progressState,
      saveStatus,
      saveStatusLabel: getSaveStatusLabel(saveStatus),
      reloadProgress,
      startFreshProgress,
      retrySave,
      resetLearningProgressRemote,
      flushProgressBeforeLogout,
      confirmStartFreshOpen,
      requestStartFresh: () => setConfirmStartFreshOpen(true),
      cancelStartFresh: () => setConfirmStartFreshOpen(false),
    }),
    [
      confirmStartFreshOpen,
      flushProgressBeforeLogout,
      progressState,
      reloadProgress,
      resetLearningProgressRemote,
      retrySave,
      saveStatus,
      startFreshProgress,
    ],
  );

  return (
    <LearnerProgressContext.Provider value={value}>
      {children}
    </LearnerProgressContext.Provider>
  );
}

export function useLearnerProgress() {
  const context = useContext(LearnerProgressContext);

  if (!context) {
    throw new Error("useLearnerProgress must be used within LearnerProgressProvider");
  }

  return context;
}

export function useOptionalLearnerProgress() {
  return useContext(LearnerProgressContext);
}
