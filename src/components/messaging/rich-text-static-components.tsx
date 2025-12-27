"use client";

/**
 * Static Plate.js components for message rendering.
 *
 * This file re-exports all static components for rich text message rendering.
 * Components are organized into separate files for maintainability:
 *
 * - mention-context.tsx: Context for current user mention highlighting
 * - mention-static.tsx: @mention rendering with different styles
 * - static-elements.tsx: Paragraph, link, and code elements
 *
 * These components are used with PlateStatic for read-only rendering
 * of rich text content in messages. They provide compact styling
 * optimized for messaging contexts.
 */

// ============================================================================
// Re-exports
// ============================================================================

// Mention Context (for current user highlighting)
export {
  MentionContextProvider,
  useMentionContext,
  type MentionContextValue,
} from "@/components/messaging/mention-context";

// Mention Static Component
export {
  MessageMentionStatic,
  type MessageMentionStaticProps,
} from "@/components/messaging/mention-static";

// Static Elements (paragraph, link, code)
export {
  MessageParagraphStatic,
  MessageLinkStatic,
  MessageCodeStatic,
  type MessageParagraphStaticProps,
  type MessageLinkStaticProps,
  type MessageCodeStaticProps,
} from "@/components/messaging/static-elements";
