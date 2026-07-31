import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInternalAuthEmail } from "@/src/lib/auth/internal-email";
import {
  MAX_SECTION_PASSWORD_LENGTH,
  MAX_USERNAME_GENERATION_ATTEMPTS,
  type JoinAccountErrorResponse,
  type JoinAccountSuccessResponse,
} from "@/src/lib/auth/join.types";
import { generateLearnerPassword } from "@/src/lib/auth/password-generator";
import {
  getSectionPassword,
  validateSectionPassword,
} from "@/src/lib/auth/section-passwords";
import { generateLearnerUsername } from "@/src/lib/auth/username-generator";
import type { CourseSection } from "@/src/lib/profile.types";
import { isCourseSection } from "@/src/lib/profile.types";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/admin";

export type CreateAuthUserResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "email_exists" | "unknown" };

export type JoinAccountDependencies = {
  isUsernameSlugAvailable: (usernameSlug: string) => Promise<boolean>;
  createAuthUser: (input: {
    email: string;
    password: string;
    username: string;
    section: CourseSection;
  }) => Promise<CreateAuthUserResult>;
  deleteAuthUser: (userId: string) => Promise<void>;
  createProfile: (input: {
    id: string;
    username: string;
    usernameSlug: string;
    section: CourseSection;
  }) => Promise<boolean>;
  generateUsername: () => { username: string; usernameSlug: string };
  generatePassword: () => string;
};

type ParsedJoinRequest =
  | {
      ok: true;
      section: CourseSection;
      sectionPassword: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type JoinAccountResult =
  | { ok: true; status: 201; body: JoinAccountSuccessResponse }
  | { ok: false; status: number; body: JoinAccountErrorResponse };

function invalidRequest(message = "Invalid request."): ParsedJoinRequest {
  return { ok: false, status: 400, error: message };
}

export function parseJoinAccountRequest(body: unknown): ParsedJoinRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalidRequest();
  }

  const record = body as Record<string, unknown>;
  const section = record.section;
  const sectionPassword = record.sectionPassword;

  if (typeof section !== "string" || typeof sectionPassword !== "string") {
    return invalidRequest();
  }

  if (
    section.length > 64 ||
    sectionPassword.length === 0 ||
    sectionPassword.length > MAX_SECTION_PASSWORD_LENGTH
  ) {
    return invalidRequest();
  }

  if (!isCourseSection(section)) {
    return invalidRequest();
  }

  if (!getSectionPassword(section)) {
    return { ok: false, status: 503, error: "Unable to create account." };
  }

  return {
    ok: true,
    section,
    sectionPassword,
  };
}

async function isUsernameSlugAvailableWithClient(
  client: SupabaseClient,
  usernameSlug: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("username_slug", usernameSlug)
    .maybeSingle();

  if (error) {
    console.error(
      "[join-account] username availability check failed:",
      JSON.stringify(error, Object.getOwnPropertyNames(error)),
    );
    throw new Error("Unable to verify username availability.");
  }

  return data === null;
}

function createDefaultDependencies(
  client: SupabaseClient,
): JoinAccountDependencies {
  return {
    isUsernameSlugAvailable: (usernameSlug) =>
      isUsernameSlugAvailableWithClient(client, usernameSlug),
    createAuthUser: async ({ email, password, username, section }) => {
      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          section,
        },
      });

      if (error) {
        const message = error.message.toLowerCase();

        if (message.includes("already") || message.includes("exists")) {
          return { ok: false, reason: "email_exists" };
        }

        return { ok: false, reason: "unknown" };
      }

      if (!data.user?.id) {
        return { ok: false, reason: "unknown" };
      }

      return { ok: true, userId: data.user.id };
    },
    deleteAuthUser: async (userId) => {
      await client.auth.admin.deleteUser(userId);
    },
    createProfile: async ({ id, username, usernameSlug, section }) => {
      const { error } = await client.from("profiles").insert({
        id,
        username,
        username_slug: usernameSlug,
        section,
      });

      return !error;
    },
    generateUsername: generateLearnerUsername,
    generatePassword: generateLearnerPassword,
  };
}

export async function createLearnerAccount(
  body: unknown,
  deps?: JoinAccountDependencies,
): Promise<JoinAccountResult> {
  const parsed = parseJoinAccountRequest(body);

  if (!parsed.ok) {
    return {
      ok: false,
      status: parsed.status,
      body: { error: parsed.error },
    };
  }

  if (!validateSectionPassword(parsed.section, parsed.sectionPassword)) {
    return {
      ok: false,
      status: 401,
      body: { error: "Unable to create account." },
    };
  }

  const dependencies =
    deps ?? createDefaultDependencies(createServiceRoleSupabaseClient());

  for (
    let attempt = 0;
    attempt < MAX_USERNAME_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    const { username, usernameSlug } = dependencies.generateUsername();
    const password = dependencies.generatePassword();
    const email = buildInternalAuthEmail(usernameSlug);

    const slugAvailable =
      await dependencies.isUsernameSlugAvailable(usernameSlug);

    if (!slugAvailable) {
      continue;
    }

    const authResult = await dependencies.createAuthUser({
      email,
      password,
      username,
      section: parsed.section,
    });

    if (!authResult.ok) {
      if (authResult.reason === "email_exists") {
        continue;
      }

      return {
        ok: false,
        status: 500,
        body: { error: "Unable to create account." },
      };
    }

    const profileCreated = await dependencies.createProfile({
      id: authResult.userId,
      username,
      usernameSlug,
      section: parsed.section,
    });

    if (!profileCreated) {
      try {
        await dependencies.deleteAuthUser(authResult.userId);
      } catch {
        // Best-effort cleanup; do not expose details to the client.
      }

      return {
        ok: false,
        status: 500,
        body: { error: "Unable to create account." },
      };
    }

    return {
      ok: true,
      status: 201,
      body: {
        username,
        password,
        section: parsed.section,
      },
    };
  }

  return {
    ok: false,
    status: 500,
    body: { error: "Unable to create account." },
  };
}

export function createJoinAccountDependencies(
  client: SupabaseClient,
): JoinAccountDependencies {
  return createDefaultDependencies(client);
}
