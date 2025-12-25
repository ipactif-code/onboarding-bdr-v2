"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loading state for a discussion message.
 */
export function DiscussionMessageSkeleton(): React.ReactElement {
  return (
    <div className="flex gap-3 px-4 py-3">
      <Skeleton className="size-6 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for the entire CourseDiscussionPanel.
 */
export function CourseDiscussionPanelSkeleton(): React.ReactElement {
  return (
    <div
      data-slot="course-discussion-panel-skeleton"
      className="border-t border-border bg-background"
    >
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="size-4" />
      </div>
    </div>
  );
}
