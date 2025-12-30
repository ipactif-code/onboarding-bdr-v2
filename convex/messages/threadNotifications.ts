import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { requireAuth } from "../lib/auth";

// ============================================================================
// Thread Read Status and Notification Queries
// ============================================================================

/**
 * Unified thread validator - supports both channel and DM threads
 */
const unifiedThreadValidator = v.object({
  _id: v.id("messages"),
  // Context - one of these will be set
  channelId: v.optional(v.id("channels")),
  conversationId: v.optional(v.id("conversations")),
  // Context details
  context: v.object({
    type: v.union(v.literal("channel"), v.literal("dm")),
    id: v.string(),
    name: v.string(),
  }),
  // Sender
  senderId: v.id("users"),
  sender: v.object({
    _id: v.id("users"),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  }),
  // Content
  content: v.string(),
  contentType: v.optional(
    v.union(
      v.literal("text"),
      v.literal("voice"),
      v.literal("file"),
      v.literal("system")
    )
  ),
  // Thread info
  threadReplyCount: v.number(),
  threadLastReplyAt: v.number(),
  createdAt: v.number(),
  // Read status
  hasUnread: v.boolean(),
});

/**
 * List threads from DM conversations the user participates in.
 * Similar to channel thread list but for DMs.
 */
export const listConversationThreadsWithActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    messages: v.array(unifiedThreadValidator),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const requestedLimit = args.limit ?? 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);

    // Get all conversations the user is an active participant in
    const participations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", user._id).eq("leftAt", undefined)
      )
      .collect();

    const conversationIds = participations.map((p) => p.conversationId);

    // Find all messages with thread activity in these conversations
    const allThreads: Array<{
      message: Doc<"messages">;
      threadLastReplyAt: number;
    }> = [];

    for (const conversationId of conversationIds) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversationId)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("parentId"), undefined),
            q.eq(q.field("deletedAt"), undefined),
            q.gt(q.field("threadReplyCount"), 0)
          )
        )
        .collect();

      for (const message of messages) {
        if (message.threadLastReplyAt !== undefined) {
          allThreads.push({
            message,
            threadLastReplyAt: message.threadLastReplyAt,
          });
        }
      }
    }

    // Sort by threadLastReplyAt descending
    allThreads.sort((a, b) => b.threadLastReplyAt - a.threadLastReplyAt);
    const limitedThreads = allThreads.slice(0, limit);

    // Get read status for threads
    const threadReadStatuses = await ctx.db
      .query("threadReadStatus")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const readStatusMap = new Map<string, number>(
      threadReadStatuses.map((s) => [s.parentMessageId.toString(), s.lastReadAt])
    );

    // Batch fetch senders and conversations
    const senderIds = [
      ...new Set(limitedThreads.map((t) => t.message.senderId)),
    ];
    const convIds = [
      ...new Set(
        limitedThreads
          .map((t) => t.message.conversationId)
          .filter((id): id is Id<"conversations"> => id !== undefined)
      ),
    ];

    const [senders, conversations] = await Promise.all([
      Promise.all(senderIds.map((id) => ctx.db.get(id))),
      Promise.all(convIds.map((id) => ctx.db.get(id))),
    ]);

    const senderMap = new Map<string, Doc<"users">>(
      senders
        .filter((s): s is Doc<"users"> => s !== null)
        .map((s) => [s._id.toString(), s])
    );

    const convMap = new Map<string, Doc<"conversations">>(
      conversations
        .filter((c): c is Doc<"conversations"> => c !== null)
        .map((c) => [c._id.toString(), c])
    );

    // Build response
    const messages = limitedThreads.map((thread) => {
      const { message } = thread;
      const sender = senderMap.get(message.senderId.toString());
      const conversation = message.conversationId
        ? convMap.get(message.conversationId.toString())
        : undefined;

      // Check unread status
      const lastReadAt = readStatusMap.get(message._id.toString());
      const hasUnread =
        lastReadAt === undefined ||
        (message.threadLastReplyAt ?? 0) > lastReadAt;

      return {
        _id: message._id,
        channelId: undefined,
        conversationId: message.conversationId,
        context: {
          type: "dm" as const,
          id: message.conversationId?.toString() ?? "",
          name: conversation?.name ?? "Direct Message",
        },
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
        hasUnread,
      };
    });

    return { messages };
  },
});

/**
 * List ALL threads (channels + DMs) unified, sorted by most recent activity.
 * This is the main query for the Threads tab.
 */
