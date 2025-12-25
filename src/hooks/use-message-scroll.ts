"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

interface UseMessageScrollOptions {
  /**
   * Number of messages in the list.
   * Used to detect new messages and trigger auto-scroll.
   */
  messagesLength: number;
  /**
   * Whether older messages are currently being loaded.
   * Auto-scroll is suppressed during load-more operations.
   */
  isLoadingMore?: boolean;
}

interface UseMessageScrollReturn {
  /**
   * Ref to attach to the scrollable container.
   */
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Ref to attach to an element at the bottom of the message list.
   */
  bottomRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Whether the user is currently at the bottom of the scroll area.
   */
  isAtBottom: boolean;
  /**
   * Handler to attach to the container's onScroll event.
   */
  handleScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  /**
   * Smoothly scrolls to the bottom of the message list.
   */
  scrollToBottom: () => void;
  /**
   * Accessibility announcement for new messages.
   * Should be rendered in an aria-live region.
   */
  announcement: string;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing message list scroll behavior.
 *
 * Features:
 * - Tracks if user is at bottom of scroll area
 * - Auto-scrolls to bottom when new messages arrive (if user was at bottom)
 * - Provides aria-live announcement for new messages
 * - Exposes scrollToBottom function for manual scrolling
 *
 * @example
 * ```tsx
 * const {
 *   scrollAreaRef,
 *   bottomRef,
 *   isAtBottom,
 *   handleScroll,
 *   scrollToBottom,
 *   announcement,
 * } = useMessageScroll({
 *   messagesLength: messages.length,
 *   isLoadingMore,
 * });
 * ```
 */
export function useMessageScroll({
  messagesLength,
  isLoadingMore = false,
}: UseMessageScrollOptions): UseMessageScrollReturn {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const previousMessagesLengthRef = useRef(messagesLength);

  // Aria-live announcement for new messages (accessibility)
  const [announcement, setAnnouncement] = useState<string>("");

  // ========================================================================
  // Auto-scroll to bottom on new messages + aria-live announcement
  // ========================================================================

  useEffect(() => {
    const previousLength = previousMessagesLengthRef.current;
    const hasNewMessages = messagesLength > previousLength;
    previousMessagesLengthRef.current = messagesLength;

    // Only process if new messages arrived (not during initial load or loadMore)
    if (hasNewMessages && !isLoadingMore) {
      const newCount = messagesLength - previousLength;

      // Announce new messages for screen readers
      setAnnouncement(
        `${newCount} new message${newCount > 1 ? "s" : ""} received`
      );
      // Clear announcement after it has been read
      const timer = setTimeout(() => setAnnouncement(""), 1000);

      // Auto-scroll if user was at bottom
      if (isAtBottom && bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [messagesLength, isAtBottom, isLoadingMore]);

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
  // Scroll to bottom function
  // ========================================================================

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  return {
    scrollAreaRef,
    bottomRef,
    isAtBottom,
    handleScroll,
    scrollToBottom,
    announcement,
  };
}
