import type { Course } from "@/src/lib/course.types";

export const lumbarAndThoracicCourse: Course = {
  id: "lumbar-and-thoracic",
  name: "Lumbar and Thoracic Course",
  region: "lumbar-and-thoracic",
  muscleProfileIds: [
    "multifidus",
    "erector-spinae",
    "rotatores",
    "quadratus-lumborum",
    "transversus-abdominis",
    "internal-oblique",
    "rectus-abdominis",
    "external-oblique",
  ],
};
