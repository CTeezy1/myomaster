import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { MuscleBrief } from "@/app/components/MuscleBrief";
import { getMuscleProfileById } from "@/src/data/muscle-profiles";

vi.mock("next/image", () => ({
  default: ({
    alt,
    onLoad,
    onError,
  }: {
    alt: string;
    onLoad?: () => void;
    onError?: () => void;
  }) => {
    useEffect(() => {
      onLoad?.();
    }, [onLoad]);

    return (
      <img
        alt={alt}
        onError={() => onError?.()}
      />
    );
  },
}));

describe("MuscleBrief why memory works display", () => {
  it("renders cervical whyMemoryWorks as a paragraph without an accordion", () => {
    const profile = getMuscleProfileById("longus-colli");

    expect(profile).toBeDefined();

    render(
      <MuscleBrief
        profile={profile!}
        mode="library"
        onPrimaryAction={() => {}}
      />,
    );

    expect(screen.getByText("Why This Memory Works")).toBeInTheDocument();
    expect(screen.queryByText("Memory Story")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /why this memory works/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/The LONGus COLli is the LONG muscle running along the COLli/i),
    ).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders a single-item shoulder whyMemoryWorks paragraph without bullets", () => {
    const profile = getMuscleProfileById("deltoid");

    expect(profile).toBeDefined();
    expect(Array.isArray(profile!.whyMemoryWorks)).toBe(true);

    render(
      <MuscleBrief
        profile={profile!}
        mode="library"
        onPrimaryAction={() => {}}
      />,
    );

    expect(screen.getByText("Why This Memory Works")).toBeInTheDocument();
    expect(
      screen.getByText(/Green represents the axillary nerve/i),
    ).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByText("Memory Illustration")).toBeInTheDocument();
  });
});

describe("MuscleBrief return to dashboard", () => {
  it("shows a secondary return action during course study without completing the brief", async () => {
    const profile = getMuscleProfileById("longus-colli");
    const onPrimaryAction = vi.fn();
    const onReturnToDashboard = vi.fn();

    expect(profile).toBeDefined();

    render(
      <MuscleBrief
        profile={profile!}
        mode="course"
        onPrimaryAction={onPrimaryAction}
        onReturnToDashboard={onReturnToDashboard}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "← Return to Dashboard" }),
    );

    expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
    expect(onPrimaryAction).not.toHaveBeenCalled();
  });

  it("does not show Return to Dashboard in the library Muscle Brief", () => {
    const profile = getMuscleProfileById("longus-colli");

    expect(profile).toBeDefined();

    render(
      <MuscleBrief
        profile={profile!}
        mode="library"
        onPrimaryAction={() => {}}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "← Return to Dashboard" }),
    ).not.toBeInTheDocument();
  });
});
