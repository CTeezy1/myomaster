import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dashboard } from "@/app/components/Dashboard";
import { EXPECTED_COURSE_STUDY_SESSIONS } from "@/src/lib/study-day-display";

function renderDashboard(
  overrides: Partial<Parameters<typeof Dashboard>[0]> = {},
) {
  return render(
    <Dashboard
      currentStudyDay={1}
      totalStudyDays={EXPECTED_COURSE_STUDY_SESSIONS}
      introducedMuscleCount={10}
      totalMuscleCount={20}
      onStartStudying={() => {}}
      canStartGuidedStudy
      hasResumableStudySession={false}
      isStudyDayComplete={false}
      canAdvanceStudyDay={false}
      onOpenMuscleLibrary={() => {}}
      onOpenMemoryCode={() => {}}
      {...overrides}
    />,
  );
}

describe("Dashboard study day display", () => {
  it("renders formal course labeling through the expected 75 sessions", () => {
    renderDashboard({ currentStudyDay: 75 });

    expect(screen.getByText("75 of 75")).toBeInTheDocument();
    expect(screen.queryByText("Continued Review")).not.toBeInTheDocument();
  });

  it("shows the actual study day for days 76-105 without continued-review labeling", () => {
    const { rerender } = renderDashboard({ currentStudyDay: 76 });

    expect(screen.getByText("76")).toBeInTheDocument();
    expect(screen.queryByText("76 of 75")).not.toBeInTheDocument();
    expect(screen.queryByText("76 of 105")).not.toBeInTheDocument();
    expect(screen.queryByText("Continued Review")).not.toBeInTheDocument();

    rerender(
      <Dashboard
        currentStudyDay={105}
        totalStudyDays={EXPECTED_COURSE_STUDY_SESSIONS}
        introducedMuscleCount={10}
        totalMuscleCount={20}
        onStartStudying={() => {}}
        canStartGuidedStudy
        hasResumableStudySession={false}
        isStudyDayComplete={false}
        canAdvanceStudyDay={false}
        onOpenMuscleLibrary={() => {}}
        onOpenMemoryCode={() => {}}
      />,
    );

    expect(screen.getByText("105")).toBeInTheDocument();
    expect(screen.queryByText("105 of 75")).not.toBeInTheDocument();
    expect(screen.queryByText("105 of 105")).not.toBeInTheDocument();
    expect(screen.queryByText("Continued Review")).not.toBeInTheDocument();
  });

  it("renders continued review only after the engine boundary at day 105", () => {
    renderDashboard({ currentStudyDay: 106 });

    expect(screen.getByText("106")).toBeInTheDocument();
    expect(screen.getByText("Continued Review")).toBeInTheDocument();
    expect(screen.queryByText("106 of 75")).not.toBeInTheDocument();
    expect(screen.queryByText("106 of 105")).not.toBeInTheDocument();
  });

  it("communicates the 5 sessions per week expectation without a weekly tracker", () => {
    renderDashboard();

    expect(
      screen.getByText(
        "Build long-term mastery with 5 MyoMaster study sessions each week. Complete them on any 5 days that work for you.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("This week")).not.toBeInTheDocument();
    expect(screen.queryByText("0 of 5 study days complete")).not.toBeInTheDocument();
    expect(screen.queryByText("0/5")).not.toBeInTheDocument();
    expect(screen.queryByText("3/5")).not.toBeInTheDocument();
    expect(screen.queryByText("5/5")).not.toBeInTheDocument();
  });

  it("shows 1 of 5 after Study Day 1 establishes a participation anchor", () => {
    renderDashboard({
      weeklyParticipation: {
        weekNumber: 1,
        weekIndex: 0,
        completedDays: 1,
        distinctDateCount: 1,
        distinctDates: ["2026-09-17"],
        goalDays: 5,
        isComplete: false,
      },
    });

    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("1 of 5 study days complete")).toBeInTheDocument();
    expect(
      screen.getByText("Complete 4 more study days this week to reach your goal."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Build long-term mastery with 5 MyoMaster study sessions each week. Complete them on any 5 days that work for you.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a partial week such as 3 of 5", () => {
    renderDashboard({
      weeklyParticipation: {
        weekNumber: 1,
        weekIndex: 0,
        completedDays: 3,
        distinctDateCount: 3,
        distinctDates: ["2026-09-17", "2026-09-18", "2026-09-19"],
        goalDays: 5,
        isComplete: false,
      },
    });

    expect(screen.getByText("3 of 5 study days complete")).toBeInTheDocument();
    expect(
      screen.getByText("Complete 2 more study days this week to reach your goal."),
    ).toBeInTheDocument();
  });

  it("shows Weekly Goal Complete at 5 of 5 and never 6 of 5", () => {
    renderDashboard({
      weeklyParticipation: {
        weekNumber: 1,
        weekIndex: 0,
        completedDays: 5,
        distinctDateCount: 6,
        distinctDates: [
          "2026-09-17",
          "2026-09-18",
          "2026-09-19",
          "2026-09-20",
          "2026-09-21",
          "2026-09-23",
        ],
        goalDays: 5,
        isComplete: true,
      },
    });

    expect(screen.getByText("Weekly Goal Complete ✓")).toBeInTheDocument();
    expect(screen.getByText("5 of 5 study days")).toBeInTheDocument();
    expect(screen.queryByText("6 of 5")).not.toBeInTheDocument();
    expect(screen.queryByText("6/5")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Begin Studying" }),
    ).toBeInTheDocument();
  });

  it("shows 0 of 5 at the beginning of the next participation week", () => {
    renderDashboard({
      weeklyParticipation: {
        weekNumber: 2,
        weekIndex: 1,
        completedDays: 0,
        distinctDateCount: 0,
        distinctDates: [],
        goalDays: 5,
        isComplete: false,
      },
    });

    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("0 of 5 study days complete")).toBeInTheDocument();
    expect(
      screen.getByText("Complete 5 more study days this week to reach your goal."),
    ).toBeInTheDocument();
  });

  it("hides the numerical tracker for a legacy learner without a Day 1 event", () => {
    renderDashboard({ weeklyParticipation: null });

    expect(screen.queryByText("This week")).not.toBeInTheDocument();
    expect(screen.queryByText("0 of 5 study days complete")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Build long-term mastery with 5 MyoMaster study sessions each week. Complete them on any 5 days that work for you.",
      ),
    ).toBeInTheDocument();
  });

  it("does not expose Reset Learning Progress in the student UI", () => {
    renderDashboard();

    expect(
      screen.queryByRole("button", { name: /reset learning progress/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Reset Learning Progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Reset Study Progress")).not.toBeInTheDocument();
  });

  it("keeps Resume Studying when an active session can be resumed", () => {
    const onStartStudying = vi.fn();

    renderDashboard({
      hasResumableStudySession: true,
      onStartStudying,
    });

    expect(
      screen.getByRole("button", { name: "Resume Studying" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Begin Studying" }),
    ).not.toBeInTheDocument();
  });
});
