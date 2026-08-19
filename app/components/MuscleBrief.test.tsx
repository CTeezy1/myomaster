import { render, screen } from "@testing-library/react";
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
  it("renders cervical whyMemoryWorks bullets without an accordion", () => {
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
      screen.getByText(/Longus means long — picture one continuous muscle/i),
    ).toBeVisible();
    expect(screen.getByRole("list")).toBeInTheDocument();
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
