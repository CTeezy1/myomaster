import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  APPLY_KINESIOLOGY_1_HIP_ALIGNMENT_ENV,
  APPLY_KINESIOLOGY_1_HIP_ALIGNMENT_VALUE,
  buildKinesiology1HipStudentReport,
  KINESIOLOGY_1_SECTION,
  planKinesiology1HipAlignment,
  planKinesiology1HipRollback,
  ROLLBACK_KINESIOLOGY_1_HIP_ALIGNMENT_ENV,
  ROLLBACK_KINESIOLOGY_1_HIP_ALIGNMENT_VALUE,
  type Kinesiology1HipStudentReport,
} from "@/src/lib/kinesiology-1-hip-alignment";
import { parsePersistedLearnerProgress } from "@/src/lib/progress/learner-progress-validation";
import { updateLearnerProgressRow } from "@/src/lib/progress/learner-progress-repository";
import type { PersistedLearnerProgress } from "@/src/lib/progress/learner-progress.types";

type ProfileRow = {
  id: string;
  username: string;
  section: string;
};

type ProgressRow = {
  user_id: string;
  revision: number;
  updated_at: string;
  progress_data: unknown;
};

type ApplyManifestStudent = {
  userId: string;
  username: string;
  originalRevision: number;
  appliedRevision: number;
  originalProgress: PersistedLearnerProgress;
  appliedProgress: PersistedLearnerProgress;
};

type ApplyManifest = {
  createdAt: string;
  section: typeof KINESIOLOGY_1_SECTION;
  mode: "apply";
  students: ApplyManifestStudent[];
};

function loadLocalEnv() {
  const contents = readFileSync(".env.local", "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function createLocalDataDir(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = path.join(
    process.cwd(),
    "local-data",
    "kinesiology-1-hip-alignment",
    stamp,
  );
  mkdirSync(directory, { recursive: true });
  return directory;
}

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase environment for the Kinesiology 1 hip script.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadKinesiology1Rows(client: SupabaseClient): Promise<{
  profiles: ProfileRow[];
  progressByUserId: Map<string, ProgressRow>;
}> {
  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id, username, section")
    .eq("section", KINESIOLOGY_1_SECTION)
    .order("username", { ascending: true });

  if (profileError || !profiles) {
    throw new Error(profileError?.message ?? "Failed to read Kinesiology 1 profiles");
  }

  const typedProfiles = profiles.map((profile) => ({
    id: String(profile.id),
    username: String(profile.username),
    section: String(profile.section),
  }));

  const unexpectedSection = typedProfiles.find(
    (profile) => profile.section !== KINESIOLOGY_1_SECTION,
  );

  if (unexpectedSection) {
    throw new Error(
      `Refusing to continue: profile ${unexpectedSection.username} is not ${KINESIOLOGY_1_SECTION}.`,
    );
  }

  const userIds = typedProfiles.map((profile) => profile.id);
  const { data: progressRows, error: progressError } =
    userIds.length === 0
      ? { data: [], error: null }
      : await client
          .from("learner_progress")
          .select("user_id, revision, updated_at, progress_data")
          .in("user_id", userIds);

  if (progressError || !progressRows) {
    throw new Error(progressError?.message ?? "Failed to read learner_progress");
  }

  return {
    profiles: typedProfiles,
    progressByUserId: new Map(
      progressRows.map((row) => [
        String(row.user_id),
        {
          user_id: String(row.user_id),
          revision: Number(row.revision),
          updated_at: String(row.updated_at),
          progress_data: row.progress_data,
        },
      ]),
    ),
  };
}

function buildReports(
  profiles: ProfileRow[],
  progressByUserId: Map<string, ProgressRow>,
  now: Date,
): {
  reports: Kinesiology1HipStudentReport[];
  snapshots: Array<{
    userId: string;
    username: string;
    revision: number;
    updatedAt: string;
    progress: PersistedLearnerProgress;
  }>;
} {
  const snapshots: Array<{
    userId: string;
    username: string;
    revision: number;
    updatedAt: string;
    progress: PersistedLearnerProgress;
  }> = [];

  const reports = profiles.map((profile) => {
    const row = progressByUserId.get(profile.id);
    const parsed = row ? parsePersistedLearnerProgress(row.progress_data) : null;
    const plan = parsed ? planKinesiology1HipAlignment(parsed, now) : null;

    if (row && parsed) {
      snapshots.push({
        userId: profile.id,
        username: profile.username,
        revision: row.revision,
        updatedAt: row.updated_at,
        progress: parsed,
      });
    }

    return buildKinesiology1HipStudentReport({
      userId: profile.id,
      username: profile.username,
      section: profile.section,
      revision: row?.revision ?? null,
      original: parsed,
      plan,
    });
  });

  return { reports, snapshots };
}

