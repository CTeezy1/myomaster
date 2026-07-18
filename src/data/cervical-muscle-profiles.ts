import type { MuscleProfile } from "./muscle-profile.types";

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
      origin: "C1-T3 vertebral bodies",
      insertion: "C1-C6 vertebrae",
      action: "Cervical flexion/stability",
      innervation: "Anterior rami of spinal nerves C2-C6",
    },
    images: muscleImages("longus-colli"),
    memoryStory:
      "The LONGus COLli is the LONG muscle running along the COLli (neck) that flexes and stabilizes the cervical spine.",
    whyMemoryWorks: [
      "Longus means long — picture one continuous muscle running vertically along the anterior neck.",
      "Colli is Latin for neck, anchoring the image to the correct region.",
      "Its anterior placement matches cervical flexion and stability.",
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
      "Longus signals length — the muscle travels upward along the neck.",
      "Capitis refers to the head, linking the insertion at the basilar occiput.",
      "Reaching up to the cap matches head and neck flexion.",
    ],
  },
  {
    id: "sternocleidomastoid",
    name: "Sternocleidomastoid",
    region: "cervical",
    order: 3,
    description: "Superficial neck flexor and rotator",
    coreFacts: {
      origin: "Manubrium, clavicle",
      insertion: "Mastoid process",
      action:
        "Flexion (bilateral) , contra rotation and ipsi sidebend (unilateral)",
      innervation: "Spinal accessory (CN XI)",
    },
    images: muscleImages("sternocleidomastoid"),
    memoryStory:
      "The STERNO (chest) and CLEIDO (clavicle) connect to the MASTOID behind the ear like a strong strap.",
    whyMemoryWorks: [
      "Sterno points to the manubrium of the sternum.",
      "Cleido anchors the clavicular origin.",
      "Mastoid names the mastoid process insertion behind the ear.",
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
        "Lateral flexion (unilateral) flexion (bilateral) , rib 1-2 elevation",
      innervation: "Anterior rami of spinal nerves C3-C8",
    },
    images: muscleImages("scalenes"),
    memoryStory:
      "The first and second ribs can SCALE up the stairs toward the neck, or the neck can SCALE down toward that side of the ribs.",
    whyMemoryWorks: [
      "Scale evokes upward movement — matching rib 1-2 elevation.",
      "The stair image reinforces side-to-side motion for unilateral sidebending.",
      "Connecting neck and ribs matches the scalenes' dual attachments.",
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
      action: "Extension (bilateral) , sidebend (ipsilateral)",
      innervation: "Anterior rami C3-C4 and dorsal scapular nerve (c5)",
    },
    images: muscleImages("levator-scapulae"),
    memoryStory:
      "The levator scapulae works like an elevator that lifts the scapula.",
    whyMemoryWorks: [
      "Levator literally means to lift — matching scapular elevation.",
      "Scapulae names the superior medial scapula insertion.",
      "The elevator image ties cervical sidebending to scapular movement.",
    ],
  },
  {
    id: "suboccipitals",
    name: "Suboccipitals",
    region: "cervical",
    order: 6,
    description: "Deep head extensors and rotators",
    coreFacts: {
      origin: "C1-C2/occiput",
      insertion: "Occiput/C1-C2",
      action: "Head extension, ipsilateral rotation",
      innervation: "Suboccipital nerve C1",
    },
    images: muscleImages("suboccipitals"),
    memoryStory:
      "The 4 suboccipital muscles are the alignment mechanics of the head.",
    whyMemoryWorks: [
      "Suboccipital means below the occiput — the muscle group's location.",
      "Four small muscles working together fits fine head extension and rotation.",
      "Alignment mechanics reflects their role stabilizing head-on-neck movement.",
    ],
  },
  {
    id: "semispinalis-capitis",
    name: "Semispinalis Capitis",
    region: "cervical",
    order: 7,
    description: "Deep head extensor and rotator",
    coreFacts: {
      origin: "C4-T6 articular and transverse processes",
      insertion: "Occiput",
      action: [
        "Bilateral – head extension",
        "Unilateral – ipsilateral sidebend and contralateral rotation",
      ],
      innervation: [
        "Greater occipital nerve (C2)",
        "Spinal nerve of C3",
      ],
    },
    images: muscleImages("semispinalis-capitis"),
    memoryStory:
      "The SEMISPINALIS CAPITIS is the strong rigger that primarily extends the neck.",
    whyMemoryWorks: [
      "Semispinalis describes the muscle spanning multiple spinal segments toward the head.",
      "Capitis ties the action to head extension at the occiput.",
      "A strong rigger image matches its role as a powerful neck extensor.",
    ],
  },
];

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export function getMuscleProfileById(id: string): MuscleProfile | undefined {
  return cervicalMuscleProfiles.find((profile) => profile.id === id);
}

export function getMuscleProfileByName(
  name: string,
): MuscleProfile | undefined {
  const normalized = normalizeName(name);

  return cervicalMuscleProfiles.find(
    (profile) => normalizeName(profile.name) === normalized,
  );
}

export function getMuscleProfilesByRegion(region: string): MuscleProfile[] {
  const normalized = normalizeName(region);

  return cervicalMuscleProfiles
    .filter((profile) => normalizeName(profile.region) === normalized)
    .sort((a, b) => a.order - b.order);
}
