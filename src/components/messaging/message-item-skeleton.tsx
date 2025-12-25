"use client";

import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// MessageItemSkeleton Component
// ============================================================================

/**
 * Skeleton loading state for MessageItem.
 * Displays placeholder UI while message data is loading.
 */
export function MessageItemSkeleton(): React.ReactElement {
  return (
    <div className="flex gap-3 px-4 py-2">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
