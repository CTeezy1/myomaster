import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryCodeOverview } from "@/app/components/memory-code/MemoryCodeOverview";

describe("MemoryCodeOverview", () => {
  it("keeps the upper extremity code and replaces coming soon with the lower extremity code", () => {
    render(<MemoryCodeOverview />);

    expect(
      screen.getByRole("heading", { name: "Upper Extremity Memory Code" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Lower Extremity Memory Code" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Musculocutaneous nerve/)).toBeInTheDocument();
    expect(screen.getByText(/Femoral nerve/)).toBeInTheDocument();
    expect(screen.getByText("Great lion — Gluteus maximus")).toBeInTheDocument();
    expect(
      screen.getByText("Long head — tibial division of sciatic nerve"),
    ).toBeInTheDocument();
    expect(screen.queryByText("More Memory Codes")).not.toBeInTheDocument();
    expect(screen.queryByText("(Coming Soon)")).not.toBeInTheDocument();
  });
});
