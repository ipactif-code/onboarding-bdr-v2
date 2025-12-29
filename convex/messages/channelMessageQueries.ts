import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { canAccessChannel } from "../lib/permissions";
import {
  channelMessageWithSenderValidator,
  getReactionsForMessages,
  getReactionsForMessage,
} from "./helpers";

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
      .filter((q) => q.eq(q.field("parentId"), undefined)) // Exclude thread replies
      .filter((q) => q.eq(q.field("deletedAt"), undefined)) // Exclude soft-deleted
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

    // T108: Batch fetch reactions for all messages in parallel
    const messageIds = resultMessages.map((m) => m._id);
    const reactionsMap = await getReactionsForMessages(ctx, messageIds);

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
          // T108: Include grouped reactions
          reactions: reactionsMap.get(message._id.toString()) ?? [],
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

    // T108: Fetch sender, lesson, and reactions in parallel for performance
    const [sender, lessonDoc, reactions] = await Promise.all([
      ctx.db.get(message.senderId),
      message.lessonId ? ctx.db.get(message.lessonId) : Promise.resolve(null),
      getReactionsForMessage(ctx, message._id),
    ]);

    // T001-T002: Build lesson data if lessonId exists
    const lesson = lessonDoc
      ? { _id: lessonDoc._id, title: lessonDoc.title }
      : undefined;

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
      // T108: Include grouped reactions
      reactions,
      status: message.status,
    };
  },
});

// ============================================================================
// Message Context Query
// ============================================================================

/**
 * Validator for context message (simplified for context view).
 */
const contextMessageValidator = v.object({
  _id: v.id("messages"),
  senderId: v.id("users"),
  senderName: v.string(),
  senderAvatarUrl: v.optional(v.string()),
  content: v.string(),
  contentType: v.optional(
    v.union(
      v.literal("text"),
      v.literal("voice"),
      v.literal("file"),
      v.literal("system")
    )
  ),
  createdAt: v.number(),
  isEdited: v.optional(v.boolean()),
});

/**
 * Validator for message context response.
 */
const messageContextResponseValidator = v.object({
  before: v.array(contextMessageValidator),
  target: contextMessageValidator,
  after: v.array(contextMessageValidator),
  channelId: v.optional(v.id("channels")),
  channelName: v.optional(v.string()),
  conversationId: v.optional(v.id("conversations")),
});

/**
 * Get surrounding messages for context when jumping to a search result.
 * T129.1-T129.2: Returns messages before and after a target message.
 *
 * This query is used when a user clicks on a search result to see
 * the message in its original context with surrounding messages.
 *
 * Access Control:
 * - User must have access to the channel or conversation containing the message
 * - Returns null if access is denied
 */
export const getMessageContext = query({
  args: {
    messageId: v.id("messages"),
    contextSize: v.optional(v.number()), // Number of messages before/after, default 10
  },
  returns: v.union(messageContextResponseValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const contextSize = Math.min(args.contextSize ?? 10, 25);

    // Get the target message
    const targetMessage = await ctx.db.get(args.messageId);
    if (!targetMessage) {
      return null;
    }

    // Check if message is deleted
    if (targetMessage.deletedAt !== undefined) {
      return null;
    }

    // ========================================================================
    // Validate user has access to the channel or conversation
    // ========================================================================

    let channelName: string | undefined;

    if (targetMessage.channelId) {
      // Channel message - check access
      const hasAccess = await canAccessChannel(
        ctx,
        targetMessage.channelId,
        user._id
      );
      if (!hasAccess) {
        return null;
      }

      // Get channel name for context
      const channel = await ctx.db.get(targetMessage.channelId);
      channelName = channel?.name;
    } else if (targetMessage.conversationId) {
      // Conversation message - check participation
      const participant = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q
            .eq("userId", user._id)
            .eq("conversationId", targetMessage.conversationId!)
        )
        .unique();

      if (!participant || participant.leftAt !== undefined) {
        return null;
      }
    } else {
      // Message has no container - should not happen
      return null;
    }

    // ========================================================================
    // Get messages before the target (older messages)
    // ========================================================================

    let beforeMessages;
    if (targetMessage.channelId) {
      beforeMessages = await ctx.db
        .query("messages")
        .withIndex("by_channel_time", (q) =>
          q
            .eq("channelId", targetMessage.channelId!)
            .lt("createdAt", targetMessage.createdAt)
        )
        .order("desc")
        .take(contextSize);
    } else {
      beforeMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation_time", (q) =>
          q
            .eq("conversationId", targetMessage.conversationId!)
            .lt("createdAt", targetMessage.createdAt)
        )
        .order("desc")
        .take(contextSize);
    }

    // Filter out deleted messages and reverse to get chronological order
    const filteredBefore = beforeMessages
      .filter((m) => m.deletedAt === undefined)
      .reverse();

    // ========================================================================
    // Get messages after the target (newer messages)
    // ========================================================================

    let afterMessages;
    if (targetMessage.channelId) {
      afterMessages = await ctx.db
        .query("messages")
        .withIndex("by_channel_time", (q) =>
          q
            .eq("channelId", targetMessage.channelId!)
            .gt("createdAt", targetMessage.createdAt)
        )
        .order("asc")
        .take(contextSize);
    } else {
      afterMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation_time", (q) =>
          q
            .eq("conversationId", targetMessage.conversationId!)
            .gt("createdAt", targetMessage.createdAt)
        )
        .order("asc")
        .take(contextSize);
    }

    // Filter out deleted messages
    const filteredAfter = afterMessages.filter(
      (m) => m.deletedAt === undefined
    );

    // ========================================================================
    // Batch fetch sender information for all messages
    // ========================================================================

    const allMessages = [
      ...filteredBefore,
      targetMessage,
      ...filteredAfter,
    ];

    const senderIds = [...new Set(allMessages.map((m) => m.senderId))];
    const senders = await Promise.all(senderIds.map((id) => ctx.db.get(id)));
    const senderMap = new Map(
      senders
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id.toString(), s])
    );

    // Helper to build context message
    const buildContextMessage = (
      message: typeof targetMessage
    ): {
      _id: typeof message._id;
      senderId: typeof message.senderId;
      senderName: string;
      senderAvatarUrl: string | undefined;
      content: string;
      contentType: typeof message.contentType;
      createdAt: number;
      isEdited: boolean | undefined;
    } => {
      const sender = senderMap.get(message.senderId.toString());
      return {
        _id: message._id,
        senderId: message.senderId,
        senderName: sender?.name ?? "Unknown User",
        senderAvatarUrl: sender?.avatarUrl,
        content: message.content,
        contentType: message.contentType,
        createdAt: message.createdAt,
        isEdited: message.isEdited,
      };
    };

    return {
      before: filteredBefore.map(buildContextMessage),
      target: buildContextMessage(targetMessage),
      after: filteredAfter.map(buildContextMessage),
      channelId: targetMessage.channelId,
      channelName,
      conversationId: targetMessage.conversationId,
    };
  },
});
