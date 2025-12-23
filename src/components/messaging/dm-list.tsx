"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { MessageSquare } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationItem } from "./dm-list/conversation-item";
import { type DMListProps, type Conversation } from "./dm-list/types";

// Re-export types for external consumers
export type { DMListProps, Conversation, Participant } from "./dm-list/types";

// ============================================================================
// DMList Component
// ============================================================================

/**
 * DMList displays the list of direct message conversations for the current user.
 *
 * Features:
 * - Real-time updates via Convex subscription
 * - Participant avatars with online status indicators
 * - Last message preview with relative timestamps
 * - Unread count badges
 * - Active state highlighting based on current route
 * - Sorted by last activity
 *
 * @example
 * ```tsx
 * <DMList
 *   onConversationSelect={(id) => console.log("Selected:", id)}
 * />
 * ```
 */
export function DMList({
  className,
  onConversationSelect,
}: DMListProps): React.ReactElement {
  const pathname = usePathname();
  const conversations = useQuery(api.messages.listConversations);

  // Determine which conversation is active based on the current route
  const activeConversationId = pathname
    ?.split("/messages/dm/")[1]
    ?.split("/")[0];

  // Handle conversation selection
  const handleConversationClick = useCallback(
    (conversationId: string) => {
      onConversationSelect?.(conversationId);
    },
    [onConversationSelect]
  );

  // Loading state
  if (conversations === undefined) {
    return <DMListSkeleton className={className} />;
  }

  return (
    <nav
      data-slot="dm-list"
      aria-label="Direct message conversations"
      className={cn("flex h-full flex-col", className)}
    >
      {/* Skip link for keyboard users */}
      <a
        href="#message-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-background focus:p-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to messages
      </a>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {conversations.length > 0 ? (
            conversations.map((conversation: Conversation) => (
              <ConversationItem
                key={conversation._id}
                conversation={conversation}
                isActive={activeConversationId === conversation._id}
                onClick={() => handleConversationClick(conversation._id)}
              />
            ))
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No conversations yet
              </p>
              <p className="text-xs text-muted-foreground/70">
                Click &quot;New Message&quot; to start
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </nav>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

/**
 * Loading skeleton for the DMList component.
 */
export function DMListSkeleton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      data-slot="dm-list-skeleton"
      className={cn("flex h-full flex-col", className)}
    >
      {/* Header skeleton */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Conversation items skeleton */}
      <div className="space-y-1 p-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            {/* Avatar skeleton */}
            <Skeleton className="size-8 shrink-0 rounded-full" />
            {/* Content skeleton */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
