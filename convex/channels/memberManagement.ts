import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth } from "../lib/auth";

// ============================================================================
// Member Management Mutations
// ============================================================================

/**
 * Add multiple users as members to a channel.
 * Only channel admins/owners or global admins can add members.
 * For private channels: only admin/owner can add.
 * For public channels: admin/owner can add (users can also self-join via `join` mutation).
 */
export const addMembers = mutation({
  args: {
    channelId: v.id("channels"),
    userIds: v.array(v.id("users")),
  },
  returns: v.object({
    added: v.number(),
    alreadyMembers: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    if (channel.isArchived) {
      throw new Error("Cannot add members to an archived channel");
    }

    // Check if caller has admin access (global admin or channel admin/owner)
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
      throw new Error("Forbidden: Channel admin access required to add members");
    }

    // Validate userIds array is not empty
    if (args.userIds.length === 0) {
      return { added: 0, alreadyMembers: 0 };
    }

    const now = Date.now();
    let addedCount = 0;
    let alreadyMembersCount = 0;

    for (const userId of args.userIds) {
      // Verify user exists
      const targetUser = await ctx.db.get(userId);
      if (!targetUser) {
        // Skip non-existent users
        continue;
      }

      // Check existing membership
      const existingMembership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", args.channelId).eq("userId", userId)
        )
        .unique();

      if (existingMembership) {
        if (existingMembership.isBanned) {
          // Cannot add banned users - they need to be unbanned first
          continue;
        }

        if (!existingMembership.leftAt) {
          // Already an active member
          alreadyMembersCount++;
          continue;
        }

        // User had left - rejoin them
        await ctx.db.patch(existingMembership._id, {
          leftAt: undefined,
          joinedAt: now,
        });
        addedCount++;
      } else {
        // Create new membership
        await ctx.db.insert("channelMembers", {
          channelId: args.channelId,
          userId,
          role: "member",
          joinedAt: now,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
        addedCount++;
      }
    }

    // Update member count
    if (addedCount > 0) {
      await ctx.db.patch(args.channelId, {
        memberCount: channel.memberCount + addedCount,
      });
    }

    return { added: addedCount, alreadyMembers: alreadyMembersCount };
  },
});

/**
 * Remove a member from a channel.
 * Only channel admins/owners or global admins can remove members.
 * Cannot remove the owner (must transfer ownership first).
 * Cannot remove self (use `leave` mutation instead).
 */
export const removeMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Cannot remove self - use leave instead
    if (args.userId === user._id) {
      throw new Error("Cannot remove yourself. Use the leave function instead.");
    }

    // Check if caller has admin access (global admin or channel admin/owner)
    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    const isChannelAdmin =
      callerMembership &&
      !callerMembership.leftAt &&
      !callerMembership.isBanned &&
      (callerMembership.role === "owner" || callerMembership.role === "admin");

    if (user.role !== "admin" && !isChannelAdmin) {
      throw new Error("Forbidden: Channel admin access required to remove members");
    }

    // Get target membership
    const targetMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (!targetMembership) {
      throw new Error("User is not a member of this channel");
    }

    if (targetMembership.leftAt) {
      throw new Error("User has already left this channel");
    }

    // Cannot remove owner
    if (targetMembership.role === "owner") {
      throw new Error(
        "Cannot remove channel owner. Transfer ownership first."
      );
    }

    // Non-owner channel admins cannot remove other admins (only owner/global admin can)
    if (
      targetMembership.role === "admin" &&
      callerMembership?.role !== "owner" &&
      user.role !== "admin"
    ) {
      throw new Error(
        "Only channel owner or global admin can remove other admins"
      );
    }

    // Soft remove - set leftAt
    await ctx.db.patch(targetMembership._id, {
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
 * Update a member's role in a channel.
 * Only channel owner or global admin can change roles.
 * Cannot change the owner role (must use transferOwnership).
 * Cannot demote self.
 */
export const updateMemberRole = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    newRole: v.union(
      v.literal("admin"),
      v.literal("moderator"),
      v.literal("member")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Get caller's membership
    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    const isChannelOwner =
      callerMembership &&
      !callerMembership.leftAt &&
      !callerMembership.isBanned &&
      callerMembership.role === "owner";

    // Only owner or global admin can change roles
    if (user.role !== "admin" && !isChannelOwner) {
      throw new Error(
        "Forbidden: Only channel owner or global admin can change member roles"
      );
    }

    // Get target membership
    const targetMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (!targetMembership) {
      throw new Error("User is not a member of this channel");
    }

    if (targetMembership.leftAt) {
      throw new Error("Cannot change role of a user who has left the channel");
    }

    if (targetMembership.isBanned) {
      throw new Error("Cannot change role of a banned user");
    }

    // Cannot change owner role
    if (targetMembership.role === "owner") {
      throw new Error(
        "Cannot change owner role. Use transfer ownership instead."
      );
    }

    // Cannot demote self (even if global admin)
    if (args.userId === user._id) {
      throw new Error("Cannot change your own role");
    }

    // Update the role
    await ctx.db.patch(targetMembership._id, {
      role: args.newRole,
    });

    return null;
  },
});
