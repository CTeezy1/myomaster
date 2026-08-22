import { describe, expect, it } from "vitest";
import {
  CANONICAL_REGION_IDS,
  CURRICULUM_IDS,
  CURRICULUM_REGION_ORDERS,
  SECTION_CURRICULUM_IDS,
} from "@/src/data/curricula/section-region-orders";
import { myomasterProgramCourse } from "@/src/data/courses/myomaster-program-course";
import {
  getMuscleProfileById,
  getMuscleProfilesForRegionId,
} from "@/src/data/muscle-profiles";
import { cervicalMuscleProfiles } from "@/src/data/muscle-profiles/cervical";
import { CANONICAL_REGIONS, getRegionById } from "@/src/data/regions";
import {
  buildMuscleRoster,
  getCurriculumIdForSection,
  getCurriculumRegionOrder,
  getStudyCourseForCurriculum,
  isCurriculumId,
  parseCurriculumId,
} from "@/src/lib/curriculum";
import { COURSE_SECTIONS } from "@/src/lib/profile.types";

function firstMuscleIdForRegion(
  regionId: (typeof CANONICAL_REGIONS)[number]["id"],
) {
  const profile = getMuscleProfilesForRegionId(regionId)[0];

  if (!profile) {
    throw new Error(`Missing first muscle for region ${regionId}`);
  }

  return profile.id;
}

function regionSlicesForCurriculum(curriculumId: keyof typeof CURRICULUM_REGION_ORDERS) {
  const regionOrder = getCurriculumRegionOrder(curriculumId);
  const roster = buildMuscleRoster(curriculumId);
  const slices: Record<string, string[]> = {};
  let offset = 0;

  for (const regionId of regionOrder) {
    const expectedIds = getMuscleProfilesForRegionId(regionId).map(
      (profile) => profile.id,
    );
    slices[regionId] = roster.slice(offset, offset + expectedIds.length);
    offset += expectedIds.length;
  }

  return slices;
}

describe("curriculum registry", () => {
  it("exposes only the versioned curriculum keys", () => {
    expect(CURRICULUM_IDS).toEqual([
      "legacy-canonical-v1",
      "upper-first-v1",
      "axial-then-upper-v1",
      "lower-first-v1",
    ]);
    expect(isCurriculumId("legacy-canonical-v1")).toBe(true);
    expect(isCurriculumId("upper-first-v1")).toBe(true);
    expect(parseCurriculumId("axial-then-upper-v1")).toBe("axial-then-upper-v1");
    expect(isCurriculumId("upper-first-v2")).toBe(false);
    expect(parseCurriculumId("not-a-curriculum")).toBeNull();
  });

  it("rejects unknown curriculum keys instead of resolving a fallback roster", () => {
    expect(() =>
      buildMuscleRoster("not-a-curriculum" as "legacy-canonical-v1"),
    ).toThrow(/Unknown curriculum id/);
    expect(() =>
      getStudyCourseForCurriculum("upper-first-v2" as "upper-first-v1"),
    ).toThrow(/Unknown curriculum id/);
  });

  it("maps every course section to the intended curriculum", () => {
    expect(getCurriculumIdForSection("Testing")).toBe("upper-first-v1");
    expect(getCurriculumIdForSection("Kinesiology 1")).toBe("upper-first-v1");
    expect(getCurriculumIdForSection("Kinesiology 2")).toBe("axial-then-upper-v1");
    expect(getCurriculumIdForSection("Movement Anatomy 1")).toBe("lower-first-v1");
    expect(getCurriculumIdForSection("Movement Anatomy 2")).toBe("lower-first-v1");
    expect(SECTION_CURRICULUM_IDS.Testing).toBe(SECTION_CURRICULUM_IDS["Kinesiology 1"]);
    expect(SECTION_CURRICULUM_IDS["Movement Anatomy 1"]).toBe(
      SECTION_CURRICULUM_IDS["Movement Anatomy 2"],
    );
    expect(COURSE_SECTIONS.every((section) => section in SECTION_CURRICULUM_IDS)).toBe(
      true,
    );
  });

  it("keeps every curriculum region order as a permutation of the canonical regions", () => {
    const canonical = [...CANONICAL_REGION_IDS].sort();

    expect(CANONICAL_REGION_IDS).toEqual(CANONICAL_REGIONS.map((region) => region.id));

    for (const curriculumId of CURRICULUM_IDS) {
      const regionOrder = getCurriculumRegionOrder(curriculumId);
      expect(regionOrder).toHaveLength(CANONICAL_REGIONS.length);
      expect(new Set(regionOrder).size).toBe(CANONICAL_REGIONS.length);
      expect([...regionOrder].sort()).toEqual(canonical);
    }
  });
});

