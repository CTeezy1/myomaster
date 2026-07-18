import { cervicalCourse } from "@/src/data/courses/cervical-course";
import {
  getMuscleProfileById,
  getMuscleProfileByName,
} from "@/src/data/cervical-muscle-profiles";
import type { Card } from "@/src/data/cards";
import type { MuscleProfile } from "@/src/data/muscle-profile.types";
import type { Course } from "@/src/lib/course.types";
import { normalizeMuscleName } from "@/src/lib/study-session";

const coursesById: Record<string, Course> = {
  [cervicalCourse.id]: cervicalCourse,
};

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

    return getCourseProfiles(course).find(
      (profile) => normalizeMuscleName(profile.name) === targetName,
    );
  }

  return getMuscleProfileByName(card.muscle);
}

export { cervicalCourse };
