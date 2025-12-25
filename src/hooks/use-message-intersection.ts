"use client";

import { useEffect, useRef } from "react";
import { Id } from "../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

interface UseMessageIntersectionOptions {
  /**
   * Ref to the scrollable container element.
   */
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Array of messages for visibility tracking.
   */
  messages: Array<{ _id: Id<"messages">; createdAt: number }>;
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
}

interface UseMessageIntersectionReturn {
  /**
   * Ref to attach to an element at the top of the message list.
   * Used to trigger loading more messages.
   */
  topRef: React.RefObject<HTMLDivElement | null>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing intersection observers in message lists.
 *
 * Features:
 * - Triggers onLoadMore when user scrolls near the top (infinite scroll)
 * - Tracks message visibility for marking messages as read
 * - Uses IntersectionObserver for efficient visibility detection
 *
 * @example
 * ```tsx
 * const { topRef } = useMessageIntersection({
 *   scrollAreaRef,
 *   messages,
 *   hasMore,
 *   isLoadingMore,
 *   onLoadMore: loadMore,
 *   onMessageVisible: markAsRead,
 * });
 * ```
 */
export function useMessageIntersection({
  scrollAreaRef,
  messages,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onMessageVisible,
}: UseMessageIntersectionOptions): UseMessageIntersectionReturn {
  const topRef = useRef<HTMLDivElement>(null);

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
  }, [hasMore, isLoadingMore, onLoadMore, scrollAreaRef]);

  // ========================================================================
  // IntersectionObserver for marking messages as read
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
  }, [messages, onMessageVisible, scrollAreaRef]);

  return {
    topRef,
  };
}
