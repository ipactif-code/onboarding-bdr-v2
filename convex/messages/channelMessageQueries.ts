import { v, Infer } from "convex/values";
import { query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
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

/**
 * Get a thread with its parent message and all replies.
 * Returns the parent message and all thread replies sorted by createdAt ASC.
 * T080.1: Thread view support for channel messages.
 */
export const getThread = query({
  args: {
    parentMessageId: v.id("messages"),
  },
  returns: v.union(
    v.object({
      parent: channelMessageWithSenderValidator,
      replies: v.array(channelMessageWithSenderValidator),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get parent message
    const parentMessage = await ctx.db.get(args.parentMessageId);
    if (!parentMessage) {
      return null;
    }

    // Parent must be a channel message (not a conversation message)
    if (!parentMessage.channelId) {
      throw new Error("Invalid thread: Parent message must be a channel message");
    }

    // Parent should not itself be a reply (must be a top-level message)
    if (parentMessage.parentId) {
      throw new Error("Invalid thread: Cannot get thread from a reply message");
    }

    // Check user has access to the channel
    const hasAccess = await canAccessChannel(
      ctx,
      parentMessage.channelId,
      user._id
    );
    if (!hasAccess) {
      throw new Error("Forbidden: You do not have access to this channel");
    }

    // Get all thread replies using by_parent_time index (sorted ASC by createdAt)
    const replies = await ctx.db
      .query("messages")
      .withIndex("by_parent_time", (q) => q.eq("parentId", args.parentMessageId))
      .order("asc")
      .filter((q) => q.eq(q.field("deletedAt"), undefined)) // Exclude soft-deleted
      .collect();

    // Collect all unique sender IDs for batch fetching (parent + replies)
    const senderIds = new Set<string>();
    senderIds.add(parentMessage.senderId);
    for (const reply of replies) {
      senderIds.add(reply.senderId);
    }

    // Batch fetch all senders
    const senderPromises = [...senderIds].map((id) =>
      ctx.db.get(id as typeof parentMessage.senderId)
    );
    const senders = await Promise.all(senderPromises);
    const senderMap = new Map(
      senders
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s])
    );

    // Collect all unique lesson IDs for batch fetching
    const lessonIds = new Set<string>();
    if (parentMessage.lessonId) {
      lessonIds.add(parentMessage.lessonId);
    }
    for (const reply of replies) {
      if (reply.lessonId) {
        lessonIds.add(reply.lessonId);
      }
    }

    // Batch fetch all lessons
    const lessonPromises = [...lessonIds].map((id) =>
      ctx.db.get(id as Id<"lessons">)
    );
    const lessons = await Promise.all(lessonPromises);
    const lessonMap = new Map(
      lessons
        .filter((l): l is NonNullable<typeof l> => l !== null)
        .map((l) => [l._id, { _id: l._id, title: l.title }])
    );

    // Helper function to hydrate a message with sender and lesson info
    const hydrateMessage = (
      message: typeof parentMessage
    ): Infer<typeof channelMessageWithSenderValidator> => {
      const sender = senderMap.get(message.senderId);
      const lesson = message.lessonId ? lessonMap.get(message.lessonId) : undefined;

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
    };

    return {
      parent: hydrateMessage(parentMessage),
      replies: replies.map(hydrateMessage),
    };
  },
});

// ============================================================================
// Thread Sidebar Queries
// ============================================================================

/**
 * Validator for thread with activity info for the Threads sidebar.
 */
const threadWithActivityValidator = v.object({
  _id: v.id("messages"),
  channelId: v.id("channels"),
  channel: v.union(
    v.object({
      _id: v.id("channels"),
      name: v.string(),
    }),
    v.null()
  ),
  senderId: v.id("users"),
  sender: v.object({
    _id: v.id("users"),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  }),
  content: v.string(),
  contentType: v.optional(
    v.union(
      v.literal("text"),
      v.literal("voice"),
      v.literal("file"),
      v.literal("system")
    )
  ),
  threadReplyCount: v.number(),
  threadLastReplyAt: v.number(),
  createdAt: v.number(),
});

/**
 * List all messages with thread activity for display in the "Threads" sidebar.
 * Returns top-level channel messages that have thread replies, sorted by most
 * recent activity. Only returns threads from channels the user has access to.
 */
export const listThreadsWithActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    messages: v.array(threadWithActivityValidator),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Determine limit with constraints (default 20, max 50)
    const requestedLimit = args.limit ?? 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);

    // Get all channels the user has access to
    // First, get channels where user is an active member
    const userMemberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", user._id).eq("leftAt", undefined)
      )
      .filter((q) => q.eq(q.field("isBanned"), false))
      .collect();

    const memberChannelIds = new Set(
      userMemberships.map((m) => m.channelId.toString())
    );

    // Get all public channels (user can access these too)
    const publicChannels = await ctx.db
      .query("channels")
      .withIndex("by_type", (q) => q.eq("type", "public"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const publicChannelIds = new Set(
      publicChannels.map((c) => c._id.toString())
    );

    // If user is admin, they can access all channels
    const isGlobalAdmin = user.role === "admin";

    // Also check channelAdmins table for additional access
    const adminAccess = await ctx.db
      .query("channelAdmins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const adminAccessChannelIds = new Set(
      adminAccess.map((a) => a.channelId.toString())
    );

    // Combined accessible channel IDs
    const accessibleChannelIds = new Set([
      ...memberChannelIds,
      ...publicChannelIds,
      ...adminAccessChannelIds,
    ]);

    // Query messages with thread activity
    // Since there's no index on threadReplyCount or threadLastReplyAt,
    // we need to scan and filter. We'll query by sender (user can see their own threads)
    // and also query accessible channels.
    // For efficiency, we'll scan messages and filter in memory.

    // Query all messages - we need to filter for:
    // 1. threadReplyCount > 0
    // 2. parentId === undefined (top-level only)
    // 3. deletedAt === undefined (not deleted)
    // 4. channelId is set (channel messages only)
    // 5. User has access to the channel

    // Since we can't efficiently query by threadReplyCount, we'll collect
    // and filter. This is not ideal but necessary without a dedicated index.
    // We'll iterate through accessible channels and collect threads.

    const allThreads: Array<{
      message: Doc<"messages">;
      threadLastReplyAt: number;
    }> = [];

    // For each accessible channel, get messages with thread activity
    // To avoid N+1 queries, we batch this by scanning messages
    // For a global admin, we scan all channel messages
    // For regular users, we only scan their accessible channels

    if (isGlobalAdmin) {
      // Admin can see all channels - scan all messages with threads
      // We'll collect a reasonable batch and filter
      const messagesWithThreads = await ctx.db
        .query("messages")
        .filter((q) =>
          q.and(
            q.neq(q.field("channelId"), undefined),
            q.eq(q.field("parentId"), undefined),
            q.eq(q.field("deletedAt"), undefined),
            q.gt(q.field("threadReplyCount"), 0)
          )
        )
        .collect();

      for (const message of messagesWithThreads) {
        if (message.threadLastReplyAt !== undefined) {
          allThreads.push({
            message,
            threadLastReplyAt: message.threadLastReplyAt,
          });
        }
      }
    } else {
      // Regular user - query messages from accessible channels
      // Since we can't use withIndex for threadReplyCount, we need to filter

      // Batch collect messages from accessible channels
      // We'll query by channel and filter for thread activity
      const channelIdList = [...accessibleChannelIds];

      for (const channelIdStr of channelIdList) {
        // Reconstruct channel ID
        const channelId = channelIdStr as Id<"channels">;

        // Check if user might be banned from this public channel
        if (publicChannelIds.has(channelIdStr) && !memberChannelIds.has(channelIdStr)) {
          // Check for ban
          const membership = await ctx.db
            .query("channelMembers")
            .withIndex("by_channel_user", (q) =>
              q.eq("channelId", channelId).eq("userId", user._id)
            )
            .unique();

          if (membership?.isBanned) {
            continue; // Skip banned channels
          }
        }

        // Get messages with thread activity from this channel
        const channelMessages = await ctx.db
          .query("messages")
          .withIndex("by_channel", (q) => q.eq("channelId", channelId))
          .filter((q) =>
            q.and(
              q.eq(q.field("parentId"), undefined),
              q.eq(q.field("deletedAt"), undefined),
              q.gt(q.field("threadReplyCount"), 0)
            )
          )
          .collect();

        for (const message of channelMessages) {
          if (message.threadLastReplyAt !== undefined) {
            allThreads.push({
              message,
              threadLastReplyAt: message.threadLastReplyAt,
            });
          }
        }
      }
    }

    // Sort by threadLastReplyAt descending (most recent activity first)
    allThreads.sort((a, b) => b.threadLastReplyAt - a.threadLastReplyAt);

    // Take only the requested limit
    const limitedThreads = allThreads.slice(0, limit);

    // Batch fetch senders and channels
    const senderIds = [...new Set(limitedThreads.map((t) => t.message.senderId))];
    const channelIds = [
      ...new Set(
        limitedThreads
          .map((t) => t.message.channelId)
          .filter((id): id is Id<"channels"> => id !== undefined)
      ),
    ];

    const [senders, channels] = await Promise.all([
      Promise.all(senderIds.map((id) => ctx.db.get(id))),
      Promise.all(channelIds.map((id) => ctx.db.get(id))),
    ]);

    const senderMap = new Map<string, Doc<"users">>(
      senders
        .filter((s): s is Doc<"users"> => s !== null)
        .map((s) => [s._id.toString(), s])
    );

    const channelMap = new Map<string, Doc<"channels">>(
      channels
        .filter((c): c is Doc<"channels"> => c !== null)
        .map((c) => [c._id.toString(), c])
    );

    // Build response
    const messages = limitedThreads.map((thread) => {
      const { message } = thread;
      const sender = message.senderId
        ? senderMap.get(message.senderId.toString())
        : undefined;
      const channel = message.channelId
        ? channelMap.get(message.channelId.toString())
        : undefined;

      return {
        _id: message._id,
        channelId: message.channelId as Id<"channels">,
        channel: channel
          ? {
              _id: channel._id,
              name: channel.name,
            }
          : null,
        senderId: message.senderId,
        sender: sender
          ? {
              _id: sender._id,
              name: sender.name,
              avatarUrl: sender.avatarUrl,
            }
          : {
              _id: message.senderId,
              name: "Unknown User",
              avatarUrl: undefined,
            },
        content: message.content,
        contentType: message.contentType,
        threadReplyCount: message.threadReplyCount ?? 0,
        threadLastReplyAt: message.threadLastReplyAt ?? message.createdAt,
        createdAt: message.createdAt,
      };
    });

    return { messages };
  },
});
