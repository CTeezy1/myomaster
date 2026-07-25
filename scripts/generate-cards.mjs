import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const csvDir = path.join(rootDir, "src/data/csv");
const outputPath = path.join(rootDir, "src/data/study-items.generated.ts");

const categories = [
  { category: "Origin", field: "Origin" },
  { category: "Insertion", field: "Insertion" },
  { category: "Action", field: "Action" },
  { category: "Innervation", field: "Innervation" },
];

const requiredFields = ["Muscle", "Origin", "Insertion", "Action", "Innervation"];
const REGION_STOP_WORDS = new Set(["and"]);

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

function parseCsv(content) {
  const lines = content.replace(/^\uFEFF/, "").trim().split(/\r?\n/);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header.trim()] = (values[index] ?? "").trim();
    });

    return row;
  });
}

function normalizeKey(value) {
  return String(value).trim().toLowerCase();
}

function tokenizeRegionName(value) {
  return normalizeKey(value)
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !REGION_STOP_WORDS.has(word))
    .sort()
    .join(" ");
}

function loadRegions() {
  const regionsPath = path.join(rootDir, "src/data/regions.json");
  const raw = fs.readFileSync(regionsPath, "utf8");
  const regions = JSON.parse(raw);

  return regions.map((region) => ({
    id: region.id,
    name: region.name,
  }));
}

function buildSheetNameLookup(regions) {
  const lookup = new Map();

  for (const region of regions) {
    const aliases = [
      region.id,
      region.name,
      region.id.replace(/-/g, "_"),
      region.id.replace(/-/g, " "),
      region.name.replace(/\s+/g, "_"),
    ];

    for (const alias of aliases) {
      lookup.set(normalizeKey(alias), region.id);
      lookup.set(tokenizeRegionName(alias), region.id);
    }
  }

  return lookup;
}

function resolveSheetRegionId(sheetName, lookup) {
  const candidates = [
    normalizeKey(sheetName),
    normalizeKey(sheetName.replace(/_/g, "-")),
    normalizeKey(sheetName.replace(/-/g, "_")),
    tokenizeRegionName(sheetName),
  ];

  for (const candidate of candidates) {
    const regionId = lookup.get(candidate);

    if (regionId) {
      return regionId;
    }
  }

  return null;
}

