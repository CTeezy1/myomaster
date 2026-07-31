import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { CourseSection } from "@/src/lib/profile.types";
import { isCourseSection } from "@/src/lib/profile.types";

export const SECTION_PASSWORD_ENV_VAR_NAMES = {
  Testing: "SECTION_PASSWORD_TESTING",
  "Kinesiology 1": "SECTION_PASSWORD_KINESIOLOGY_1",
  "Kinesiology 2": "SECTION_PASSWORD_KINESIOLOGY_2",
  "Movement Anatomy 1": "SECTION_PASSWORD_MOVEMENT_ANATOMY_1",
  "Movement Anatomy 2": "SECTION_PASSWORD_MOVEMENT_ANATOMY_2",
} as const satisfies Record<CourseSection, string>;

export function getSectionPasswordEnvVarName(
  section: CourseSection,
): string {
  return SECTION_PASSWORD_ENV_VAR_NAMES[section];
}

export function getSectionPassword(section: CourseSection): string | null {
  const envVarName = getSectionPasswordEnvVarName(section);
  const value = process.env[envVarName];

  if (!value) {
    return null;
  }

  return value;
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    timingSafeEqual(leftBuffer, leftBuffer);
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function validateSectionPassword(
  section: CourseSection,
  providedPassword: string,
): boolean {
  const expectedPassword = getSectionPassword(section);

  if (!expectedPassword) {
    return false;
  }

  return timingSafeEqualString(providedPassword, expectedPassword);
}

export function isConfiguredSection(section: string): section is CourseSection {
  return isCourseSection(section) && getSectionPassword(section) !== null;
}
