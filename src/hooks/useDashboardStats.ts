"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { getCourseById } from "@/src/lib/course-controller";
import { COURSE_DAYS } from "@/src/lib/introduction-policy";
import { planDailyWorkload } from "@/src/lib/daily-workload-planning";
import {
  getCourseProgress,
  getCurrentStudyDay,
  isCurrentStudyDayCompleted,
} from "@/src/lib/course-progress";
import {
  getDueReviewPromptCount,
  getIntroducedMuscleCount,
  getMasteredMuscleCount,
} from "@/src/lib/dashboard-progress";
import {
  canAdvanceStudyDay as getCanAdvanceStudyDay,
  getGuidedDailyNewMuscleAllowance,
  hasIncompleteGuidedMuscle,
} from "@/src/lib/guided-scheduling";
import { readMasteryProgress } from "@/src/lib/mastery-progress";
import {
  isResumableActiveStudySession,
  readActiveStudySession,
} from "@/src/lib/active-study-session";
import type { Course } from "@/src/lib/course.types";

export type DashboardStats = {
  currentStudyDay: number;
  /** @internal Used for start-session gating; not shown on the dashboard. */
  plannedPromptCount: number;
  /** @internal Used for mixed review; not shown on the dashboard. */
  dueReviewPromptCount: number;
  /** @internal Retained for tests; not shown on the dashboard. */
  newMusclePromptCount: number;
  /** @internal Retained for tests; not shown on the dashboard. */
  showWorkloadWarning: boolean;
  introducedMuscleCount: number;
  /** @internal Retained for tests; not shown on the dashboard. */
  masteredMuscleCount: number;
  /** @internal Retained for tests; not shown on the dashboard. */
  remainingNewMuscleAllowance: number;
  canStartGuidedStudy: boolean;
  hasResumableStudySession: boolean;
  canStartReview: boolean;
  canAdvanceStudyDay: boolean;
  isStudyDayComplete: boolean;
};

const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  currentStudyDay: 1,
  plannedPromptCount: 0,
  dueReviewPromptCount: 0,
  newMusclePromptCount: 0,
  showWorkloadWarning: false,
  introducedMuscleCount: 0,
  masteredMuscleCount: 0,
  remainingNewMuscleAllowance: 0,
  canStartGuidedStudy: false,
  hasResumableStudySession: false,
  canStartReview: false,
  canAdvanceStudyDay: false,
  isStudyDayComplete: false,
};

export function computeDashboardStats(course: Course): DashboardStats {
  const muscleIds = course.muscleProfileIds;
  const masteryStore = readMasteryProgress();
  const courseProgress = getCourseProgress(course.id);
  const currentStudyDay = getCurrentStudyDay(courseProgress);
  const isStudyDayComplete = isCurrentStudyDayCompleted(courseProgress);
  const dueReviewPromptCount = getDueReviewPromptCount(
    muscleIds,
    masteryStore,
    currentStudyDay,
  );
  const workloadPlan = isStudyDayComplete
    ? {
        plannedPromptCount: 0,
        dueReviewPromptCount,
        newMusclePromptCount: 0,
        showWorkloadWarning: false,
      }
    : planDailyWorkload(course, courseProgress, masteryStore);
  const introducedMuscleCount = getIntroducedMuscleCount(
    muscleIds,
    courseProgress.introducedMuscleIds,
  );
  const masteredMuscleCount = getMasteredMuscleCount(muscleIds, masteryStore);
  const remainingNewMuscleAllowance = isStudyDayComplete
    ? 0
    : getGuidedDailyNewMuscleAllowance(
        courseProgress,
        muscleIds,
        masteryStore,
      );
  const hasIncomplete = hasIncompleteGuidedMuscle(
    course,
    courseProgress,
    masteryStore,
  );
  const hasResumableStudySession = isResumableActiveStudySession(
    readActiveStudySession(),
    course.id,
    courseProgress,
  );

  return {
    currentStudyDay,
    plannedPromptCount: workloadPlan.plannedPromptCount,
    dueReviewPromptCount: workloadPlan.dueReviewPromptCount,
    newMusclePromptCount: workloadPlan.newMusclePromptCount,
    showWorkloadWarning: workloadPlan.showWorkloadWarning,
    introducedMuscleCount,
    masteredMuscleCount,
    remainingNewMuscleAllowance,
    canStartGuidedStudy:
      !isStudyDayComplete &&
      (hasResumableStudySession ||
        workloadPlan.plannedPromptCount > 0 ||
        hasIncomplete),
    hasResumableStudySession,
    canStartReview: dueReviewPromptCount > 0,
    canAdvanceStudyDay: getCanAdvanceStudyDay(
      courseProgress,
      muscleIds,
      masteryStore,
    ),
    isStudyDayComplete,
  };
}

export function useDashboardStats(isDashboardActive: boolean) {
  const dashboardCourse = getCourseById(DEFAULT_COURSE_ID);
  const totalMuscleCount = dashboardCourse?.muscleProfileIds.length ?? 0;
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_DASHBOARD_STATS);

  const refreshDashboardStats = useCallback(() => {
    if (!dashboardCourse) {
      setStats(DEFAULT_DASHBOARD_STATS);
      return;
    }

    setStats(computeDashboardStats(dashboardCourse));
  }, [dashboardCourse]);

  useEffect(() => {
    if (!isDashboardActive) {
      return;
    }

    refreshDashboardStats();
  }, [isDashboardActive, refreshDashboardStats]);

  return {
    dashboardCourse,
    totalMuscleCount,
    totalStudyDays: COURSE_DAYS,
    ...stats,
    refreshDashboardStats,
  };
}
