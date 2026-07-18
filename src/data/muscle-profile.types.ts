export type MuscleProfileImages = {
  anatomy: string;
  memory: string;
};

export type MuscleProfileCoreFacts = {
  origin: string | string[];
  insertion: string | string[];
  action: string | string[];
  innervation: string | string[];
};

export type MuscleProfileMetadata = {
  peripheralNerve?: string;
  nerveColorKey?: string;
  tags?: string[];
};

export type MuscleProfile = {
  id: string;
  name: string;
  region: string;
  order: number;
  description: string;
  coreFacts: MuscleProfileCoreFacts;
  images: MuscleProfileImages;
  memoryStory: string;
  whyMemoryWorks: string | string[];
  metadata?: MuscleProfileMetadata;
};
