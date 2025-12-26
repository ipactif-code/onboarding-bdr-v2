"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Flag, CheckCircle, Loader2 } from "lucide-react";
import { LessonContent } from "./lessons/[lessonId]/lesson-content";
import { LessonViewerSkeleton, LessonNotFound } from "./lesson-viewer-skeleton";
import { CourseWithProgress, LessonFull } from "@/types/course";
import { Id } from "../../../../../convex/_generated/dataModel";

interface LessonViewerProps {
  course: CourseWithProgress;
  lesson: LessonFull | null | undefined;
  isLoading: boolean;
}

export function LessonViewer({ course, lesson, isLoading }: LessonViewerProps): React.ReactElement | null {
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
      markStarted({ lessonId: lesson._id }).catch(() => {
        // Silently fail - this is a non-critical background operation
        // The user can still view the lesson even if progress tracking fails
      });
    }
  }, [lesson?._id, markStarted]);

  // Navigate to lesson
  const navigateToLesson = (lessonId: Id<"lessons">): void => {
    router.push(`/courses/${course._id}?lesson=${lessonId}`, { scroll: false });
  };

  // Mark complete and navigate to next
  const handleMarkCompleteAndNext = async (): Promise<void> => {
    if (!lesson) return;

    setIsCompleting(true);
    try {
      await markCompleted({ lessonId: lesson._id });

      // Navigate to next lesson if available
      if (navigation.next) {
        navigateToLesson(navigation.next._id);
      }
    } catch {
      toast.error("Failed to mark lesson as completed. Please try again.");
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
    return <LessonNotFound />;
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
            <Flag className="size-4" data-icon="inline-start" aria-hidden="true" />
            Report Issue
          </Button>

          <div className="flex items-center gap-3">
            {/* Back Button */}
            {navigation.prev ? (
              <Button
                variant="outline"
                onClick={() => navigateToLesson(navigation.prev!._id)}
              >
                <ChevronLeft className="size-4" data-icon="inline-start" aria-hidden="true" />
                Back
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <ChevronLeft className="size-4" data-icon="inline-start" aria-hidden="true" />
                Back
              </Button>
            )}

            {/* Mark Complete & Continue / Complete Course Button */}
            {isLessonCompleted ? (
              // Already completed - just show navigation
              navigation.next ? (
                <Button onClick={() => navigateToLesson(navigation.next!._id)}>
                  Next Chapter
                  <ChevronRight className="size-4" data-icon="inline-end" aria-hidden="true" />
                </Button>
              ) : (
                <Button disabled>
                  <CheckCircle className="size-4" data-icon="inline-start" aria-hidden="true" />
                  Course Complete
                </Button>
              )
            ) : (
              // Not completed - show mark complete button
              <Button onClick={handleMarkCompleteAndNext} disabled={isCompleting}>
                {isCompleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" data-icon="inline-start" aria-hidden="true" />
                    Saving...
                  </>
                ) : navigation.next ? (
                  <>
                    Mark Complete & Continue
                    <ChevronRight className="size-4" data-icon="inline-end" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <CheckCircle className="size-4" data-icon="inline-start" aria-hidden="true" />
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
