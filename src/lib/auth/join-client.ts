import type {
  JoinAccountSuccessResponse,
} from "@/src/lib/auth/join.types";
import type { CourseSection } from "@/src/lib/profile.types";

export type JoinAccountClientErrorKind =
  | "invalid"
  | "incorrect_password"
  | "request_error"
  | "server_error"
  | "unavailable"
  | "network";

export type JoinAccountClientResult =
  | { ok: true; credentials: JoinAccountSuccessResponse }
  | { ok: false; kind: JoinAccountClientErrorKind; message: string };

export const JOIN_ACCOUNT_ERROR_MESSAGES: Record<
  JoinAccountClientErrorKind,
  string
> = {
  invalid: "The submitted information is invalid. Please check and try again.",
  incorrect_password: "Incorrect section confirmation password.",
  request_error: "There was a problem with your request. Please try again.",
  server_error: "Unable to create your account right now. Please try again.",
  unavailable:
    "Account creation is temporarily unavailable. Please try again later.",
  network:
    "Network error. Check your connection and try again.",
};

export async function submitJoinAccountRequest(
  section: CourseSection,
  sectionPassword: string,
  fetchImpl: typeof fetch = fetch,
): Promise<JoinAccountClientResult> {
  try {
    const response = await fetchImpl("/api/auth/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        section,
        sectionPassword,
      }),
    });

    if (response.status === 201) {
      const credentials = (await response.json()) as JoinAccountSuccessResponse;

      return {
        ok: true,
        credentials,
      };
    }

    const kind = mapJoinResponseStatus(response.status);

    return {
      ok: false,
      kind,
      message: JOIN_ACCOUNT_ERROR_MESSAGES[kind],
    };
  } catch {
    return {
      ok: false,
      kind: "network",
      message: JOIN_ACCOUNT_ERROR_MESSAGES.network,
    };
  }
}

function mapJoinResponseStatus(status: number): JoinAccountClientErrorKind {
  switch (status) {
    case 400:
      return "invalid";
    case 401:
      return "incorrect_password";
    case 413:
      return "request_error";
    case 503:
      return "unavailable";
    default:
      return "server_error";
  }
}
