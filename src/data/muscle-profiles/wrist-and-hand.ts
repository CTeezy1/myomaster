import type { MuscleProfile } from "@/src/data/muscle-profile.types";

function muscleImages(regionId: string, id: string) {
  const basePath = `/images/muscles/${regionId}/${id}`;

  return {
    anatomy: `${basePath}/anatomy.png`,
    memory: `${basePath}/memory.png`,
  };
}

export const wristAndHandMuscleProfiles: MuscleProfile[] = [
  {
    id: "flexor-carpi-radialis",
    name: "Flexor carpi radialis",
    region: "wrist-and-hand",
    order: 1,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Medial epicondyle",
      insertion: "Bases of 2nd-3rd metacarpals",
      action: "Wrist flexion, radial deviation",
      innervation: "Median nerve C6-C7",
    },
    images: muscleImages("wrist-and-hand", "flexor-carpi-radialis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dwarf is underground, representing that flexor carpi radialis is a flexor and inserts on the palmar side of the hand. The watch represents that the muscle acts at the wrist. The peace sign represents insertion on the 2nd and 3rd metacarpals. The foot on the rock pile to the medial side represents that the muscle originates at the medial epicondyle. The blue coloring represents innervation by the median nerve.",
    ],
  },
  {
    id: "flexor-carpi-ulnaris",
    name: "Flexor carpi ulnaris",
    region: "wrist-and-hand",
    order: 2,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Medial epicondyle/ulna",
      insertion: "Pisiform",
      action: "Wrist flexion, ulnar deviation",
      innervation: "Ulnar nerve C7-T1",
    },
    images: muscleImages("wrist-and-hand", "flexor-carpi-ulnaris"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dwarf is underground, representing that flexor carpi ulnaris is a flexor and inserts on the palmar side of the hand. The watch represents that the muscle acts at the wrist. The pea on the hand represents insertion on the pisiform. The foot on the rock pile to the medial side represents that the muscle originates at the medial epicondyle. The purple coloring represents innervation by the ulnar nerve.",
    ],
  },
  {
    id: "extensor-carpi-ulnaris",
    name: "Extensor carpi ulnaris",
    region: "wrist-and-hand",
    order: 3,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Lateral epicondyle",
      insertion: "Base of 5th metacarpal",
      action: "Wrist extension, ulnar deviation",
      innervation: "Posterior interosseous nerve (deep branch of radial) C7-C8",
    },
    images: muscleImages("wrist-and-hand", "extensor-carpi-ulnaris"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dwarf is above ground, representing that extensor carpi ulnaris is an extensor and inserts on the dorsal side of the hand. The watch represents that the muscle acts at the wrist. The extended pinkie finger represents insertion on the 5th metacarpal. The red coloring represents innervation by the radial nerve. The foot on the rock pile to the lateral side represents that the muscle originates at the lateral epicondyle.",
    ],
  },
  {
    id: "extensor-carpi-radialis-longus",
    name: "Extensor carpi radialis longus",
    region: "wrist-and-hand",
    order: 4,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Lateral supracondylar ridge",
      insertion: "base of 2nd metacarpal",
      action: "Wrist extension",
      innervation: "Radial nerve C6-C7",
    },
    images: muscleImages("wrist-and-hand", "extensor-carpi-radialis-longus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dwarf is above ground, representing that extensor carpi radialis longus is an extensor and inserts on the dorsal side of the hand. The watch represents that the muscle acts at the wrist. The dwarf is tall, representing longus. The pointer finger represents insertion on the 2nd metacarpal. The red coloring represents innervation by the radial nerve.",
    ],
  },
  {
    id: "extensor-carpi-radialis-brevis",
    name: "Extensor Carpi Radialis Brevis",
    region: "wrist-and-hand",
    order: 5,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Lateral epicondyle of humerus",
      insertion: "base of 3rd metacarpal",
      action: "Wrist extension and radial deviation",
      innervation: "Radial nerve (C5-C6)",
    },
    images: muscleImages("wrist-and-hand", "extensor-carpi-radialis-brevis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dwarf is above ground, representing that extensor carpi radialis brevis is an extensor and inserts on the dorsal side of the hand. The watch represents that the muscle acts at the wrist. The dwarf is short, representing brevis. The middle finger represents insertion on the 3rd metacarpal. The red coloring represents innervation by the radial nerve. The foot on the rock pile to the lateral side represents that the muscle originates at the lateral epicondyle.",
    ],
  },
  {
    id: "wrist-and-hand-extensor-digitorum",
    name: "Extensor Digitorum",
    region: "wrist-and-hand",
    order: 6,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Lateral epicondyle of humerus",
      insertion: "Extensor expansions digits 2-5",
      action: "Extends fingers 2-5 (assists wrist extension)",
      innervation: "Posterior Interosseus nerve (C7-C8)",
    },
    images: muscleImages("wrist-and-hand", "wrist-and-hand-extensor-digitorum"),
    memoryStory: "",
    whyMemoryWorks: [
      "The fingers are above ground, representing that extensor digitorum is an extensor and inserts on the dorsal side of the hand. The four finger-shaped characters represent the muscle's action on digits 2–5 and its insertion at the distal fingers. The PIN buckle represents innervation by the posterior interosseous nerve, a division of the radial nerve (red). The foot on the rock pile to the lateral side represents that the muscle originates at the lateral epicondyle.",
    ],
  },
  {
    id: "extensor-pollicis-longus",
    name: "Extensor Pollicis Longus",
    region: "wrist-and-hand",
    order: 7,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Posterior ulna and interosseus membrane",
      insertion: "Distal phalanx of thum",
      action: "Extends thumb IP, MCP, CMC",
      innervation: "Posterior Interosseus nerve (C7-C8)",
    },
    images: muscleImages("wrist-and-hand", "extensor-pollicis-longus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The thumb is above ground, representing that extensor pollicis longus is an extensor and inserts on the dorsal side of the hand. The character looks like a thumb, representing the muscle's action on the thumb. The hat at the top of the thumb represents insertion on the distal phalanx of the thumb. The PIN buckle represents innervation by the posterior interosseous nerve, a division of the radial nerve (red).",
    ],
  },
  {
    id: "extensor-pollicis-brevis",
    name: "Extensor Pollicis Brevis",
    region: "wrist-and-hand",
    order: 8,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Posterior distal radius",
      insertion: "Posterior base of proximal phalanx of thumb",
      action: "Thumb MCP and CMC extension",
      innervation: "Posterior Interosseus nerve (C7-C8)",
    },
    images: muscleImages("wrist-and-hand", "extensor-pollicis-brevis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The thumb is above ground, representing that extensor pollicis brevis is an extensor and inserts on the dorsal side of the hand. The character looks like a thumb, representing the muscle's action on the thumb. The helmet positioned lower on the thumb represents insertion on the proximal phalanx of the thumb. The PIN buckle represents innervation by the posterior interosseous nerve, a division of the radial nerve (red).",
    ],
  },
  {
    id: "abductor-pollicis-longus",
    name: "Abductor Pollicis Longus",
    region: "wrist-and-hand",
    order: 9,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Posterior radius and ulna, interosseus membrane",
      insertion: "Base of 1st metacarpal",
      action: "Thumb CMC abduction and extension",
      innervation: "Posterior Interosseus nerve (C7-C8)",
    },
    images: muscleImages("wrist-and-hand", "abductor-pollicis-longus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The thumb is above ground, representing insertion on the dorsal side of the hand. The thumb positioned sideways represents abduction of the thumb. The hat positioned in the middle represents insertion on the 1st metacarpal. The PIN buckle represents innervation by the posterior interosseous nerve, a division of the radial nerve (red).",
    ],
  },
  {
    id: "flexor-digitorum-superficialis",
    name: "Flexor digitorum superficialis",
    region: "wrist-and-hand",
    order: 10,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Medial epicondyle, coronoud process of ulna, proximal anterior radius",
      insertion: "Middle phalanges",
      action: "Finger flexion",
      innervation: "Median C7-T1",
    },
    images: muscleImages("wrist-and-hand", "flexor-digitorum-superficialis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dwarves are underground, representing that flexor digitorum superficialis is a flexor and inserts on the palmar side of the hand. The four finger-shaped characters represent the muscle's action on digits 2–5. The hats positioned in the middle of the fingers represent insertion on the middle phalanges at the level of the PIP joints. The blue coloring represents innervation by the median nerve.",
    ],
  },
  {
    id: "flexor-digitorum-profundus",
    name: "Flexor Digitorum Profundus",
    region: "wrist-and-hand",
    order: 11,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Proximal anterior and medial ulna",
      insertion: "Distal phalanges 2-5",
      action: "Flexes DIP joints (assist wrist flexion)",
      innervation: "Lateral half (median);Medial half (Ulnar) C8-T1",
    },
    images: muscleImages("wrist-and-hand", "flexor-digitorum-profundus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dwarves are underground, representing that flexor digitorum profundus is a flexor and inserts on the palmar side of the hand. The four finger-shaped characters represent the muscle's action on digits 2–5. The hats at the tops of the fingers represent insertion on the distal phalanges. The lateral half is blue, representing innervation by the median nerve, while the medial half is purple, representing innervation by the ulnar nerve.",
    ],
  },
  {
    id: "flexor-pollicis-longus",
    name: "Flexor Pollicis Longus",
    region: "wrist-and-hand",
    order: 12,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Anterior radius and interosseus membrane",
      insertion: "Distal phalanx of thumb",
      action: "Flexes thumb IP joints",
      innervation: "Anterior Interosseus nerve (C8-T1)",
    },
    images: muscleImages("wrist-and-hand", "flexor-pollicis-longus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dwarf is underground, representing that flexor pollicis longus is a flexor and inserts on the palmar side of the hand. The character looks like a thumb, representing the muscle's action on the thumb. The hat at the top of the thumb represents insertion on the distal phalanx of the thumb. The blue coloring represents the median nerve, and the AIN buckle represents innervation by the anterior interosseous nerve, a division of the median nerve (blue).",
    ],
  },
  {
    id: "interossei",
    name: "Interossei",
    region: "wrist-and-hand",
    order: 13,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Adjacent metacarpals",
      insertion: "Proximal phalanges",
      action: "Dorsal-finger abduction Palmar- finger adduction",
      innervation: "Ulnar nerve C8-T1)",
    },
    images: muscleImages("wrist-and-hand", "interossei"),
    memoryStory: "",
    whyMemoryWorks: [
      "The purple coloring represents innervation by the ulnar nerve. The palmar interossei are below the surface on a PAD, representing Palmar ADduction (PAD). The dorsal interossei are above the surface DABbing, representing Dorsal ABduction (DAB).",
    ],
  },
  {
    id: "opponens-pollicis",
    name: "Opponens Pollicis",
    region: "wrist-and-hand",
    order: 14,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Flexor retinaculum and trapezium",
      insertion: "Lateral shaft of 1st metacarpal",
      action: "Opposition of thumb",
      innervation: "Median nerve (C8-T1)",
    },
    images: muscleImages("wrist-and-hand", "opponens-pollicis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The thumb holding a pencil represents opposition of the thumb for grasping. The blue coloring represents innervation by the median nerve.",
    ],
  },
  {
    id: "lumbricals",
    name: "Lumbricals",
    region: "wrist-and-hand",
    order: 15,
    description: "Muscle of the Wrist and Hand",
    coreFacts: {
      origin: "Tendons of flexor digitorum profundus",
      insertion: "Extensor expansion of digits 2-5",
      action: "MCP flexion and IP extension",
      innervation: "Lumbricals 1-2 Median nerve ; Lumbricals 3-4 Ulnar nerve (C8-T1)",
    },
    images: muscleImages("wrist-and-hand", "lumbricals"),
    memoryStory: "",
    whyMemoryWorks: [
      "The hand is shown with MCP flexion and IP extension, representing the action of the lumbricals. The blue and purple coloring represents their split innervation: lumbricals 1 and 2 are innervated by the median nerve (blue), while lumbricals 3 and 4 are innervated by the ulnar nerve (purple).",
    ],
  },
];
