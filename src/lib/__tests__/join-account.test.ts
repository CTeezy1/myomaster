import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/join/route";
import {
  createLearnerAccount,
  parseJoinAccountRequest,
  type JoinAccountDependencies,
} from "@/src/lib/auth/join-account";
import { buildInternalAuthEmail } from "@/src/lib/auth/internal-email";
import {
  generateLearnerPassword,
  isValidGeneratedLearnerPassword,
} from "@/src/lib/auth/password-generator";
import {
  getSectionPasswordEnvVarName,
  SECTION_PASSWORD_ENV_VAR_NAMES,
  validateSectionPassword,
} from "@/src/lib/auth/section-passwords";
import {
  generateLearnerUsername,
  isValidGeneratedUsername,
  isValidGeneratedUsernameSlug,
} from "@/src/lib/auth/username-generator";
import { COURSE_SECTIONS, type CourseSection } from "@/src/lib/profile.types";

const SECTION_ENV_VALUES: Record<CourseSection, string> = {
  Testing: "Testing",
  "Kinesiology 1": "Cowboys1",
  "Kinesiology 2": "Cowboys2",
  "Movement Anatomy 1": "Panda1",
  "Movement Anatomy 2": "Panda2",
};

function setSectionPasswordEnv(): void {
  for (const section of COURSE_SECTIONS) {
    process.env[getSectionPasswordEnvVarName(section)] =
      SECTION_ENV_VALUES[section];
  }
}

function clearSectionPasswordEnv(): void {
  for (const envVarName of Object.values(SECTION_PASSWORD_ENV_VAR_NAMES)) {
    delete process.env[envVarName];
  }
}

function createMockDependencies(
  overrides: Partial<JoinAccountDependencies> = {},
): JoinAccountDependencies {
  return {
    isUsernameSlugAvailable: vi.fn(async () => true),
    createAuthUser: vi.fn(async () => ({ ok: true as const, userId: "user-123" })),
    deleteAuthUser: vi.fn(async () => undefined),
    createProfile: vi.fn(async () => true),
    generateUsername: vi.fn(() => ({
      username: "Energetic Pencil",
      usernameSlug: "energetic-pencil",
    })),
    generatePassword: vi.fn(() => "plant7"),
    ...overrides,
  };
}

describe("section password helpers", () => {
  beforeEach(() => {
    clearSectionPasswordEnv();
    setSectionPasswordEnv();
  });

  it("maps every valid section to the correct environment variable", () => {
    expect(getSectionPasswordEnvVarName("Testing")).toBe(
      "SECTION_PASSWORD_TESTING",
    );
    expect(getSectionPasswordEnvVarName("Kinesiology 1")).toBe(
      "SECTION_PASSWORD_KINESIOLOGY_1",
    );
    expect(getSectionPasswordEnvVarName("Kinesiology 2")).toBe(
      "SECTION_PASSWORD_KINESIOLOGY_2",
    );
    expect(getSectionPasswordEnvVarName("Movement Anatomy 1")).toBe(
      "SECTION_PASSWORD_MOVEMENT_ANATOMY_1",
    );
    expect(getSectionPasswordEnvVarName("Movement Anatomy 2")).toBe(
      "SECTION_PASSWORD_MOVEMENT_ANATOMY_2",
    );
  });

  it("accepts correct section passwords", () => {
    expect(validateSectionPassword("Testing", "Testing")).toBe(true);
    expect(validateSectionPassword("Kinesiology 1", "Cowboys1")).toBe(true);
    expect(validateSectionPassword("Movement Anatomy 2", "Panda2")).toBe(true);
  });

  it("rejects incorrect section passwords", () => {
    expect(validateSectionPassword("Testing", "Wrong")).toBe(false);
    expect(validateSectionPassword("Kinesiology 1", "Cowboys2")).toBe(false);
  });
});

describe("username generation", () => {
  it("generates Adjective Noun display usernames", () => {
    const generated = generateLearnerUsername(() => 0);

    expect(generated.username).toBe("Active Basket");
    expect(isValidGeneratedUsername(generated.username)).toBe(true);
  });

  it("generates lowercase hyphenated slugs", () => {
    const generated = generateLearnerUsername(() => 0);

    expect(generated.usernameSlug).toBe("active-basket");
    expect(isValidGeneratedUsernameSlug(generated.usernameSlug)).toBe(true);
  });
});

describe("password generation", () => {
  it("generates a five-letter lowercase word followed by one digit", () => {
    const password = generateLearnerPassword(() => 0);

    expect(password).toBe("apple0");
    expect(isValidGeneratedLearnerPassword(password)).toBe(true);
  });

  it("uses injected secure random selection instead of Math.random", () => {
    const mathRandomSpy = vi.spyOn(Math, "random");
    const password = generateLearnerPassword((max) => max - 1);

    expect(password.endsWith("9")).toBe(true);
    expect(mathRandomSpy).not.toHaveBeenCalled();

    mathRandomSpy.mockRestore();
  });
});

