"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { cn } from "@/lib/utils";

/**
 * Props for the TypingIndicator component.
 */
export interface TypingIndicatorProps {
  /**
   * The ID of the conversation to show typing indicators for.
   * This should be a valid Convex ID for the conversations table.
   */
  conversationId: string;

  /**
   * Optional additional CSS classes for the container.
   */
  className?: string;
}

/**
 * Formats the typing indicator message based on the number of users typing.
 *
 * @param names - Array of user names who are currently typing
 * @returns Formatted string describing who is typing
 *
 * @example
 * formatTypingMessage(["Alice"]) // "Alice is typing"
 * formatTypingMessage(["Alice", "Bob"]) // "Alice and Bob are typing"
 * formatTypingMessage(["Alice", "Bob", "Charlie"]) // "3 people are typing"
 */
function formatTypingMessage(names: string[]): string {
  const count = names.length;

  if (count === 0) {
    return "";
  }

  if (count === 1) {
    return `${names[0]} is typing`;
  }

  if (count === 2) {
    return `${names[0]} and ${names[1]} are typing`;
  }

  return `${count} people are typing`;
}

/**
 * Animated typing dots component.
 * Displays three dots with staggered fade animation.
 */
function TypingDots(): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      <span
        className="inline-block size-1.5 rounded-full bg-current animate-typing-dot"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="inline-block size-1.5 rounded-full bg-current animate-typing-dot"
        style={{ animationDelay: "200ms" }}
      />
      <span
        className="inline-block size-1.5 rounded-full bg-current animate-typing-dot"
        style={{ animationDelay: "400ms" }}
      />
    </span>
  );
}

/**
 * TypingIndicator component displays who is currently typing in a conversation.
 *
 * Features:
 * - Real-time subscription to typing indicators via Convex
 * - Displays user name(s) with animated dots
 * - Handles multiple users: "Alice is typing", "Alice and Bob are typing", "3 people are typing"
 * - Smooth fade in/out animation
 * - Accessible with aria-live for screen readers
 * - Returns null if no one is typing
 *
 * @example
 * ```tsx
 * <TypingIndicator conversationId="abc123" />
 * ```
 */
export function TypingIndicator({
  conversationId,
  className,
}: TypingIndicatorProps): React.ReactElement | null {
  // Subscribe to typing indicators for this conversation
  const typingUsers = useQuery(api.typing.getTypingIndicators, {
    conversationId: conversationId as Id<"conversations">,
  });

  // Track previous state for animation purposes
  const [isVisible, setIsVisible] = React.useState(false);
  const [displayedMessage, setDisplayedMessage] = React.useState("");

  // Update visibility and message when typing users change
  React.useEffect(() => {
    if (typingUsers === undefined) {
      // Still loading, don't change anything
      return;
    }

    if (typingUsers.length === 0) {
      // No one is typing - fade out
      setIsVisible(false);
    } else {
      // Someone is typing - update message and fade in
      const names = typingUsers.map((user: { userName: string }) => user.userName);
      setDisplayedMessage(formatTypingMessage(names));
      setIsVisible(true);
    }
  }, [typingUsers]);

  // Don't render anything if not visible and animation complete
  if (!isVisible && displayedMessage === "") {
    return null;
  }

  // Handle animation end to clean up displayed message
  const handleAnimationEnd = (): void => {
    if (!isVisible) {
      setDisplayedMessage("");
    }
  };

  return (
    <div
      data-slot="typing-indicator"
      className={cn(
        "flex items-center gap-2 px-4 py-1.5 text-sm text-muted-foreground",
        "transition-all duration-200 ease-in-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
        className
      )}
      onTransitionEnd={handleAnimationEnd}
      // Accessibility: announce typing status to screen readers
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {displayedMessage && (
        <>
          <TypingDots />
          <span>{displayedMessage}</span>
        </>
      )}
    </div>
  );
}

/**
 * Skeleton loading state for TypingIndicator.
 * Generally not needed since the component handles its own loading state,
 * but provided for consistency with other messaging components.
 */
export function TypingIndicatorSkeleton(): React.ReactElement {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <div className="flex gap-0.5">
        <div className="size-1.5 rounded-full bg-muted animate-pulse" />
        <div className="size-1.5 rounded-full bg-muted animate-pulse" />
        <div className="size-1.5 rounded-full bg-muted animate-pulse" />
      </div>
      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
    </div>
  );
}
