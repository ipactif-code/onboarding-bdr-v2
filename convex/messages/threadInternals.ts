import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

// ============================================================================
// Thread Internal Mutations
// ============================================================================

/**
 * Update thread metadata (reply count and last reply time) on a parent message.
 *
 * This internal mutation recalculates and updates the `threadReplyCount` and
 * `threadLastReplyAt` fields on a parent message by counting all non-deleted
 * replies and finding the most recent reply timestamp.
 *
 * ## Security Model
 *
 * This is an `internalMutation` (NOT callable from client) because:
 *
 * 1. **Integrity**: Thread metadata should only be updated by the system,
 *    not directly by users who could manipulate counts
 *
 * 2. **Authorization**: Only called by authorized mutations (sendToChannel,
 *    deleteChannelMessage) after they've verified user permissions
 *
 * 3. **Consistency**: Ensures threadReplyCount always reflects actual
 *    non-deleted replies in the database
 *
 * ## Usage
 *
 * Called via scheduler after:
 * - `sendToChannel` mutation (when parentId is set - new reply)
 * - `deleteChannelMessage` mutation (when message has parentId - deleted reply)
 *
 * T082.1: Called after replies are added or deleted to keep thread metadata in sync.
 *
 * @param parentId - The ID of the parent message whose metadata should be updated
 * @internal - Not exposed to client, only callable server-side
 */
export const updateThreadMetadata = internalMutation({
  args: {
    parentId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Get parent message (validate exists)
    const parent = await ctx.db.get(args.parentId);
    if (!parent) {
      // Parent deleted, nothing to update - no-op
      return null;
    }

    // 2. Count non-deleted replies using index
    // Uses by_parent index for performance per convex skill guidelines
    const replies = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // 3. Calculate thread metadata
    const threadReplyCount = replies.length;

    // Find latest reply timestamp (undefined if no replies)
    let threadLastReplyAt: number | undefined;
    if (replies.length > 0) {
      threadLastReplyAt = Math.max(...replies.map((r) => r.createdAt));
    }

    // 4. Update parent with new counts
    await ctx.db.patch(args.parentId, {
      threadReplyCount,
      threadLastReplyAt,
    });

    return null;
  },
});
