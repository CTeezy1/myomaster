import { getMuscleProfilesByRegion } from "@/src/data/cervical-muscle-profiles";

export type LibraryRegion = {
  id: string;
  name: string;
};

const libraryRegions: LibraryRegion[] = [
  {
    id: "cervical",
    name: "Cervical",
  },
];

export function getLibraryRegions(): LibraryRegion[] {
  return libraryRegions;
}

export function getLibraryRegion(
  regionId: string,
): LibraryRegion | undefined {
  const normalized = regionId.trim().toLowerCase();

  return libraryRegions.find((region) => region.id === normalized);
}

export function getLibraryRegionMuscleCount(regionId: string): number {
  return getMuscleProfilesByRegion(regionId).length;
}
