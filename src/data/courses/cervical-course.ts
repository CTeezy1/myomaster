import type { Course } from "@/src/lib/course.types";

export const cervicalCourse: Course = {
  id: "cervical",
  name: "Cervical Course",
  region: "cervical",
  muscleProfileIds: [
    "longus-colli",
    "longus-capitis",
    "sternocleidomastoid",
    "scalenes",
    "levator-scapulae",
    "suboccipitals",
    "semispinalis-capitis",
  ],
};
