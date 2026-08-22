import { CANONICAL_REGIONS, type RegionId } from "@/src/data/regions";
import type { CourseSection } from "@/src/lib/profile.types";

export const CURRICULUM_IDS = [
  "legacy-canonical-v1",
  "upper-first-v1",
  "axial-then-upper-v1",
  "lower-first-v1",
] as const;

export type CurriculumId = (typeof CURRICULUM_IDS)[number];

const LEGACY_CANONICAL_REGION_ORDER = [
  "cervical",
  "shoulder",
  "elbow-and-forearm",
  "wrist-and-hand",
  "lumbar-and-thoracic",
  "hip",
  "knee",
  "ankle-and-foot",
] as const satisfies readonly RegionId[];

const UPPER_FIRST_REGION_ORDER = [
  "shoulder",
  "elbow-and-forearm",
  "wrist-and-hand",
  "hip",
  "knee",
  "ankle-and-foot",
  "cervical",
  "lumbar-and-thoracic",
] as const satisfies readonly RegionId[];

const AXIAL_THEN_UPPER_REGION_ORDER = [
  "cervical",
  "lumbar-and-thoracic",
  "shoulder",
  "elbow-and-forearm",
  "wrist-and-hand",
  "hip",
  "knee",
  "ankle-and-foot",
] as const satisfies readonly RegionId[];

const LOWER_FIRST_REGION_ORDER = [
  "ankle-and-foot",
  "knee",
  "hip",
  "lumbar-and-thoracic",
  "cervical",
  "shoulder",
  "elbow-and-forearm",
  "wrist-and-hand",
] as const satisfies readonly RegionId[];

export const CURRICULUM_REGION_ORDERS = {
  "legacy-canonical-v1": LEGACY_CANONICAL_REGION_ORDER,
  "upper-first-v1": UPPER_FIRST_REGION_ORDER,
  "axial-then-upper-v1": AXIAL_THEN_UPPER_REGION_ORDER,
  "lower-first-v1": LOWER_FIRST_REGION_ORDER,
} as const satisfies Record<CurriculumId, readonly RegionId[]>;

export const SECTION_CURRICULUM_IDS = {
  Testing: "upper-first-v1",
  "Kinesiology 1": "upper-first-v1",
  "Kinesiology 2": "axial-then-upper-v1",
  "Movement Anatomy 1": "lower-first-v1",
  "Movement Anatomy 2": "lower-first-v1",
} as const satisfies Record<CourseSection, CurriculumId>;

export const CANONICAL_REGION_IDS = CANONICAL_REGIONS.map(
  (region) => region.id,
) as readonly RegionId[];
