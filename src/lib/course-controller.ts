import {
  cervicalCourse,
  coursesById,
} from "@/src/data/courses";
import {
  getMuscleProfileById,
  getMuscleProfileByName,
  getMuscleProfileByNameAndRegion,
} from "@/src/data/muscle-profiles";
import type { Card } from "@/src/data/cards";
import type { MuscleProfile } from "@/src/data/muscle-profile.types";
import type { Course } from "@/src/lib/course.types";
import { isCanonicalRegionId } from "@/src/data/regions";
import { normalizeMuscleName } from "@/src/lib/study-session";

export function getCourseById(courseId: string): Course | undefined {
  return coursesById[courseId];
}

export function getCourseProfiles(course: Course): MuscleProfile[] {
  return course.muscleProfileIds
    .map((profileId) => getMuscleProfileById(profileId))
    .filter((profile): profile is MuscleProfile => profile !== undefined);
}

export function getCourseProfileAtIndex(
  course: Course,
  index: number,
): MuscleProfile | undefined {
  return getCourseProfiles(course)[index];
}

export function hasNextMuscle(course: Course, currentIndex: number): boolean {
  return currentIndex + 1 < course.muscleProfileIds.length;
}

export function getProfileForStudyCard(
  card: Card,
  course?: Course | null,
): MuscleProfile | undefined {
  if (course) {
    const targetName = normalizeMuscleName(card.muscle);
    const courseProfiles = getCourseProfiles(course);

    if (card.region) {
      const normalizedRegion = card.region.trim().toLowerCase();

      return courseProfiles.find(
        (profile) =>
          normalizeMuscleName(profile.name) === targetName &&
          profile.region.trim().toLowerCase() === normalizedRegion,
      );
    }

    return courseProfiles.find(
      (profile) => normalizeMuscleName(profile.name) === targetName,
    );
  }

  if (card.region) {
    return getMuscleProfileByNameAndRegion(card.muscle, card.region);
  }

  return getMuscleProfileByName(card.muscle);
}

export { cervicalCourse, myomasterProgramCourse } from "@/src/data/courses";
