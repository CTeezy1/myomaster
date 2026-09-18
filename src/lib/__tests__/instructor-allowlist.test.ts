import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  getInstructorUserIds,
  INSTRUCTOR_USER_IDS_ENV_VAR,
  isInstructorUserId,
  parseInstructorUserIds,
} from "@/src/lib/auth/instructor-allowlist";

const INSTRUCTOR_UUID = "514bf461-b2d6-416b-8310-5a8ace14e4e0";
const SECOND_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const STUDENT_UUID = "11111111-2222-3333-4444-555555555555";

describe("instructor allowlist", () => {
  const originalValue = process.env[INSTRUCTOR_USER_IDS_ENV_VAR];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[INSTRUCTOR_USER_IDS_ENV_VAR];
    } else {
      process.env[INSTRUCTOR_USER_IDS_ENV_VAR] = originalValue;
    }
  });

  it("recognizes the configured instructor UUID", () => {
    expect(
      isInstructorUserId(INSTRUCTOR_UUID, {
        [INSTRUCTOR_USER_IDS_ENV_VAR]: INSTRUCTOR_UUID,
      }),
    ).toBe(true);
    expect(
      isInstructorUserId(INSTRUCTOR_UUID.toUpperCase(), {
        [INSTRUCTOR_USER_IDS_ENV_VAR]: INSTRUCTOR_UUID,
      }),
    ).toBe(true);
  });

  it("does not recognize an ordinary student UUID", () => {
    expect(
      isInstructorUserId(STUDENT_UUID, {
        [INSTRUCTOR_USER_IDS_ENV_VAR]: INSTRUCTOR_UUID,
      }),
    ).toBe(false);
  });

  it("does not grant access by username", () => {
    expect(
      isInstructorUserId("Agile River", {
        [INSTRUCTOR_USER_IDS_ENV_VAR]: INSTRUCTOR_UUID,
      }),
    ).toBe(false);
    expect(parseInstructorUserIds("Agile River")).toEqual(new Set());
  });

  it("does not grant access by section", () => {
    expect(
      isInstructorUserId("Kinesiology 1", {
        [INSTRUCTOR_USER_IDS_ENV_VAR]: INSTRUCTOR_UUID,
      }),
    ).toBe(false);
    expect(parseInstructorUserIds("Kinesiology 1")).toEqual(new Set());
  });

  it("fails closed when the env value is missing or empty", () => {
    expect(parseInstructorUserIds(undefined).size).toBe(0);
    expect(parseInstructorUserIds("").size).toBe(0);
    expect(parseInstructorUserIds("   ").size).toBe(0);
    expect(isInstructorUserId(INSTRUCTOR_UUID, {})).toBe(false);
    expect(
      isInstructorUserId(INSTRUCTOR_UUID, { [INSTRUCTOR_USER_IDS_ENV_VAR]: "" }),
    ).toBe(false);
  });

  it("parses comma-separated UUIDs", () => {
    const ids = parseInstructorUserIds(` ${INSTRUCTOR_UUID}, ${SECOND_UUID} `);

    expect(ids).toEqual(
      new Set([INSTRUCTOR_UUID, SECOND_UUID]),
    );
    expect(
      isInstructorUserId(SECOND_UUID, {
        [INSTRUCTOR_USER_IDS_ENV_VAR]: `${INSTRUCTOR_UUID},${SECOND_UUID}`,
      }),
    ).toBe(true);
  });

  it("ignores non-UUID tokens in the allowlist", () => {
    expect(
      parseInstructorUserIds(`${INSTRUCTOR_UUID},Agile River,not-a-uuid`),
    ).toEqual(new Set([INSTRUCTOR_UUID]));
  });

  it("reads process.env through the documented server-only variable name", () => {
    process.env[INSTRUCTOR_USER_IDS_ENV_VAR] = INSTRUCTOR_UUID;

    expect(INSTRUCTOR_USER_IDS_ENV_VAR).toBe("INSTRUCTOR_USER_IDS");
    expect(getInstructorUserIds().has(INSTRUCTOR_UUID)).toBe(true);
    expect(isInstructorUserId(INSTRUCTOR_UUID)).toBe(true);
  });

  it("keeps the allowlist server-only and out of public env docs", () => {
    const allowlistSource = readFileSync(
      path.join(process.cwd(), "src/lib/auth/instructor-allowlist.ts"),
      "utf8",
    );
    const envExample = readFileSync(
      path.join(process.cwd(), ".env.example"),
      "utf8",
    );

    expect(allowlistSource).toContain('import "server-only"');
    expect(allowlistSource).not.toContain("NEXT_PUBLIC_INSTRUCTOR_USER_IDS");
    expect(envExample).toContain("INSTRUCTOR_USER_IDS=");
    expect(envExample).not.toContain("NEXT_PUBLIC_INSTRUCTOR_USER_IDS");
    expect(envExample).not.toContain(INSTRUCTOR_UUID);
    expect(envExample).not.toContain("Agile River");
  });
});
