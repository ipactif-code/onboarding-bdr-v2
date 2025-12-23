import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { canAccessChannel } from "../lib/permissions";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Channel with user membership information.
 */
export const channelWithMembershipValidator = v.object({
  _id: v.id("channels"),
  name: v.string(),
  description: v.optional(v.string()),
  topic: v.optional(v.string()),
  type: v.union(v.literal("public"), v.literal("private"), v.literal("course")),
  courseId: v.optional(v.id("courses")),
  creatorId: v.id("users"),
  createdAt: v.number(),
  isArchived: v.boolean(),
  memberCount: v.number(),
  lastMessageAt: v.optional(v.number()),
  // Membership info (null if not a member)
  membership: v.union(
    v.object({
      role: v.union(
        v.literal("owner"),
        v.literal("admin"),
        v.literal("moderator"),
        v.literal("member")
      ),
      joinedAt: v.number(),
      notificationLevel: v.union(
        v.literal("all"),
        v.literal("mentions"),
        v.literal("none")
      ),
      isMuted: v.boolean(),
      unreadCount: v.number(),
      lastReadAt: v.optional(v.number()),
    }),
    v.null()
  ),
});

// ============================================================================
// Queries
// ============================================================================

/**
 * List channels the current user has access to.
 * Returns channels with membership information including unread counts.
 *
 * FR-001: Public channels visible to all authenticated users
 * FR-002: Private channels with invite-only access
 *
 * T019: Implement list query returning ChannelWithMembership[]
 *
 * OPTIMIZED: Uses batched unread count calculation to avoid N+1 queries.
 * Instead of querying messages for each channel individually, we:
 * 1. Collect all channel IDs and membership lastReadAt timestamps
 * 2. Batch query messages for channels with activity after lastReadAt
 * 3. Calculate unread counts in memory
 */
export const list = query({
  args: {
    type: v.optional(
      v.union(v.literal("public"), v.literal("private"), v.literal("course"))
    ),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(channelWithMembershipValidator),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const includeArchived = args.includeArchived ?? false;

    // Get channels, optionally filtered by type
    let allChannels;
    if (args.type) {
      allChannels = await ctx.db
        .query("channels")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .collect();
    } else {
      allChannels = await ctx.db.query("channels").collect();
    }

    // Filter archived channels unless explicitly included
    const filteredChannels = includeArchived
      ? allChannels
      : allChannels.filter((c) => !c.isArchived);

    // Get user's memberships for all channels
    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const membershipMap = new Map(
      memberships.map((m) => [m.channelId.toString(), m])
    );

    // Step 1: Filter channels by access and build list of channels needing unread counts
    const accessibleChannels: Array<{
      channel: typeof filteredChannels[0];
      membership: typeof memberships[0] | undefined;
    }> = [];

    for (const channel of filteredChannels) {
      // Check if user can access this channel
      const hasAccess = await canAccessChannel(ctx, channel._id, user._id);
      if (!hasAccess) {
        continue;
      }

      const membership = membershipMap.get(channel._id.toString());
      accessibleChannels.push({ channel, membership });
    }

    // Step 2: Batch calculate unread counts
    // For channels where user is a member, calculate unread based on lastReadAt vs lastMessageAt
    // This avoids N+1 by comparing timestamps instead of counting messages
    const unreadCountMap = new Map<string, number>();

    for (const { channel, membership } of accessibleChannels) {
      if (!membership || membership.leftAt || membership.isBanned) {
        unreadCountMap.set(channel._id.toString(), 0);
        continue;
      }

      const lastReadAt = membership.lastReadAt ?? 0;
      const lastMessageAt = channel.lastMessageAt ?? 0;

      // Optimization: If no messages after lastReadAt, unread is 0
      if (lastMessageAt <= lastReadAt) {
        unreadCountMap.set(channel._id.toString(), 0);
        continue;
      }

      // For channels with potential unread messages, count them
      // Use the index to only get messages after lastReadAt
      const unreadMessages = await ctx.db
        .query("messages")
        .withIndex("by_channel_time", (q) =>
          q.eq("channelId", channel._id).gt("createdAt", lastReadAt)
        )
        .collect();

      // Filter out deleted messages and count
      const unreadCount = unreadMessages.filter((m) => !m.deletedAt).length;
      unreadCountMap.set(channel._id.toString(), unreadCount);
    }

    // Step 3: Build result
    const result = accessibleChannels.map(({ channel, membership }) => {
      const unreadCount = unreadCountMap.get(channel._id.toString()) ?? 0;

      return {
        _id: channel._id,
        name: channel.name,
        description: channel.description,
        topic: channel.topic,
        type: channel.type,
        courseId: channel.courseId,
        creatorId: channel.creatorId,
        createdAt: channel.createdAt,
        isArchived: channel.isArchived,
        memberCount: channel.memberCount,
        lastMessageAt: channel.lastMessageAt,
        membership:
          membership && !membership.leftAt && !membership.isBanned
            ? {
                role: membership.role,
                joinedAt: membership.joinedAt,
                notificationLevel: membership.notificationLevel,
                isMuted: membership.isMuted,
                unreadCount,
                lastReadAt: membership.lastReadAt,
              }
            : null,
      };
    });

    // Sort by lastMessageAt (most recent first), then by name
    result.sort((a, b) => {
      // Channels with messages come first
      if (a.lastMessageAt && !b.lastMessageAt) return -1;
      if (!a.lastMessageAt && b.lastMessageAt) return 1;
      if (a.lastMessageAt && b.lastMessageAt) {
        return b.lastMessageAt - a.lastMessageAt;
      }
      // If no messages, sort by name
      return a.name.localeCompare(b.name);
    });

    return result;
  },
});

/**
 * Get a single channel by ID with full details.
 */
export const get = query({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.union(channelWithMembershipValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      return null;
    }

    // Check access
    const hasAccess = await canAccessChannel(ctx, args.channelId, user._id);
    if (!hasAccess) {
      return null;
    }

    // Get membership
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    // Calculate unread count efficiently
    let unreadCount = 0;
    if (membership && !membership.leftAt && !membership.isBanned) {
      const lastReadAt = membership.lastReadAt ?? 0;
      const lastMessageAt = channel.lastMessageAt ?? 0;

      // Only count if there might be unread messages
      if (lastMessageAt > lastReadAt) {
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_channel_time", (q) =>
            q.eq("channelId", args.channelId).gt("createdAt", lastReadAt)
          )
          .collect();
        unreadCount = unreadMessages.filter((m) => !m.deletedAt).length;
      }
    }

    return {
      _id: channel._id,
      name: channel.name,
      description: channel.description,
      topic: channel.topic,
      type: channel.type,
      courseId: channel.courseId,
      creatorId: channel.creatorId,
      createdAt: channel.createdAt,
      isArchived: channel.isArchived,
      memberCount: channel.memberCount,
      lastMessageAt: channel.lastMessageAt,
      membership:
        membership && !membership.leftAt && !membership.isBanned
          ? {
              role: membership.role,
              joinedAt: membership.joinedAt,
              notificationLevel: membership.notificationLevel,
              isMuted: membership.isMuted,
              unreadCount,
              lastReadAt: membership.lastReadAt,
            }
          : null,
    };
  },
});
