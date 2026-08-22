import type { MuscleProfile } from "@/src/data/muscle-profile.types";

function muscleImages(regionId: string, id: string) {
  const basePath = `/images/muscles/${regionId}/${id}`;

  return {
    anatomy: `${basePath}/anatomy.png`,
    memory: `${basePath}/memory.png`,
  };
}

export const lumbarAndThoracicMuscleProfiles: MuscleProfile[] = [
  {
    id: "multifidus",
    name: "Multifidus",
    region: "lumbar-and-thoracic",
    order: 1,
    description: "Muscle of the Lumbar and Thoracic",
    coreFacts: {
      origin: "Sacrum/transverse processes",
      insertion: "Spinous processes",
      action: "Extension (bilateral) , Ipsi lateral flexion and contra rotation (unilateral)",
      innervation: "Dorsal rami of spinal nerves",
    },
    images: muscleImages("lumbar-and-thoracic", "multifidus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The name multifidus means “split into many parts,” depicted by the many climbers traveling from the transverse processes toward the spinous processes.",
    ],
  },
  {
    id: "erector-spinae",
    name: "Erector spinae",
    region: "lumbar-and-thoracic",
    order: 2,
    description: "Muscle of the Lumbar and Thoracic",
    coreFacts: {
      origin: "Iliac crest, sacrum",
      insertion: "Ribs, vertebrae, skull",
      action: "Extension (bilateral) , Ipsi lateral flexion (unilateral)",
      innervation: "Dorsal rami of spinal nerves",
    },
    images: muscleImages("lumbar-and-thoracic", "erector-spinae"),
    memoryStory: "",
    whyMemoryWorks: [
      "The three workers running vertically along each side of the spine represent the three erector spinae muscles: spinalis, longissimus, and iliocostalis.",
    ],
  },
  {
    id: "rotatores",
    name: "Rotatores",
    region: "lumbar-and-thoracic",
    order: 3,
    description: "Muscle of the Lumbar and Thoracic",
    coreFacts: {
      origin: "Transverse processes",
      insertion: "Superior spinous processes",
      action: "Extension (bilateral), Contralateral rotation (unilateral)",
      innervation: "Dorsal rami of spinal nerves",
    },
    images: muscleImages("lumbar-and-thoracic", "rotatores"),
    memoryStory: "",
    whyMemoryWorks: [
      "The small rotors on the vertebrae represent the rotatores, small muscles that help rotate and extend the spine.",
    ],
  },
  {
    id: "quadratus-lumborum",
    name: "Quadratus lumborum",
    region: "lumbar-and-thoracic",
    order: 4,
    description: "Muscle of the Lumbar and Thoracic",
    coreFacts: {
      origin: "Iliac crest",
      insertion: "12th rib, L1-L4",
      action: "Extension (bilateral), Ipsilateral sidebend (unilateral)",
      innervation: "T12-L4 anterior rami spinal nerves",
    },
    images: muscleImages("lumbar-and-thoracic", "quadratus-lumborum"),
    memoryStory: "",
    whyMemoryWorks: [
      "The pump jacks extending from the iliac crests toward the ribs represent the quadratus lumborum, which connects the pelvis to the 12th rib and helps side bend the spine.",
    ],
  },
  {
    id: "transversus-abdominis",
    name: "Transversus abdominis",
    region: "lumbar-and-thoracic",
    order: 5,
    description: "Muscle of the Lumbar and Thoracic",
    coreFacts: {
      origin: "Thoracolumbar fascia, ribs",
      insertion: "Linea alba",
      action: "Abdominal compression",
      innervation: "T7-L1 anterior rami of spinal nerves",
    },
    images: muscleImages("lumbar-and-thoracic", "transversus-abdominis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The deep corset wrapped around the abdomen represents the transversus abdominis, a deep abdominal muscle that compresses the abdomen like a corset around the core.",
    ],
  },
  {
    id: "internal-oblique",
    name: "Internal oblique",
    region: "lumbar-and-thoracic",
    order: 6,
    description: "Muscle of the Lumbar and Thoracic",
    coreFacts: {
      origin: "Iliac crest",
      insertion: "Ribs 10-12, linea alba",
      action: "Trunk flexion (bilateral),  Ipsilateral rotation and sidebend (unilateral)",
      innervation: "T6-L1 anterior rami of spinal nerves",
    },
    images: muscleImages("lumbar-and-thoracic", "internal-oblique"),
    memoryStory: "",
    whyMemoryWorks: [
      "The deeper oblique fibers run from inferolateral to superomedial, represented by the upward diagonal lines. This fiber direction helps rotate the trunk to the same side.",
    ],
  },
  {
    id: "rectus-abdominis",
    name: "Rectus abdominis",
    region: "lumbar-and-thoracic",
    order: 7,
    description: "Muscle of the Lumbar and Thoracic",
    coreFacts: {
      origin: "Pubic crest",
      insertion: "Xiphoid and ribs 5-7",
      action: "Trunk flexion",
      innervation: "T6-T12 anterior rami of spinal nerves",
    },
    images: muscleImages("lumbar-and-thoracic", "rectus-abdominis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The six-pack on the abdomen represents the rectus abdominis, the classic “six-pack” muscle that flexes the trunk.",
    ],
  },
  {
    id: "external-oblique",
    name: "External oblique",
    region: "lumbar-and-thoracic",
    order: 8,
    description: "Muscle of the Lumbar and Thoracic",
    coreFacts: {
      origin: "External surface ribs 5-12",
      insertion: "pubic tubercle, linea alba, anterior half of iliac crest",
      action: "Trunk flexion (bilateral),  Contra rotation and Ipsi sidebend (unilateral)",
      innervation: "T7-T12 anterior rami of spinal nerves",
    },
    images: muscleImages("lumbar-and-thoracic", "external-oblique"),
    memoryStory: "",
    whyMemoryWorks: [
      "The more superficial oblique fibers run from superolateral to inferomedial, represented by the downward diagonal lines. This fiber direction helps rotate the trunk to the opposite side.",
    ],
  },
];
