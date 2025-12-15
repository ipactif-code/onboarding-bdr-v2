"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { LessonContent } from "./lesson-content";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Flag, AlertCircle } from "lucide-react";
import Link from "next/link";

interface LessonPageContentProps {
  courseId: string;
  lessonId: string;
}

export function LessonPageContent({ courseId, lessonId }: LessonPageContentProps) {
  // Fetch lesson data
  const lesson = useQuery(api.lessons.get, {
    lessonId: lessonId as Id<"lessons">,
  });

  // Fetch course data for navigation
  const course = useQuery(api.courses.getWithProgress, {
    courseId: courseId as Id<"courses">,
  });

  // Mutation to mark lesson as started
  const markStarted = useMutation(api.progress.markStarted);

  // Calculate prev/next lessons
  const navigation = useMemo(() => {
    if (!course?.sections) return { prev: null, next: null };

    const allLessons = course.sections.flatMap((section) => section.lessons);
    const currentIndex = allLessons.findIndex((l) => l._id === lessonId);

    return {
      prev: currentIndex > 0 ? allLessons[currentIndex - 1] : null,
      next: currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null,
    };
  }, [course?.sections, lessonId]);

  // Mark lesson as started when component mounts
  useEffect(() => {
    if (lesson?._id) {
      markStarted({ lessonId: lesson._id }).catch((error) => {
        console.error("Failed to mark lesson as started:", error);
      });
    }
  }, [lesson?._id, markStarted]);

  // Loading state
  if (lesson === undefined || course === undefined) {
    return <LessonPageSkeleton />;
  }

  // Lesson not found
  if (lesson === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="size-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Lesson not found</h1>
        <p className="text-muted-foreground">
          This lesson doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Button render={<Link href={`/courses/${courseId}`} />}>
          Back to course
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Main Content */}
      <ScrollArea className="h-0 flex-1">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* Lesson Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href={`/courses/${courseId}`} className="hover:underline">
                {course?.title}
              </Link>
              <ChevronRight className="size-4" />
              <span>{lesson.title}</span>
            </div>
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
          <LessonContent lesson={lesson} courseId={courseId} />
        </div>
      </ScrollArea>

      {/* Footer Navigation */}
      <div className="border-t px-6 py-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag className="size-4" data-icon="inline-start" />
          Report Issue
        </Button>

        <div className="flex items-center gap-3">
          {navigation.prev ? (
            <Button variant="outline" render={<Link href={`/courses/${courseId}/lessons/${navigation.prev._id}`} />}>
              <ChevronLeft className="size-4" data-icon="inline-start" />
              Back
            </Button>
          ) : (
            <Button variant="outline" render={<Link href={`/courses/${courseId}`} />}>
              <ChevronLeft className="size-4" data-icon="inline-start" />
              Back to Course
            </Button>
          )}

          {navigation.next ? (
            <Button render={<Link href={`/courses/${courseId}/lessons/${navigation.next._id}`} />}>
              Next Chapter
              <ChevronRight className="size-4" data-icon="inline-end" />
            </Button>
          ) : (
            <Button render={<Link href={`/courses/${courseId}`} />}>
              Complete Course
              <ChevronRight className="size-4" data-icon="inline-end" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function LessonPageSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Breadcrumb skeleton */}
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
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </div>
  );
}
