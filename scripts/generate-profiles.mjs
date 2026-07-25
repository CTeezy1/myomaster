import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const regions = JSON.parse(
  fs.readFileSync(path.join(rootDir, "src/data/regions.json"), "utf8"),
);

const regionExportNames = {
  cervical: "cervicalMuscleProfiles",
  shoulder: "shoulderMuscleProfiles",
  "elbow-and-forearm": "elbowAndForearmMuscleProfiles",
  "wrist-and-hand": "wristAndHandMuscleProfiles",
  "lumbar-and-thoracic": "lumbarAndThoracicMuscleProfiles",
  hip: "hipMuscleProfiles",
  knee: "kneeMuscleProfiles",
  "ankle-and-foot": "ankleAndFootMuscleProfiles",
};

const regionCourseNames = {
  cervical: "cervicalCourse",
  shoulder: "shoulderCourse",
  "elbow-and-forearm": "elbowAndForearmCourse",
  "wrist-and-hand": "wristAndHandCourse",
  "lumbar-and-thoracic": "lumbarAndThoracicCourse",
  hip: "hipCourse",
  knee: "kneeCourse",
  "ankle-and-foot": "ankleAndFootCourse",
};

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeTsString(value) {
  return JSON.stringify(value);
}

async function loadGeneratedMuscles() {
  const generatedPath = path.join(rootDir, "src/data/study-items.generated.ts");
  const module = await import(pathToFileURL(generatedPath).href);

  return module.muscles;
}

function loadExistingCervicalProfileIds() {
  const cervicalPath = path.join(
    rootDir,
    "src/data/muscle-profiles/cervical.ts",
  );
  const source = fs.readFileSync(cervicalPath, "utf8");
  const ids = [...source.matchAll(/id: "([^"]+)"/g)].map((match) => match[1]);
  const names = [...source.matchAll(/name: "([^"]+)"/g)].map((match) => match[1]);

  return ids.map((id, index) => ({
    id,
    name: names[index],
  }));
}

function buildProfileIds(muscles) {
  const slugCounts = new Map();

  for (const muscle of muscles) {
    const slug = slugify(muscle.Muscle);
    slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
  }

  const existingCervical = loadExistingCervicalProfileIds();
  const cervicalNameToId = new Map(
    existingCervical.map((profile) => [
      profile.name.trim().toLowerCase(),
      profile.id,
    ]),
  );

  return muscles.map((muscle) => {
    if (muscle.region === "cervical") {
      const existingId = cervicalNameToId.get(muscle.Muscle.trim().toLowerCase());

      if (!existingId) {
        throw new Error(`Missing existing cervical profile for "${muscle.Muscle}"`);
      }

      return existingId;
    }

    const baseSlug = slugify(muscle.Muscle);

    if (slugCounts.get(baseSlug) === 1) {
      return baseSlug;
    }

    return `${muscle.region}-${baseSlug}`;
  });
}

function getRegionName(regionId) {
  return regions.find((region) => region.id === regionId)?.name ?? regionId;
}

function renderProfileFile(regionId, profiles) {
  const exportName = regionExportNames[regionId];

  if (regionId === "cervical") {
    return null;
  }

  const lines = [
    'import type { MuscleProfile } from "@/src/data/muscle-profile.types";',
    "",
    "function muscleImages(regionId: string, id: string) {",
    "  const basePath = `/images/muscles/${regionId}/${id}`;",
    "",
    "  return {",
    "    anatomy: `${basePath}/anatomy.png`,",
    "    memory: `${basePath}/memory.png`,",
    "  };",
    "}",
    "",
    `export const ${exportName}: MuscleProfile[] = [`,
  ];

  for (const profile of profiles) {
    lines.push("  {");
    lines.push(`    id: ${escapeTsString(profile.id)},`);
    lines.push(`    name: ${escapeTsString(profile.name)},`);
    lines.push(`    region: ${escapeTsString(profile.region)},`);
    lines.push(`    order: ${profile.order},`);
    lines.push(`    description: ${escapeTsString(profile.description)},`);
    lines.push("    coreFacts: {");
    lines.push(`      origin: ${escapeTsString(profile.origin)},`);
    lines.push(`      insertion: ${escapeTsString(profile.insertion)},`);
    lines.push(`      action: ${escapeTsString(profile.action)},`);
    lines.push(`      innervation: ${escapeTsString(profile.innervation)},`);
    lines.push("    },");
    lines.push(
      `    images: muscleImages(${escapeTsString(profile.region)}, ${escapeTsString(profile.id)}),`,
    );
    lines.push(`    memoryStory: ${escapeTsString("")},`);
    lines.push(`    whyMemoryWorks: ${escapeTsString("")},`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");

  return lines.join("\n");
}

function renderCourseFile(regionId, profileIds) {
  const courseName = regionCourseNames[regionId];
  const displayName = `${getRegionName(regionId)} Course`;

  return `import type { Course } from "@/src/lib/course.types";

export const ${courseName}: Course = {
  id: ${escapeTsString(regionId)},
  name: ${escapeTsString(displayName)},
  region: ${escapeTsString(regionId)},
  muscleProfileIds: [
${profileIds.map((id) => `    ${escapeTsString(id)},`).join("\n")}
  ],
};
`;
}

async function main() {
  const muscles = await loadGeneratedMuscles();
  const profileIds = buildProfileIds(muscles);
  const profilesByRegion = new Map();

  for (const region of regions) {
    profilesByRegion.set(region.id, []);
  }

  muscles.forEach((muscle, index) => {
    const regionProfiles = profilesByRegion.get(muscle.region);
    const order = regionProfiles.length + 1;

    if (muscle.region === "cervical") {
      regionProfiles.push({
        id: profileIds[index],
        region: muscle.region,
        order,
      });
      return;
    }

    regionProfiles.push({
      id: profileIds[index],
      name: muscle.Muscle,
      region: muscle.region,
      order,
      description: `Muscle of the ${getRegionName(muscle.region)}`,
      origin: muscle.Origin,
      insertion: muscle.Insertion,
      action: muscle.Action,
      innervation: muscle.Innervation,
    });
  });

  for (const region of regions) {
    if (region.id === "cervical") {
      continue;
    }

    const profileFile = renderProfileFile(
      region.id,
      profilesByRegion.get(region.id),
    );
    const profilePath = path.join(
      rootDir,
      `src/data/muscle-profiles/${region.id}.ts`,
    );

    fs.writeFileSync(profilePath, profileFile, "utf8");
  }

  for (const region of regions) {
    const regionProfiles = profilesByRegion.get(region.id);
    const coursePath = path.join(
      rootDir,
      `src/data/courses/${region.id}-course.ts`,
    );

    fs.writeFileSync(
      coursePath,
      renderCourseFile(
        region.id,
        regionProfiles.map((profile) => profile.id),
      ),
      "utf8",
    );
  }

  const allIds = profileIds;
  const duplicateIds = allIds.filter(
    (id, index) => allIds.indexOf(id) !== index,
  );

  console.log(`Prepared ${allIds.length} profile IDs across ${regions.length} regions.`);

  for (const region of regions) {
    console.log(
      `${region.id}: ${profilesByRegion.get(region.id).length} muscles`,
    );
  }

  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate profile IDs: ${[...new Set(duplicateIds)].join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
