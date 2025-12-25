"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading state for the LessonViewer component.
 * Displays placeholder UI while lesson data is loading.
 */
export function LessonViewerSkeleton(): React.ReactElement {
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

/**
 * State shown when a lesson is not found or user doesn't have access.
 */
export function LessonNotFound(): React.ReactElement {
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
