import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstructorDashboard } from "@/app/components/instructor/InstructorDashboard";
import { CURRENT_INSTRUCTOR_WEEK } from "@/src/lib/instructor/instructor-student";
import { COURSE_SECTIONS } from "@/src/lib/profile.types";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

describe("InstructorDashboard", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("defaults the selector to the provided section and lists all canonical sections", () => {
    render(
      <InstructorDashboard
        section="Kinesiology 1"
        selectedWeek={CURRENT_INSTRUCTOR_WEEK}
        availableWeeks={[]}
        students={[]}
      />,
    );

    const select = screen.getByLabelText("Section");
    expect(select).toHaveValue("Kinesiology 1");
    expect(screen.getByLabelText("Participation Week")).toHaveValue("current");
    expect(
      screen.getByRole("option", { name: "Current Week" }),
    ).toBeInTheDocument();

    for (const section of COURSE_SECTIONS) {
      expect(screen.getByRole("option", { name: section })).toBeInTheDocument();
    }
  });

  it("renders Current Week as Week N · X/5 and legacy as Not tracked", () => {
    render(
      <InstructorDashboard
        section="Kinesiology 1"
        selectedWeek={CURRENT_INSTRUCTOR_WEEK}
        availableWeeks={[1]}
        students={[
          {
            username: "Agile Fox",
            section: "Kinesiology 1",
            currentStudyDay: 8,
            expectedStudySessions: 75,
            weeklyParticipation: {
              status: "in-progress",
              weekNumber: 1,
              completedDays: 5,
              goalDays: 5,
            },
          },
          {
            username: "Legacy Cedar",
            section: "Kinesiology 1",
            currentStudyDay: 9,
            expectedStudySessions: 75,
            weeklyParticipation: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("Agile Fox")).toBeInTheDocument();
    expect(screen.getByText("Day 8 / 75")).toBeInTheDocument();
    expect(screen.getByText("Week 1 · 5/5")).toBeInTheDocument();
    expect(screen.getByText("Day 9 / 75")).toBeInTheDocument();
    expect(screen.getByText("Not tracked")).toBeInTheDocument();
    expect(screen.getByText("Weekly Participation")).toBeInTheDocument();
    expect(screen.queryByText("0/5")).not.toBeInTheDocument();
    expect(screen.queryByText(/105/)).not.toBeInTheDocument();
  });

  it("uses a historical header and complete, in-progress, and not-reached labels", () => {
    render(
      <InstructorDashboard
        section="Kinesiology 1"
        selectedWeek={2}
        availableWeeks={[1, 2]}
        students={[
          {
            username: "Complete Fox",
            section: "Kinesiology 1",
            currentStudyDay: 20,
            expectedStudySessions: 75,
            weeklyParticipation: {
              status: "complete",
              weekNumber: 2,
              completedDays: 5,
              goalDays: 5,
            },
          },
          {
            username: "Active Cedar",
            section: "Kinesiology 1",
            currentStudyDay: 4,
            expectedStudySessions: 75,
            weeklyParticipation: {
              status: "in-progress",
              weekNumber: 2,
              completedDays: 2,
              goalDays: 5,
            },
          },
          {
            username: "Future River",
            section: "Kinesiology 1",
            currentStudyDay: 1,
            expectedStudySessions: 75,
            weeklyParticipation: {
              status: "not-reached",
              weekNumber: 2,
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("Week 2 Participation")).toBeInTheDocument();
    expect(screen.getByText("Day 20 / 75")).toBeInTheDocument();
    expect(screen.getByText("5/5")).toBeInTheDocument();
    expect(screen.getByText("2/5 · In progress")).toBeInTheDocument();
    expect(screen.getByText("Not reached")).toBeInTheDocument();
    expect(screen.queryByText("Weekly Participation")).not.toBeInTheDocument();
  });

  it("resets to Current Week when the section changes", async () => {
    render(
      <InstructorDashboard
        section="Kinesiology 1"
        selectedWeek={2}
        availableWeeks={[1, 2]}
        students={[]}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Section"), "Testing");

    expect(push).toHaveBeenCalledWith("/instructor?section=Testing");
  });

  it("navigates with the selected historical week", async () => {
    render(
      <InstructorDashboard
        section="Testing"
        selectedWeek={CURRENT_INSTRUCTOR_WEEK}
        availableWeeks={[1]}
        students={[]}
      />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Participation Week"),
      "1",
    );

    expect(push).toHaveBeenCalledWith("/instructor?section=Testing&week=1");
  });
});