describe("curriculum rosters", () => {
  const rosters = Object.fromEntries(
    CURRICULUM_IDS.map((curriculumId) => [
      curriculumId,
      buildMuscleRoster(curriculumId),
    ]),
  );
  const liveRoster = myomasterProgramCourse.muscleProfileIds;
  const canonicalSet = new Set(liveRoster);

  it("gives every curriculum exactly 84 unique muscle IDs", () => {
    for (const curriculumId of CURRICULUM_IDS) {
      const roster = rosters[curriculumId];
      expect(roster).toHaveLength(84);
      expect(new Set(roster).size).toBe(84);
    }
  });

  it("uses the identical set of canonical muscle IDs in every curriculum", () => {
    for (const curriculumId of CURRICULUM_IDS) {
      expect(new Set(rosters[curriculumId])).toEqual(canonicalSet);
    }
  });

  it("resolves every roster ID to an existing canonical muscle profile", () => {
    for (const curriculumId of CURRICULUM_IDS) {
      for (const muscleId of rosters[curriculumId]) {
        const profile = getMuscleProfileById(muscleId);
        expect(profile, `missing profile for ${muscleId}`).toBeDefined();
        expect(profile!.id).toBe(muscleId);
      }
    }
  });

  it("preserves within-region muscle order in every curriculum", () => {
    for (const curriculumId of CURRICULUM_IDS) {
      const slices = regionSlicesForCurriculum(curriculumId);

      for (const regionId of getCurriculumRegionOrder(curriculumId)) {
        expect(slices[regionId]).toEqual(
          getMuscleProfilesForRegionId(regionId).map((profile) => profile.id),
        );
      }
    }
  });

  it("makes legacy-canonical-v1 match the live myomaster-program roster exactly", () => {
    expect(CURRICULUM_REGION_ORDERS["legacy-canonical-v1"]).toEqual(
      CANONICAL_REGIONS.map((region) => region.id),
    );
    expect(rosters["legacy-canonical-v1"]).toEqual(liveRoster);
    expect(getStudyCourseForCurriculum("legacy-canonical-v1").muscleProfileIds).toEqual(
      myomasterProgramCourse.muscleProfileIds,
    );
  });

  it("starts each curriculum at the first muscle of the intended first region", () => {
    const firstShoulderId = firstMuscleIdForRegion("shoulder");
    const firstCervicalId = firstMuscleIdForRegion("cervical");
    const firstAnkleId = firstMuscleIdForRegion("ankle-and-foot");

    expect(getRegionById("shoulder")?.name).toBe("Shoulder");
    expect(getRegionById("cervical")?.name).toBe("Cervical");
    expect(getRegionById("ankle-and-foot")?.name).toBe("Ankle and Foot");

    expect(getCurriculumRegionOrder("upper-first-v1")[0]).toBe("shoulder");
    expect(rosters["upper-first-v1"][0]).toBe(firstShoulderId);
    expect(getMuscleProfileById(firstShoulderId)?.region).toBe("shoulder");

    expect(getCurriculumRegionOrder("axial-then-upper-v1")[0]).toBe("cervical");
    expect(rosters["axial-then-upper-v1"][0]).toBe(firstCervicalId);
    expect(getMuscleProfileById(firstCervicalId)?.region).toBe("cervical");

    expect(getCurriculumRegionOrder("lower-first-v1")[0]).toBe("ankle-and-foot");
    expect(rosters["lower-first-v1"][0]).toBe(firstAnkleId);
    expect(getMuscleProfileById(firstAnkleId)?.region).toBe("ankle-and-foot");

    expect(getCurriculumRegionOrder("legacy-canonical-v1")[0]).toBe("cervical");
    expect(rosters["legacy-canonical-v1"][0]).toBe(firstCervicalId);
    expect(liveRoster[0]).toBe(firstCervicalId);
  });

  it("keeps every generated study course on myomaster-program", () => {
    for (const curriculumId of CURRICULUM_IDS) {
      const course = getStudyCourseForCurriculum(curriculumId);
      expect(course.id).toBe("myomaster-program");
      expect(course.name).toBe(myomasterProgramCourse.name);
      expect(course.region).toBe(myomasterProgramCourse.region);
    }
  });

  it("does not mutate canonical profile arrays or the live program course", () => {
    const originalLiveRoster = [...myomasterProgramCourse.muscleProfileIds];
    const originalCervicalIds = cervicalMuscleProfiles.map((profile) => profile.id);
    const originalCervicalOrder = cervicalMuscleProfiles.map((profile) => profile.order);

    const upperFirst = getStudyCourseForCurriculum("upper-first-v1");
    const lowerFirst = getStudyCourseForCurriculum("lower-first-v1");

    upperFirst.muscleProfileIds.push("mutated-curriculum-id");
    lowerFirst.muscleProfileIds.reverse();

    expect(myomasterProgramCourse.muscleProfileIds).toEqual(originalLiveRoster);
    expect(cervicalMuscleProfiles.map((profile) => profile.id)).toEqual(
      originalCervicalIds,
    );
    expect(cervicalMuscleProfiles.map((profile) => profile.order)).toEqual(
      originalCervicalOrder,
    );
    expect(buildMuscleRoster("upper-first-v1")).not.toContain("mutated-curriculum-id");
    expect(getStudyCourseForCurriculum("legacy-canonical-v1").muscleProfileIds).toEqual(
      originalLiveRoster,
    );
  });
});
