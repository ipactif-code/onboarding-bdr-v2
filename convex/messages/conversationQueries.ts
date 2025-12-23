import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { Id } from "../_generated/dataModel";

// ============================================================================
// Conversation Queries
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

        const unreadCount = allMessages.filter(
          (m) => m.createdAt > lastReadAt && m.senderId !== user._id
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
        };
      })
    );

    // Filter out null values and sort by updatedAt
    return result
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

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
