export type MemoryCodeListItem = {
  text: string;
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
];
