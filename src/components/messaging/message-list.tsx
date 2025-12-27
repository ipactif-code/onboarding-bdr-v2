"use client";

import { Loader2, MessageCircle } from "lucide-react";

import { type ChannelMessage } from "@/hooks/use-messages";
import { useMessageScroll } from "@/hooks/use-message-scroll";
import { useMessageIntersection } from "@/hooks/use-message-intersection";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageItem } from "@/components/messaging/message-item";
import { MessageListSkeleton } from "@/components/messaging/message-list-skeleton";
import { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export interface MessageListProps {
  /** Array of messages to display. */
  messages: ChannelMessage[];
  /** Whether the initial messages are loading. */
  isLoading?: boolean;
  /** Whether there are more messages to load. */
  hasMore?: boolean;
  /** Whether older messages are currently being loaded. */
  isLoadingMore?: boolean;
  /** Callback to load more (older) messages. */
  onLoadMore?: () => void;
  /** Callback when a message becomes visible (for marking as read). */
  onMessageVisible?: (messageId: Id<"messages">, createdAt: number) => void;
  /** Callback when user wants to reply to a message. */
  onReply?: (messageId: Id<"messages">) => void;
  /** Callback when user wants to edit a message. */
  onEdit?: (messageId: Id<"messages">) => void;
  /** Callback when user wants to delete a message. */
  onDelete?: (messageId: Id<"messages">) => void;
  /** The current user's ID for determining message ownership. */
  currentUserId?: Id<"users">;
  /** The current user's display name for highlighting @mentions. */
  currentUserName?: string;
  /** Optional className for the container. */
  className?: string;
}

// ============================================================================
// MessageList Component
// ============================================================================

/**
 * MessageList displays a scrollable list of messages with real-time updates.
 *
 * Features:
 * - Real-time message updates
 * - Infinite scroll to load older messages
 * - Auto-scroll to bottom on new messages (if already at bottom)
 * - IntersectionObserver to detect visible messages
 * - Loading states and skeletons
 */
export function MessageList({
  messages,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onMessageVisible,
  onReply,
  onEdit,
  onDelete,
  currentUserId,
  currentUserName,
  className,
}: MessageListProps): React.ReactElement {
  // Scroll behavior hook
  const {
    scrollAreaRef,
    bottomRef,
    isAtBottom,
    handleScroll,
    scrollToBottom,
    announcement,
  } = useMessageScroll({
    messagesLength: messages.length,
    isLoadingMore,
  });

  // Intersection observer hook for load-more and visibility tracking
  const { topRef } = useMessageIntersection({
    scrollAreaRef,
    messages,
    hasMore,
    isLoadingMore,
    onLoadMore,
    onMessageVisible,
  });

  // ========================================================================
  // Render
  // ========================================================================

  if (isLoading) {
    return <MessageListSkeleton className={className} />;
  }

  if (messages.length === 0) {
    return (
      <div
        data-slot="message-list-empty"
        className={cn(
          "flex flex-1 flex-col items-center justify-center p-8 text-center",
          className
        )}
      >
        <MessageCircle className="mb-4 size-12 text-muted-foreground/50" aria-hidden="true" />
        <h3 className="text-lg font-medium">No messages yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Be the first to send a message in this channel!
        </p>
      </div>
    );
  }

  return (
    <div
      data-slot="message-list"
      id="message-content"
      className={cn("relative flex flex-1 flex-col overflow-hidden", className)}
    >
      {/* Screen reader announcement for new messages */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Scrollable message container */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {/* Message feed with semantic roles for accessibility */}
        <div
          role="feed"
          aria-label="Channel messages"
          aria-busy={isLoading || isLoadingMore}
          className="flex flex-col pb-4"
        >
          {/* Load more trigger (at top) */}
          <div ref={topRef} className="h-1" aria-hidden="true" />

          {/* Loading indicator for older messages */}
          {isLoadingMore && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading older messages...
              </span>
            </div>
          )}

          {/* Load more button (fallback for when observer doesn't trigger) */}
          {hasMore && !isLoadingMore && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadMore}
                className="text-xs"
              >
                Load older messages
              </Button>
            </div>
          )}

          {/* Messages with article role for each item */}
          {messages.map((message, index) => (
            <article
              key={message._id}
              role="article"
              aria-posinset={index + 1}
              aria-setsize={messages.length}
              data-created-at={message.createdAt}
            >
              <MessageItem
                id={message._id}
                content={message.content}
                senderId={message.senderId}
                senderName={message.sender.name}
                senderAvatarUrl={message.sender.avatarUrl}
                createdAt={message.createdAt}
                isOwn={currentUserId === message.senderId}
                isEdited={message.isEdited}
                threadReplyCount={message.threadReplyCount}
                status={message.status ?? "sent"}
                lesson={message.lesson}
                currentUserName={currentUserName}
                onReply={onReply ? () => onReply(message._id) : undefined}
                onEdit={
                  onEdit && currentUserId === message.senderId
                    ? () => onEdit(message._id)
                    : undefined
                }
                onDelete={
                  onDelete && currentUserId === message.senderId
                    ? () => onDelete(message._id)
                    : undefined
                }
              />
            </article>
          ))}

          {/* Bottom anchor for auto-scroll */}
          <div ref={bottomRef} className="h-1" aria-hidden="true" />
        </div>
      </div>

      {/* Scroll to bottom button (shown when not at bottom) */}
      {!isAtBottom && (
        <Button
          variant="secondary"
          size="sm"
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg"
          aria-label="Scroll to latest messages"
        >
          New messages
        </Button>
      )}
    </div>
  );
}

export { MessageListSkeleton };
