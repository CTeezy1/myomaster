import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedPageShell } from "@/app/components/auth/AuthenticatedPageShell";
import { fetchCurrentProfile } from "@/src/lib/auth/profile-client";
import { signOutLearner } from "@/src/lib/auth/logout-client";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browser";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/src/lib/supabase/browser", () => ({
  createBrowserSupabaseClient: vi.fn(),
}));

vi.mock("@/src/lib/auth/profile-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/auth/profile-client")>();

  return {
    ...actual,
    fetchCurrentProfile: vi.fn(),
  };
});

vi.mock("@/src/lib/auth/logout-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/auth/logout-client")>();

  return {
    ...actual,
    signOutLearner: vi.fn(),
  };
});

vi.mock("@/src/lib/progress/LearnerProgressProvider", () => ({
  LearnerProgressProvider: ({ children }: { children: React.ReactNode }) => children,
  useLearnerProgress: () => ({
    progressState: { status: "ready", hydrationVersion: 1 },
    saveStatus: "idle",
    saveStatusLabel: null,
    reloadProgress: vi.fn(),
    startFreshProgress: vi.fn(async () => true),
    retrySave: vi.fn(),
    resetLearningProgressRemote: vi.fn(async () => true),
    flushProgressBeforeLogout: vi.fn(async () => true),
    confirmStartFreshOpen: false,
    requestStartFresh: vi.fn(),
    cancelStartFresh: vi.fn(),
  }),
}));

const mockedFetchCurrentProfile = vi.mocked(fetchCurrentProfile);
const mockedSignOutLearner = vi.mocked(signOutLearner);
const mockedCreateBrowserSupabaseClient = vi.mocked(createBrowserSupabaseClient);

describe("AuthenticatedPageShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockedCreateBrowserSupabaseClient.mockReturnValue({} as never);
    mockedFetchCurrentProfile.mockResolvedValue({
      ok: true,
      profile: {
        id: "user-123",
        username: "Energetic Pencil",
        username_slug: "energetic-pencil",
        section: "Kinesiology 1",
        created_at: "2026-07-30T00:00:00.000Z",
      },
    });
    mockedSignOutLearner.mockResolvedValue({ ok: true });
  });

  it("shows a loading state while the profile loads", () => {
    mockedFetchCurrentProfile.mockImplementation(
      () => new Promise(() => undefined),
    );

    render(
      <AuthenticatedPageShell>
        <p>Protected content</p>
      </AuthenticatedPageShell>,
    );

    expect(screen.getByText("Loading your account...")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("displays the learner username and section", async () => {
    render(
      <AuthenticatedPageShell>
        <p>Protected content</p>
      </AuthenticatedPageShell>,
    );

    expect(await screen.findByText("Energetic Pencil")).toBeInTheDocument();
    expect(screen.getByText("Kinesiology 1")).toBeInTheDocument();
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Instructor Dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("shows an Instructor Dashboard link only when the server marks the account as instructor", async () => {
    render(
      <AuthenticatedPageShell showInstructorLink>
        <p>Protected content</p>
      </AuthenticatedPageShell>,
    );

    expect(
      await screen.findByRole("link", { name: "Instructor Dashboard" }),
    ).toHaveAttribute("href", "/instructor");
  });

  it("does not display internal email or auth user IDs", async () => {
    render(
      <AuthenticatedPageShell>
        <p>Protected content</p>
      </AuthenticatedPageShell>,
    );

    await screen.findByText("Energetic Pencil");

    expect(screen.queryByText(/@users\.myomaster\.local/i)).not.toBeInTheDocument();
    expect(screen.queryByText("user-123")).not.toBeInTheDocument();
  });

  it("calls signOut and navigates to /login on logout", async () => {
    render(
      <AuthenticatedPageShell>
        <p>Protected content</p>
      </AuthenticatedPageShell>,
    );

    await screen.findByRole("button", { name: "Logout" });
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(mockedSignOutLearner).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/login");
    });
  });

  it("prevents duplicate logout requests", async () => {
    let resolveSignOut: ((value: Awaited<ReturnType<typeof signOutLearner>>) => void) | undefined;

    mockedSignOutLearner.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignOut = resolve;
        }),
    );

    render(
      <AuthenticatedPageShell>
        <p>Protected content</p>
      </AuthenticatedPageShell>,
    );

    const logoutButton = await screen.findByRole("button", { name: "Logout" });
    await userEvent.click(logoutButton);
    expect(screen.getByRole("button", { name: "Logging Out..." })).toBeDisabled();
    await userEvent.click(logoutButton);

    expect(mockedSignOutLearner).toHaveBeenCalledTimes(1);

    resolveSignOut?.({ ok: true });
  });

  it("shows a generic logout error without technical details", async () => {
    mockedSignOutLearner.mockResolvedValue({
      ok: false,
      message: "Unable to log out right now. Please try again.",
    });

    render(
      <AuthenticatedPageShell>
        <p>Protected content</p>
      </AuthenticatedPageShell>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Logout" }));

    expect(
      await screen.findByText("Unable to log out right now. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/supabase/i)).not.toBeInTheDocument();
  });

  it("shows a safe error state when the profile is missing", async () => {
    mockedFetchCurrentProfile.mockResolvedValue({
      ok: false,
      kind: "missing_profile",
      message:
        "Your account profile is unavailable. Please log out and contact your instructor.",
    });

    render(
      <AuthenticatedPageShell>
        <p>Protected content</p>
      </AuthenticatedPageShell>,
    );

    expect(
      await screen.findByText(
        "Your account profile is unavailable. Please log out and contact your instructor.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("shows a retryable error when profile loading fails", async () => {
    mockedFetchCurrentProfile.mockResolvedValue({
      ok: false,
      kind: "load_error",
      message: "Unable to load your account right now. Please try again.",
    });

    render(
      <AuthenticatedPageShell>
        <p>Protected content</p>
      </AuthenticatedPageShell>,
    );

    expect(
      await screen.findByText(
        "Unable to load your account right now. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("does not write credentials to localStorage or sessionStorage", async () => {
    render(
      <AuthenticatedPageShell>
        <p>Protected content</p>
      </AuthenticatedPageShell>,
    );

    await screen.findByText("Energetic Pencil");

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
