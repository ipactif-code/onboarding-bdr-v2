import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireAuth } from "../lib/auth";
import { canAccessChannel } from "../lib/permissions";
import { channelMessageWithSenderValidator } from "./helpers";

// ============================================================================
// Channel Message Queries
// ============================================================================

/**
 * List messages in a channel with pagination.
 * Returns messages in reverse chronological order (newest first).
 * T001-T002: Enriches messages with lesson data when lessonId exists.
 */
export const listByChannel = query({
  args: {
    channelId: v.id("channels"),
    limit: v.optional(v.number()),
    before: v.optional(v.number()), // Cursor: get messages before this timestamp
  },
  returns: v.object({
    messages: v.array(channelMessageWithSenderValidator),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check access
    const hasAccess = await canAccessChannel(ctx, args.channelId, user._id);
    if (!hasAccess) {
      throw new Error("Forbidden: You do not have access to this channel");
    }

    const limit = Math.min(args.limit ?? 50, 100);

    // Build query
    const messagesQuery = ctx.db
      .query("messages")
      .withIndex("by_channel_time", (q) => {
        const base = q.eq("channelId", args.channelId);
        if (args.before) {
          return base.lt("createdAt", args.before);
        }
        return base;
      })
      .order("desc");

    // Get one extra to check if there are more
    const messages = await messagesQuery.take(limit + 1);
    const hasMore = messages.length > limit;
    const resultMessages = messages.slice(0, limit);

    // T001-T002: Batch fetch lessons for messages with lessonId (no N+1 queries)
    const lessonIds = [
      ...new Set(
        resultMessages
          .filter((m) => m.lessonId !== undefined)
          .map((m) => m.lessonId!)
      ),
    ];
    const lessons = await Promise.all(lessonIds.map((id) => ctx.db.get(id)));
    const lessonMap = new Map(
      lessons
        .filter((l): l is NonNullable<typeof l> => l !== null)
        .map((l) => [l._id, { _id: l._id, title: l.title }])
    );

    // Get sender info for each message
    const result = await Promise.all(
      resultMessages.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);

        return {
          _id: message._id,
          channelId: message.channelId,
          conversationId: message.conversationId,
          senderId: message.senderId,
          sender: sender
            ? {
                _id: sender._id,
                name: sender.name,
                avatarUrl: sender.avatarUrl,
                status: sender.status,
              }
            : {
                _id: message.senderId,
                name: "Unknown User",
                avatarUrl: undefined,
                status: "offline" as const,
              },
          content: message.content,
          contentType: message.contentType,
          parentId: message.parentId,
          threadReplyCount: message.threadReplyCount,
          threadLastReplyAt: message.threadLastReplyAt,
          lessonId: message.lessonId,
          // T001-T002: Include lesson data if lessonId exists
          lesson: message.lessonId
            ? lessonMap.get(message.lessonId)
            : undefined,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          isEdited: message.isEdited,
          deletedAt: message.deletedAt,
          reactionCount: message.reactionCount,
          status: message.status,
        };
      })
    );

    return {
      messages: result,
      hasMore,
    };
  },
});

/**
 * Get a single message by ID.
 * T001-T002: Enriches message with lesson data when lessonId exists.
 */
export const getChannelMessage = query({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.union(channelMessageWithSenderValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }

    // Check access based on channel or conversation
    if (message.channelId) {
      const hasAccess = await canAccessChannel(ctx, message.channelId, user._id);
      if (!hasAccess) {
        return null;
      }
    } else if (message.conversationId) {
      // Check conversation participant
      const participant = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", user._id).eq("conversationId", message.conversationId!)
        )
        .unique();

      if (!participant || participant.leftAt) {
        return null;
      }
    } else {
      // Message has no container - should not happen
      return null;
    }

    const sender = await ctx.db.get(message.senderId);

    // T001-T002: Fetch lesson data if lessonId exists
    let lesson: { _id: Id<"lessons">; title: string } | undefined;
    if (message.lessonId) {
      const lessonDoc = await ctx.db.get(message.lessonId);
      if (lessonDoc) {
        lesson = { _id: lessonDoc._id, title: lessonDoc.title };
      }
    }

    return {
      _id: message._id,
      channelId: message.channelId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sender: sender
        ? {
            _id: sender._id,
            name: sender.name,
            avatarUrl: sender.avatarUrl,
            status: sender.status,
          }
        : {
            _id: message.senderId,
            name: "Unknown User",
            avatarUrl: undefined,
            status: "offline" as const,
          },
      content: message.content,
      contentType: message.contentType,
      parentId: message.parentId,
      threadReplyCount: message.threadReplyCount,
      threadLastReplyAt: message.threadLastReplyAt,
      lessonId: message.lessonId,
      lesson,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      isEdited: message.isEdited,
      deletedAt: message.deletedAt,
      reactionCount: message.reactionCount,
      status: message.status,
    };
  },
});
