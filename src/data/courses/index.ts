import { ankleAndFootCourse } from "@/src/data/courses/ankle-and-foot-course";
import { cervicalCourse } from "@/src/data/courses/cervical-course";
import { elbowAndForearmCourse } from "@/src/data/courses/elbow-and-forearm-course";
import { hipCourse } from "@/src/data/courses/hip-course";
import { kneeCourse } from "@/src/data/courses/knee-course";
import { lumbarAndThoracicCourse } from "@/src/data/courses/lumbar-and-thoracic-course";
import { myomasterProgramCourse } from "@/src/data/courses/myomaster-program-course";
import { shoulderCourse } from "@/src/data/courses/shoulder-course";
import { wristAndHandCourse } from "@/src/data/courses/wrist-and-hand-course";
import type { Course } from "@/src/lib/course.types";
import type { RegionId } from "@/src/data/regions";

export const allCourses: Course[] = [
  myomasterProgramCourse,
  cervicalCourse,
  shoulderCourse,
  elbowAndForearmCourse,
  wristAndHandCourse,
  lumbarAndThoracicCourse,
  hipCourse,
  kneeCourse,
  ankleAndFootCourse,
];

export const coursesById: Record<string, Course> = Object.fromEntries(
  allCourses.map((course) => [course.id, course]),
);

export function getCourseByRegionId(regionId: RegionId): Course | undefined {
  return allCourses.find((course) => course.region === regionId);
}

export {
  ankleAndFootCourse,
  cervicalCourse,
  elbowAndForearmCourse,
  hipCourse,
  kneeCourse,
  lumbarAndThoracicCourse,
  myomasterProgramCourse,
  shoulderCourse,
  wristAndHandCourse,
};
