import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { requireAuth } from "../lib/auth";

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
    const allThreads: Array<{
      message: Doc<"messages">;
      threadLastReplyAt: number;
    }> = [];

    if (isGlobalAdmin) {
      // Admin can see all channels - scan all messages with threads
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
      const channelIdList = [...accessibleChannelIds];

      for (const channelIdStr of channelIdList) {
        const channelId = channelIdStr as Id<"channels">;

        // Check if user might be banned from this public channel
        if (publicChannelIds.has(channelIdStr) && !memberChannelIds.has(channelIdStr)) {
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
