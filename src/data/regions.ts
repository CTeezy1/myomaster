import regionsData from "@/src/data/regions.json";

export type RegionDefinition = {
  id: string;
  name: string;
};

export type RegionId = (typeof regionsData)[number]["id"];

export const CANONICAL_REGIONS: RegionDefinition[] = regionsData;

export function getRegionById(regionId: string): RegionDefinition | undefined {
  const normalized = regionId.trim().toLowerCase();

  return CANONICAL_REGIONS.find((region) => region.id === normalized);
}

export function isCanonicalRegionId(regionId: string): regionId is RegionId {
  return getRegionById(regionId) !== undefined;
}
