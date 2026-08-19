import type { MuscleProfile } from "@/src/data/muscle-profile.types";

function muscleImages(regionId: string, id: string) {
  const basePath = `/images/muscles/${regionId}/${id}`;

  return {
    anatomy: `${basePath}/anatomy.png`,
    memory: `${basePath}/memory.png`,
  };
}

export const shoulderMuscleProfiles: MuscleProfile[] = [
  {
    id: "supraspinatus",
    name: "Supraspinatus",
    region: "shoulder",
    order: 1,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Supraspinous fossa",
      insertion: "Greater tubercle of humerus",
      action: "Initiates Shoulder Abduction, stabilizes humeral  head",
      innervation: "Suprascapular nerve C5-C6",
    },
    images: muscleImages("shoulder", "supraspinatus"),
    memoryStory: "",
    whyMemoryWorks: [
      "This rotator cuff mechanic stands above the scapular spine, representing the supraspinous fossa. The power cord from above represents the suprascapular nerve, and his arm pointing to the side reinforces shoulder abduction.",
    ],
  },
  {
    id: "infraspinatus",
    name: "Infraspinatus",
    region: "shoulder",
    order: 2,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Infraspinous fossa",
      insertion: "Greater tubercle",
      action: "Shoulder External rotation, stabilizes humeral head",
      innervation: "Suprascapular nerve C5-C6",
    },
    images: muscleImages("shoulder", "infraspinatus"),
    memoryStory: "",
    whyMemoryWorks: [
      "This rotator cuff mechanic is positioned in the infraspinous fossa. The externally rotated arm reinforces the muscle's action. The wire from above (“supra”) indicates innervation by the suprascapular nerve.",
    ],
  },
  {
    id: "teres-minor",
    name: "Teres minor",
    region: "shoulder",
    order: 3,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Lateral scapula",
      insertion: "Greater tubercle",
      action: "Shoulder External rotation, stabilizes humeral head",
      innervation: "Axillary nerve C5-C6",
    },
    images: muscleImages("shoulder", "teres-minor"),
    memoryStory: "",
    whyMemoryWorks: [
      "This alien (“teres”) rotator cuff mechanic has his shoulders externally rotated from an abducted position, reinforcing external rotation. His position beside the lateral scapula represents the muscle's origin, while green symbolizes innervation by the axillary nerve.",
    ],
  },
  {
    id: "subscapularis",
    name: "Subscapularis",
    region: "shoulder",
    order: 4,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Subscapular fossa",
      insertion: "Lesser tubercle",
      action: "Shoulder Internal rotation",
      innervation: "Upper and Lower Subscapular nerve C5-C7",
    },
    images: muscleImages("shoulder", "subscapularis"),
    memoryStory: "",
    whyMemoryWorks: [
      "This rotator cuff mechanic is positioned in front of the scapula, representing its origin on the anterior scapula. The arm position reinforces internal rotation. Two power cords connecting from above and below represent the upper and lower subscapular nerves.",
    ],
  },
  {
    id: "teres-major",
    name: "Teres major",
    region: "shoulder",
    order: 5,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Inferior angle of scapula",
      insertion: "Intertubular sulcus (humerus)",
      action: "Shoulder Extension, IR",
      innervation: "Lower Subscapular Nerve (C5-C7)",
    },
    images: muscleImages("shoulder", "teres-major"),
    memoryStory: "",
    whyMemoryWorks: [
      "This alien (“teres”) superhero has her hands handcuffed behind her back, reinforcing shoulder extension and internal rotation. The submarine setting and electrical cord from below represent innervation by the lower subscapular nerve.",
    ],
  },
  {
    id: "latissimus-dorsi",
    name: "Latissimus dorsi",
    region: "shoulder",
    order: 6,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "T7-L5, iliac crest",
      insertion: "Intertuberular sulcus of Humerus",
      action: "Shoulder Extension, adduction, IR",
      innervation: "Thoracodorsal C6-C8",
    },
    images: muscleImages("shoulder", "latissimus-dorsi"),
    memoryStory: "",
    whyMemoryWorks: [
      "The enormous athlete wearing 68 provides the C6–C8 root cue for the thoracodorsal nerve. Her arms handcuffed behind her back reinforce shoulder extension, adduction, and internal rotation.",
    ],
  },
  {
    id: "coracobrachialis",
    name: "Coracobrachialis",
    region: "shoulder",
    order: 7,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Coracoid Process",
      insertion: "Anteromedial surface of humerus",
      action: "Shoulder flexion/adduction",
      innervation: "Musculocutaneous nerve (C5-C7)",
    },
    images: muscleImages("shoulder", "coracobrachialis"),
    memoryStory: "",
    whyMemoryWorks: [
      "Yellow represents the musculocutaneous nerve, with a belt marked 57 for nerve roots C5–C7. Her arms are held together in front of her body, reinforcing the coracobrachialis' role in shoulder flexion and adduction.",
    ],
  },
  {
    id: "deltoid",
    name: "Deltoid",
    region: "shoulder",
    order: 8,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Clavicle/acromion/scapular spine",
      insertion: "Deltoid tuberosity",
      action: "Shoulder Flexion, abduction, extension",
      innervation: "Axillary nerve C5-C6",
    },
    images: muscleImages("shoulder", "deltoid"),
    memoryStory: "",
    whyMemoryWorks: [
      "Green represents the axillary nerve. His three-claw arm represents the anterior, middle, and posterior deltoid and their roles in shoulder flexion, abduction, and extension.",
    ],
  },
  {
    id: "pectoralis-major",
    name: "Pectoralis major",
    region: "shoulder",
    order: 9,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Clavicle/sternum",
      insertion: "Latereral Intertubercular sulcus of Humerus",
      action: "Shoulder Flexion, adduction, IR",
      innervation: "Lateral Pectoral nerve and medial pectoral nerve  C5-T1",
    },
    images: muscleImages("shoulder", "pectoralis-major"),
    memoryStory: "",
    whyMemoryWorks: [
      "Pectoralis (Latin for breast or chest) major is symbolized by this hero drawing daggers, reinforcing shoulder adduction, flexion, and internal rotation. The headphones represent innervation by the medial and lateral pectoral nerves.",
    ],
  },
  {
    id: "pectoralis-minor",
    name: "Pectoralis minor",
    region: "shoulder",
    order: 10,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Sternal end of ribs 3-5",
      insertion: "Coracoid Process",
      action: "Stabilizes scapula, scapular protraction/depression",
      innervation: "Medial Pectoral nerve (C8-T1)",
    },
    images: muscleImages("shoulder", "pectoralis-minor"),
    memoryStory: "",
    whyMemoryWorks: [
      "Like a water-skier, pectoralis minor pulls the scapula forward into protraction. The single right (“medial”) headphone represents innervation by the medial pectoral nerve.",
    ],
  },
  {
    id: "serratus-anterior",
    name: "Serratus anterior",
    region: "shoulder",
    order: 11,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Ribs 1-8",
      insertion: "Medial scapula",
      action: "Scapular Protraction/upward rotation",
      innervation: "Long thoracic nerve C5-C7",
    },
    images: muscleImages("shoulder", "serratus-anterior"),
    memoryStory: "",
    whyMemoryWorks: [
      "Serratus anterior is a water-skier pulling the scapula forward into protraction and upward rotation. The saltshaker labeled 57 represents the mnemonic SALT57: Serratus Anterior, Long Thoracic, C5–C7.",
    ],
  },
  {
    id: "rhomboids",
    name: "Rhomboids",
    region: "shoulder",
    order: 12,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "C7-T5 spinous processes",
      insertion: "Medial scapula",
      action: "Scapular Retraction/downward rotation",
      innervation: "Dorsal scapular nerve C4-C5",
    },
    images: muscleImages("shoulder", "rhomboids"),
    memoryStory: "",
    whyMemoryWorks: [
      "Rhomboid major and minor are depicted by a man and child fishing together, pulling the scapula toward them into retraction and downward rotation. Their DSN fishing gear represents innervation by the dorsal scapular nerve.",
    ],
  },
  {
    id: "upper-trapezius",
    name: "Upper Trapezius",
    region: "shoulder",
    order: 13,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "External occipital protuberance, nuchal ligament",
      insertion: "Lateral 1/3 of clavicle",
      action: "Scapular elevation and upward rotation",
      innervation: "Spinal Accessory Nerve (CN X1) and spinal nerves C3-C4",
    },
    images: muscleImages("shoulder", "upper-trapezius"),
    memoryStory: "",
    whyMemoryWorks: [
      "The skull-headed fisherman symbolizes the muscle's origin on the skull while pulling on the scapula.",
    ],
  },
  {
    id: "middle-trapezius",
    name: "Middle Trapezius",
    region: "shoulder",
    order: 14,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Spinous Processes and supraspinous ligament of C7-T3",
      insertion: "Acromian, spine of scapula",
      action: "Scapular retraction",
      innervation: "Spinal Accessory Nerve (CN XI) and spinal nerves C3-C4",
    },
    images: muscleImages("shoulder", "middle-trapezius"),
    memoryStory: "",
    whyMemoryWorks: [
      "The spine-headed fisherman symbolizes the muscle's origin on the spinous processes while pulling on the scapula.",
    ],
  },
  {
    id: "lower-trapezius",
    name: "Lower Trapezius",
    region: "shoulder",
    order: 15,
    description: "Muscle of the Shoulder",
    coreFacts: {
      origin: "Spinous processes and supraspinous ligaments T4-T12",
      insertion: "Lateral apex of medial scapular spine",
      action: "Scapular depression, retraction, and upward rotation",
      innervation: "Spinal accessory nerve (CN XI) and spinal nerves C3-C4",
    },
    images: muscleImages("shoulder", "lower-trapezius"),
    memoryStory: "",
    whyMemoryWorks: [
      "The spine-headed fisherman symbolizes the muscle's origin on the spinous processes while pulling on the scapula.",
    ],
  },
];
