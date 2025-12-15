"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Flag, CheckCircle, Loader2 } from "lucide-react";
import { LessonContent } from "./lessons/[lessonId]/lesson-content";
import { CourseWithProgress, LessonFull } from "@/types/course";
import { Id } from "../../../../../convex/_generated/dataModel";

interface LessonViewerProps {
  course: CourseWithProgress;
  lesson: LessonFull | null | undefined;
  isLoading: boolean;
}

export function LessonViewer({ course, lesson, isLoading }: LessonViewerProps) {
  const router = useRouter();
  const markStarted = useMutation(api.progress.markStarted);
  const markCompleted = useMutation(api.progress.markCompleted);
  const [isCompleting, setIsCompleting] = useState(false);

  // Check if current lesson is completed
  const isLessonCompleted = useMemo(() => {
    if (!lesson) return false;
    const status = course.userProgress.lessonStatuses.find(
      (s) => s.lessonId === lesson._id
    );
    return status?.status === "completed";
  }, [course.userProgress.lessonStatuses, lesson]);

  // Calculate prev/next lessons
  const navigation = useMemo(() => {
    if (!course?.sections) return { prev: null, next: null };

    const allLessons = course.sections.flatMap((section) => section.lessons);
    const currentIndex = lesson
      ? allLessons.findIndex((l) => l._id === lesson._id)
      : -1;

    return {
      prev: currentIndex > 0 ? allLessons[currentIndex - 1] : null,
      next:
        currentIndex >= 0 && currentIndex < allLessons.length - 1
          ? allLessons[currentIndex + 1]
          : null,
    };
  }, [course?.sections, lesson]);

  // Mark lesson as started when it loads
  useEffect(() => {
    if (lesson?._id) {
      markStarted({ lessonId: lesson._id }).catch((error) => {
        console.error("Failed to mark lesson as started:", error);
      });
    }
  }, [lesson?._id, markStarted]);

  // Navigate to lesson
  const navigateToLesson = (lessonId: Id<"lessons">) => {
    router.push(`/courses/${course._id}?lesson=${lessonId}`, { scroll: false });
  };

  // Mark complete and navigate to next
  const handleMarkCompleteAndNext = async () => {
    if (!lesson) return;

    setIsCompleting(true);
    try {
      await markCompleted({ lessonId: lesson._id });

      // Navigate to next lesson if available
      if (navigation.next) {
        navigateToLesson(navigation.next._id);
      }
    } catch (error) {
      console.error("Failed to mark lesson as completed:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return <LessonViewerSkeleton />;
  }

  // Lesson not found
  if (lesson === null) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold">Lesson not found</h2>
            <p className="text-muted-foreground mt-2">
              This lesson doesn&apos;t exist or you don&apos;t have access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No lesson selected (shouldn't happen with auto-select, but fallback)
  if (!lesson) {
    return null;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable Content */}
      <ScrollArea className="h-0 flex-1">
        <div className="p-6 space-y-6">
          {/* Lesson Header */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{course.title}</p>
            <h1 className="text-3xl font-bold">{lesson.title}</h1>
            {lesson.description && (
              <p className="text-muted-foreground">{lesson.description}</p>
            )}
            {lesson.estimatedDuration && (
              <p className="text-sm text-muted-foreground">
                Estimated time: {lesson.estimatedDuration} min
              </p>
            )}
          </div>

          {/* Lesson Content */}
          <LessonContent lesson={lesson} courseId={course._id} />
        </div>
      </ScrollArea>

      {/* Footer Navigation */}
      <div className="border-t border-border px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Flag className="size-4" data-icon="inline-start" />
            Report Issue
          </Button>

          <div className="flex items-center gap-3">
            {/* Back Button */}
            {navigation.prev ? (
              <Button
                variant="outline"
                onClick={() => navigateToLesson(navigation.prev!._id)}
              >
                <ChevronLeft className="size-4" data-icon="inline-start" />
                Back
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <ChevronLeft className="size-4" data-icon="inline-start" />
                Back
              </Button>
            )}

            {/* Mark Complete & Continue / Complete Course Button */}
            {isLessonCompleted ? (
              // Already completed - just show navigation
              navigation.next ? (
                <Button onClick={() => navigateToLesson(navigation.next!._id)}>
                  Next Chapter
                  <ChevronRight className="size-4" data-icon="inline-end" />
                </Button>
              ) : (
                <Button disabled>
                  <CheckCircle className="size-4" data-icon="inline-start" />
                  Course Complete
                </Button>
              )
            ) : (
              // Not completed - show mark complete button
              <Button onClick={handleMarkCompleteAndNext} disabled={isCompleting}>
                {isCompleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                    Saving...
                  </>
                ) : navigation.next ? (
                  <>
                    Mark Complete & Continue
                    <ChevronRight className="size-4" data-icon="inline-end" />
                  </>
                ) : (
                  <>
                    <CheckCircle className="size-4" data-icon="inline-start" />
                    Mark Complete
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LessonViewerSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 p-6 space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* Content skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      </div>
      {/* Footer skeleton */}
      <div className="border-t px-6 py-4 flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-48" />
        </div>
      </div>
    </div>
  );
}
