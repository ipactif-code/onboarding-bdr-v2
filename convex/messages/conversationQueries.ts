import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import {
  messageReactionValidator,
  getReactionsForMessages,
} from "./helpers";

// Re-export other conversation queries for backward compatibility
export { listConversations } from "./conversationListQueries";
export { getUnreadCount } from "./conversationUnreadQueries";

// ============================================================================
// Conversation Message Queries
// ============================================================================

/**
 * Get messages in a conversation.
 * T162: Implement messages.getConversation query
 */
export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  returns: v.object({
    conversation: v.union(
      v.object({
        _id: v.id("conversations"),
        type: v.union(v.literal("direct"), v.literal("group"), v.literal("broadcast")),
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
      }),
      v.null()
    ),
    messages: v.array(
      v.object({
        _id: v.id("messages"),
        senderId: v.id("users"),
        senderName: v.string(),
        senderAvatarUrl: v.optional(v.string()),
        content: v.string(),
        createdAt: v.number(),
        isOwn: v.boolean(),
        // T108: Include grouped reactions for conversation messages
        reactions: v.optional(v.array(messageReactionValidator)),
      })
    ),
    nextCursor: v.optional(v.number()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const limit = args.limit ?? 50;

    // Verify user is a participant
    const participation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (!participation) {
      return {
        conversation: null,
        messages: [],
        hasMore: false,
      };
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return {
        conversation: null,
        messages: [],
        hasMore: false,
      };
    }

    // Get all participants
    const allParticipants = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const participants = await Promise.all(
      allParticipants
        .filter((p) => conversation.type === "broadcast" || p.userId !== user._id)
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

    // Get messages with pagination
    let messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_time", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .collect();

    // Apply cursor (timestamp-based pagination)
    if (args.cursor) {
      messages = messages.filter((m) => m.createdAt < args.cursor!);
    }

    const paginatedMessages = messages.slice(0, limit + 1);
    const hasMore = paginatedMessages.length > limit;
    const resultMessages = paginatedMessages.slice(0, limit);

    // T108: Batch fetch reactions for all messages in parallel
    const messageIds = resultMessages.map((m) => m._id);
    const reactionsMap = await getReactionsForMessages(ctx, messageIds);

    // Get sender details for each message
    const messagesWithSenders = await Promise.all(
      resultMessages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        return {
          _id: msg._id,
          senderId: msg.senderId,
          senderName: sender?.name ?? "Unknown",
          senderAvatarUrl: sender?.avatarUrl,
          content: msg.content,
          createdAt: msg.createdAt,
          isOwn: msg.senderId === user._id,
          // T108: Include grouped reactions
          reactions: reactionsMap.get(msg._id.toString()) ?? [],
        };
      })
    );

    // Reverse to get chronological order
    messagesWithSenders.reverse();

    return {
      conversation: {
        _id: conversation._id,
        type: conversation.type,
        participants: participants.filter(
          (p): p is NonNullable<typeof p> => p !== null
        ),
      },
      messages: messagesWithSenders,
      nextCursor: hasMore
        ? resultMessages[resultMessages.length - 1]?.createdAt
        : undefined,
      hasMore,
    };
  },
});
