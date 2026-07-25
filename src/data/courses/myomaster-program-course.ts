import { getMuscleProfilesForRegionId } from "@/src/data/muscle-profiles";
import { CANONICAL_REGIONS } from "@/src/data/regions";
import type { Course } from "@/src/lib/course.types";

export const myomasterProgramCourse: Course = {
  id: "myomaster-program",
  name: "MyoMaster 15-Week Program",
  region: "program",
  muscleProfileIds: CANONICAL_REGIONS.flatMap((region) =>
    getMuscleProfilesForRegionId(region.id).map((profile) => profile.id),
  ),
};
