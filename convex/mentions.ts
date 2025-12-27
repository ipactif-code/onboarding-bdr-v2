import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// Re-export queries for backward compatibility
export { getMentionsForUser, getUnreadMentionCount } from "./mentionQueries";

// ============================================================================
// Mutations
// ============================================================================

/**
 * Mark a mention as read by setting the notifiedAt timestamp.
 * Only the mentioned user can mark their own mentions as read.
 *
 * @param mentionId - The ID of the mention to mark as read
 * @throws Error if user is not authenticated
 * @throws Error if mention does not exist
 * @throws Error if user is not the mentioned user (security check)
 */
export const markMentionAsRead = mutation({
  args: {
    mentionId: v.id("mentions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);

    // Get the mention
    const mention = await ctx.db.get(args.mentionId);
    if (!mention) {
      throw new Error("Mention not found");
    }

    // Security check: only the mentioned user can mark as read
    if (mention.mentionedUserId !== currentUser._id) {
      throw new Error("Forbidden: You can only mark your own mentions as read");
    }

    // Mark as read by setting notifiedAt timestamp
    await ctx.db.patch(args.mentionId, {
      notifiedAt: Date.now(),
    });

    return null;
  },
});
