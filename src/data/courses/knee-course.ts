import type { Course } from "@/src/lib/course.types";

export const kneeCourse: Course = {
  id: "knee",
  name: "Knee Course",
  region: "knee",
  muscleProfileIds: [
    "rectus-femoris",
    "vastus-medialis",
    "vastus-lateralis",
    "vastus-intermedialis",
    "biceps-femoris-short-head",
    "semitendinosus",
    "semimembranosus",
    "gracilis",
    "popliteus",
  ],
};