export const listAllThreadsWithActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    messages: v.array(unifiedThreadValidator),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const requestedLimit = args.limit ?? 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);

    const allThreads: Array<{
      message: Doc<"messages">;
      threadLastReplyAt: number;
      type: "channel" | "dm";
    }> = [];

    // =========================================================================
    // PART 1: Channel threads (same logic as existing listThreadsWithActivity)
    // =========================================================================

    // Get all channels the user has access to
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

    // Get public channels
    const publicChannels = await ctx.db
      .query("channels")
      .withIndex("by_type", (q) => q.eq("type", "public"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const publicChannelIds = new Set(
      publicChannels.map((c) => c._id.toString())
    );

    const isGlobalAdmin = user.role === "admin";

    // Admin access via channelAdmins table
    const adminAccess = await ctx.db
      .query("channelAdmins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const adminAccessChannelIds = new Set(
      adminAccess.map((a) => a.channelId.toString())
    );

    const accessibleChannelIds = new Set([
      ...memberChannelIds,
      ...publicChannelIds,
      ...adminAccessChannelIds,
    ]);

    if (isGlobalAdmin) {
      // Admin can see all channels
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
            type: "channel",
          });
        }
      }
    } else {
      // Regular user - query accessible channels
      for (const channelIdStr of accessibleChannelIds) {
        const channelId = channelIdStr as Id<"channels">;

        // Check if user is banned from public channel
        if (
          publicChannelIds.has(channelIdStr) &&
          !memberChannelIds.has(channelIdStr)
        ) {
          const membership = await ctx.db
            .query("channelMembers")
            .withIndex("by_channel_user", (q) =>
              q.eq("channelId", channelId).eq("userId", user._id)
            )
            .unique();

          if (membership?.isBanned) {
            continue;
          }
        }

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
              type: "channel",
            });
          }
        }
      }
    }

    // =========================================================================
    // PART 2: DM threads
    // =========================================================================

    const participations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", user._id).eq("leftAt", undefined)
      )
      .collect();

    const conversationIds = participations.map((p) => p.conversationId);

    for (const conversationId of conversationIds) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversationId)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("parentId"), undefined),
            q.eq(q.field("deletedAt"), undefined),
            q.gt(q.field("threadReplyCount"), 0)
          )
        )
        .collect();

      for (const message of messages) {
        if (message.threadLastReplyAt !== undefined) {
          allThreads.push({
            message,
            threadLastReplyAt: message.threadLastReplyAt,
            type: "dm",
          });
        }
      }
    }

    // =========================================================================
    // PART 3: Sort, limit, and enrich
    // =========================================================================

    allThreads.sort((a, b) => b.threadLastReplyAt - a.threadLastReplyAt);
    const limitedThreads = allThreads.slice(0, limit);

    // Get read statuses
    const threadReadStatuses = await ctx.db
      .query("threadReadStatus")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const readStatusMap = new Map<string, number>(
      threadReadStatuses.map((s) => [s.parentMessageId.toString(), s.lastReadAt])
    );

    // Batch fetch related entities
    const senderIds = [
      ...new Set(limitedThreads.map((t) => t.message.senderId)),
    ];
    const channelIds = [
      ...new Set(
        limitedThreads
          .filter((t) => t.type === "channel")
          .map((t) => t.message.channelId)
          .filter((id): id is Id<"channels"> => id !== undefined)
      ),
    ];
    const convIds = [
      ...new Set(
        limitedThreads
          .filter((t) => t.type === "dm")
          .map((t) => t.message.conversationId)
          .filter((id): id is Id<"conversations"> => id !== undefined)
      ),
    ];

    const [senders, channels, conversations] = await Promise.all([
      Promise.all(senderIds.map((id) => ctx.db.get(id))),
      Promise.all(channelIds.map((id) => ctx.db.get(id))),
      Promise.all(convIds.map((id) => ctx.db.get(id))),
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

    const convMap = new Map<string, Doc<"conversations">>(
      conversations
        .filter((c): c is Doc<"conversations"> => c !== null)
        .map((c) => [c._id.toString(), c])
    );

    // Build response
    const messages = limitedThreads.map((thread) => {
      const { message, type } = thread;
      const sender = senderMap.get(message.senderId.toString());

      // Check unread status
      const lastReadAt = readStatusMap.get(message._id.toString());
      const hasUnread =
        lastReadAt === undefined ||
        (message.threadLastReplyAt ?? 0) > lastReadAt;

      let context: { type: "channel" | "dm"; id: string; name: string };

      if (type === "channel" && message.channelId) {
        const channel = channelMap.get(message.channelId.toString());
        context = {
          type: "channel",
          id: message.channelId.toString(),
          name: channel?.name ?? "Unknown Channel",
        };
      } else if (type === "dm" && message.conversationId) {
        const conversation = convMap.get(message.conversationId.toString());
        context = {
          type: "dm",
          id: message.conversationId.toString(),
          name: conversation?.name ?? "Direct Message",
        };
      } else {
        context = { type: "channel", id: "", name: "Unknown" };
      }

      return {
        _id: message._id,
        channelId: message.channelId,
        conversationId: message.conversationId,
        context,
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
        hasUnread,
      };
    });

    return { messages };
  },
});