describe("internal auth email", () => {
  it("builds internal-only auth emails from username slugs", () => {
    expect(buildInternalAuthEmail("energetic-pencil")).toBe(
      "energetic-pencil@users.myomaster.local",
    );
  });
});

describe("createLearnerAccount", () => {
  beforeEach(() => {
    clearSectionPasswordEnv();
    setSectionPasswordEnv();
  });

  it("rejects invalid sections", async () => {
    const result = await createLearnerAccount(
      {
        section: "Kinesiology 3",
        sectionPassword: "Cowboys1",
      },
      createMockDependencies(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects incorrect section passwords without revealing the expected value", async () => {
    const result = await createLearnerAccount(
      {
        section: "Testing",
        sectionPassword: "NotTesting",
      },
      createMockDependencies(),
    );

    expect(result).toEqual({
      ok: false,
      status: 401,
      body: { error: "Unable to create account." },
    });
    expect(JSON.stringify(result)).not.toContain("NotTesting");
  });

  it("retries username generation when a slug collision occurs", async () => {
    const generateUsername = vi
      .fn()
      .mockReturnValueOnce({
        username: "Energetic Pencil",
        usernameSlug: "energetic-pencil",
      })
      .mockReturnValueOnce({
        username: "Active Basket",
        usernameSlug: "active-basket",
      });
    const isUsernameSlugAvailable = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const deps = createMockDependencies({
      generateUsername,
      isUsernameSlugAvailable,
    });

    const result = await createLearnerAccount(
      {
        section: "Testing",
        sectionPassword: "Testing",
      },
      deps,
    );

    expect(result.ok).toBe(true);
    expect(generateUsername).toHaveBeenCalledTimes(2);
    expect(isUsernameSlugAvailable).toHaveBeenCalledTimes(2);
  });

  it("creates a profile after the auth user is created", async () => {
    const deps = createMockDependencies();

    const result = await createLearnerAccount(
      {
        section: "Testing",
        sectionPassword: "Testing",
      },
      deps,
    );

    expect(deps.createAuthUser).toHaveBeenCalledWith({
      email: "energetic-pencil@users.myomaster.local",
      password: "plant7",
      username: "Energetic Pencil",
      section: "Testing",
    });
    expect(deps.createProfile).toHaveBeenCalledWith({
      id: "user-123",
      username: "Energetic Pencil",
      usernameSlug: "energetic-pencil",
      section: "Testing",
    });
    expect(result.ok).toBe(true);
  });

  it("attempts auth user cleanup when profile insertion fails", async () => {
    const deps = createMockDependencies({
      createProfile: vi.fn(async () => false),
    });

    const result = await createLearnerAccount(
      {
        section: "Testing",
        sectionPassword: "Testing",
      },
      deps,
    );

    expect(deps.deleteAuthUser).toHaveBeenCalledWith("user-123");
    expect(result).toEqual({
      ok: false,
      status: 500,
      body: { error: "Unable to create account." },
    });
    if (!result.ok) {
      expect(result.body).not.toHaveProperty("password");
      expect(result.body).not.toHaveProperty("username");
    }
  });

  it("returns only username, password, and section on success", async () => {
    const result = await createLearnerAccount(
      {
        section: "Testing",
        sectionPassword: "Testing",
      },
      createMockDependencies(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toEqual({
        username: "Energetic Pencil",
        password: "plant7",
        section: "Testing",
      });
      expect(result.body).not.toHaveProperty("email");
      expect(result.body).not.toHaveProperty("id");
      expect(result.body).not.toHaveProperty("userId");
    }
  });

  it("rejects malformed and oversized requests", () => {
    expect(parseJoinAccountRequest(null).ok).toBe(false);
    expect(parseJoinAccountRequest({ section: "Testing" }).ok).toBe(false);
    expect(
      parseJoinAccountRequest({
        section: "Testing",
        sectionPassword: "x".repeat(129),
      }).ok,
    ).toBe(false);
  });
});

describe("POST /api/auth/join", () => {
  beforeEach(() => {
    clearSectionPasswordEnv();
    setSectionPasswordEnv();
    vi.restoreAllMocks();
  });

  it("returns concise generic errors for invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request.",
    });
  });

  it("rejects oversized request bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "5000",
        },
        body: JSON.stringify({
          section: "Testing",
          sectionPassword: "Testing",
        }),
      }),
    );

    expect(response.status).toBe(413);
  });

  it("returns a successful join response without exposing internal auth details", async () => {
    vi.spyOn(
      await import("@/src/lib/auth/join-account"),
      "createLearnerAccount",
    ).mockResolvedValue({
      ok: true,
      status: 201,
      body: {
        username: "Energetic Pencil",
        password: "plant7",
        section: "Testing",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "Testing",
          sectionPassword: "Testing",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body).toEqual({
      username: "Energetic Pencil",
      password: "plant7",
      section: "Testing",
    });
    expect(JSON.stringify(body)).not.toContain("@users.myomaster.local");
    expect(body).not.toHaveProperty("id");
  });
});

vi.mock("@/src/lib/supabase/admin", () => ({
  createServiceRoleSupabaseClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { admin: {} },
  })),
}));
