import { describe, expect, it, vi } from "vitest";
import {
  JOIN_ACCOUNT_ERROR_MESSAGES,
  submitJoinAccountRequest,
} from "@/src/lib/auth/join-client";

describe("submitJoinAccountRequest", () => {
  it("posts JSON to /api/auth/join", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          username: "Energetic Pencil",
          password: "plant7",
          section: "Testing",
        },
        { status: 201 },
      ),
    );

    const result = await submitJoinAccountRequest(
      "Testing",
      "Testing",
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledWith("/api/auth/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        section: "Testing",
        sectionPassword: "Testing",
      }),
    });
    expect(result.ok).toBe(true);
  });

  it("maps HTTP status codes to user-facing messages", async () => {
    const cases = [
      [400, JOIN_ACCOUNT_ERROR_MESSAGES.invalid],
      [401, JOIN_ACCOUNT_ERROR_MESSAGES.incorrect_password],
      [413, JOIN_ACCOUNT_ERROR_MESSAGES.request_error],
      [500, JOIN_ACCOUNT_ERROR_MESSAGES.server_error],
      [503, JOIN_ACCOUNT_ERROR_MESSAGES.unavailable],
    ] as const;

    for (const [status, message] of cases) {
      const result = await submitJoinAccountRequest(
        "Testing",
        "Testing",
        vi.fn(async () => Response.json({ error: "hidden" }, { status })),
      );

      expect(result).toEqual({
        ok: false,
        kind: expect.any(String),
        message,
      });
    }
  });

  it("returns a retryable network error when fetch fails", async () => {
    const result = await submitJoinAccountRequest(
      "Testing",
      "Testing",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    expect(result).toEqual({
      ok: false,
      kind: "network",
      message: JOIN_ACCOUNT_ERROR_MESSAGES.network,
    });
  });
});