function resolveWorkbookPath() {
  const candidates = [
    path.join(rootDir, "src/data/muscles.xlsx"),
    path.join(rootDir, "src/data/muscles.xlsx.xlsx"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function rowToMuscle(row, regionId) {
  for (const field of requiredFields) {
    if (!String(row[field] ?? "").trim()) {
      throw new Error(
        `Missing required field "${field}" for region "${regionId}" muscle "${row.Muscle ?? "(unknown)"}".`,
      );
    }
  }

  return {
    region: regionId,
    Muscle: String(row.Muscle).trim(),
    Origin: String(row.Origin).trim(),
    Insertion: String(row.Insertion).trim(),
    Action: String(row.Action).trim(),
    Innervation: String(row.Innervation).trim(),
  };
}

function loadRegionCsv(regionId) {
  const csvPath = path.join(csvDir, `${regionId}.csv`);

  if (!fs.existsSync(csvPath)) {
    return [];
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));

  return rows.map((row) => rowToMuscle(row, regionId));
}

async function loadWorkbookRegions(regions, csvLoadedRegionIds) {
  const workbookPath = resolveWorkbookPath();

  if (!workbookPath) {
    return {
      musclesByRegion: new Map(),
      unmatchedSheets: [],
      worksheetNameMismatches: [],
    };
  }

  let xlsxModule;

  try {
    xlsxModule = await import("xlsx");
  } catch {
    console.warn(
      "Skipping muscles.xlsx because the xlsx package is not installed. Run `npm install --save-dev xlsx` to enable workbook import.",
    );
    return {
      musclesByRegion: new Map(),
      unmatchedSheets: [],
      worksheetNameMismatches: [],
    };
  }

  const XLSX = xlsxModule.default ?? xlsxModule;
  const workbook = XLSX.readFile(workbookPath);
  const sheetLookup = buildSheetNameLookup(regions);
  const musclesByRegion = new Map();
  const unmatchedSheets = [];
  const worksheetNameMismatches = [];

  for (const sheetName of workbook.SheetNames) {
    const regionId = resolveSheetRegionId(sheetName, sheetLookup);

    if (!regionId) {
      unmatchedSheets.push(sheetName);
      continue;
    }

    if (sheetName !== regionId && normalizeKey(sheetName) !== normalizeKey(regionId)) {
      const region = regions.find((entry) => entry.id === regionId);

      worksheetNameMismatches.push({
        sheetName,
        regionId,
        canonicalName: region?.name ?? regionId,
      });
    }

    if (csvLoadedRegionIds.has(regionId)) {
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const regionMuscles = [];

    for (const row of rows) {
      if (!String(row.Muscle ?? "").trim()) {
        continue;
      }

      regionMuscles.push(rowToMuscle(row, regionId));
    }

    musclesByRegion.set(regionId, regionMuscles);
  }

  return {
    musclesByRegion,
    unmatchedSheets,
    worksheetNameMismatches,
  };
}

function createCards(muscles) {
  const cards = [];
  let id = 1;

  for (const muscle of muscles) {
    for (const { category, field } of categories) {
      cards.push({
        id,
        region: muscle.region,
        muscle: muscle.Muscle,
        category,
        answer: muscle[field],
        mastery: 0,
      });
      id += 1;
    }
  }

  return cards;
}

function toTsObject(value, indent = 2) {
  const spaces = " ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const items = value
      .map((item) => `${spaces}${toTsObject(item, indent + 2)}`)
      .join(",\n");

    return `[\n${items},\n${" ".repeat(indent - 2)}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(
      ([key, entryValue]) =>
        `${spaces}${key}: ${toTsObject(entryValue, indent + 2)}`,
    );

    return `{\n${entries.join(",\n")},\n${" ".repeat(indent - 2)}}`;
  }

  return JSON.stringify(value);
}

async function main() {
  const regions = loadRegions();
  const csvLoadedRegionIds = new Set();
  const musclesByRegion = new Map();
  const regionSummaries = [];

  for (const region of regions) {
    const regionMuscles = loadRegionCsv(region.id);

    if (regionMuscles.length > 0) {
      musclesByRegion.set(region.id, regionMuscles);
      csvLoadedRegionIds.add(region.id);
      regionSummaries.push(`${region.id}: ${regionMuscles.length} (csv)`);
    }
  }

  const {
    musclesByRegion: workbookMusclesByRegion,
    unmatchedSheets,
    worksheetNameMismatches,
  } = await loadWorkbookRegions(regions, csvLoadedRegionIds);

  for (const region of regions) {
    if (csvLoadedRegionIds.has(region.id)) {
      continue;
    }

    const regionMuscles = workbookMusclesByRegion.get(region.id) ?? [];

    if (regionMuscles.length > 0) {
      musclesByRegion.set(region.id, regionMuscles);
      regionSummaries.push(`${region.id}: ${regionMuscles.length} (workbook)`);
    }
  }

  const muscles = regions.flatMap((region) => musclesByRegion.get(region.id) ?? []);
  const cards = createCards(muscles);
  const output = `// This file is auto-generated by scripts/generate-cards.mjs
// Do not edit manually. Run "npm run generate-cards" to regenerate.

export type Muscle = {
  region: string;
  Muscle: string;
  Origin: string;
  Insertion: string;
  Action: string;
  Innervation: string;
};

export type Card = {
  id: number;
  region: string;
  muscle: string;
  category: string;
  answer: string;
  mastery: number;
};

export const muscles: Muscle[] = ${toTsObject(muscles)};

export const cards: Card[] = ${toTsObject(cards)};
`;

  fs.writeFileSync(outputPath, output, "utf8");

  console.log(
    `Generated ${cards.length} study items from ${muscles.length} muscles.`,
  );

  if (regionSummaries.length > 0) {
    console.log(`Regions loaded: ${regionSummaries.length}`);
    console.log(regionSummaries.join(", "));
  } else {
    console.warn(
      "No region data found. Add CSV files under src/data/csv/{region-slug}.csv or export src/data/muscles.xlsx.",
    );
  }

  if (worksheetNameMismatches.length > 0) {
    console.log("Worksheet name mismatches:");
    for (const mismatch of worksheetNameMismatches) {
      console.log(
        `  "${mismatch.sheetName}" -> ${mismatch.regionId} (${mismatch.canonicalName})`,
      );
    }
  }

  if (unmatchedSheets.length > 0) {
    console.warn(`Unmatched workbook sheets: ${unmatchedSheets.join(", ")}`);
  }

  console.log(`Output: ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
