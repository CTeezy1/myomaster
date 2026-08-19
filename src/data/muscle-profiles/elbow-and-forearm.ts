import type { MuscleProfile } from "@/src/data/muscle-profile.types";

function muscleImages(regionId: string, id: string) {
  const basePath = `/images/muscles/${regionId}/${id}`;

  return {
    anatomy: `${basePath}/anatomy.png`,
    memory: `${basePath}/memory.png`,
  };
}

export const elbowAndForearmMuscleProfiles: MuscleProfile[] = [
  {
    id: "biceps-brachii",
    name: "Biceps brachii",
    region: "elbow-and-forearm",
    order: 1,
    description: "Muscle of the Elbow and Forearm",
    coreFacts: {
      origin: "short head-coracoid process; long head- supraglenoid tubercle of scapula",
      insertion: "Radial tuberosity",
      action: "Elbow flexion, supination",
      innervation: "Musculocutaneous nerve C5-C7",
    },
    images: muscleImages("elbow-and-forearm", "biceps-brachii"),
    memoryStory: "",
    whyMemoryWorks: [
      "The open door represents elbow flexion. Holding the axe with the elbow flexed and forearm supinated reinforces the biceps' actions of elbow flexion and supination. Yellow represents innervation by the musculocutaneous nerve.",
    ],
  },
  {
    id: "brachialis",
    name: "Brachialis",
    region: "elbow-and-forearm",
    order: 2,
    description: "Muscle of the Elbow and Forearm",
    coreFacts: {
      origin: "Distal Anterior humerus",
      insertion: "Coronoid process of ulna",
      action: "Elbow flexion",
      innervation: "Musculocutaneous nerve C5-C6",
    },
    images: muscleImages("elbow-and-forearm", "brachialis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The open door represents elbow flexion. Holding the axe with the elbow flexed and forearm neutral reinforces the brachialis' role in elbow flexion. Yellow represents innervation by the musculocutaneous nerve.",
    ],
  },
  {
    id: "brachioradialis",
    name: "Brachioradialis",
    region: "elbow-and-forearm",
    order: 3,
    description: "Muscle of the Elbow and Forearm",
    coreFacts: {
      origin: "Lateral humerus",
      insertion: "Distal radius",
      action: "Elbow flexion",
      innervation: "Radial nerve C5-C7",
    },
    images: muscleImages("elbow-and-forearm", "brachioradialis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The open door represents elbow flexion. Holding the sword with the elbow flexed and forearm neutral reinforces the brachioradialis' role in elbow flexion. Red represents innervation by the radial nerve.",
    ],
  },
  {
    id: "triceps-brachii",
    name: "Triceps brachii",
    region: "elbow-and-forearm",
    order: 4,
    description: "Muscle of the Elbow and Forearm",
    coreFacts: {
      origin: "LongHead- infraglenoid tubercle, Medial and Lateral head- posterior humerus",
      insertion: "Olecranon process",
      action: "Elbow extension",
      innervation: "Radial nerve C6-C8",
    },
    images: muscleImages("elbow-and-forearm", "triceps-brachii"),
    memoryStory: "",
    whyMemoryWorks: [
      "The large knight stands with the door closed and elbow extended, reinforcing the triceps' role in elbow extension. His trident represents the muscle's three heads. Red represents innervation by the radial nerve.",
    ],
  },
  {
    id: "anconeus",
    name: "Anconeus",
    region: "elbow-and-forearm",
    order: 5,
    description: "Muscle of the Elbow and Forearm",
    coreFacts: {
      origin: "Lateral epicondyle of humerus",
      insertion: "Lateral surface of Olecranon",
      action: "Elbow extension/stabilization",
      innervation: "Radial Nerve C7-C8",
    },
    images: muscleImages("elbow-and-forearm", "anconeus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The small child closing the door represents this small elbow extensor assisting with extension. Red represents innervation by the radial nerve.",
    ],
  },
  {
    id: "supinator",
    name: "Supinator",
    region: "elbow-and-forearm",
    order: 6,
    description: "Muscle of the Elbow and Forearm",
    coreFacts: {
      origin: "Lateral epicondyle of humerus",
      insertion: "Proximal Radius",
      action: "Supination",
      innervation: "Deep radial nerve C6-C7",
    },
    images: muscleImages("elbow-and-forearm", "supinator"),
    memoryStory: "",
    whyMemoryWorks: [
      "The go-kart represents the forearm, with the hands holding the steering wheel in a supinated position to reinforce forearm supination. Red represents radial nerve innervation via the posterior interosseous nerve.",
    ],
  },
  {
    id: "pronator-quadratus",
    name: "Pronator Quadratus",
    region: "elbow-and-forearm",
    order: 7,
    description: "Muscle of the Elbow and Forearm",
    coreFacts: {
      origin: "Pronator ridge (anterior distal ulna)",
      insertion: "Anterior distal radius",
      action: "Pronation",
      innervation: "Anterior Interosseus nerve C7-T1",
    },
    images: muscleImages("elbow-and-forearm", "pronator-quadratus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The go-kart represents the forearm, while its square shape represents quadratus. The hands hold the steering wheel in a pronated position to reinforce forearm pronation. Blue represents the median nerve, with the ant symbol representing the anterior interosseous nerve.",
    ],
  },
  {
    id: "pronator-teres",
    name: "Pronator teres",
    region: "elbow-and-forearm",
    order: 8,
    description: "Muscle of the Elbow and Forearm",
    coreFacts: {
      origin: "Medial epicondyle (humeral head) ; coronoid process of ulna (ulnar head)",
      insertion: "Pronator Tuberosity of Radius",
      action: "Pronation",
      innervation: "Median nerve C6-C7",
    },
    images: muscleImages("elbow-and-forearm", "pronator-teres"),
    memoryStory: "",
    whyMemoryWorks: [
      "The go-kart represents the forearm, while its cylindrical shape represents teres. The hands hold the steering wheel in a pronated position to reinforce forearm pronation. Blue represents innervation by the median nerve.",
    ],
  },
];
