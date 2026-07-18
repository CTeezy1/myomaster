export type MuscleBriefMode = "course" | "review" | "library";

export function getMuscleBriefPrimaryLabel(
  mode: MuscleBriefMode,
  libraryRegionName?: string,
): string {
  switch (mode) {
    case "course":
      return "Start Practice";
    case "review":
      return "Return to Practice";
    case "library":
      return `Back to ${libraryRegionName ?? "Region"} Library`;
  }
}
