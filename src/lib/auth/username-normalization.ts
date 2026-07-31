export const MAX_USERNAME_LENGTH = 64;

const USERNAME_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type UsernameNormalizationResult =
  | { ok: true; slug: string }
  | { ok: false };

export function normalizeUsernameToSlug(
  input: string,
): UsernameNormalizationResult {
  const trimmed = input.trim();

  if (!trimmed || trimmed.length > MAX_USERNAME_LENGTH) {
    return { ok: false };
  }

  let slug = trimmed.toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-");

  slug = slug.replace(/^-+|-+$/g, "");

  if (!slug || !USERNAME_SLUG_PATTERN.test(slug)) {
    return { ok: false };
  }

  return { ok: true, slug };
}
