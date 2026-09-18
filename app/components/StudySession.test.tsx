import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudySession } from "@/app/components/StudySession";

function renderStudySession(
  overrides: Partial<Parameters<typeof StudySession>[0]> = {},
) {
  return render(
    <StudySession
      muscle="Longus Colli"
      question="What is the origin?"
      answer="Anterior vertebral bodies"
      answerShown={false}
      feedbackGrade={null}
      onShowAnswer={() => {}}
      onGrade={() => {}}
      onReviewBrief={() => {}}
      onContinue={() => {}}
      onReturnToDashboard={() => {}}
      {...overrides}
    />,
  );
}

describe("StudySession return to dashboard", () => {
  it("renders a secondary return action below the study controls", () => {
    renderStudySession();

    expect(
      screen.getByRole("button", { name: "← Return to Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Answer" })).toBeInTheDocument();
  });

  it("returns to the dashboard without grading or continuing the current card", async () => {
    const onReturnToDashboard = vi.fn();
    const onGrade = vi.fn();
    const onShowAnswer = vi.fn();
    const onContinue = vi.fn();
    const onReviewBrief = vi.fn();

    renderStudySession({
      answerShown: true,
      onReturnToDashboard,
      onGrade,
      onShowAnswer,
      onContinue,
      onReviewBrief,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "← Return to Dashboard" }),
    );

    expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
    expect(onGrade).not.toHaveBeenCalled();
    expect(onShowAnswer).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
    expect(onReviewBrief).not.toHaveBeenCalled();
  });
});
