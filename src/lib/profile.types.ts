export type CourseSection =
  | "Testing"
  | "Kinesiology 1"
  | "Kinesiology 2"
  | "Movement Anatomy 1"
  | "Movement Anatomy 2";

export const COURSE_SECTIONS = [
  "Testing",
  "Kinesiology 1",
  "Kinesiology 2",
  "Movement Anatomy 1",
  "Movement Anatomy 2",
] as const satisfies readonly CourseSection[];

export function isCourseSection(value: string): value is CourseSection {
  return (COURSE_SECTIONS as readonly string[]).includes(value);
}

export type Profile = {
  id: string;
  username: string;
  username_slug: string;
  section: CourseSection;
  created_at: string;
};

export type ProfileInsert = {
  id: string;
  username: string;
  username_slug: string;
  section: CourseSection;
};
