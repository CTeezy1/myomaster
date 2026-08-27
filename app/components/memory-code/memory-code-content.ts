export type MemoryCodeListItem = {
  text: string;
  items?: MemoryCodeListItem[];
};

export type MemoryCodeRegion = {
  name: string;
  items: MemoryCodeListItem[];
};

export type MemoryCodeNerveColor = {
  color: string;
  swatchClass: string;
  nerve: string;
};

export type MemoryCodeSection =
  | {
      id: string;
      heading: string;
      type: "nerve-colors";
      colors: MemoryCodeNerveColor[];
    }
  | {
      id: string;
      heading: string;
      type: "figure-movement";
      groups: { title: string; items: MemoryCodeListItem[] }[];
    }
  | {
      id: string;
      heading: string;
      type: "regional-scenes";
      regions: MemoryCodeRegion[];
    }
  | {
      id: string;
      heading: string;
      type: "list";
      items: MemoryCodeListItem[];
    };

export type MemoryCodeChapter = {
  id: string;
  title: string;
  sections: MemoryCodeSection[];
};

export const memoryCodeChapters: MemoryCodeChapter[] = [
  {
    id: "upper-extremity",
    title: "Upper Extremity Memory Code",
    sections: [
      {
        id: "nerve-colors",
        heading: "Nerve Colors",
        type: "nerve-colors",
        colors: [
          {
            color: "Yellow",
            swatchClass: "bg-yellow-400",
            nerve: "Musculocutaneous nerve",
          },
          {
            color: "Green",
            swatchClass: "bg-green-500",
            nerve: "Axillary nerve",
          },
          {
            color: "Red",
            swatchClass: "bg-red-500",
            nerve: "Radial nerve",
          },
          {
            color: "Blue",
            swatchClass: "bg-blue-500",
            nerve: "Median nerve",
          },
          {
            color: "Purple",
            swatchClass: "bg-purple-500",
            nerve: "Ulnar nerve",
          },
        ],
      },
      {
        id: "figure-movement",
        heading: "Figure Movement Code",
        type: "figure-movement",
        groups: [
          {
            title: "Male figures represent:",
            items: [
              { text: "Abduction (or radial deviation)" },
              { text: "External rotation (or supination)" },
            ],
          },
          {
            title: "Female figures represent:",
            items: [
              { text: "Adduction (or ulnar deviation)" },
              { text: "Internal rotation (or pronation)" },
            ],
          },
        ],
      },
      {
        id: "regional-scenes",
        heading: "Regional Scene Codes",
        type: "regional-scenes",
        regions: [
          {
            name: "Shoulder",
            items: [
              { text: "Superheroes = gross movers of the shoulder" },
              { text: "Mechanics = rotator cuff muscles" },
              { text: "Water scenes = muscles that move the scapula" },
              { text: "Fishing = scapular retraction" },
              { text: "Water sports = scapular protraction" },
            ],
          },
          {
            name: "Elbow",
            items: [{ text: "Knights / medieval setting" }],
          },
          {
            name: "Forearm",
            items: [{ text: "Go-karts" }],
          },
          {
            name: "Hand",
            items: [
              { text: "Dwarves" },
              { text: "Above the surface = extensor muscle or dorsal hand insertion" },
              { text: "Underground = flexor muscle or palmar hand insertion" },
              { text: "Foot on rocks at left side = lateral epicondyle origin" },
              { text: "Foot on rocks at right side = medial epicondyle origin" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "lower-extremity",
    title: "Lower Extremity Memory Code",
    sections: [
      {
        id: "lower-nerve-colors",
        heading: "Nerve Colors",
        type: "nerve-colors",
        colors: [
          {
            color: "Blue",
            swatchClass: "bg-blue-500",
            nerve: "Femoral nerve",
          },
          {
            color: "Green",
            swatchClass: "bg-green-500",
            nerve: "Obturator nerve",
          },
          {
            color: "Red",
            swatchClass: "bg-red-500",
            nerve: "Sciatic nerve",
          },
          {
            color: "Pink",
            swatchClass: "bg-pink-400",
            nerve: "Tibial nerve",
          },
          {
            color: "Dark Purple",
            swatchClass: "bg-purple-800",
            nerve: "Deep fibular nerve",
          },
          {
            color: "Light Purple",
            swatchClass: "bg-purple-300",
            nerve: "Superficial fibular nerve",
          },
        ],
      },
      {
        id: "hip-character-code",
        heading: "Hip Character Code",
        type: "figure-movement",
        groups: [
          {
            title: "Cats represent gluteal / posterior-lateral hip muscles:",
            items: [
              { text: "Great lion — Gluteus maximus" },
              { text: "Jaguar — Gluteus medius" },
              { text: "Small cat — Gluteus minimus" },
              { text: "Pear necklace — Piriformis" },
            ],
          },
          {
            title: "Flamingos represent long, thin hip muscles:",
            items: [
              { text: "Tensor fasciae latae" },
              { text: "Sartorius" },
            ],
          },
          {
            title: "Bunnies represent hip flexors:",
            items: [
              { text: "Iliacus" },
              { text: "Psoas major" },
            ],
          },
          {
            title: "Dogs represent hip adductors:",
            items: [
              { text: "Dachshund — Adductor longus" },
              { text: "Pug — Adductor brevis" },
              { text: "Poodle — Pectineus" },
              { text: "Great Dane — Adductor magnus" },
            ],
          },
        ],
      },
      {
        id: "hip-origin-insertion-cues",
        heading: "Hip Origin / Insertion Cues",
        type: "list",
        items: [
          { text: "Rock pile — Trochanter insertion" },
          { text: "Band around the leg — IT band" },
          { text: "BP collar — Body of pubis" },
          { text: "PR collar — Pubic ramus" },
          {
            text: "PRITIR collar — Pubic ramus, ischial tuberosity, and ischial ramus",
          },
          { text: "Line near the feet — Linea aspera" },
          { text: "Comb — Pectineal line" },
          { text: "Webbed foot — Pes anserinus" },
        ],
      },
      {
        id: "gluteal-nerve-cue",
        heading: "Gluteal Nerve Cue",
        type: "list",
        items: [
          { text: "Power cord from above — Superior gluteal nerve" },
          { text: "Power cord from below — Inferior gluteal nerve" },
        ],
      },
      {
        id: "knee-door-code",
        heading: "Knee Door Code",
        type: "list",
        items: [
          { text: "Closing the door — Knee extension / quadriceps" },
          { text: "Opening the door — Knee flexion / hamstrings" },
          { text: "Unlocking the door — Popliteus unlocking the knee" },
        ],
      },
      {
        id: "quadriceps-cues",
        heading: "Quadriceps Cues",
        type: "list",
        items: [
          { text: "Shared rug — Patella insertion" },
          { text: "AIIS hat — Rectus femoris origin" },
          { text: "Lateral — Vastus lateralis" },
          { text: "Medial — Vastus medialis" },
          { text: "Middle — Vastus intermedialis" },
        ],
      },
      {
        id: "hamstring-cues",
        heading: "Hamstring Cues",
        type: "list",
        items: [
          { text: "Pelvis rug — Ischial tuberosity origin" },
          { text: "Lateral position + skull shoes — Biceps femoris / head of fibula" },
          {
            text: "Half pink + half purple — Two nerve divisions of biceps femoris:",
            items: [
              { text: "Long head — tibial division of sciatic nerve" },
              { text: "Short head — common fibular division of sciatic nerve" },
            ],
          },
          { text: "Medial position — Semimembranosus / Semitendinosus" },
          { text: "Webbed feet — Pes anserinus" },
        ],
      },
      {
        id: "ankle-foot-environment-code",
        heading: "Ankle / Foot Environment Code",
        type: "list",
        items: [
          { text: "Shoes + snowboard — Muscle acts primarily at the ankle" },
          { text: "Bare feet + skis — Muscle acts on the toes" },
        ],
      },
      {
        id: "lower-leg-bone-cues",
        heading: "Lower-Leg Bone Cues",
        type: "list",
        items: [
          { text: "Thick pole — Tibia" },
          { text: "Thin pole — Fibula" },
        ],
      },
      {
        id: "ankle-toe-action-cues",
        heading: "Ankle / Toe Action Cues",
        type: "list",
        items: [
          { text: "Tiptoes — Plantar flexion" },
          { text: "Toes up — Dorsiflexion" },
          { text: "Backward hat — Inversion" },
          { text: "Sideways hat — Eversion" },
          { text: "Skis curling downward — Toe flexion" },
          { text: "Skis curling upward — Toe extension" },
        ],
      },
      {
        id: "number-cues",
        heading: "Number Cues",
        type: "list",
        items: [
          { text: "1 — Great toe or first metatarsal" },
          { text: "2 and 5 — Toes 2–5" },
          { text: "5 — Fifth metatarsal" },
        ],
      },
      {
        id: "gastrocnemius-cue",
        heading: "Gastrocnemius Cue",
        type: "list",
        items: [{ text: "Femur rail — Femoral condyle origin" }],
      },
    ],
  },
];
