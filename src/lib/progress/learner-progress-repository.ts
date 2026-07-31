import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLearnerProgressRowData } from "@/src/lib/progress/learner-progress-validation";
import type {
  LearnerProgressRow,
  PersistedLearnerProgress,
} from "@/src/lib/progress/learner-progress.types";

export type FetchLearnerProgressResult =
  | { ok: true; row: LearnerProgressRow | null }
  | { ok: false; kind: "load_error" };

export type SaveLearnerProgressResult =
  | { ok: true; row: LearnerProgressRow }
  | { ok: false; kind: "conflict" | "save_error" };

function parseLearnerProgressRow(data: {
  user_id: string;
  progress_data: unknown;
  revision: number;
  updated_at: string;
}): LearnerProgressRow | null {
  const progress = parseLearnerProgressRowData(data.progress_data);

  if (!progress) {
    return null;
  }

  return {
    user_id: data.user_id,
    progress_data: progress,
    revision: data.revision,
    updated_at: data.updated_at,
  };
}

export async function fetchLearnerProgressRow(
  client: SupabaseClient,
  userId: string,
): Promise<FetchLearnerProgressResult> {
  try {
    const { data, error } = await client
      .from("learner_progress")
      .select("user_id, progress_data, revision, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return { ok: false, kind: "load_error" };
    }

    if (!data) {
      return { ok: true, row: null };
    }

    const row = parseLearnerProgressRow(data);

    if (!row) {
      return { ok: false, kind: "load_error" };
    }

    return { ok: true, row };
  } catch {
    return { ok: false, kind: "load_error" };
  }
}

export async function insertLearnerProgressRow(
  client: SupabaseClient,
  userId: string,
  progress: PersistedLearnerProgress,
): Promise<SaveLearnerProgressResult> {
  try {
    const { data, error } = await client
      .from("learner_progress")
      .insert({
        user_id: userId,
        progress_data: progress,
      })
      .select("user_id, progress_data, revision, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        const existing = await fetchLearnerProgressRow(client, userId);

        if (existing.ok && existing.row) {
          return { ok: true, row: existing.row };
        }
      }

      return { ok: false, kind: "save_error" };
    }

    if (!data) {
      return { ok: false, kind: "save_error" };
    }

    const row = parseLearnerProgressRow(data);

    if (!row) {
      return { ok: false, kind: "save_error" };
    }

    return { ok: true, row };
  } catch {
    return { ok: false, kind: "save_error" };
  }
}

export async function updateLearnerProgressRow(
  client: SupabaseClient,
  userId: string,
  progress: PersistedLearnerProgress,
  expectedRevision: number,
): Promise<SaveLearnerProgressResult> {
  try {
    const { data, error } = await client
      .from("learner_progress")
      .update({
        progress_data: progress,
      })
      .eq("user_id", userId)
      .eq("revision", expectedRevision)
      .select("user_id, progress_data, revision, updated_at")
      .maybeSingle();

    if (error) {
      return { ok: false, kind: "save_error" };
    }

    if (!data) {
      return { ok: false, kind: "conflict" };
    }

    const row = parseLearnerProgressRow(data);

    if (!row) {
      return { ok: false, kind: "save_error" };
    }

    return { ok: true, row };
  } catch {
    return { ok: false, kind: "save_error" };
  }
}

export async function saveLearnerProgressRow(
  client: SupabaseClient,
  userId: string,
  progress: PersistedLearnerProgress,
  options: {
    hasExistingRow: boolean;
    expectedRevision: number | null;
  },
): Promise<SaveLearnerProgressResult> {
  if (!options.hasExistingRow) {
    return insertLearnerProgressRow(client, userId, progress);
  }

  if (options.expectedRevision === null) {
    return { ok: false, kind: "save_error" };
  }

  return updateLearnerProgressRow(
    client,
    userId,
    progress,
    options.expectedRevision,
  );
}

export async function replaceLearnerProgressRow(
  client: SupabaseClient,
  userId: string,
  progress: PersistedLearnerProgress,
): Promise<SaveLearnerProgressResult> {
  try {
    const { data, error } = await client
      .from("learner_progress")
      .upsert(
        {
          user_id: userId,
          progress_data: progress,
        },
        { onConflict: "user_id" },
      )
      .select("user_id, progress_data, revision, updated_at")
      .single();

    if (error || !data) {
      return { ok: false, kind: "save_error" };
    }

    const row = parseLearnerProgressRow(data);

    if (!row) {
      return { ok: false, kind: "save_error" };
    }

    return { ok: true, row };
  } catch {
    return { ok: false, kind: "save_error" };
  }
}
