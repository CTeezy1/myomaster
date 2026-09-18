import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isInstructorUserId } from "@/src/lib/auth/instructor-allowlist";
import {
  mapInstructorStudentRow,
  parseInstructorSectionInput,
  type InstructorRosterDto,
} from "@/src/lib/instructor/instructor-student";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/admin";

export type LoadInstructorRosterResult =
  | { ok: true; roster: InstructorRosterDto }
  | {
      ok: false;
      kind: "unauthorized" | "invalid_section" | "load_error";
    };

export type LoadInstructorRosterDependencies = {
  createPrivilegedClient: () => SupabaseClient;
};

const defaultDependencies: LoadInstructorRosterDependencies = {
  createPrivilegedClient: createServiceRoleSupabaseClient,
};

type ProfileRow = {
  id: string;
  username: string;
  section: InstructorRosterDto["section"];
};

type ProgressRow = {
  user_id: string;
  progress_data: unknown;
};

export async function loadInstructorRoster(
  input: {
    userId: string | null | undefined;
    section: unknown;
    now?: Date;
  },
  deps: LoadInstructorRosterDependencies = defaultDependencies,
): Promise<LoadInstructorRosterResult> {
  if (!isInstructorUserId(input.userId)) {
    return { ok: false, kind: "unauthorized" };
  }

  const parsedSection = parseInstructorSectionInput(input.section);

  if (!parsedSection.ok) {
    return { ok: false, kind: "invalid_section" };
  }

  const client = deps.createPrivilegedClient();

  try {
    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("id, username, section")
      .eq("section", parsedSection.section)
      .order("username", { ascending: true });

    if (profileError || !profiles) {
      return { ok: false, kind: "load_error" };
    }

    const typedProfiles = profiles as ProfileRow[];
    const userIds = typedProfiles.map((profile) => profile.id);
    const progressByUserId = new Map<string, unknown>();

    if (userIds.length > 0) {
      const { data: progressRows, error: progressError } = await client
        .from("learner_progress")
        .select("user_id, progress_data")
        .in("user_id", userIds);

      if (progressError || !progressRows) {
        return { ok: false, kind: "load_error" };
      }

      for (const row of progressRows as ProgressRow[]) {
        progressByUserId.set(row.user_id, row.progress_data);
      }
    }

    return {
      ok: true,
      roster: {
        section: parsedSection.section,
        students: typedProfiles.map((profile) =>
          mapInstructorStudentRow({
            username: profile.username,
            section: profile.section,
            progressData: progressByUserId.get(profile.id) ?? null,
            now: input.now,
          }),
        ),
      },
    };
  } catch {
    return { ok: false, kind: "load_error" };
  }
}
