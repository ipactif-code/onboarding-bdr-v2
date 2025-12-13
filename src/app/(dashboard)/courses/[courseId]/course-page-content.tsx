"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { CourseContent } from "./course-content";
import { CourseSidebar } from "./course-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface CoursePageContentProps {
  courseId: string;
}

export function CoursePageContent({ courseId }: CoursePageContentProps) {
  const course = useQuery(api.courses.getWithProgress, {
    courseId: courseId as Id<"courses">,
  });

  // Loading state
  if (course === undefined) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[2.75fr_1fr] h-[calc(100vh-4rem)]">
        <div className="p-6 space-y-4">
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
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Course not found</h1>
          <p className="text-muted-foreground mt-2">
            This course doesn&apos;t exist or you don&apos;t have access to it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2.75fr_1fr] h-[calc(100vh-4rem)]">
      <CourseContent course={course} />
      <CourseSidebar course={course} />
    </div>
  );
}
