import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { canAccessChannel } from "../lib/permissions";
import { channelWithMembershipValidator, memberInfoValidator } from "./types";

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
      channel: (typeof filteredChannels)[0];
      membership: (typeof memberships)[0] | undefined;
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
                isFavorite: membership.isFavorite,
              }
            : null,
      };
    });

    // Sort by lastMessageAt (most recent first), then by name
    result.sort((a, b) => {
      if (a.lastMessageAt && !b.lastMessageAt) return -1;
      if (!a.lastMessageAt && b.lastMessageAt) return 1;
      if (a.lastMessageAt && b.lastMessageAt) {
        return b.lastMessageAt - a.lastMessageAt;
      }
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
              isFavorite: membership.isFavorite,
            }
          : null,
    };
  },
});

/**
 * Get all active members of a channel with user information.
 * Returns members sorted by role (owner first) then by name.
 */
export const getMembers = query({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.array(memberInfoValidator),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check if user can access the channel
    const hasAccess = await canAccessChannel(ctx, args.channelId, user._id);
    if (!hasAccess) {
      throw new Error("Forbidden: You do not have access to this channel");
    }

    // Get all active members (no leftAt, not banned)
    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    // Filter to active members only
    const activeMembers = memberships.filter(
      (m) => m.leftAt === undefined && !m.isBanned
    );

    // Fetch user info for each member
    const membersWithUserInfo = await Promise.all(
      activeMembers.map(async (membership) => {
        const memberUser = await ctx.db.get(membership.userId);
        if (!memberUser) {
          return null;
        }
        return {
          _id: membership._id,
          userId: membership.userId,
          userName: memberUser.name,
          userEmail: memberUser.email,
          userAvatarUrl: memberUser.avatarUrl,
          userStatus: memberUser.status,
          role: membership.role,
          joinedAt: membership.joinedAt,
        };
      })
    );

    // Filter out any null results (deleted users)
    const validMembers = membersWithUserInfo.filter(
      (m): m is NonNullable<typeof m> => m !== null
    );

    // Sort by role hierarchy (owner first), then by name
    type ChannelRole = "owner" | "admin" | "moderator" | "member";
    const roleOrder: Record<ChannelRole, number> = {
      owner: 0,
      admin: 1,
      moderator: 2,
      member: 3,
    };

    validMembers.sort((a, b) => {
      const aOrder = roleOrder[a.role as ChannelRole];
      const bOrder = roleOrder[b.role as ChannelRole];
      const roleCompare = aOrder - bOrder;
      if (roleCompare !== 0) {
        return roleCompare;
      }
      return a.userName.localeCompare(b.userName);
    });

    return validMembers;
  },
});
