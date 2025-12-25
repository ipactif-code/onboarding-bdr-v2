import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth } from "../lib/auth";

// ============================================================================
// Channel Read Status Mutations
// ============================================================================

/**
 * Mark channel messages as read up to a specific timestamp.
 */
export const markChannelAsRead = mutation({
  args: {
    channelId: v.id("channels"),
    readAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    if (!membership) {
      throw new Error("You are not a member of this channel");
    }

    if (membership.leftAt || membership.isBanned) {
      throw new Error("You are not an active member of this channel");
    }

    const readAt = args.readAt ?? Date.now();

    await ctx.db.patch(membership._id, {
      lastReadAt: readAt,
    });

    return null;
  },
});