function summarize(reports: Kinesiology1HipStudentReport[]) {
  return {
    section: KINESIOLOGY_1_SECTION,
    totalStudents: reports.length,
    adjustCount: reports.filter((report) => report.action === "adjust").length,
    unchangedCount: reports.filter((report) => report.action === "unchanged").length,
    missingOrUnparsed: reports.filter(
      (report) =>
        report.action === "missing-progress" || report.action === "unparsed-progress",
    ),
    overdueWouldBlockHip: reports.filter(
      (report) =>
        report.action === "adjust" &&
        report.predictedNextSession?.overdueBlocksNewMuscles === true,
    ),
    nextSessionNotHip: reports.filter(
      (report) =>
        report.action === "adjust" &&
        !(report.predictedNextSession?.newMuscleIds.includes("gluteus-maximus") ?? false),
    ),
    alreadyAtHip: reports
      .filter((report) => report.action === "unchanged")
      .map((report) => ({
        username: report.username,
        currentStudyDay: report.originalStudyDay,
        revision: report.revision,
      })),
    students: reports.map((report) => ({
      username: report.username,
      action: report.action,
      originalStudyDay: report.originalStudyDay,
      proposedStudyDay: report.proposedStudyDay,
      reviewDayDelta: report.reviewDayDelta,
      deferredCount: report.deferredMuscleIds.length,
      clearActiveSession: report.clearActiveSession,
      predictedNextMuscles: report.predictedNextSession?.newMuscleNames ?? [],
      overdueBlocksNewMuscles:
        report.predictedNextSession?.overdueBlocksNewMuscles ?? false,
      historyPreserved:
        report.introducedMuscleIdsUnchanged &&
        report.completedStudyDaysUnchanged &&
        report.studyDayCompletionsUnchanged &&
        report.recentGradesUnchanged &&
        report.masteryAttemptsUnchanged,
    })),
  };
}

async function runDryRun(client: SupabaseClient) {
  const now = new Date();
  const { profiles, progressByUserId } = await loadKinesiology1Rows(client);
  const { reports, snapshots } = buildReports(profiles, progressByUserId, now);
  const directory = createLocalDataDir();
  const reportPath = path.join(directory, "dry-run-report.json");
  const snapshotPath = path.join(directory, "read-snapshot.json");

  writeJson(reportPath, {
    createdAt: now.toISOString(),
    mode: "dry-run",
    productionWrites: false,
    summary: summarize(reports),
    students: reports,
  });
  writeJson(snapshotPath, {
    createdAt: now.toISOString(),
    section: KINESIOLOGY_1_SECTION,
    snapshots,
  });

  return {
    directory,
    reportPath,
    snapshotPath,
    summary: summarize(reports),
  };
}

