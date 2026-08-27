import type { MuscleProfile } from "@/src/data/muscle-profile.types";

function muscleImages(id: string) {
  const basePath = `/images/muscles/cervical/${id}`;

  return {
    anatomy: `${basePath}/anatomy.png`,
    memory: `${basePath}/memory.png`,
  };
}

export const cervicalMuscleProfiles: MuscleProfile[] = [
  {
    id: "longus-colli",
    name: "Longus Colli",
    region: "cervical",
    order: 1,
    description: "Deep anterior neck flexor and cervical stabilizer",
    coreFacts: {
      origin: "C3-T3",
      insertion: "C1-C6 vertebrae",
      action: "Cervical flexion/stability",
      innervation: "Anterior rami of spinal nerves C2-C6",
    },
    images: muscleImages("longus-colli"),
    memoryStory:
      "The LONGus COLli is the LONG muscle running along the COLli (neck) that flexes and stabilizes the cervical spine.",
    whyMemoryWorks: [
      "The LONGus COLli is the LONG muscle running along the COLli (neck) that flexes and stabilizes the cervical spine.",
    ],
  },
  {
    id: "longus-capitis",
    name: "Longus Capitis",
    region: "cervical",
    order: 2,
    description: "Deep neck/head flexor and stabilizer",
    coreFacts: {
      origin: "C3-C6 transverse processes",
      insertion: "Basilar occiput",
      action: "Head/neck flexion",
      innervation: "Anterior rami of spinal nerves C1-C3",
    },
    images: muscleImages("longus-capitis"),
    memoryStory:
      "Longus Capitis is a LONG neck muscle that reaches up to the CAP (skull).",
    whyMemoryWorks: [
      "Longus Capitis is a LONG neck muscle that reaches up to the CAP (skull).",
    ],
  },
  {
    id: "sternocleidomastoid",
    name: "Sternocleidomastoid",
    region: "cervical",
    order: 3,
    description: "Superficial neck flexor and rotator",
    coreFacts: {
      origin: "Manubrium of sternum, medial clavicle",
      insertion: "Mastoid process",
      action:
        "Flexion (bilateral) , contra rotation and ipsi sidebend (unilateral)",
      innervation: "Spinal accessory (CN XI)",
    },
    images: muscleImages("sternocleidomastoid"),
    memoryStory:
      "The STERNO (chest) and CLEIDO (clavicle) connect to the MASTOID behind the ear like a strong strap.",
    whyMemoryWorks: [
      "The STERNO (chest) and CLEIDO (clavicle) connect to the MASTOID behind the ear like a strong strap.",
    ],
  },
  {
    id: "scalenes",
    name: "Scalenes",
    region: "cervical",
    order: 4,
    description:
      "Lateral neck muscles that assist sidebending and rib elevation",
    coreFacts: {
      origin: "C2-C7 transverse processes",
      insertion: "Ribs 1-2",
      action:
        "Neck flexion (bilateral), ipsilateral sidebend (unilateral), rib 1-2 elevation",
      innervation: "Anterior rami of spinal nerves C3-C8",
    },
    images: muscleImages("scalenes"),
    memoryStory:
      "The first and second ribs can SCALE up the stairs toward the neck, or the neck can SCALE down toward that side of the ribs.",
    whyMemoryWorks: [
      "The first and second ribs can SCALE up the stairs toward the neck, or the neck can SCALE down toward that side of the ribs.",
    ],
  },
  {
    id: "levator-scapulae",
    name: "Levator Scapulae",
    region: "cervical",
    order: 5,
    description: "Scapular elevator and cervical sidebender",
    coreFacts: {
      origin: "C1-C4 transverse processes",
      insertion: "Superior medial scapula",
      action:
        "Neck sidebend, elevation of the scapula, downward rotation of the scapula",
      innervation: "Anterior rami C3-C4 and dorsal scapular nerve (c5)",
    },
    images: muscleImages("levator-scapulae"),
    memoryStory:
      "The levator scapulae works like an elevator that lifts the scapula.",
    whyMemoryWorks: [
      "The levator scapulae works like an elevator that lifts the scapula.",
    ],
  },
  {
    id: "suboccipitals",
    name: "Suboccipitals",
    region: "cervical",
    order: 6,
    description: "Deep head extensors and rotators",
    coreFacts: {
      origin: "C1-C2",
      insertion: "Occiput and C1",
      action: "Head extension, ipsilateral rotation",
      innervation: "Suboccipital nerve C1",
    },
    images: muscleImages("suboccipitals"),
    memoryStory:
      "The 4 suboccipital muscles are the alignment mechanics of the head.",
    whyMemoryWorks: [
      "The 4 suboccipital muscles are the alignment mechanics of the head.",
    ],
  },
  {
    id: "semispinalis-capitis",
    name: "Semispinalis Capitis",
    region: "cervical",
    order: 7,
    description: "Deep head extensor and rotator",
    coreFacts: {
      origin: "C4-T6 transverse and articular processes",
      insertion: "Occiput",
      action:
        "Head extension (bilateral), contralateral rotation and ipsilateral sidebend (unilateral)",
      innervation: "Greater occipital nerve (C2) and C3 spinal nerve",
    },
    images: muscleImages("semispinalis-capitis"),
    memoryStory:
      "The SEMISPINALIS CAPITIS is the strong rigger that primarily extends the neck.",
    whyMemoryWorks: [
      "The SEMISPINALIS CAPITIS is the strong rigger that primarily extends the neck.",
    ],
  },
];
