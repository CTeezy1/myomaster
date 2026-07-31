import { describe, expect, it } from "vitest";
import {
  COURSE_SECTIONS,
  isCourseSection,
  type CourseSection,
} from "@/src/lib/profile.types";

describe("profile types", () => {
  it("exposes the five allowed course sections", () => {
    expect(COURSE_SECTIONS).toEqual([
      "Testing",
      "Kinesiology 1",
      "Kinesiology 2",
      "Movement Anatomy 1",
      "Movement Anatomy 2",
    ] satisfies readonly CourseSection[]);
  });

  it("validates allowed section names", () => {
    expect(isCourseSection("Testing")).toBe(true);
    expect(isCourseSection("Kinesiology 1")).toBe(true);
    expect(isCourseSection("Movement Anatomy 2")).toBe(true);
    expect(isCourseSection("Kinesiology 3")).toBe(false);
    expect(isCourseSection("")).toBe(false);
  });
});

describe("supabase env helpers", () => {
  it("requires public Supabase environment variables", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { getPublicSupabaseEnv } = await import("@/src/lib/supabase/env");

    expect(() => getPublicSupabaseEnv()).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );

    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
  });
});
