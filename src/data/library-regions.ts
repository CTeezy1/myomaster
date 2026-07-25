import { CANONICAL_REGIONS } from "@/src/data/regions";
import { getMuscleProfilesByRegion } from "@/src/data/muscle-profiles";

export type LibraryRegion = {
  id: string;
  name: string;
};

export function getLibraryRegions(): LibraryRegion[] {
  return CANONICAL_REGIONS.map((region) => ({
    id: region.id,
    name: region.name,
  }));
}

export function getLibraryRegion(
  regionId: string,
): LibraryRegion | undefined {
  const normalized = regionId.trim().toLowerCase();

  return getLibraryRegions().find((region) => region.id === normalized);
}

export function getLibraryRegionMuscleCount(regionId: string): number {
  return getMuscleProfilesByRegion(regionId).length;
}
