import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { Id } from "../_generated/dataModel";

// ============================================================================
// Conversation List Queries
// ============================================================================

/**
 * List all conversations for the current user.
 * T161: Implement messages.listConversations query
 */
export const listConversations = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("conversations"),
      type: v.union(v.literal("direct"), v.literal("group"), v.literal("broadcast")),
      updatedAt: v.number(),
      participants: v.array(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
          status: v.union(
            v.literal("online"),
            v.literal("offline"),
            v.literal("away"),
            v.literal("dnd")
          ),
        })
      ),
      lastMessage: v.optional(
        v.object({
          content: v.string(),
          senderId: v.id("users"),
          senderName: v.string(),
          createdAt: v.number(),
        })
      ),
      unreadCount: v.number(),
      isFavorite: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all conversation participations for the user
    const participations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const result = await Promise.all(
      participations.map(async (participation) => {
        const conversation = await ctx.db.get(participation.conversationId);
        if (!conversation) {
          return null;
        }

        // Get all participants
        const allParticipants = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .collect();

        // Get participant user details (excluding current user for direct messages)
        const participants = await Promise.all(
          allParticipants
            .filter(
              (p) =>
                conversation.type === "broadcast" || p.userId !== user._id
            )
            .map(async (p) => {
              const participantUser = await ctx.db.get(p.userId);
              if (!participantUser) return null;
              return {
                _id: participantUser._id,
                name: participantUser.name,
                avatarUrl: participantUser.avatarUrl,
                status: participantUser.status,
              };
            })
        );

        // Get last message
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation_time", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .take(1);

        let lastMessage:
          | {
              content: string;
              senderId: Id<"users">;
              senderName: string;
              createdAt: number;
            }
          | undefined;

        const msg = messages[0];
        if (msg) {
          const sender = await ctx.db.get(msg.senderId);
          lastMessage = {
            content:
              msg.content.length > 100
                ? msg.content.substring(0, 100) + "..."
                : msg.content,
            senderId: msg.senderId,
            senderName: sender?.name ?? "Unknown",
            createdAt: msg.createdAt,
          };
        }

        // Count unread messages
        const lastReadAt = participation.lastReadAt ?? 0;
        const allMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation_time", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .collect();

        // Exclude deleted messages and thread replies from unread count
        const unreadCount = allMessages.filter(
          (m) => m.createdAt > lastReadAt && !m.deletedAt && m.senderId !== user._id && !m.parentId
        ).length;

        return {
          _id: conversation._id,
          type: conversation.type,
          updatedAt: conversation.updatedAt,
          participants: participants.filter(
            (p): p is NonNullable<typeof p> => p !== null
          ),
          lastMessage,
          unreadCount,
          isFavorite: participation.isFavorite,
        };
      })
    );

    // Filter out null values and sort by updatedAt
    return result
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
