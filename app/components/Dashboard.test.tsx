import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dashboard } from "@/app/components/Dashboard";
import { COURSE_DAYS } from "@/src/lib/introduction-policy";

describe("Dashboard study day display", () => {
  it("renders continued review after day 105", () => {
    render(
      <Dashboard
        currentStudyDay={106}
        totalStudyDays={COURSE_DAYS}
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

    expect(screen.getByText("106")).toBeInTheDocument();
    expect(screen.getByText("Continued Review")).toBeInTheDocument();
    expect(screen.queryByText("106 of 105")).not.toBeInTheDocument();
  });

  it("renders formal course labeling through day 105", () => {
    render(
      <Dashboard
        currentStudyDay={105}
        totalStudyDays={COURSE_DAYS}
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

    expect(screen.getByText("105 of 105")).toBeInTheDocument();
    expect(screen.queryByText("Continued Review")).not.toBeInTheDocument();
  });
});
