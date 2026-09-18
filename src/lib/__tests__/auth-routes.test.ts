import { describe, expect, it } from "vitest";
import {
  isPublicApiPath,
  isPublicPagePath,
  isPublicPath,
  resolveAuthRedirect,
} from "@/src/lib/auth/routes";

describe("auth routes", () => {
  it("treats /login and /join as public pages", () => {
    expect(isPublicPagePath("/login")).toBe(true);
    expect(isPublicPagePath("/join")).toBe(true);
    expect(isPublicPagePath("/")).toBe(false);
    expect(isPublicPagePath("/library")).toBe(false);
    expect(isPublicPagePath("/instructor")).toBe(false);
  });

  it("treats /api/auth/join as a public API route", () => {
    expect(isPublicApiPath("/api/auth/join")).toBe(true);
    expect(isPublicPath("/api/auth/join")).toBe(true);
    expect(isPublicApiPath("/api/instructor/roster")).toBe(false);
    expect(isPublicPath("/api/instructor/roster")).toBe(false);
  });

  it("redirects unauthenticated visitors from protected routes to /login", () => {
    expect(
      resolveAuthRedirect({ pathname: "/", isAuthenticated: false }),
    ).toBe("/login");
    expect(
      resolveAuthRedirect({ pathname: "/library", isAuthenticated: false }),
    ).toBe("/login");
    expect(
      resolveAuthRedirect({
        pathname: "/library/hip/psoas-major",
        isAuthenticated: false,
      }),
    ).toBe("/login");
    expect(
      resolveAuthRedirect({ pathname: "/memory-code", isAuthenticated: false }),
    ).toBe("/login");
    expect(
      resolveAuthRedirect({ pathname: "/instructor", isAuthenticated: false }),
    ).toBe("/login");
  });

  it("allows unauthenticated access to public routes", () => {
    expect(
      resolveAuthRedirect({ pathname: "/login", isAuthenticated: false }),
    ).toBeNull();
    expect(
      resolveAuthRedirect({ pathname: "/join", isAuthenticated: false }),
    ).toBeNull();
    expect(
      resolveAuthRedirect({ pathname: "/api/auth/join", isAuthenticated: false }),
    ).toBeNull();
  });

  it("redirects authenticated visitors away from /login and /join", () => {
    expect(
      resolveAuthRedirect({ pathname: "/login", isAuthenticated: true }),
    ).toBe("/");
    expect(
      resolveAuthRedirect({ pathname: "/join", isAuthenticated: true }),
    ).toBe("/");
  });

  it("allows authenticated access to protected routes", () => {
    expect(
      resolveAuthRedirect({ pathname: "/", isAuthenticated: true }),
    ).toBeNull();
    expect(
      resolveAuthRedirect({ pathname: "/library", isAuthenticated: true }),
    ).toBeNull();
    expect(
      resolveAuthRedirect({ pathname: "/memory-code", isAuthenticated: true }),
    ).toBeNull();
    expect(
      resolveAuthRedirect({ pathname: "/instructor", isAuthenticated: true }),
    ).toBeNull();
  });
});
