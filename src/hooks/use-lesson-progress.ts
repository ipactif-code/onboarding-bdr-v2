"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface UseLessonProgressOptions {
  lessonId: Id<"lessons">;
  autoTrackTime?: boolean;
  timeUpdateIntervalMs?: number;
}

interface UseLessonProgressReturn {
  progress: {
    _id: Id<"progress">;
    status: "not_started" | "in_progress" | "completed";
    completedAt?: number;
    lastAccessedAt: number;
    timeSpent: number;
  } | null | undefined;
  isLoading: boolean;
  markStarted: () => Promise<Id<"progress">>;
  markCompleted: () => Promise<void>;
  updateTimeSpent: (additionalSeconds: number) => Promise<void>;
}

/**
 * Hook for tracking lesson progress.
 * T068: Implement use-lesson-progress hook
 *
 * Features:
 * - Auto-marks lesson as started on mount
 * - Tracks time spent on lesson
 * - Provides methods to mark complete
 * - Real-time progress updates via Convex
 *
 * @param options Configuration options
 * @returns Progress state and control methods
 */
export function useLessonProgress(
  options: UseLessonProgressOptions
): UseLessonProgressReturn {
  const {
    lessonId,
    autoTrackTime = true,
    timeUpdateIntervalMs = 30000, // Update every 30 seconds
  } = options;

  // Query current progress
  const progress = useQuery(api.progress.getForLesson, { lessonId });

  // Mutations
  const markStartedMutation = useMutation(api.progress.markStarted);
  const markCompletedMutation = useMutation(api.progress.markCompleted);
  const updateTimeSpentMutation = useMutation(api.progress.updateTimeSpent);

  // Track accumulated time since last update
  const accumulatedTimeRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());

  // Mark started on mount
  useEffect(() => {
    markStartedMutation({ lessonId }).catch(console.error);
  }, [lessonId, markStartedMutation]);

  // Auto-track time spent
  useEffect(() => {
    if (!autoTrackTime) return;

    const updateTime = (): void => {
      const now = Date.now();
      const elapsedSeconds = Math.floor(
        (now - lastUpdateTimeRef.current) / 1000
      );
      accumulatedTimeRef.current += elapsedSeconds;
      lastUpdateTimeRef.current = now;

      // Send update to server
      if (accumulatedTimeRef.current > 0) {
        updateTimeSpentMutation({
          lessonId,
          additionalSeconds: accumulatedTimeRef.current,
        }).catch(console.error);
        accumulatedTimeRef.current = 0;
      }
    };

    // Set up interval for periodic updates
    const intervalId = setInterval(updateTime, timeUpdateIntervalMs);

    // Update on visibility change (when user switches tabs)
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        updateTime();
      } else {
        lastUpdateTimeRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Update on unmount
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      updateTime();
    };
  }, [lessonId, autoTrackTime, timeUpdateIntervalMs, updateTimeSpentMutation]);

  // Mark started handler
  const markStarted = useCallback(async (): Promise<Id<"progress">> => {
    return await markStartedMutation({ lessonId });
  }, [lessonId, markStartedMutation]);

  // Mark completed handler
  const markCompleted = useCallback(async (): Promise<void> => {
    await markCompletedMutation({ lessonId });
  }, [lessonId, markCompletedMutation]);

  // Manual time update handler
  const updateTimeSpent = useCallback(
    async (additionalSeconds: number): Promise<void> => {
      await updateTimeSpentMutation({ lessonId, additionalSeconds });
    },
    [lessonId, updateTimeSpentMutation]
  );

  return {
    progress,
    isLoading: progress === undefined,
    markStarted,
    markCompleted,
    updateTimeSpent,
  };
}

/**
 * Hook for tracking course progress.
 * Returns overall progress across all lessons.
 */
export function useCourseProgress(courseId: Id<"courses">): {
  progress: {
    completedLessons: number;
    totalLessons: number;
    percentage: number;
    lessonProgress: {
      lessonId: Id<"lessons">;
      lessonTitle: string;
      sectionTitle: string;
      status: "not_started" | "in_progress" | "completed";
      completedAt?: number;
      timeSpent: number;
    }[];
    lastAccessedLesson?: {
      lessonId: Id<"lessons">;
      title: string;
      sectionTitle: string;
      lastAccessedAt: number;
    };
    totalTimeSpent: number;
  } | undefined;
  isLoading: boolean;
} {
  const progress = useQuery(api.progress.getForCourse, { courseId });

  return {
    progress,
    isLoading: progress === undefined,
  };
}

/**
 * Hook for "Continue where you left off" feature.
 */
export function useContinueWatching(): {
  data:
    | {
        course: {
          _id: Id<"courses">;
          title: string;
          coverImageUrl?: string;
        };
        lesson: {
          _id: Id<"lessons">;
          title: string;
          sectionTitle: string;
        };
        progress: {
          completedLessons: number;
          totalLessons: number;
          percentage: number;
        };
        lastAccessedAt: number;
      }
    | undefined;
  isLoading: boolean;
} {
  const data = useQuery(api.progress.getContinueWatching);

  return {
    data: data ?? undefined,
    isLoading: data === undefined,
  };
}
