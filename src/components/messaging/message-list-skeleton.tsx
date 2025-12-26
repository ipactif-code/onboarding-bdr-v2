"use client";

import { cn } from "@/lib/utils";
import { MessageItemSkeleton } from "@/components/messaging/message-item-skeleton";

// ============================================================================
// Types
// ============================================================================

interface MessageListSkeletonProps {
  /** Optional className for the container. */
  className?: string;
  /** Number of skeleton items to display. Defaults to 8. */
  count?: number;
}

// ============================================================================
// MessageListSkeleton Component
// ============================================================================

/**
 * Skeleton loading state for MessageList.
 * Displays placeholder UI while messages are loading.
 */
export function MessageListSkeleton({
  className,
  count = 8,
}: MessageListSkeletonProps): React.ReactElement {
  return (
    <div
      data-slot="message-list-skeleton"
      className={cn("flex flex-1 flex-col overflow-hidden", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex-1 space-y-1 p-4">
        {Array.from({ length: count }, (_, i) => (
          <MessageItemSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">Loading messages</span>
    </div>
  );
}
