import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { canAccessChannel, isChannelMember } from "../lib/permissions";
import { isChannelRole } from "../lib/typeGuards";
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
      const membership = membershipMap.get(channel._id.toString());

      // Skip channels where user has explicitly left (via leftAt)
      // This ensures unassigned course channels don't appear in the list
      if (membership?.leftAt) {
        continue;
      }

      // Check if user can access this channel
      const hasAccess = await canAccessChannel(ctx, channel._id, user._id);
      if (!hasAccess) {
        continue;
      }

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
 * Returns channel with membership information including unread count.
 *
 * Access Control:
 * - Returns null if channel doesn't exist
 * - Returns null if user doesn't have access to the channel
 * - For public channels: accessible unless user is banned
 * - For private/course channels: requires membership or admin role
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
 *
 * Access Control:
 * - User must have access to the channel (via canAccessChannel)
 * - Throws error if user doesn't have access
 *
 * Returns:
 * - Active members only (no leftAt, not banned)
 * - Includes user information (name, email, avatar, status)
 * - Sorted by role hierarchy (owner > admin > moderator > member)
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
      // Validate roles with type guard before accessing roleOrder
      const aOrder = isChannelRole(a.role) ? roleOrder[a.role] : roleOrder.member;
      const bOrder = isChannelRole(b.role) ? roleOrder[b.role] : roleOrder.member;
      const roleCompare = aOrder - bOrder;
      if (roleCompare !== 0) {
        return roleCompare;
      }
      return a.userName.localeCompare(b.userName);
    });

    return validMembers;
  },
});

/**
 * Search channels by name with access control.
 * Returns channels matching the search term that the user can access.
 *
 * Access Control:
 * - Public channels: Always returned if matching (unless user is banned)
 * - Private channels: Only returned if user is an active member or global admin
 * - Course channels: Only returned if user is an active member or global admin
 * - Channels where user has leftAt set are excluded
 * - Archived channels excluded unless includeArchived is true
 *
 * T075-1: Implement channel search query
 */
export const search = query({
  args: {
    searchTerm: v.string(),
    type: v.optional(v.union(v.literal("public"), v.literal("private"), v.literal("course"))),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(channelWithMembershipValidator),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate search term (min 2 chars, max 100 chars) - prevents enumeration attacks
    const trimmedSearch = args.searchTerm.trim();
    if (trimmedSearch.length < 2) {
      throw new Error("Search term must be at least 2 characters");
    }
    if (trimmedSearch.length > 100) {
      throw new Error("Search term must be 100 characters or less");
    }

    const searchLower = trimmedSearch.toLowerCase();
    const includeArchived = args.includeArchived ?? false;

    // Get all channels (we need to filter by name which isn't indexed for search)
    let allChannels;
    if (args.type) {
      allChannels = await ctx.db
        .query("channels")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .collect();
    } else {
      // Get all channel types (public, private, and course)
      const publicChannels = await ctx.db
        .query("channels")
        .withIndex("by_type", (q) => q.eq("type", "public"))
        .collect();
      const privateChannels = await ctx.db
        .query("channels")
        .withIndex("by_type", (q) => q.eq("type", "private"))
        .collect();
      const courseChannels = await ctx.db
        .query("channels")
        .withIndex("by_type", (q) => q.eq("type", "course"))
        .collect();
      allChannels = [...publicChannels, ...privateChannels, ...courseChannels];
    }

    // Filter by search term (case-insensitive name matching)
    const matchingChannels = allChannels.filter((channel) =>
      channel.name.toLowerCase().includes(searchLower)
    );

    // Filter archived channels unless explicitly included
    const filteredChannels = includeArchived
      ? matchingChannels
      : matchingChannels.filter((c) => !c.isArchived);

    // Get user's memberships for all channels
    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const membershipMap = new Map(
      memberships.map((m) => [m.channelId.toString(), m])
    );

    // Filter channels by access
    const accessibleChannels: Array<{
      channel: (typeof filteredChannels)[0];
      membership: (typeof memberships)[0] | undefined;
      isExactMatch: boolean;
    }> = [];

    for (const channel of filteredChannels) {
      const membership = membershipMap.get(channel._id.toString());

      // Skip channels where user has explicitly left (via leftAt)
      if (membership?.leftAt) {
        continue;
      }

      // For private and course channels, user must be an active member OR global admin
      // Access decision made in single check to avoid timing side-channel leaks
      if (channel.type === "private" || channel.type === "course") {
        const isMember = await isChannelMember(ctx, channel._id, user._id);
        const isGlobalAdmin = user.role === "admin";
        const hasAccess = isMember || isGlobalAdmin;
        if (!hasAccess) {
          continue;
        }
      } else {
        // For public channels, check if user is banned
        if (membership?.isBanned) {
          continue;
        }
      }

      // Check if it's an exact match (case-insensitive)
      const isExactMatch = channel.name.toLowerCase() === searchLower;

      accessibleChannels.push({ channel, membership, isExactMatch });
    }

    // Build result with unread counts
    const result = await Promise.all(
      accessibleChannels.map(async ({ channel, membership, isExactMatch }) => {
        // Calculate unread count
        let unreadCount = 0;
        if (membership && !membership.leftAt && !membership.isBanned) {
          const lastReadAt = membership.lastReadAt ?? 0;
          const lastMessageAt = channel.lastMessageAt ?? 0;

          if (lastMessageAt > lastReadAt) {
            const unreadMessages = await ctx.db
              .query("messages")
              .withIndex("by_channel_time", (q) =>
                q.eq("channelId", channel._id).gt("createdAt", lastReadAt)
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
          _isExactMatch: isExactMatch, // Temporary field for sorting
        };
      })
    );

    // Sort: exact matches first, then partial matches alphabetically
    result.sort((a, b) => {
      // Exact matches come first
      if (a._isExactMatch && !b._isExactMatch) return -1;
      if (!a._isExactMatch && b._isExactMatch) return 1;

      // Within same match type, sort alphabetically
      return a.name.localeCompare(b.name);
    });

    // Limit to 20 results and remove temporary sorting field
    return result.slice(0, 20).map(({ _isExactMatch, ...rest }) => rest);
  },
});
