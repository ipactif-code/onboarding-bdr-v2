import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAdmin } from "./lib/auth";
import { canAccessChannel } from "./lib/permissions";

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

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new channel.
 * Only admins can create channels (FR-036).
 *
 * FR-001: Public channels visible to all authenticated users
 * FR-002: Private channels with invite-only access
 * FR-036: Channel creation restricted to admins and designated users
 *
 * T018: Create channels.create mutation
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    topic: v.optional(v.string()),
    type: v.union(v.literal("public"), v.literal("private")),
  },
  returns: v.id("channels"),
  handler: async (ctx, args) => {
    // Require admin for channel creation (FR-036)
    const user = await requireAdmin(ctx);

    // Validate name (2-80 chars)
    if (args.name.length < 2) {
      throw new Error("Channel name must be at least 2 characters");
    }
    if (args.name.length > 80) {
      throw new Error("Channel name must be at most 80 characters");
    }

    // Validate name format (alphanumeric, hyphens, underscores)
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(args.name)) {
      throw new Error(
        "Channel name can only contain letters, numbers, hyphens, and underscores"
      );
    }

    // Check for duplicate name
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();

    if (existing) {
      throw new Error("A channel with this name already exists");
    }

    const now = Date.now();

    // Create channel
    const channelId = await ctx.db.insert("channels", {
      name: args.name,
      description: args.description,
      topic: args.topic,
      type: args.type,
      creatorId: user._id,
      createdAt: now,
      isArchived: false,
      memberCount: 1, // Creator is first member
    });

    // Add creator as owner member
    await ctx.db.insert("channelMembers", {
      channelId,
      userId: user._id,
      role: "owner",
      joinedAt: now,
      notificationLevel: "all",
      isMuted: false,
      isBanned: false,
    });

    return channelId;
  },
});

/**
 * Update channel details.
 * Only channel admins/owners or global admins can update.
 */
export const update = mutation({
  args: {
    channelId: v.id("channels"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Check if user has admin access (global admin or channel admin/owner)
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    const isChannelAdmin =
      membership &&
      !membership.leftAt &&
      !membership.isBanned &&
      (membership.role === "owner" || membership.role === "admin");

    if (user.role !== "admin" && !isChannelAdmin) {
      throw new Error("Forbidden: Channel admin access required");
    }

    const updates: {
      name?: string;
      description?: string;
      topic?: string;
    } = {};

    if (args.name !== undefined) {
      // Validate name
      if (args.name.length < 2) {
        throw new Error("Channel name must be at least 2 characters");
      }
      if (args.name.length > 80) {
        throw new Error("Channel name must be at most 80 characters");
      }

      const nameRegex = /^[a-zA-Z0-9_-]+$/;
      if (!nameRegex.test(args.name)) {
        throw new Error(
          "Channel name can only contain letters, numbers, hyphens, and underscores"
        );
      }

      // Check for duplicate name (excluding current channel)
      const existing = await ctx.db
        .query("channels")
        .withIndex("by_name", (q) => q.eq("name", args.name!))
        .unique();

      if (existing && existing._id !== args.channelId) {
        throw new Error("A channel with this name already exists");
      }

      updates.name = args.name;
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.topic !== undefined) {
      updates.topic = args.topic;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.channelId, updates);
    }

    return null;
  },
});

/**
 * Archive a channel.
 * Only channel owners or global admins can archive.
 */
export const archive = mutation({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    if (channel.isArchived) {
      throw new Error("Channel is already archived");
    }

    // Check if user is global admin or channel owner
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    const isOwner =
      membership &&
      !membership.leftAt &&
      !membership.isBanned &&
      membership.role === "owner";

    if (user.role !== "admin" && !isOwner) {
      throw new Error("Forbidden: Only channel owner or global admin can archive");
    }

    await ctx.db.patch(args.channelId, {
      isArchived: true,
      archivedAt: Date.now(),
      archivedBy: user._id,
    });

    return null;
  },
});

/**
 * Unarchive a channel.
 * Only global admins can unarchive.
 */
export const unarchive = mutation({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    if (!channel.isArchived) {
      throw new Error("Channel is not archived");
    }

    await ctx.db.patch(args.channelId, {
      isArchived: false,
      archivedAt: undefined,
      archivedBy: undefined,
    });

    return null;
  },
});

/**
 * Join a public channel.
 * Private channels require an invite.
 */
export const join = mutation({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    if (channel.isArchived) {
      throw new Error("Cannot join an archived channel");
    }

    if (channel.type !== "public") {
      throw new Error("Cannot join a private channel without an invite");
    }

    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    if (existingMembership) {
      if (existingMembership.isBanned) {
        throw new Error("You are banned from this channel");
      }

      if (!existingMembership.leftAt) {
        // Already an active member
        return null;
      }

      // Rejoin - update existing membership
      await ctx.db.patch(existingMembership._id, {
        leftAt: undefined,
        joinedAt: Date.now(),
      });
    } else {
      // New membership
      await ctx.db.insert("channelMembers", {
        channelId: args.channelId,
        userId: user._id,
        role: "member",
        joinedAt: Date.now(),
        notificationLevel: "all",
        isMuted: false,
        isBanned: false,
      });
    }

    // Update member count
    await ctx.db.patch(args.channelId, {
      memberCount: channel.memberCount + 1,
    });

    return null;
  },
});

/**
 * Mark all channels as read for the current user.
 * T034: Implement markAllAsRead mutation
 */
export const markAllAsRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all active memberships for the user
    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const now = Date.now();

    // Update lastReadAt for all active memberships
    for (const membership of memberships) {
      if (!membership.leftAt && !membership.isBanned) {
        await ctx.db.patch(membership._id, {
          lastReadAt: now,
        });
      }
    }

    return null;
  },
});

/**
 * Leave a channel.
 * Owners cannot leave - they must transfer ownership first.
 */
export const leave = mutation({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    if (!membership || membership.leftAt) {
      throw new Error("You are not a member of this channel");
    }

    if (membership.role === "owner") {
      throw new Error("Channel owner cannot leave. Transfer ownership first.");
    }

    // Soft leave - set leftAt
    await ctx.db.patch(membership._id, {
      leftAt: Date.now(),
    });

    // Update member count
    await ctx.db.patch(args.channelId, {
      memberCount: Math.max(0, channel.memberCount - 1),
    });

    return null;
  },
});

/**
 * Toggle favorite status for a channel.
 * User must be a member of the channel.
 * Returns the new favorite state.
 */
export const toggleFavorite = mutation({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify channel exists
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Find user's membership
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    if (!membership) {
      throw new Error("You are not a member of this channel");
    }

    if (membership.leftAt) {
      throw new Error("You have left this channel");
    }

    if (membership.isBanned) {
      throw new Error("You are banned from this channel");
    }

    // Toggle the isFavorite state
    const newFavoriteState = !(membership.isFavorite ?? false);

    await ctx.db.patch(membership._id, {
      isFavorite: newFavoriteState,
    });

    return newFavoriteState;
  },
});
