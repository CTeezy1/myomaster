import type { Course } from "@/src/lib/course.types";

export const kneeCourse: Course = {
  id: "knee",
  name: "Knee Course",
  region: "knee",
  muscleProfileIds: [
    "knee-rectus-femoris",
    "vastus-medialis",
    "vastus-lateralis",
    "vastus-intermedialis",
    "biceps-femoris-short-head",
    "semitendinosus",
    "knee-semimembranosus",
    "gracilis",
    "popliteus",
  ],
};
