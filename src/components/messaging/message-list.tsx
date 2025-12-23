"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

import { type ChannelMessage } from "@/hooks/use-messages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageItem, MessageItemSkeleton } from "@/components/messaging/message-item";
import { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export interface MessageListProps {
  /**
   * Array of messages to display.
   */
  messages: ChannelMessage[];
  /**
   * Whether the initial messages are loading.
   */
  isLoading?: boolean;
  /**
   * Whether there are more messages to load.
   */
  hasMore?: boolean;
  /**
   * Whether older messages are currently being loaded.
   */
  isLoadingMore?: boolean;
  /**
   * Callback to load more (older) messages.
   */
  onLoadMore?: () => void;
  /**
   * Callback when a message becomes visible (for marking as read).
   */
  onMessageVisible?: (messageId: Id<"messages">, createdAt: number) => void;
  /**
   * Callback when user wants to reply to a message.
   */
  onReply?: (messageId: Id<"messages">) => void;
  /**
   * Callback when user wants to edit a message.
   */
  onEdit?: (messageId: Id<"messages">) => void;
  /**
   * Callback when user wants to delete a message.
   */
  onDelete?: (messageId: Id<"messages">) => void;
  /**
   * The current user's ID for determining message ownership.
   */
  currentUserId?: Id<"users">;
  /**
   * Optional className for the container.
   */
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
 * - IntersectionObserver to detect visible messages (T035)
 * - Loading states and skeletons
 *
 * @example
 * ```tsx
 * const { messages, isLoading, hasMore, loadMore } = useChannelMessages({ channelId });
 *
 * <MessageList
 *   messages={messages}
 *   isLoading={isLoading}
 *   hasMore={hasMore}
 *   onLoadMore={loadMore}
 *   onMessageVisible={(id, createdAt) => markAsRead(createdAt)}
 * />
 * ```
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
  className,
}: MessageListProps): React.ReactElement {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const previousMessagesLengthRef = useRef(messages.length);

  // Aria-live announcement for new messages (accessibility)
  const [announcement, setAnnouncement] = useState<string>("");

  // Track the latest visible message for auto-read
  const latestVisibleMessageRef = useRef<{
    messageId: Id<"messages">;
    createdAt: number;
  } | null>(null);

  // ========================================================================
  // IntersectionObserver for infinite scroll (load more)
  // ========================================================================

  useEffect(() => {
    if (!topRef.current || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore?.();
        }
      },
      {
        root: scrollAreaRef.current,
        rootMargin: "100px 0px 0px 0px", // Trigger 100px before reaching top
        threshold: 0,
      }
    );

    observer.observe(topRef.current);

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  // ========================================================================
  // IntersectionObserver for marking messages as read (T035)
  // ========================================================================

  useEffect(() => {
    if (!scrollAreaRef.current || messages.length === 0) return;

    // Create observer for message visibility
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute("data-message-id");
            const createdAt = entry.target.getAttribute("data-created-at");

            if (messageId && createdAt) {
              const createdAtNum = parseInt(createdAt, 10);
              const currentLatest = latestVisibleMessageRef.current;

              // Only update if this message is newer than the current latest
              if (!currentLatest || createdAtNum > currentLatest.createdAt) {
                latestVisibleMessageRef.current = {
                  messageId: messageId as Id<"messages">,
                  createdAt: createdAtNum,
                };

                // Notify parent about the visible message
                onMessageVisible?.(
                  messageId as Id<"messages">,
                  createdAtNum
                );
              }
            }
          }
        }
      },
      {
        root: scrollAreaRef.current,
        rootMargin: "0px",
        threshold: 0.5, // Message is considered visible when 50% is in view
      }
    );

    // Observe all message elements
    const messageElements = scrollAreaRef.current.querySelectorAll(
      "[data-slot='message-item']"
    );
    messageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [messages, onMessageVisible]);

  // ========================================================================
  // Auto-scroll to bottom on new messages + aria-live announcement
  // ========================================================================

  useEffect(() => {
    const previousLength = previousMessagesLengthRef.current;
    const hasNewMessages = messages.length > previousLength;
    previousMessagesLengthRef.current = messages.length;

    // Only process if new messages arrived (not during initial load or loadMore)
    if (hasNewMessages && !isLoadingMore) {
      const newCount = messages.length - previousLength;

      // Announce new messages for screen readers
      setAnnouncement(
        `${newCount} new message${newCount > 1 ? "s" : ""} received`
      );
      // Clear announcement after it has been read
      const timer = setTimeout(() => setAnnouncement(""), 1000);

      // Auto-scroll if user was at bottom
      if (isAtBottom && bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth" });
      }

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [messages.length, isAtBottom, isLoadingMore]);

  // ========================================================================
  // Track scroll position to determine if at bottom
  // ========================================================================

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const threshold = 100; // Consider "at bottom" if within 100px

    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < threshold;

    setIsAtBottom(isNearBottom);
  }, []);

  // ========================================================================
  // Scroll to bottom button
  // ========================================================================

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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
        <MessageCircle className="mb-4 size-12 text-muted-foreground/50" />
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
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
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

// ============================================================================
// Skeleton
// ============================================================================

function MessageListSkeleton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      data-slot="message-list-skeleton"
      className={cn("flex flex-1 flex-col overflow-hidden", className)}
    >
      <div className="flex-1 space-y-1 p-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <MessageItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export { MessageListSkeleton };
