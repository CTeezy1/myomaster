import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/instructor/roster/route";
import { loadInstructorRoster } from "@/src/lib/instructor/load-instructor-roster";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

vi.mock("@/src/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/src/lib/instructor/load-instructor-roster", () => ({
  loadInstructorRoster: vi.fn(),
}));

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockedLoadInstructorRoster = vi.mocked(loadInstructorRoster);

const INSTRUCTOR_UUID = "514bf461-b2d6-416b-8310-5a8ace14e4e0";
const STUDENT_UUID = "11111111-2222-3333-4444-555555555555";

function mockSessionUser(userId: string | null) {
  mockedCreateServerSupabaseClient.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  } as never);
}

describe("GET /api/instructor/roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorizes from the server session user id, not request-supplied identity", async () => {
    mockSessionUser(INSTRUCTOR_UUID);
    mockedLoadInstructorRoster.mockResolvedValue({
      ok: true,
      roster: { section: "Kinesiology 1", students: [] },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/instructor/roster?section=Kinesiology%201&userId=11111111-2222-3333-4444-555555555555&username=Agile%20River",
      ),
    );

    expect(mockedLoadInstructorRoster).toHaveBeenCalledWith({
      userId: INSTRUCTOR_UUID,
      section: "Kinesiology 1",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      section: "Kinesiology 1",
      students: [],
    });
  });

  it("returns no roster data for an authenticated student", async () => {
    mockSessionUser(STUDENT_UUID);
    mockedLoadInstructorRoster.mockResolvedValue({
      ok: false,
      kind: "unauthorized",
    });

    const response = await GET(
      new Request("http://localhost/api/instructor/roster?section=Kinesiology%201"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Not found." });
    expect(body).not.toHaveProperty("students");
    expect(mockedLoadInstructorRoster).toHaveBeenCalledWith({
      userId: STUDENT_UUID,
      section: "Kinesiology 1",
    });
  });

  it("rejects an invalid section", async () => {
    mockSessionUser(INSTRUCTOR_UUID);
    mockedLoadInstructorRoster.mockResolvedValue({
      ok: false,
      kind: "invalid_section",
    });

    const response = await GET(
      new Request("http://localhost/api/instructor/roster?section=not-a-section"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid section." });
  });
});
