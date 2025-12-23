import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth, requireAdmin } from "../lib/auth";

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
