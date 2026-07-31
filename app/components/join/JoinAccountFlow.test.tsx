import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JoinAccountFlow } from "@/app/components/join/JoinAccountFlow";
import { submitJoinAccountRequest } from "@/src/lib/auth/join-client";
import { COURSE_SECTIONS } from "@/src/lib/profile.types";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browser";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

vi.mock("@/src/lib/auth/join-client", () => ({
  submitJoinAccountRequest: vi.fn(),
}));

vi.mock("@/src/lib/supabase/browser", () => ({
  createBrowserSupabaseClient: vi.fn(),
}));

const mockedSubmitJoinAccountRequest = vi.mocked(submitJoinAccountRequest);
const mockedCreateBrowserSupabaseClient = vi.mocked(createBrowserSupabaseClient);

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

async function waitForJoinForm() {
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Choose Section" })).toBeInTheDocument();
  });
}

async function selectSection(section: string) {
  await userEvent.click(screen.getByRole("radio", { name: section }));
}

async function continueToPasswordStep() {
  await waitForJoinForm();
  await selectSection("Testing");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("JoinAccountFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockNoExistingSession();
    mockedSubmitJoinAccountRequest.mockReset();
  });

  it("renders all five sections from COURSE_SECTIONS", async () => {
    render(<JoinAccountFlow />);
    await waitForJoinForm();

    for (const section of COURSE_SECTIONS) {
      expect(screen.getByRole("radio", { name: section })).toBeInTheDocument();
    }

    expect(screen.getAllByRole("radio")).toHaveLength(COURSE_SECTIONS.length);
  });

  it("keeps Continue disabled until a section is selected", async () => {
    render(<JoinAccountFlow />);
    await waitForJoinForm();

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("advances to password confirmation after selecting a section", async () => {
    render(<JoinAccountFlow />);

    await continueToPasswordStep();

    expect(
      screen.getByLabelText("Section Confirmation Password"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
  });

  it("returns to section selection when Back is clicked", async () => {
    render(<JoinAccountFlow />);

    await continueToPasswordStep();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("heading", { name: "Choose Section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("submits the password to /api/auth/join", async () => {
    mockedSubmitJoinAccountRequest.mockResolvedValue({
      ok: true,
      credentials: {
        username: "Energetic Pencil",
        password: "plant7",
        section: "Testing",
      },
    });

    render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "Testing",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(mockedSubmitJoinAccountRequest).toHaveBeenCalledWith(
        "Testing",
        "Testing",
      );
    });
  });

  it("prevents duplicate submissions while a request is running", async () => {
    let resolveRequest: ((value: Awaited<ReturnType<typeof submitJoinAccountRequest>>) => void) | undefined;

    mockedSubmitJoinAccountRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "Testing",
    );

    const submitButton = screen.getByRole("button", { name: "Create Account" });
    await userEvent.click(submitButton);
    await userEvent.click(submitButton);

    expect(mockedSubmitJoinAccountRequest).toHaveBeenCalledTimes(1);

    resolveRequest?.({
      ok: true,
      credentials: {
        username: "Energetic Pencil",
        password: "plant7",
        section: "Testing",
      },
    });
  });

  it("displays username, password, and section after a 201 response", async () => {
    mockedSubmitJoinAccountRequest.mockResolvedValue({
      ok: true,
      credentials: {
        username: "Energetic Pencil",
        password: "plant7",
        section: "Testing",
      },
    });

    render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "Testing",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByRole("heading", { name: "Your Account Is Ready" })).toBeInTheDocument();
    expect(screen.getByText("Energetic Pencil")).toBeInTheDocument();
    expect(screen.getByText("plant7")).toBeInTheDocument();
    expect(screen.getByText("Section").closest("div")).toHaveTextContent("Testing");
  });

  it("shows the incorrect-password message for a 401 response", async () => {
    mockedSubmitJoinAccountRequest.mockResolvedValue({
      ok: false,
      kind: "incorrect_password",
      message: "Incorrect section confirmation password.",
    });

    render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "wrong",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(
      await screen.findByText("Incorrect section confirmation password."),
    ).toBeInTheDocument();
  });

  it("shows generic messages for server and network failures", async () => {
    mockedSubmitJoinAccountRequest.mockResolvedValueOnce({
      ok: false,
      kind: "server_error",
      message: "Unable to create your account right now. Please try again.",
    });

    const { unmount } = render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "Testing",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(
      await screen.findByText(
        "Unable to create your account right now. Please try again.",
      ),
    ).toBeInTheDocument();

    unmount();
    mockedSubmitJoinAccountRequest.mockResolvedValueOnce({
      ok: false,
      kind: "network",
      message: "Network error. Check your connection and try again.",
    });

    render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "Testing",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(
      await screen.findByText("Network error. Check your connection and try again."),
    ).toBeInTheDocument();
  });

  it("does not store credentials in localStorage or sessionStorage", async () => {
    mockedSubmitJoinAccountRequest.mockResolvedValue({
      ok: true,
      credentials: {
        username: "Energetic Pencil",
        password: "plant7",
        section: "Testing",
      },
    });

    render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "Testing",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await screen.findByText("plant7");

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(localStorage)).not.toContain("plant7");
    expect(JSON.stringify(sessionStorage)).not.toContain("Energetic Pencil");
  });

  it("does not show credentials after a fresh mount", async () => {
    mockedSubmitJoinAccountRequest.mockResolvedValue({
      ok: true,
      credentials: {
        username: "Energetic Pencil",
        password: "plant7",
        section: "Testing",
      },
    });

    const { unmount } = render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "Testing",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    await screen.findByText("plant7");
    unmount();

    render(<JoinAccountFlow />);
    await waitForJoinForm();

    expect(
      screen.queryByRole("heading", { name: "Your Account Is Ready" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose Section" })).toBeInTheDocument();
  });

  it("navigates Back to Login at /login after confirming credentials were written down", async () => {
    mockedSubmitJoinAccountRequest.mockResolvedValue({
      ok: true,
      credentials: {
        username: "Energetic Pencil",
        password: "plant7",
        section: "Testing",
      },
    });

    render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "Testing",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    await screen.findByRole("button", { name: "Back to Login" });
    expect(screen.getByRole("button", { name: "Back to Login" })).toBeDisabled();

    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "I have written down my username and password.",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Back to Login" }));

    expect(push).toHaveBeenCalledWith("/login");
  });

  it("includes the write-down checkbox on the credential reveal screen", async () => {
    mockedSubmitJoinAccountRequest.mockResolvedValue({
      ok: true,
      credentials: {
        username: "Energetic Pencil",
        password: "plant7",
        section: "Testing",
      },
    });

    render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "Testing",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(
      screen.getByRole("checkbox", {
        name: "I have written down my username and password.",
      }),
    ).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Back to Login" })).toBeDisabled();
  });

  it("does not persist credentials or checkbox state in browser storage", async () => {
    mockedSubmitJoinAccountRequest.mockResolvedValue({
      ok: true,
      credentials: {
        username: "Energetic Pencil",
        password: "plant7",
        section: "Testing",
      },
    });

    render(<JoinAccountFlow />);
    await continueToPasswordStep();
    await userEvent.type(
      screen.getByLabelText("Section Confirmation Password"),
      "Testing",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "I have written down my username and password.",
      }),
    );

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(localStorage)).not.toContain("plant7");
  });

  it("redirects authenticated learners away from /join", async () => {
    mockExistingSession();

    render(<JoinAccountFlow />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });
});
