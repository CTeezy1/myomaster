import { describe, expect, it } from "vitest";
import { buildInternalAuthEmail } from "@/src/lib/auth/internal-auth-email";
import { normalizeUsernameToSlug } from "@/src/lib/auth/username-normalization";

describe("normalizeUsernameToSlug", () => {
  it("handles capitalization and extra spaces", () => {
    expect(normalizeUsernameToSlug("  Energetic Pencil  ")).toEqual({
      ok: true,
      slug: "energetic-pencil",
    });
    expect(normalizeUsernameToSlug("ENERGETIC PENCIL")).toEqual({
      ok: true,
      slug: "energetic-pencil",
    });
  });

  it("accepts a hyphenated username", () => {
    expect(normalizeUsernameToSlug("energetic-pencil")).toEqual({
      ok: true,
      slug: "energetic-pencil",
    });
  });

  it("rejects unsupported characters", () => {
    expect(normalizeUsernameToSlug("user@name")).toEqual({ ok: false });
    expect(normalizeUsernameToSlug("user_name")).toEqual({ ok: false });
    expect(normalizeUsernameToSlug("")).toEqual({ ok: false });
    expect(normalizeUsernameToSlug("   ")).toEqual({ ok: false });
    expect(normalizeUsernameToSlug("a".repeat(65))).toEqual({ ok: false });
  });
});

describe("buildInternalAuthEmail", () => {
  it("builds the internal auth email from a slug", () => {
    expect(buildInternalAuthEmail("energetic-pencil")).toBe(
      "energetic-pencil@users.myomaster.local",
    );
  });
});
