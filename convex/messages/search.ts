import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { Id } from "../_generated/dataModel";

// ============================================================================
// Search Queries
// ============================================================================

/**
 * Search messages across all conversations.
 * T165: Implement messages.search query
 */
export const searchMessages = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      conversationId: v.optional(v.id("conversations")),
      senderId: v.id("users"),
      senderName: v.string(),
      content: v.string(),
      createdAt: v.number(),
      otherParticipant: v.optional(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (!args.searchTerm || args.searchTerm.length < 2) {
      return [];
    }

    const limit = args.limit ?? 20;
    const searchLower = args.searchTerm.toLowerCase();

    // Get user's conversations
    const participations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const conversationIds = new Set(
      participations.map((p) => p.conversationId.toString())
    );

    // Search messages in user's conversations
    const allMessages = await ctx.db.query("messages").collect();

    const matchingMessages = allMessages
      .filter(
        (m) =>
          m.conversationId && conversationIds.has(m.conversationId.toString()) &&
          m.content.toLowerCase().includes(searchLower)
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    // Get details for each message
    const result = await Promise.all(
      matchingMessages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        const conversation = msg.conversationId ? await ctx.db.get(msg.conversationId) : null;

        let otherParticipant:
          | { _id: Id<"users">; name: string; avatarUrl?: string }
          | undefined;

        if (conversation?.type === "direct" && msg.conversationId) {
          const participants = await ctx.db
            .query("conversationParticipants")
            .withIndex("by_conversation", (q) =>
              q.eq("conversationId", msg.conversationId!)
            )
            .collect();

          const other = participants.find((p) => p.userId !== user._id);
          if (other) {
            const otherUser = await ctx.db.get(other.userId);
            if (otherUser) {
              otherParticipant = {
                _id: otherUser._id,
                name: otherUser.name,
                avatarUrl: otherUser.avatarUrl,
              };
            }
          }
        }

        return {
          _id: msg._id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          senderName: sender?.name ?? "Unknown",
          content: msg.content,
          createdAt: msg.createdAt,
          otherParticipant,
        };
      })
    );

    return result;
  },
});
