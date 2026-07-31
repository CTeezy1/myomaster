import { buildInternalAuthEmail } from "@/src/lib/auth/internal-auth-email";
import { normalizeUsernameToSlug } from "@/src/lib/auth/username-normalization";

export const LOGIN_INVALID_CREDENTIALS_MESSAGE =
  "Incorrect username or password.";

export const LOGIN_SERVICE_ERROR_MESSAGE =
  "Unable to sign in right now. Check your connection and try again.";

export type LoginClientErrorKind = "invalid_credentials" | "service_error";

export type LoginClientResult =
  | { ok: true }
  | { ok: false; kind: LoginClientErrorKind; message: string };

export type SignInLearnerClient = {
  auth: {
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{ error: { message?: string; name?: string } | null }>;
  };
};

function isServiceError(error: { message?: string; name?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  const name = (error.name ?? "").toLowerCase();

  return (
    name.includes("fetch") ||
    name.includes("network") ||
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("failed to fetch")
  );
}

export function buildLoginEmailFromUsername(username: string): string | null {
  const normalized = normalizeUsernameToSlug(username);

  if (!normalized.ok) {
    return null;
  }

  return buildInternalAuthEmail(normalized.slug);
}

export async function signInLearner(
  username: string,
  password: string,
  client: SignInLearnerClient,
): Promise<LoginClientResult> {
  const email = buildLoginEmailFromUsername(username);

  if (!email) {
    return {
      ok: false,
      kind: "invalid_credentials",
      message: LOGIN_INVALID_CREDENTIALS_MESSAGE,
    };
  }

  try {
    const { error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (isServiceError(error)) {
        return {
          ok: false,
          kind: "service_error",
          message: LOGIN_SERVICE_ERROR_MESSAGE,
        };
      }

      return {
        ok: false,
        kind: "invalid_credentials",
        message: LOGIN_INVALID_CREDENTIALS_MESSAGE,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      kind: "service_error",
      message: LOGIN_SERVICE_ERROR_MESSAGE,
    };
  }
}
