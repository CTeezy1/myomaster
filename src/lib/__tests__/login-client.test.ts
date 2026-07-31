import { describe, expect, it, vi } from "vitest";
import {
  buildLoginEmailFromUsername,
  LOGIN_INVALID_CREDENTIALS_MESSAGE,
  LOGIN_SERVICE_ERROR_MESSAGE,
  signInLearner,
} from "@/src/lib/auth/login-client";

describe("login client", () => {
  it("constructs the correct internal email from a display username", () => {
    expect(buildLoginEmailFromUsername("Energetic Pencil")).toBe(
      "energetic-pencil@users.myomaster.local",
    );
  });

  it("rejects invalid usernames before calling Supabase", async () => {
    const signInWithPassword = vi.fn();
    const result = await signInLearner("bad@user", "secret1", {
      auth: { signInWithPassword },
    });

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      kind: "invalid_credentials",
      message: LOGIN_INVALID_CREDENTIALS_MESSAGE,
    });
  });

  it("calls signInWithPassword with the internal email", async () => {
    const signInWithPassword = vi.fn(async () => ({ error: null }));
    const result = await signInLearner("Energetic Pencil", "plant7", {
      auth: { signInWithPassword },
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "energetic-pencil@users.myomaster.local",
      password: "plant7",
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns a generic invalid-credentials message", async () => {
    const result = await signInLearner("Energetic Pencil", "wrong", {
      auth: {
        signInWithPassword: vi.fn(async () => ({
          error: { message: "Invalid login credentials" },
        })),
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "invalid_credentials",
      message: LOGIN_INVALID_CREDENTIALS_MESSAGE,
    });
    expect(JSON.stringify(result)).not.toContain("@users.myomaster.local");
  });

  it("does not reveal whether the username exists", async () => {
    const invalidUsernameResult = await signInLearner("!!!", "secret1", {
      auth: { signInWithPassword: vi.fn() },
    });
    const invalidPasswordResult = await signInLearner("Energetic Pencil", "wrong", {
      auth: {
        signInWithPassword: vi.fn(async () => ({
          error: { message: "Invalid login credentials" },
        })),
      },
    });

    expect(invalidUsernameResult.ok).toBe(false);
    expect(invalidPasswordResult.ok).toBe(false);
    if (!invalidUsernameResult.ok && !invalidPasswordResult.ok) {
      expect(invalidUsernameResult.message).toBe(
        invalidPasswordResult.message,
      );
    }
  });

  it("returns a service error for network failures", async () => {
    const result = await signInLearner("Energetic Pencil", "plant7", {
      auth: {
        signInWithPassword: vi.fn(async () => {
          throw new Error("Failed to fetch");
        }),
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "service_error",
      message: LOGIN_SERVICE_ERROR_MESSAGE,
    });
  });
});
