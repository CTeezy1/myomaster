import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstructorDashboard } from "@/app/components/instructor/InstructorDashboard";
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
      <InstructorDashboard section="Kinesiology 1" students={[]} />,
    );

    const select = screen.getByLabelText("Section");
    expect(select).toHaveValue("Kinesiology 1");

    for (const section of COURSE_SECTIONS) {
      expect(screen.getByRole("option", { name: section })).toBeInTheDocument();
    }
  });

  it("renders study progress against 75 and not-tracked participation", () => {
    render(
      <InstructorDashboard
        section="Kinesiology 1"
        students={[
          {
            username: "Agile Fox",
            section: "Kinesiology 1",
            currentStudyDay: 8,
            expectedStudySessions: 75,
            weeklyParticipation: {
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
    expect(screen.queryByText("0/5")).not.toBeInTheDocument();
    expect(screen.queryByText(/105/)).not.toBeInTheDocument();
  });

  it("navigates with the selected canonical section", async () => {
    render(
      <InstructorDashboard section="Kinesiology 1" students={[]} />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Section"), "Testing");

    expect(push).toHaveBeenCalledWith("/instructor?section=Testing");
  });
});
