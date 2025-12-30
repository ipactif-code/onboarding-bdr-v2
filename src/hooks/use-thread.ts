"use client";

import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import type { ChannelMessage } from "./use-messages";

/**
 * TECH DEBT: Using `any` type as workaround for Convex TS2589 error
 * "Type instantiation is excessively deep and possibly infinite"
 *
 * This is a known issue with Convex's generated types when used with
 * complex validator structures. The workaround is to use require() instead
 * of import to defer type checking and avoid the recursive type instantiation.
 *
 * The `any` type is necessary here because TypeScript cannot resolve the
 * deeply nested Convex API type definitions.
 *
 * @see https://github.com/get-convex/convex-js/issues (Convex deep type instantiation issue)
 * TODO: Remove when Convex improves type generation for deep validator nesting
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

// ============================================================================
// Types
// ============================================================================

interface UseThreadOptions {
  /** The ID of the parent message for the thread. */
  parentMessageId: Id<"messages"> | undefined;
  /** The conversation ID for DM threads (optional, uses channel thread query if not provided). */
  conversationId?: Id<"conversations">;
}

interface UseThreadReturn {
  /** The parent message of the thread. */
  parent: ChannelMessage | null;
  /** Array of reply messages in the thread, sorted by createdAt ASC. */
  replies: ChannelMessage[];
  /** Whether the thread data is currently loading. */
  isLoading: boolean;
}

// ============================================================================
// useThread Hook
// ============================================================================

/**
 * Hook for fetching a thread with its parent message and all replies.
 *
 * Subscribes to real-time updates via Convex subscription.
 * Uses the appropriate query based on whether this is a channel or DM thread:
 * - Channel threads: `api.messages.getThread`
 * - DM threads: `api.messages.conversationThreadQueries.getConversationThread`
 *
 * @param options.parentMessageId - The ID of the parent message (undefined skips the query)
 * @param options.conversationId - The conversation ID for DM threads (optional)
 * @returns Thread data including parent message and replies array
 *
 * @example
 * ```tsx
 * // Channel thread
 * const { parent, replies, isLoading } = useThread({ parentMessageId });
 *
 * // DM thread
 * const { parent, replies, isLoading } = useThread({ parentMessageId, conversationId });
 *
 * if (isLoading) return <ThreadViewSkeleton />;
 * if (!parent) return <NotFound />;
 *
 * return (
 *   <>
 *     <MessageItem message={parent} />
 *     {replies.map((reply) => (
 *       <MessageItem key={reply._id} message={reply} />
 *     ))}
 *   </>
 * );
 * ```
 */
export function useThread(options: UseThreadOptions): UseThreadReturn {
  const { parentMessageId, conversationId } = options;

  // Subscribe to channel thread data
  const channelResult = useQuery(
    api.messages.getThread,
    parentMessageId && !conversationId ? { parentMessageId } : "skip"
  );

  // Subscribe to DM thread data
  const dmResult = useQuery(
    api.messages.conversationThreadQueries.getConversationThread,
    parentMessageId && conversationId ? { parentMessageId } : "skip"
  );

  // Use DM result if conversationId is provided, otherwise channel result
  const result = conversationId ? dmResult : channelResult;

  return {
    parent: result?.parent ?? null,
    replies: result?.replies ?? [],
    isLoading: result === undefined && parentMessageId !== undefined,
  };
}
