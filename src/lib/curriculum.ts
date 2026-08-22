import {
  CURRICULUM_IDS,
  CURRICULUM_REGION_ORDERS,
  SECTION_CURRICULUM_IDS,
  type CurriculumId,
} from "@/src/data/curricula/section-region-orders";
import { getMuscleProfilesForRegionId } from "@/src/data/muscle-profiles";
import { myomasterProgramCourse } from "@/src/data/courses/myomaster-program-course";
import type { RegionId } from "@/src/data/regions";
import type { Course } from "@/src/lib/course.types";
import type { CourseSection } from "@/src/lib/profile.types";

export type { CurriculumId } from "@/src/data/curricula/section-region-orders";
export {
  CURRICULUM_IDS,
  CURRICULUM_REGION_ORDERS,
  SECTION_CURRICULUM_IDS,
} from "@/src/data/curricula/section-region-orders";

export function isCurriculumId(value: string): value is CurriculumId {
  return (CURRICULUM_IDS as readonly string[]).includes(value);
}

export function parseCurriculumId(value: string): CurriculumId | null {
  return isCurriculumId(value) ? value : null;
}

function assertCurriculumId(value: string): asserts value is CurriculumId {
  if (!isCurriculumId(value)) {
    throw new Error(`Unknown curriculum id: ${value}`);
  }
}

export function getCurriculumIdForSection(
  section: CourseSection,
): CurriculumId {
  return SECTION_CURRICULUM_IDS[section];
}

export function getCurriculumRegionOrder(
  curriculumId: CurriculumId,
): readonly RegionId[] {
  assertCurriculumId(curriculumId);
  return CURRICULUM_REGION_ORDERS[curriculumId];
}

export function buildMuscleRoster(curriculumId: CurriculumId): string[] {
  assertCurriculumId(curriculumId);

  return CURRICULUM_REGION_ORDERS[curriculumId].flatMap((regionId) =>
    getMuscleProfilesForRegionId(regionId).map((profile) => profile.id),
  );
}

export function getStudyCourseForCurriculum(
  curriculumId: CurriculumId,
): Course {
  return {
    id: myomasterProgramCourse.id,
    name: myomasterProgramCourse.name,
    region: myomasterProgramCourse.region,
    muscleProfileIds: buildMuscleRoster(curriculumId),
  };
}
