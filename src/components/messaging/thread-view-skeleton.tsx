"use client";

import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// ThreadViewSkeleton Component
// ============================================================================

/**
 * Loading skeleton for the ThreadView component.
 * Displays placeholder UI for parent message and replies while loading.
 */
export function ThreadViewSkeleton(): React.ReactElement {
  return (
    <div data-slot="thread-view-skeleton" className="space-y-4 p-4">
      {/* Parent message skeleton */}
      <div className="space-y-2 border-b pb-4">
        <div className="flex gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
      {/* Reply skeletons */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
        <div className="flex gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}
