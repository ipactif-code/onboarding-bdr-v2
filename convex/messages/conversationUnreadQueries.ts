import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";

// ============================================================================
// Unread Count Queries
// ============================================================================

/**
 * Get total unread message count for the current user.
 * T164: Implement messages.getUnreadCount query
 */
export const getUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all conversation participations
    const participations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let totalUnread = 0;

    for (const participation of participations) {
      const lastReadAt = participation.lastReadAt ?? 0;

      // Count messages after lastReadAt that weren't sent by the user
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation_time", (q) =>
          q.eq("conversationId", participation.conversationId)
        )
        .collect();

      const unread = messages.filter(
        (m) => m.createdAt > lastReadAt && m.senderId !== user._id
      ).length;

      totalUnread += unread;
    }

    return totalUnread;
  },
});
