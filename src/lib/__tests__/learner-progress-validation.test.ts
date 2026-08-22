import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  parsePersistedLearnerProgress,
  parsePersistedStudyState,
} from "@/src/lib/progress/learner-progress-validation";
import { LEARNER_PROGRESS_SCHEMA_VERSION } from "@/src/lib/progress/learner-progress.types";

describe("learner progress migration sql", () => {
  it("creates learner_progress with RLS and learner-only policies", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260730193000_create_learner_progress.sql",
      ),
      "utf8",
    );
    const grants = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260730194000_grant_auth_tables.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("create table public.learner_progress");
    expect(sql).toContain("progress_data jsonb not null");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain('for select');
    expect(sql).toContain('for insert');
    expect(sql).toContain('for update');
    expect(sql).toContain("auth.uid() = user_id");
    expect(grants).toContain("grant select, insert, update on public.learner_progress to authenticated");
  });
});

describe("parsePersistedLearnerProgress", () => {
  it("accepts a valid progress envelope", () => {
    const parsed = parsePersistedLearnerProgress({
      schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
      savedAt: "2026-07-30T00:00:00.000Z",
      state: {
        courseProgress: { version: 1, courses: {} },
        masteryProgress: { version: 1, cards: {} },
        activeStudySession: null,
        muscleBriefViewedIds: [],
      },
    });

    expect(parsed?.schemaVersion).toBe(LEARNER_PROGRESS_SCHEMA_VERSION);
  });

  it("rejects malformed database payloads safely", () => {
    expect(parsePersistedLearnerProgress(null)).toBeNull();
    expect(parsePersistedLearnerProgress({ schemaVersion: 99 })).toBeNull();
    expect(
      parsePersistedStudyState({
        courseProgress: { version: 2, courses: {} },
        masteryProgress: { version: 1, cards: {} },
        activeStudySession: null,
        muscleBriefViewedIds: [],
      }),
    ).toBeNull();
  });

  it("accepts legacy payloads that omit curriculumId", () => {
    const parsed = parsePersistedLearnerProgress({
      schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
      savedAt: "2026-07-30T00:00:00.000Z",
      state: {
        courseProgress: { version: 1, courses: {} },
        masteryProgress: { version: 1, cards: {} },
        activeStudySession: null,
        muscleBriefViewedIds: [],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.curriculumId).toBeUndefined();
    expect(parsed?.state.curriculumId).toBeUndefined();
  });

  it("rejects unknown curriculum IDs instead of substituting another curriculum", () => {
    expect(
      parsePersistedLearnerProgress({
        schemaVersion: LEARNER_PROGRESS_SCHEMA_VERSION,
        savedAt: "2026-07-30T00:00:00.000Z",
        curriculumId: "upper-first-v2",
        state: {
          courseProgress: { version: 1, courses: {} },
          masteryProgress: { version: 1, cards: {} },
          activeStudySession: null,
          muscleBriefViewedIds: [],
        },
      }),
    ).toBeNull();
    expect(
      parsePersistedStudyState({
        courseProgress: { version: 1, courses: {} },
        masteryProgress: { version: 1, cards: {} },
        activeStudySession: null,
        muscleBriefViewedIds: [],
        curriculumId: "not-a-curriculum",
      }),
    ).toBeNull();
  });
});
