import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/app/components/login/LoginForm";
import {
  LOGIN_INVALID_CREDENTIALS_MESSAGE,
  LOGIN_SERVICE_ERROR_MESSAGE,
  signInLearner,
} from "@/src/lib/auth/login-client";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browser";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/src/lib/supabase/browser", () => ({
  createBrowserSupabaseClient: vi.fn(),
}));

vi.mock("@/src/lib/auth/login-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/auth/login-client")>();

  return {
    ...actual,
    signInLearner: vi.fn(),
  };
});

const mockedCreateBrowserSupabaseClient = vi.mocked(createBrowserSupabaseClient);
const mockedSignInLearner = vi.mocked(signInLearner);

function mockNoExistingSession() {
  mockedCreateBrowserSupabaseClient.mockReturnValue({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  } as never);
}

function mockExistingSession() {
  mockedCreateBrowserSupabaseClient.mockReturnValue({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: "user-123" } } },
      })),
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-123" } },
        error: null,
      })),
    },
  } as never);
}

async function waitForLoginForm() {
  await waitFor(() => {
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockNoExistingSession();
    mockedSignInLearner.mockReset();
  });

  it("renders Username and Password fields", async () => {
    render(<LoginForm />);
    await waitForLoginForm();

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  });

  it("links Join with new account to /join", async () => {
    render(<LoginForm />);
    await waitForLoginForm();

    expect(screen.getByRole("link", { name: "Join with new account" })).toHaveAttribute(
      "href",
      "/join",
    );
  });

  it("submits credentials through signInLearner", async () => {
    mockedSignInLearner.mockResolvedValue({ ok: true });

    render(<LoginForm />);
    await waitForLoginForm();

    await userEvent.type(screen.getByLabelText("Username"), "Energetic Pencil");
    await userEvent.type(screen.getByLabelText("Password"), "plant7");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(mockedSignInLearner).toHaveBeenCalledWith(
        "Energetic Pencil",
        "plant7",
        expect.any(Object),
      );
    });
  });

  it("navigates to / after a successful login", async () => {
    mockedSignInLearner.mockResolvedValue({ ok: true });

    render(<LoginForm />);
    await waitForLoginForm();

    await userEvent.type(screen.getByLabelText("Username"), "Energetic Pencil");
    await userEvent.type(screen.getByLabelText("Password"), "plant7");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  it("shows the invalid-credentials message for failed login", async () => {
    mockedSignInLearner.mockResolvedValue({
      ok: false,
      kind: "invalid_credentials",
      message: LOGIN_INVALID_CREDENTIALS_MESSAGE,
    });

    render(<LoginForm />);
    await waitForLoginForm();

    await userEvent.type(screen.getByLabelText("Username"), "Energetic Pencil");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText(LOGIN_INVALID_CREDENTIALS_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue("Energetic Pencil");
    expect(screen.getByLabelText("Password")).toHaveValue("wrong");
  });

  it("shows a generic service error without technical details", async () => {
    mockedSignInLearner.mockResolvedValue({
      ok: false,
      kind: "service_error",
      message: LOGIN_SERVICE_ERROR_MESSAGE,
    });

    render(<LoginForm />);
    await waitForLoginForm();

    await userEvent.type(screen.getByLabelText("Username"), "Energetic Pencil");
    await userEvent.type(screen.getByLabelText("Password"), "plant7");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText(LOGIN_SERVICE_ERROR_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.queryByText(/supabase/i)).not.toBeInTheDocument();
  });

  it("prevents duplicate submissions while submitting", async () => {
    let resolveSignIn:
      | ((value: Awaited<ReturnType<typeof signInLearner>>) => void)
      | undefined;

    mockedSignInLearner.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );

    render(<LoginForm />);
    await waitForLoginForm();

    await userEvent.type(screen.getByLabelText("Username"), "Energetic Pencil");
    await userEvent.type(screen.getByLabelText("Password"), "plant7");

    const loginButton = screen.getByRole("button", { name: "Login" });
    await userEvent.click(loginButton);
    expect(screen.getByRole("button", { name: "Signing In..." })).toBeDisabled();
    await userEvent.click(loginButton);

    expect(mockedSignInLearner).toHaveBeenCalledTimes(1);

    resolveSignIn?.({ ok: true });
  });

  it("redirects to / when an authenticated session already exists", async () => {
    mockExistingSession();

    render(<LoginForm />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  it("does not write credentials to localStorage or sessionStorage", async () => {
    mockedSignInLearner.mockResolvedValue({ ok: true });

    render(<LoginForm />);
    await waitForLoginForm();

    await userEvent.type(screen.getByLabelText("Username"), "Energetic Pencil");
    await userEvent.type(screen.getByLabelText("Password"), "plant7");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(mockedSignInLearner).toHaveBeenCalled();
    });

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(localStorage)).not.toContain("plant7");
  });

  it("clears the error when the learner edits a field", async () => {
    mockedSignInLearner.mockResolvedValue({
      ok: false,
      kind: "invalid_credentials",
      message: LOGIN_INVALID_CREDENTIALS_MESSAGE,
    });

    render(<LoginForm />);
    await waitForLoginForm();

    await userEvent.type(screen.getByLabelText("Username"), "Energetic Pencil");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(
      await screen.findByText(LOGIN_INVALID_CREDENTIALS_MESSAGE),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Username"), "!");
    expect(
      screen.queryByText(LOGIN_INVALID_CREDENTIALS_MESSAGE),
    ).not.toBeInTheDocument();
  });
});
