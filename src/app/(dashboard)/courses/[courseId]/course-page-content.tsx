"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Id } from "../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import { LessonViewer } from "./lesson-viewer";
import { CourseSidebar } from "./course-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface CoursePageContentProps {
  courseId: string;
}

export function CoursePageContent({ courseId }: CoursePageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonIdParam = searchParams.get("lesson");

  // Fetch course data
  const course = useQuery(api.courses.getWithProgress, {
    courseId: courseId as Id<"courses">,
  });

  // Fetch lesson data (conditionally, only if lessonId is in URL)
  const lesson = useQuery(
    api.lessons.get,
    lessonIdParam ? { lessonId: lessonIdParam as Id<"lessons"> } : "skip"
  );

  // Calculate first incomplete lesson for auto-select
  const firstIncompleteLessonId = useMemo(() => {
    if (!course?.sections) return null;

    const completedSet = new Set(
      course.userProgress.lessonStatuses
        .filter((s: { status: string }) => s.status === "completed")
        .map((s: { lessonId: Id<"lessons"> }) => s.lessonId)
    );

    for (const section of course.sections) {
      for (const lesson of section.lessons) {
        if (!completedSet.has(lesson._id)) {
          return lesson._id;
        }
      }
    }

    // All completed, return first lesson
    return course.sections[0]?.lessons[0]?._id ?? null;
  }, [course]);

  // Auto-select first incomplete lesson if no lesson in URL
  useEffect(() => {
    if (course && !lessonIdParam && firstIncompleteLessonId) {
      router.replace(`/courses/${courseId}?lesson=${firstIncompleteLessonId}`, {
        scroll: false,
      });
    }
  }, [course, lessonIdParam, firstIncompleteLessonId, courseId, router]);

  // Loading state
  if (course === undefined) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[2.75fr_1fr] h-full overflow-hidden">
        <div className="p-6 space-y-4 overflow-auto">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="border-l p-4 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  // Course not found
  if (course === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Course not found</h1>
          <p className="text-muted-foreground mt-2">
            This course doesn&apos;t exist or you don&apos;t have access to it.
          </p>
        </div>
      </div>
    );
  }

  // Determine if lesson is still loading
  const isLessonLoading = Boolean(lessonIdParam && lesson === undefined);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2.75fr_1fr] h-full overflow-hidden">
      <LessonViewer
        course={course}
        lesson={lesson}
        isLoading={isLessonLoading}
      />
      <CourseSidebar course={course} selectedLessonId={lessonIdParam} />
    </div>
  );
}
