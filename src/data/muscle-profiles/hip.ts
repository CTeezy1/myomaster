import type { MuscleProfile } from "@/src/data/muscle-profile.types";

function muscleImages(regionId: string, id: string) {
  const basePath = `/images/muscles/${regionId}/${id}`;

  return {
    anatomy: `${basePath}/anatomy.png`,
    memory: `${basePath}/memory.png`,
  };
}

export const hipMuscleProfiles: MuscleProfile[] = [
  {
    id: "gluteus-maximus",
    name: "Gluteus maximus",
    region: "hip",
    order: 1,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "posterior Ilium/sacrum/coccyx",
      insertion: "IT band, femur",
      action: "Hip extension",
      innervation: "Inferior gluteal nerve L5-S2",
    },
    images: muscleImages("hip", "gluteus-maximus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The great lion represents gluteus maximus, the largest of the gluteal muscles. His extended leg represents hip extension, while the band around the leg represents insertion into the IT band. The power cord coming from below represents innervation by the inferior gluteal nerve.",
    ],
  },
  {
    id: "gluteus-medius",
    name: "Gluteus medius",
    region: "hip",
    order: 2,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "external surface of ilium between anterior and posterior gluteal lines",
      insertion: "Greater trochanter",
      action: "Hip abduction",
      innervation: "Superior gluteal nerve L4-S1",
    },
    images: muscleImages("hip", "gluteus-medius"),
    memoryStory: "",
    whyMemoryWorks: [
      "The jaguar represents gluteus medius. Its leg held out to the side represents hip abduction. The front feet on the rock pile represent insertion on the greater trochanter. The power cord coming from above represents innervation by the superior gluteal nerve.",
    ],
  },
  {
    id: "gluteus-minimus",
    name: "Gluteus minimus",
    region: "hip",
    order: 3,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "external surface of ilium between anterior and inferior gluteal lines",
      insertion: "Greater trochanter",
      action: "Hip abduction, IR",
      innervation: "Superior gluteal nerve L4-S1",
    },
    images: muscleImages("hip", "gluteus-minimus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The smallest cat represents gluteus minimus. Its leg held out to the side represents hip abduction. The front feet on the rock pile represent insertion on the greater trochanter. The power cord coming from above represents innervation by the superior gluteal nerve.",
    ],
  },
  {
    id: "tensor-fasciae-latae",
    name: "Tensor fasciae latae",
    region: "hip",
    order: 4,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "Anterior Superior Iliac Spine",
      insertion: "IT band",
      action: "Hip flexion/abduction",
      innervation: "Superior gluteal nerve L4-S1",
    },
    images: muscleImages("hip", "tensor-fasciae-latae"),
    memoryStory: "",
    whyMemoryWorks: [
      "The long, thin flamingo represents the tensor fasciae latae. Its leg held forward and out to the side represents hip flexion and abduction. The band around the legs represents insertion into the IT band. The power cord coming from above represents innervation by the superior gluteal nerve.",
    ],
  },
  {
    id: "sartorius",
    name: "Sartorius",
    region: "hip",
    order: 5,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "Anterior Superior Iliac Spine",
      insertion: "Pes anserine",
      action: "Hip abduction, flexion, external rotation; knee flexion",
      innervation: "Femoral nerve L2-L3",
    },
    images: muscleImages("hip", "sartorius"),
    memoryStory: "",
    whyMemoryWorks: [
      "The long, thin flamingo represents sartorius, the longest muscle in the body. Its flexed and abducted hip with a bent knee represents the muscle’s actions at the hip and knee. The webbed foot represents insertion at the pes anserinus. The blue background represents innervation by the femoral nerve.",
    ],
  },
  {
    id: "piriformis",
    name: "Piriformis",
    region: "hip",
    order: 6,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "Anterior Sacrum",
      insertion: "Greater trochanter (superior border)",
      action: "Hip ER,",
      innervation: "nerve to piriformis S1-S2",
    },
    images: muscleImages("hip", "piriformis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The pear necklace represents piriformis, whose name refers to its pear shape. The cat’s externally rotated leg represents the muscle’s action of external rotation at the hip. Its feet on the rock pile represent insertion on the greater trochanter.",
    ],
  },
  {
    id: "adductor-longus",
    name: "Adductor Longus",
    region: "hip",
    order: 7,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "Body of Pubis inferior to pubic crest",
      insertion: "Medial third linea aspera",
      action: "Hip adduction, assists flexion",
      innervation: "Obturator Nerve L2-L4",
    },
    images: muscleImages("hip", "adductor-longus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dog represents a hip adductor, while the long-bodied dachshund represents longus. The BP on its collar represents origin on the body of the pubis. Its leg crossed in front represents hip adduction and assistance with hip flexion. The line on the ground near its front feet represents insertion on the linea aspera. The green background represents innervation by the obturator nerve.",
    ],
  },
  {
    id: "adductor-magnus",
    name: "Adductor magnus",
    region: "hip",
    order: 8,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "Inferior Pubic ramus, ischial ramus, ischial tuberosity",
      insertion: "Linea aspera and adductor tubercle",
      action: "Hip adduction",
      innervation: "Obturator nerve L2-L4; Sciatic nerve L4-S1",
    },
    images: muscleImages("hip", "adductor-magnus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dog represents a hip adductor, while the Great Dane represents magnus, meaning “great.” The PRITIR on its collar represents origin on the pubic ramus, ischial tuberosity, and ischial ramus. Its leg crossed in front represents hip adduction. The line on the ground near its front feet represents insertion on the linea aspera. The green background represents innervation by the obturator nerve.",
    ],
  },
  {
    id: "adductor-brevis",
    name: "Adductor Brevis",
    region: "hip",
    order: 9,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "Inferior Pubic ramus",
      insertion: "Proximal linea aspera",
      action: "Hip adduction, assists flexion",
      innervation: "Obturator nerve L2-L4",
    },
    images: muscleImages("hip", "adductor-brevis"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dog represents a hip adductor, while the short, compact pug represents brevis. The PR on its collar represents origin on the pubic ramus. Its leg crossed in front represents hip adduction and assistance with hip flexion. The line on the ground near its front feet represents insertion on the linea aspera. The green background represents innervation by the obturator nerve.",
    ],
  },
  {
    id: "pectineus",
    name: "Pectineus",
    region: "hip",
    order: 10,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "Superior pubic ramus, pectineal line of pubis",
      insertion: "Pectineal line of femur",
      action: "Hip flexion, adduction",
      innervation: "Femoral nerve L2-L3",
    },
    images: muscleImages("hip", "pectineus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The dog represents a hip adductor, while the poodle provides the cue for pectineus. The PR on its collar represents origin on the pubic ramus. Its leg crossed in front represents hip adduction and assistance with hip flexion. The comb near its front feet represents insertion on the pectineal line of the femur. The blue background represents innervation by the femoral nerve.",
    ],
  },
  {
    id: "psoas-major",
    name: "Psoas Major",
    region: "hip",
    order: 11,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "T12-L5 vertebral bodies, discs, and vertebral processes",
      insertion: "Lesser trochanter of femur",
      action: "Hip flexion, assists trunk flexion",
      innervation: "Anterior rami L1-L3",
    },
    images: muscleImages("hip", "psoas-major"),
    memoryStory: "",
    whyMemoryWorks: [
      "The larger bunny’s marching leg represents hip flexion. The lumbar spine behind the bunny represents the muscle’s origin from the vertebral bodies, while the front feet on the small rock represent insertion on the lesser trochanter.",
    ],
  },
  {
    id: "iliacus",
    name: "Iliacus",
    region: "hip",
    order: 12,
    description: "Muscle of the Hip",
    coreFacts: {
      origin: "Iliac fossa and iliac crest",
      insertion: "Lesser trochanter of femur",
      action: "Hip flexion, assists hip ER",
      innervation: "Femoral nerve L2-L3",
    },
    images: muscleImages("hip", "iliacus"),
    memoryStory: "",
    whyMemoryWorks: [
      "The bunny’s marching leg represents hip flexion. The large rock behind the bunny represents its origin from the iliac fossa and iliac crest, while the front feet on the small rock represent insertion on the lesser trochanter. The blue background represents innervation by the femoral nerve.",
    ],
  },
];
