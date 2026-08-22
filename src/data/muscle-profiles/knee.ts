import type { MuscleProfile } from "@/src/data/muscle-profile.types";

function muscleImages(regionId: string, id: string) {
  const basePath = `/images/muscles/${regionId}/${id}`;

  return {
    anatomy: `${basePath}/anatomy.png`,
    memory: `${basePath}/memory.png`,
  };
}

export const kneeMuscleProfiles: MuscleProfile[] = [
  {
    id: "rectus-femoris",
    name: "Rectus femoris",
    region: "knee",
    order: 1,
    description: "Muscle of the Knee",
    coreFacts: {
      origin: "AIIS (anterior inferior iliac spine)",
      insertion: "Tibial tuberosity via patella tendon",
      action: "Knee extension, hip flexion",
      innervation: "Femoral nerve L2-L4",
    },
    images: muscleImages("knee", "rectus-femoris"),
    memoryStory: "",
    whyMemoryWorks: [
      "The four doormen closing the door represent the quadriceps as the primary knee extensors. The tall doorman wearing the AIIS hat represents rectus femoris crossing the hip and originating from the anterior inferior iliac spine. All four doormen stand on the same rug to represent their shared insertion on the patella. The blue image represents innervation by the femoral nerve.",
    ],
  },
  {
    id: "vastus-medialis",
    name: "Vastus medialis",
    region: "knee",
    order: 2,
    description: "Muscle of the Knee",
    coreFacts: {
      origin: "Medial femur",
      insertion: "Patella",
      action: "Knee extension",
      innervation: "Femoral nerve L2-L4",
    },
    images: muscleImages("knee", "vastus-medialis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The four doormen closing the door represent the quadriceps as the primary knee extensors. The doorman labeled medial represents the position and origin of vastus medialis on the medial femur. All four doormen stand on the same rug to represent their shared insertion on the patella. The blue image represents innervation by the femoral nerve.",
    ],
  },
  {
    id: "vastus-lateralis",
    name: "Vastus lateralis",
    region: "knee",
    order: 3,
    description: "Muscle of the Knee",
    coreFacts: {
      origin: "lateral femur",
      insertion: "Patella",
      action: "Knee extension",
      innervation: "Femoral nerve L2-L4",
    },
    images: muscleImages("knee", "vastus-lateralis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The four doormen closing the door represent the quadriceps as the primary knee extensors. The doorman labeled lateral represents the position and origin of vastus lateralis on the lateral femur. All four doormen stand on the same rug to represent their shared insertion on the patella. The blue image represents innervation by the femoral nerve.",
    ],
  },
  {
    id: "vastus-intermedialis",
    name: "Vastus Intermedialis",
    region: "knee",
    order: 4,
    description: "Muscle of the Knee",
    coreFacts: {
      origin: "Intertrochanteric line of femur",
      insertion: "Patella",
      action: "Knee extension",
      innervation: "Femoral nerve L2-L4",
    },
    images: muscleImages("knee", "vastus-intermedialis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The four doormen closing the door represent the quadriceps as the primary knee extensors. The doorman labeled middle represents the position and origin of vastus intermedius on the middle of the femur. All four doormen stand on the same rug to represent their shared insertion on the patella. The blue image represents innervation by the femoral nerve.",
    ],
  },
  {
    id: "biceps-femoris",
    name: "Biceps femoris",
    region: "knee",
    order: 5,
    description: "Muscle of the Knee",
    coreFacts: {
      origin: "Ischial tuberosity/femur",
      insertion: "Fibular head",
      action: "Knee flexion",
      innervation:
        "long head: tibial division of sciatic nerve (L5-S2) Short head: common fibular division of sciatic nerve (L5-S2)",
    },
    images: muscleImages("knee", "biceps-femoris"),
    memoryStory: "",
    whyMemoryWorks: [
      "The three doormen opening the door represent the hamstrings as primary knee flexors. They stand on the pelvis rug to represent their shared origin at the ischial tuberosity. Biceps femoris stands on the lateral side, and the skull shoes represent insertion on the head of the fibula. His half-pink, half-purple clothing represents the two heads: the long head is innervated by the tibial division of the sciatic nerve, while the short head is innervated by the common fibular division of the sciatic nerve. The red image represents innervation by the sciatic nerve.",
    ],
  },
  {
    id: "semitendinosus",
    name: "Semitendinosus",
    region: "knee",
    order: 6,
    description: "Muscle of the Knee",
    coreFacts: {
      origin: "Ischial tuberosity",
      insertion: "Pes anserine",
      action: "Knee flexion, hip extension",
      innervation: "tibial division of sciatic nerve (L5-S2)",
    },
    images: muscleImages("knee", "semitendinosus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The three doormen opening the door represent the hamstrings as primary knee flexors. They stand on the pelvis rug to represent their shared origin at the ischial tuberosity. The doorman labeled tendin stands on the medial side, and his webbed feet represent insertion on the pes anserinus. The red image represents innervation by the sciatic nerve.",
    ],
  },
  {
    id: "semimembranosus",
    name: "Semimembranosus",
    region: "knee",
    order: 7,
    description: "Muscle of the Knee",
    coreFacts: {
      origin: "Ischial tuberosity",
      insertion: "Posterior medial condyle of tibia",
      action: "knee flexion, hip extension",
      innervation: "tibial division of sciatic nerve (L5-S2)",
    },
    images: muscleImages("knee", "semimembranosus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The three doormen opening the door represent the hamstrings as primary knee flexors. They stand on the pelvis rug to represent their shared origin at the ischial tuberosity. The doorman labeled membran stands on the medial side to represent semimembranosus and its insertion on the posteromedial tibia. The red image represents innervation by the sciatic nerve.",
    ],
  },
  {
    id: "gracilis",
    name: "Gracilis",
    region: "knee",
    order: 8,
    description: "Muscle of the Knee",
    coreFacts: {
      origin: "Body and inferior ramus of pubis",
      insertion: "Pes anserine",
      action: "Knee flexion, tibial IR; assists hip adduction",
      innervation: "Obturator nerve L2-L3",
    },
    images: muscleImages("knee", "gracilis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The doorman opening the door represents gracilis assisting with knee flexion. His crossed feet represent hip adduction, while his webbed feet represent insertion on the pes anserinus. His green clothing represents innervation by the obturator nerve.",
    ],
  },
  {
    id: "popliteus",
    name: "Popliteus",
    region: "knee",
    order: 9,
    description: "Muscle of the Knee",
    coreFacts: {
      origin: "Lateral femoral condyle, lateral meniscus",
      insertion: "Posterior proximal tibia",
      action: "Tibal IR ,unlocks knee",
      innervation: "Tibial nerve L4-S1",
    },
    images: muscleImages("knee", "popliteus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The child doorman unlocking the door represents the small popliteus muscle “unlocking” the knee through internal rotation of the tibia. The pink image represents innervation by the tibial nerve.",
    ],
  },
];
