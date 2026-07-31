import type { CourseSection } from "@/src/lib/profile.types";

export type JoinAccountRequest = {
  section: CourseSection;
  sectionPassword: string;
};

export type JoinAccountSuccessResponse = {
  username: string;
  password: string;
  section: CourseSection;
};

export type JoinAccountErrorResponse = {
  error: string;
};

export const MAX_JOIN_REQUEST_BODY_BYTES = 4096;
export const MAX_SECTION_PASSWORD_LENGTH = 128;
export const MAX_USERNAME_GENERATION_ATTEMPTS = 10;
