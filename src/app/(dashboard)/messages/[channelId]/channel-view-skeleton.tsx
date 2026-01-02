"use client";

import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// ChannelViewSkeleton Component
// ============================================================================

/**
 * Loading skeleton for the ChannelView component.
 * Displays placeholder UI while channel data is being fetched.
 */
export function ChannelViewSkeleton(): React.ReactElement {
  return (
    <div data-slot="channel-view-skeleton" className="flex min-h-0 flex-1 flex-col">
      {/* Header skeleton */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b px-4">
        <Skeleton className="size-5" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="size-8" />
      </div>

      {/* Messages skeleton */}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 py-2">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>

      {/* Input skeleton */}
      <div className="flex-shrink-0 border-t p-4">
        <div className="flex items-end gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