async function runApply(client: SupabaseClient) {
  if (
    process.env[APPLY_KINESIOLOGY_1_HIP_ALIGNMENT_ENV] !==
    APPLY_KINESIOLOGY_1_HIP_ALIGNMENT_VALUE
  ) {
    throw new Error(
      `Refusing --apply. Set ${APPLY_KINESIOLOGY_1_HIP_ALIGNMENT_ENV}=${APPLY_KINESIOLOGY_1_HIP_ALIGNMENT_VALUE} only after explicit production approval.`,
    );
  }

  const now = new Date();
  const { profiles, progressByUserId } = await loadKinesiology1Rows(client);
  const { reports, snapshots } = buildReports(profiles, progressByUserId, now);
  const directory = createLocalDataDir();
  const manifest: ApplyManifest = {
    createdAt: now.toISOString(),
    section: KINESIOLOGY_1_SECTION,
    mode: "apply",
    students: [],
  };

  writeJson(path.join(directory, "pre-apply-snapshot.json"), {
    createdAt: now.toISOString(),
    snapshots,
  });
  writeJson(path.join(directory, "pre-apply-report.json"), {
    createdAt: now.toISOString(),
    students: reports,
  });

  for (const profile of profiles) {
    const row = progressByUserId.get(profile.id);

    if (!row) {
      continue;
    }

    const parsed = parsePersistedLearnerProgress(row.progress_data);

    if (!parsed) {
      throw new Error(`Refusing apply: unparsed progress for ${profile.username}.`);
    }

    const plan = planKinesiology1HipAlignment(parsed, now);

    if (plan.action === "unchanged") {
      continue;
    }

    const saved = await updateLearnerProgressRow(
      client,
      profile.id,
      plan.progress,
      row.revision,
    );

    if (!saved.ok) {
      throw new Error(
        `Apply stopped on ${profile.username}: ${saved.kind}. Later rows were not written. Use the snapshot plus revision checks for rollback.`,
      );
    }

    manifest.students.push({
      userId: profile.id,
      username: profile.username,
      originalRevision: row.revision,
      appliedRevision: saved.row.revision,
      originalProgress: parsed,
      appliedProgress: saved.row.progress_data,
    });
  }

  const manifestPath = path.join(directory, "apply-manifest.json");
  writeJson(manifestPath, manifest);
  return { directory, manifestPath, appliedCount: manifest.students.length };
}

async function runRollback(client: SupabaseClient, manifestPath: string) {
  if (
    process.env[ROLLBACK_KINESIOLOGY_1_HIP_ALIGNMENT_ENV] !==
    ROLLBACK_KINESIOLOGY_1_HIP_ALIGNMENT_VALUE
  ) {
    throw new Error(
      `Refusing --rollback. Set ${ROLLBACK_KINESIOLOGY_1_HIP_ALIGNMENT_ENV}=${ROLLBACK_KINESIOLOGY_1_HIP_ALIGNMENT_VALUE} only after explicit production approval.`,
    );
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ApplyManifest;

  if (manifest.section !== KINESIOLOGY_1_SECTION || manifest.mode !== "apply") {
    throw new Error("Rollback manifest is not a Kinesiology 1 hip apply manifest.");
  }

  const results: Array<{
    username: string;
    action: string;
    reason?: string;
  }> = [];

  for (const student of manifest.students) {
    const { data, error } = await client
      .from("learner_progress")
      .select("user_id, revision, progress_data")
      .eq("user_id", student.userId)
      .maybeSingle();

    if (error || !data) {
      results.push({ username: student.username, action: "skip", reason: "missing-row" });
      continue;
    }

    const currentProgress = parsePersistedLearnerProgress(data.progress_data);

    if (!currentProgress) {
      results.push({
        username: student.username,
        action: "skip",
        reason: "unparsed-progress",
      });
      continue;
    }

    const decision = planKinesiology1HipRollback({
      originalProgress: student.originalProgress,
      originalRevision: student.originalRevision,
      appliedRevision: student.appliedRevision,
      appliedProgress: student.appliedProgress,
      currentProgress,
      currentRevision: Number(data.revision),
    });

    if (decision.action === "skip") {
      results.push({
        username: student.username,
        action: "skip",
        reason: decision.reason,
      });
      continue;
    }

    const saved = await updateLearnerProgressRow(
      client,
      student.userId,
      decision.progress,
      decision.expectedRevision,
    );

    if (!saved.ok) {
      results.push({
        username: student.username,
        action: "skip",
        reason: saved.kind,
      });
      continue;
    }

    results.push({ username: student.username, action: "restored" });
  }

  const directory = createLocalDataDir();
  const resultPath = path.join(directory, "rollback-result.json");
  writeJson(resultPath, {
    createdAt: new Date().toISOString(),
    manifestPath,
    results,
  });
  return { directory, resultPath, results };
}

loadLocalEnv();

const client = createServiceClient();
const apply = hasFlag("--apply");
const rollbackPath = getArgValue("--rollback");

if (apply && rollbackPath) {
  throw new Error("Use either --apply or --rollback, not both.");
}

if (apply) {
  const result = await runApply(client);
  console.log(JSON.stringify({ mode: "apply", ...result }, null, 2));
} else if (rollbackPath) {
  const result = await runRollback(client, rollbackPath);
  console.log(JSON.stringify({ mode: "rollback", ...result }, null, 2));
} else {
  const result = await runDryRun(client);
  console.log(JSON.stringify({ mode: "dry-run", ...result }, null, 2));
}
