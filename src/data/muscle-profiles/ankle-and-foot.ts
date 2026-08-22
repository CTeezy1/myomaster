import type { MuscleProfile } from "@/src/data/muscle-profile.types";

function muscleImages(regionId: string, id: string) {
  const basePath = `/images/muscles/${regionId}/${id}`;

  return {
    anatomy: `${basePath}/anatomy.png`,
    memory: `${basePath}/memory.png`,
  };
}

export const ankleAndFootMuscleProfiles: MuscleProfile[] = [
  {
    id: "gastrocnemius",
    name: "Gastrocnemius",
    region: "ankle-and-foot",
    order: 1,
    description: "Muscle of the Ankle and Foot",
    coreFacts: {
      origin: "Medial and lateral condyles",
      insertion: "Posterior calcaneous",
      action: "Ankle Plantarflexion, assists knee flexion",
      innervation: "Tibial nerve S1-S2",
    },
    images: muscleImages("ankle-and-foot", "gastrocnemius"),
    memoryStory: "",
    whyMemoryWorks: [
      "The skier holds the femur rail to represent the gastrocnemius originating from the femoral condyles. Standing on tiptoes represents plantar flexion at the ankle. The pink color represents innervation by the tibial nerve.",
    ],
  },
  {
    id: "soleus",
    name: "Soleus",
    region: "ankle-and-foot",
    order: 2,
    description: "Muscle of the Ankle and Foot",
    coreFacts: {
      origin: "Posterior tibia and proximal fibula",
      insertion: "Posterior calcaneus",
      action: "Ankle Plantarflexion",
      innervation: "Tibial nerve S1-S2",
    },
    images: muscleImages("ankle-and-foot", "soleus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The skier holds a thick pole for the tibia and a thin pole for the fibula, representing the soleus originating from both bones. Standing on tiptoes represents plantar flexion at the ankle. The pink color represents innervation by the tibial nerve.",
    ],
  },
  {
    id: "tibialis-anterior",
    name: "Tibialis anterior",
    region: "ankle-and-foot",
    order: 3,
    description: "Muscle of the Ankle and Foot",
    coreFacts: {
      origin: "Lateral tibia, lateral condyle of tibia",
      insertion: "Medial cuneiform and base of 1st Metatarsal",
      action: "Dorsiflexion, inversion",
      innervation: "Deep fibular L4-L5",
    },
    images: muscleImages("ankle-and-foot", "tibialis-anterior"),
    memoryStory: "",
    whyMemoryWorks: [
      "The snowboarder holds the thick tibia pole to represent the muscle’s origin on the tibia, while the “1” at the bottom of the pole represents insertion at the base of the first metatarsal. The toes-up position represents ankle dorsiflexion, and the backward hat represents inversion. The dark purple color represents innervation by the deep fibular nerve.",
    ],
  },
  {
    id: "tibialis-posterior",
    name: "Tibialis posterior",
    region: "ankle-and-foot",
    order: 4,
    description: "Muscle of the Ankle and Foot",
    coreFacts: {
      origin: "posterior tibia and fibula",
      insertion: "Navicular, cuneiforms, cuboid, base of MT 2-4",
      action: "Ankle plantarflexion and inversion; support medial arch",
      innervation: "Tibial nerve L4-L5",
    },
    images: muscleImages("ankle-and-foot", "tibialis-posterior"),
    memoryStory: "",
    whyMemoryWorks: [
      "The skier holds a thick pole for the tibia and a thin pole for the fibula, representing the tibialis posterior originating from both bones. Standing on tiptoes represents plantar flexion, while the backward hat represents inversion at the ankle. The pink color represents innervation by the tibial nerve.",
    ],
  },
  {
    id: "fibularis-longus",
    name: "Fibularis longus",
    region: "ankle-and-foot",
    order: 5,
    description: "Muscle of the Ankle and Foot",
    coreFacts: {
      origin: "Head of fibula and proximal lateral fibula",
      insertion: "Base of 1st metatarsal and medial cuneiform",
      action: "Ankle Eversion and plantarflexion, support transverse arch",
      innervation: "Superficial fibular L5-S2",
    },
    images: muscleImages("ankle-and-foot", "fibularis-longus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The snowboarder holds the thin fibula pole to represent the muscle’s origin on the fibula, while the “1” at the bottom of the pole represents insertion at the base of the first metatarsal. The sideways hat represents eversion at the ankle. The light purple color represents innervation by the superficial fibular nerve.",
    ],
  },
  {
    id: "fibularis-brevis",
    name: "Fibularis brevis",
    region: "ankle-and-foot",
    order: 6,
    description: "Muscle of the Ankle and Foot",
    coreFacts: {
      origin: "Distal lateral fibula",
      insertion: "Tuberosity of 5th metatarsal",
      action: "Ankle eversion and plantarflexion",
      innervation: "Superficial fibular nerve L5-S2",
    },
    images: muscleImages("ankle-and-foot", "fibularis-brevis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The smaller snowboarder holds the thin fibula pole lower down to represent the muscle’s origin on the distal fibula, while the “5” at the bottom of the pole represents insertion at the base of the fifth metatarsal. The sideways hat represents eversion at the ankle. The light purple color represents innervation by the superficial fibular nerve.",
    ],
  },
  {
    id: "extensor-hallucis-longus",
    name: "Extensor Hallucis Longus",
    region: "ankle-and-foot",
    order: 7,
    description: "Muscle of the Ankle and Foot",
    coreFacts: {
      origin: "Anterior fibula",
      insertion: "Distal phalanx of great toe",
      action: "Great toe extension",
      innervation: "Deep fibular nerve L5-S1",
    },
    images: muscleImages("ankle-and-foot", "extensor-hallucis-longus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The barefoot skier holds the thin fibula pole to represent the muscle’s origin on the fibula. The “1” on the ski represents insertion on the great toe, while the ski curling upward represents great-toe extension. The dark purple color represents innervation by the deep fibular nerve.",
    ],
  },
  {
    id: "ankle-and-foot-extensor-digitorum",
    name: "Extensor Digitorum",
    region: "ankle-and-foot",
    order: 8,
    description: "Muscle of the Ankle and Foot",
    coreFacts: {
      origin: "Lateral tibial condyle, fibula",
      insertion: "Middle and distal phalanges 2-5",
      action: "Extends digits 2-5",
      innervation: "Deep fibular nerve L5-S1",
    },
    images: muscleImages("ankle-and-foot", "ankle-and-foot-extensor-digitorum"),
    memoryStory: "",
    whyMemoryWorks: [
      "The barefoot skier holds a thick tibia pole and a thin fibula pole to represent the muscle’s origins on the tibia and fibula. The “2” and “5” on the skis represent insertion on toes 2–5, while the skis curling upward represent toe extension. The dark purple color represents innervation by the deep fibular nerve.",
    ],
  },
  {
    id: "flexor-hallucis-longus",
    name: "Flexor hallucis longus",
    region: "ankle-and-foot",
    order: 9,
    description: "Muscle of the Ankle and Foot",
    coreFacts: {
      origin: "Posterior fibula, interosseus membrane",
      insertion: "Distal phalanx of great toe",
      action: "Great toe flexion",
      innervation: "Tibial nerve S2-S3",
    },
    images: muscleImages("ankle-and-foot", "flexor-hallucis-longus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The barefoot skier holds the thin fibula pole to represent the muscle’s origin on the fibula. The “1” on the ski represents insertion on the great toe, while the ski curling downward represents great-toe flexion. The pink color represents innervation by the tibial nerve.",
    ],
  },
  {
    id: "flexor-digitorum-longus",
    name: "Flexor Digitorum longus",
    region: "ankle-and-foot",
    order: 10,
    description: "Muscle of the Ankle and Foot",
    coreFacts: {
      origin: "Posterior tibia",
      insertion: "Distal phalanges 2-5",
      action: "Flexes digits 2-5",
      innervation: "Tibial nerve S2-S3",
    },
    images: muscleImages("ankle-and-foot", "flexor-digitorum-longus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The barefoot skier holds the thick tibia pole to represent the muscle’s origin on the tibia. The “2” and “5” on the skis represent insertion on toes 2–5, while the skis curling downward represent toe flexion. The pink color represents innervation by the tibial nerve.",
    ],
  },
];
