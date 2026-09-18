import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

describe("instructor route security wiring", () => {
  it("denies non-instructors at the /instructor page before loading roster data", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app/(authenticated)/instructor/page.tsx"),
      "utf8",
    );

    expect(page).toContain("isInstructorUserId(user?.id)");
    expect(page).toContain("notFound()");
    expect(page).toContain("loadInstructorRoster");
    expect(page).not.toContain("NEXT_PUBLIC_INSTRUCTOR_USER_IDS");
    expect(page).not.toContain("createServiceRoleSupabaseClient");
  });

  it("does not add a database migration for instructor access", () => {
    const migrations = readdirSync(
      path.join(process.cwd(), "supabase/migrations"),
    );

    expect(migrations.every((name) => !name.toLowerCase().includes("instructor"))).toBe(
      true,
    );
  });

  it("keeps learner_progress own-row RLS unchanged", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260730193000_create_learner_progress.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("auth.uid() = user_id");
    expect(sql).not.toContain("instructor");
  });
});
