import "server-only";

export const INSTRUCTOR_USER_IDS_ENV_VAR = "INSTRUCTOR_USER_IDS";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseInstructorUserIds(value: string | undefined): Set<string> {
  if (!value) {
    return new Set();
  }

  const ids = new Set<string>();

  for (const part of value.split(",")) {
    const candidate = part.trim().toLowerCase();

    if (!candidate || !UUID_PATTERN.test(candidate)) {
      continue;
    }

    ids.add(candidate);
  }

  return ids;
}

export function getInstructorUserIds(
  env: Record<string, string | undefined> = process.env,
): Set<string> {
  return parseInstructorUserIds(env[INSTRUCTOR_USER_IDS_ENV_VAR]);
}

export function isInstructorUserId(
  userId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!userId) {
    return false;
  }

  return getInstructorUserIds(env).has(userId.trim().toLowerCase());
}
