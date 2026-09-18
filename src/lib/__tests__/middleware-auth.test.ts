import { describe, expect, it } from "vitest";
import { resolveAuthRedirect } from "@/src/lib/auth/routes";

describe("middleware auth redirect rules", () => {
  it("allows unauthenticated access to /api/auth/join", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/api/auth/join",
        isAuthenticated: false,
      }),
    ).toBeNull();
  });

  it("redirects authenticated users away from /login without looping to /login", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/login",
        isAuthenticated: true,
      }),
    ).toBe("/");
  });

  it("redirects unauthenticated users from / to /login", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/",
        isAuthenticated: false,
      }),
    ).toBe("/login");
  });

  it("does not redirect authenticated users from protected routes to /login", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/library",
        isAuthenticated: true,
      }),
    ).toBeNull();
    expect(
      resolveAuthRedirect({
        pathname: "/instructor",
        isAuthenticated: true,
      }),
    ).toBeNull();
  });

  it("redirects unauthenticated users from /instructor to /login", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/instructor",
        isAuthenticated: false,
      }),
    ).toBe("/login");
  });
});
