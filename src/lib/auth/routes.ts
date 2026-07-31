export const LOGIN_PATH = "/login";
export const JOIN_PATH = "/join";
export const HOME_PATH = "/";

export const PUBLIC_PAGE_PATHS = [LOGIN_PATH, JOIN_PATH] as const;

export const PUBLIC_API_PATH_PREFIXES = ["/api/auth/join"] as const;

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isPublicPagePath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return PUBLIC_PAGE_PATHS.some((publicPath) => normalized === publicPath);
}

export function isPublicApiPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return PUBLIC_API_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function isPublicPath(pathname: string): boolean {
  return isPublicPagePath(pathname) || isPublicApiPath(pathname);
}

export function isAuthEntryPath(pathname: string): boolean {
  return isPublicPagePath(pathname);
}

export function resolveAuthRedirect(options: {
  pathname: string;
  isAuthenticated: boolean;
}): string | null {
  const normalizedPath = normalizePathname(options.pathname);

  if (options.isAuthenticated && isAuthEntryPath(normalizedPath)) {
    return HOME_PATH;
  }

  if (!options.isAuthenticated && !isPublicPath(normalizedPath)) {
    return LOGIN_PATH;
  }

  return null;
}
