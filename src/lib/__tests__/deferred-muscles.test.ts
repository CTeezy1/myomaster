import { describe, expect, it } from "vitest";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { CARD_CATEGORIES, buildCardProgressKey } from "@/src/lib/card-progress-key";
import { createDefaultCourseProgress } from "@/src/lib/course-progress";
import { getStudyCourseForCurriculum } from "@/src/lib/curriculum";
import {
  parseDeferredMuscleIds,
  selectNewMuscleIds,
  shiftCardReviewStudyDays,
} from "@/src/lib/deferred-muscles";
import { findNextGuidedMuscleIndex } from "@/src/lib/guided-scheduling";
import { OVERDUE_PROMPT_LIMIT } from "@/src/lib/introduction-policy";
import { getNewMuscleIdsForStudyDay } from "@/src/lib/new-muscle-queue";
import { getDueReviewPromptCount } from "@/src/lib/dashboard-progress";
import { createDefaultCardProgress } from "@/src/lib/mastery-progress";
import type { CardProgress, MasteryProgressStore } from "@/src/lib/progress.types";

const course = getStudyCourseForCurriculum("upper-first-v1");

function dueCard(muscleId: string, category: "action", nextReviewStudyDay: number | null): CardProgress {
  const key = buildCardProgressKey(muscleId, category)!;
  return {
    ...createDefaultCardProgress({ key, muscleId, category }),
    state: "learning",
    totalAttempts: 1,
    correctAttempts: 1,
    successfulReviewCount: 1,
    currentIntervalDays: 3,
    nextReviewStudyDay,
  };
}

describe("deferred muscle introductions", () => {
  it("ignores invalid deferred tokens", () => {
    expect(parseDeferredMuscleIds([" deltoid ", "", "deltoid", 1, null])).toEqual([
      "deltoid",
    ]);
  });

  it("skips deferred muscles until later non-deferred muscles are introduced", () => {
    const progress = {
      ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
      introducedMuscleIds: course.muscleProfileIds.slice(0, 3),
      deferredMuscleIds: course.muscleProfileIds.slice(3, 38),
    };

    expect(getNewMuscleIdsForStudyDay(course, progress, 2)).toEqual([
      "gluteus-maximus",
      "gluteus-medius",
    ]);

    const completedIntroduced: MasteryProgressStore = { version: 1, cards: {} };
    for (const muscleId of progress.introducedMuscleIds) {
      for (const category of CARD_CATEGORIES) {
        const key = buildCardProgressKey(muscleId, category)!;
        completedIntroduced.cards[key] = {
          ...createDefaultCardProgress({ key, muscleId, category }),
          totalAttempts: 1,
        };
      }
    }

    expect(
      findNextGuidedMuscleIndex(course, progress, completedIntroduced, 1),
    ).toEqual({
      index: course.muscleProfileIds.indexOf("gluteus-maximus"),
      isNew: true,
    });
  });

  it("revisits deferred muscles in original roster order after later regions", () => {
    const deferred = ["deltoid", "brachialis", "lumbricals"];
    const progress = {
      ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
      introducedMuscleIds: course.muscleProfileIds.filter(
        (muscleId) => !deferred.includes(muscleId),
      ),
      deferredMuscleIds: deferred,
    };

    expect(selectNewMuscleIds(course, progress, 3)).toEqual(deferred);
  });

  it("does not permanently strand deferred muscles when allowance remains", () => {
    const progress = {
      ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
      introducedMuscleIds: course.muscleProfileIds.filter(
        (muscleId) => muscleId !== "lumbricals",
      ),
      deferredMuscleIds: ["lumbricals"],
    };

    expect(getNewMuscleIdsForStudyDay(course, progress, 1)).toEqual(["lumbricals"]);
  });

  it("keeps previously introduced muscles out of the new-muscle queue", () => {
    const progress = {
      ...createDefaultCourseProgress(DEFAULT_COURSE_ID),
      introducedMuscleIds: ["supraspinatus", "infraspinatus"],
      deferredMuscleIds: course.muscleProfileIds.slice(2, 38),
    };

    expect(getNewMuscleIdsForStudyDay(course, progress, 1)[0]).toBe(
      "gluteus-maximus",
    );
    expect(progress.introducedMuscleIds).toEqual([
      "supraspinatus",
      "infraspinatus",
    ]);
  });

  it("preserves relative review due dates when study days are shifted", () => {
    const store: MasteryProgressStore = {
      version: 1,
      cards: {
        "supraspinatus:action": dueCard("supraspinatus", "action", 6),
      },
    };
    const shifted = shiftCardReviewStudyDays(store, 15);

    expect(store.cards["supraspinatus:action"]?.nextReviewStudyDay).toBe(6);
    expect(shifted.cards["supraspinatus:action"]?.nextReviewStudyDay).toBe(21);
    expect(
      getDueReviewPromptCount(course.muscleProfileIds, store, 5),
    ).toBe(
      getDueReviewPromptCount(course.muscleProfileIds, shifted, 20),
    );
  });

  it("keeps the 40-overdue limit from blocking hip after a shifted Day 20 jump", () => {
    const cards: MasteryProgressStore["cards"] = {};

    for (let index = 0; index < 11; index += 1) {
      const muscleId = course.muscleProfileIds[index]!;
      for (const category of ["origin", "insertion", "action", "innervation"] as const) {
        const key = buildCardProgressKey(muscleId, category)!;
        cards[key] = {
          ...dueCard(muscleId, "action", 6),
          key,
          category,
        };
      }
    }

    const store = { version: 1 as const, cards };
    const jumpedDue = getDueReviewPromptCount(course.muscleProfileIds, store, 20);
    const shifted = shiftCardReviewStudyDays(store, 15);
    const shiftedDue = getDueReviewPromptCount(
      course.muscleProfileIds,
      shifted,
      20,
    );

    expect(jumpedDue).toBeGreaterThan(OVERDUE_PROMPT_LIMIT);
    expect(shiftedDue).toBeLessThanOrEqual(OVERDUE_PROMPT_LIMIT);
  });
});
