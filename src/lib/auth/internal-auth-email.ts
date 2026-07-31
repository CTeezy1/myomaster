export const INTERNAL_EMAIL_DOMAIN = "users.myomaster.local";

export function buildInternalAuthEmail(usernameSlug: string): string {
  return `${usernameSlug}@${INTERNAL_EMAIL_DOMAIN}`;
}
