"use client";

/**
 * MessageMentionStatic - Static mention element for message rendering.
 *
 * Displays @username with different styling based on mention type:
 * - Regular mentions: blue text with hover underline
 * - Current user mentions: amber/yellow background for emphasis
 * - @here/@everyone: bold purple text for visibility
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { filterPlatejsProps } from "@/lib/plate-utils";
import { useMentionContext } from "@/components/messaging/mention-context";

// ============================================================================
// Types
// ============================================================================

/**
 * Mention type based on the value.
 */
type MentionType = "here" | "everyone" | "currentUser" | "user";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines the type of mention based on the value.
 * @param value - The mention value (username or special keyword)
 * @param currentUserName - The current user's name for comparison
 * @returns The mention type: 'here', 'everyone', 'currentUser', or 'user'
 */
function getMentionType(
  value: string,
  currentUserName?: string
): MentionType {
  const normalizedValue = value.toLowerCase().trim();

  if (normalizedValue === "here") {
    return "here";
  }
  if (normalizedValue === "everyone") {
    return "everyone";
  }
  // Compare names case-insensitively for current user highlighting
  if (
    currentUserName &&
    normalizedValue === currentUserName.toLowerCase().trim()
  ) {
    return "currentUser";
  }
  return "user";
}

/**
 * Gets the screen reader announcement text for a mention.
 * @param value - The mention value
 * @param mentionType - The type of mention
 * @returns Accessible text for screen readers
 */
function getMentionAriaLabel(
  value: string,
  mentionType: MentionType
): string {
  switch (mentionType) {
    case "here":
      return "mentioned here, notifying online members";
    case "everyone":
      return "mentioned everyone, notifying all members";
    case "currentUser":
      return `mentioned you, ${value}`;
    default:
      return `mentioned ${value}`;
  }
}

// ============================================================================
// Component
// ============================================================================

export interface MessageMentionStaticProps
  extends React.ComponentPropsWithoutRef<"span"> {
  children?: React.ReactNode;
  element?: { value?: string };
  attributes?: Record<string, unknown>;
}

/**
 * Mention element for message context.
 * Displays @username with different styling based on mention type:
 * - Regular mentions: blue text with hover underline
 * - Current user mentions: amber/yellow background for emphasis
 * - @here/@everyone: bold purple text for visibility
 */
export function MessageMentionStatic(
  props: MessageMentionStaticProps
): React.ReactElement {
  const { children, element, attributes, ...rest } = props;
  const value = element?.value ?? "";
  const { currentUserName } = useMentionContext();

  const mentionType = getMentionType(value, currentUserName);
  const ariaLabel = getMentionAriaLabel(value, mentionType);

  // Filter out Plate.js internal methods before spreading to DOM
  const domSafeProps = filterPlatejsProps(rest);

  return (
    <span
      data-slot="message-mention"
      data-mention-value={value}
      data-mention-type={mentionType}
      role="mark"
      aria-label={ariaLabel}
      className={cn(
        // Base styles for all mentions
        "inline rounded px-1 py-0.5 font-medium",
        // Type-specific styles
        mentionType === "here" && [
          // @here: purple bold styling
          "bg-purple-100 font-semibold text-purple-700",
          "dark:bg-purple-900/30 dark:text-purple-300",
        ],
        mentionType === "everyone" && [
          // @everyone: purple bold styling (same as @here)
          "bg-purple-100 font-semibold text-purple-700",
          "dark:bg-purple-900/30 dark:text-purple-300",
        ],
        mentionType === "currentUser" && [
          // Current user mention: amber background for emphasis
          "bg-amber-100 text-amber-900 hover:underline",
          "dark:bg-amber-900/40 dark:text-amber-200",
        ],
        mentionType === "user" && [
          // Regular user mention: blue text with subtle background
          "bg-primary/10 text-blue-600 hover:underline",
          "dark:text-blue-400",
        ]
      )}
      {...attributes}
      {...domSafeProps}
    >
      {children}@{value}
    </span>
  );
}
