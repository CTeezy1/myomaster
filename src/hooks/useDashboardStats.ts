"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COURSE_ID } from "@/src/config/study-flow";
import { getCourseById } from "@/src/lib/course-controller";
import { COURSE_DAYS } from "@/src/lib/introduction-policy";
import { planDailyWorkload } from "@/src/lib/daily-workload-planning";
import { getCourseProgress, getCurrentStudyDay } from "@/src/lib/course-progress";
import {
  getIntroducedMuscleCount,
  getMasteredMuscleCount,
} from "@/src/lib/dashboard-progress";
import {
  canAdvanceStudyDay as getCanAdvanceStudyDay,
  findNextGuidedMuscleIndex,
  getGuidedDailyNewMuscleAllowance,
  getGuidedStudyButtonLabel,
  hasIncompleteGuidedMuscle,
} from "@/src/lib/guided-scheduling";
import { readMasteryProgress } from "@/src/lib/mastery-progress";
import type { Course } from "@/src/lib/course.types";

export type DashboardStats = {
  currentStudyDay: number;
  plannedPromptCount: number;
  dueReviewPromptCount: number;
  newMusclePromptCount: number;
  showWorkloadWarning: boolean;
  introducedMuscleCount: number;
  masteredMuscleCount: number;
  remainingNewMuscleAllowance: number;
  canStartGuidedStudy: boolean;
  guidedStudyLabel: string;
  canStartReview: boolean;
  canAdvanceStudyDay: boolean;
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
  guidedStudyLabel: getGuidedStudyButtonLabel(null),
  canStartReview: false,
  canAdvanceStudyDay: false,
};

export function computeDashboardStats(course: Course): DashboardStats {
  const muscleIds = course.muscleProfileIds;
  const masteryStore = readMasteryProgress();
  const courseProgress = getCourseProgress(course.id);
  const currentStudyDay = getCurrentStudyDay(courseProgress);
  const workloadPlan = planDailyWorkload(course, courseProgress, masteryStore);
  const introducedMuscleCount = getIntroducedMuscleCount(
    muscleIds,
    courseProgress.introducedMuscleIds,
  );
  const masteredMuscleCount = getMasteredMuscleCount(muscleIds, masteryStore);
  const remainingNewMuscleAllowance = getGuidedDailyNewMuscleAllowance(
    courseProgress,
    muscleIds,
    masteryStore,
  );
  const nextGuidedMuscle = findNextGuidedMuscleIndex(
    course,
    courseProgress,
    masteryStore,
    remainingNewMuscleAllowance,
  );
  const hasIncomplete = hasIncompleteGuidedMuscle(
    course,
    courseProgress,
    masteryStore,
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
      workloadPlan.plannedPromptCount > 0 || hasIncomplete,
    guidedStudyLabel: getGuidedStudyButtonLabel(nextGuidedMuscle),
    canStartReview: workloadPlan.dueReviewPromptCount > 0,
    canAdvanceStudyDay: getCanAdvanceStudyDay(
      courseProgress,
      muscleIds,
      masteryStore,
    ),
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
