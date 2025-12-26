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
 * Uses the `getThread` query which returns both parent and replies.
 *
 * @param options.parentMessageId - The ID of the parent message (undefined skips the query)
 * @returns Thread data including parent message and replies array
 *
 * @example
 * ```tsx
 * const { parent, replies, isLoading } = useThread({ parentMessageId });
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
  const { parentMessageId } = options;

  // Subscribe to thread data - this will automatically update in real-time
  const result = useQuery(
    api.messages.getThread,
    parentMessageId ? { parentMessageId } : "skip"
  );

  return {
    parent: result?.parent ?? null,
    replies: result?.replies ?? [],
    isLoading: result === undefined && parentMessageId !== undefined,
  };
}