/**
 * Get the count of threads with unread replies.
 * Used for the badge on the Threads sidebar item.
 */
export const getUnreadThreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all user's thread read statuses
    const threadReadStatuses = await ctx.db
      .query("threadReadStatus")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const readStatusMap = new Map<string, number>(
      threadReadStatuses.map((s) => [s.parentMessageId.toString(), s.lastReadAt])
    );

    let unreadCount = 0;

    // =========================================================================
    // Count unread channel threads
    // =========================================================================

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

    const publicChannels = await ctx.db
      .query("channels")
      .withIndex("by_type", (q) => q.eq("type", "public"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const publicChannelIds = new Set(
      publicChannels.map((c) => c._id.toString())
    );

    const isGlobalAdmin = user.role === "admin";

    const adminAccess = await ctx.db
      .query("channelAdmins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const adminAccessChannelIds = new Set(
      adminAccess.map((a) => a.channelId.toString())
    );

    const accessibleChannelIds = new Set([
      ...memberChannelIds,
      ...publicChannelIds,
      ...adminAccessChannelIds,
    ]);

    if (isGlobalAdmin) {
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
          const lastReadAt = readStatusMap.get(message._id.toString());
          if (
            lastReadAt === undefined ||
            message.threadLastReplyAt > lastReadAt
          ) {
            unreadCount++;
          }
        }
      }
    } else {
      for (const channelIdStr of accessibleChannelIds) {
        const channelId = channelIdStr as Id<"channels">;

        if (
          publicChannelIds.has(channelIdStr) &&
          !memberChannelIds.has(channelIdStr)
        ) {
          const membership = await ctx.db
            .query("channelMembers")
            .withIndex("by_channel_user", (q) =>
              q.eq("channelId", channelId).eq("userId", user._id)
            )
            .unique();

          if (membership?.isBanned) {
            continue;
          }
        }

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
            const lastReadAt = readStatusMap.get(message._id.toString());
            if (
              lastReadAt === undefined ||
              message.threadLastReplyAt > lastReadAt
            ) {
              unreadCount++;
            }
          }
        }
      }
    }

    // =========================================================================
    // Count unread DM threads
    // =========================================================================

    const participations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", user._id).eq("leftAt", undefined)
      )
      .collect();

    for (const participation of participations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", participation.conversationId)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("parentId"), undefined),
            q.eq(q.field("deletedAt"), undefined),
            q.gt(q.field("threadReplyCount"), 0)
          )
        )
        .collect();

      for (const message of messages) {
        if (message.threadLastReplyAt !== undefined) {
          const lastReadAt = readStatusMap.get(message._id.toString());
          if (
            lastReadAt === undefined ||
            message.threadLastReplyAt > lastReadAt
          ) {
            unreadCount++;
          }
        }
      }
    }

    return unreadCount;
  },
});

/**
 * Mark a thread as read.
 * Creates or updates threadReadStatus for the given parent message.
 */
export const markThreadAsRead = mutation({
  args: {
    parentMessageId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify the message exists and is a thread parent
    const message = await ctx.db.get(args.parentMessageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user has access to this thread
    if (message.channelId) {
      // Channel thread - verify channel membership or public access
      const channel = await ctx.db.get(message.channelId);
      if (!channel) {
        throw new Error("Channel not found");
      }

      const membership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", message.channelId!).eq("userId", user._id)
        )
        .unique();

      // Check for public channel or membership
      const isPublic = channel.type === "public" && !channel.isArchived;
      const isMember = membership && !membership.leftAt && !membership.isBanned;
      const isAdmin = user.role === "admin";

      if (!isPublic && !isMember && !isAdmin) {
        throw new Error("Access denied to this thread");
      }
    } else if (message.conversationId) {
      // DM thread - verify participation
      const participation = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", user._id).eq("conversationId", message.conversationId!)
        )
        .unique();

      if (!participation || participation.leftAt) {
        throw new Error("Access denied to this thread");
      }
    } else {
      throw new Error("Invalid message: no context");
    }

    // Check if read status already exists
    const existingStatus = await ctx.db
      .query("threadReadStatus")
      .withIndex("by_user_thread", (q) =>
        q.eq("userId", user._id).eq("parentMessageId", args.parentMessageId)
      )
      .unique();

    const now = Date.now();

    if (existingStatus) {
      // Update existing
      await ctx.db.patch(existingStatus._id, {
        lastReadAt: now,
      });
    } else {
      // Create new
      await ctx.db.insert("threadReadStatus", {
        userId: user._id,
        parentMessageId: args.parentMessageId,
        lastReadAt: now,
      });
    }

    return null;
  },
});
