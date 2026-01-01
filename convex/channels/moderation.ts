import { v } from "convex/values";
import { mutation, query, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireAuth } from "../lib/auth";
import { hasChannelRole, ChannelRole } from "../lib/permissions";

// ============================================================================
// Channel Moderation Mutations
// ============================================================================

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<ChannelRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

/**
 * Helper to get caller and target memberships with validation.
 * Returns both memberships and validates basic conditions.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function getModerationContext(
  ctx: MutationCtx,
  channelId: Id<"channels">,
  targetUserId: Id<"users">,
  requiredRoles: ChannelRole[]
) {
  const user = await requireAuth(ctx);

  const channel = await ctx.db.get(channelId);
  if (!channel) {
    throw new Error("Channel not found");
  }

  // Get caller's membership
  const callerMembership = await ctx.db
    .query("channelMembers")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", user._id)
    )
    .unique();

  // Check if caller has required role or is global admin
  const hasRequiredRole =
    user.role === "admin" ||
    (callerMembership &&
      !callerMembership.leftAt &&
      !callerMembership.isBanned &&
      requiredRoles.includes(callerMembership.role as ChannelRole));

  if (!hasRequiredRole) {
    throw new Error(
      `Forbidden: Requires one of these roles: ${requiredRoles.join(", ")} or global admin`
    );
  }

  // Get target's membership
  const targetMembership = await ctx.db
    .query("channelMembers")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", targetUserId)
    )
    .unique();

  if (!targetMembership) {
    throw new Error("Target user is not a member of this channel");
  }

  if (targetMembership.leftAt && !targetMembership.isBanned) {
    throw new Error("Target user has left this channel");
  }

  return {
    user,
    channel,
    callerMembership,
    targetMembership,
    callerRole: user.role === "admin" ? ("owner" as ChannelRole) : (callerMembership?.role as ChannelRole),
    targetRole: targetMembership.role as ChannelRole,
  };
}

// ============================================================================
// T166: Mute/Unmute Mutations
// ============================================================================

/**
 * Mute a member in a channel for a specified duration.
 *
 * Permission: owner, admin, or moderator can mute members.
 * Restriction: Cannot mute someone with equal or higher role.
 *
 * @param channelId - The channel ID
 * @param userId - The user to mute
 * @param durationMinutes - How long to mute (in minutes)
 */
export const muteMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    durationMinutes: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Validate duration
    if (args.durationMinutes <= 0) {
      throw new Error("Duration must be a positive number");
    }
    if (args.durationMinutes > 43200) {
      // Max 30 days
      throw new Error("Maximum mute duration is 30 days (43200 minutes)");
    }

    const { user, callerRole, targetRole, targetMembership } =
      await getModerationContext(ctx, args.channelId, args.userId, [
        "owner",
        "admin",
        "moderator",
      ]);

    // Cannot mute yourself
    if (args.userId === user._id) {
      throw new Error("Cannot mute yourself");
    }

    // Cannot mute someone with equal or higher role
    const callerRoleLevel = ROLE_HIERARCHY[callerRole];
    const targetRoleLevel = ROLE_HIERARCHY[targetRole];

    if (targetRoleLevel >= callerRoleLevel) {
      throw new Error(
        "Cannot mute a member with equal or higher role than yourself"
      );
    }

    // Cannot mute owner
    if (targetRole === "owner") {
      throw new Error("Cannot mute the channel owner");
    }

    // Calculate mute expiry
    const mutedUntil = Date.now() + args.durationMinutes * 60 * 1000;

    // Apply mute
    await ctx.db.patch(targetMembership._id, {
      isMuted: true,
      mutedUntil,
      mutedBy: user._id,
    });

    return null;
  },
});

/**
 * Unmute a member in a channel.
 *
 * Permission: owner, admin, or moderator can unmute members.
 *
 * @param channelId - The channel ID
 * @param userId - The user to unmute
 */
export const unmuteMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { targetMembership } = await getModerationContext(
      ctx,
      args.channelId,
      args.userId,
      ["owner", "admin", "moderator"]
    );

    // Check if actually muted
    if (!targetMembership.isMuted) {
      throw new Error("User is not muted");
    }

    // Clear mute
    await ctx.db.patch(targetMembership._id, {
      isMuted: false,
      mutedUntil: undefined,
      mutedBy: undefined,
    });

    return null;
  },
});

// ============================================================================
// T167: Ban/Unban Mutations
// ============================================================================

/**
 * Ban a member from a channel.
 *
 * Permission: owner or admin only.
 * Restriction: Cannot ban the owner.
 *
 * @param channelId - The channel ID
 * @param userId - The user to ban
 * @param reason - Optional reason for the ban
 */
export const banMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, channel, targetRole, targetMembership } =
      await getModerationContext(ctx, args.channelId, args.userId, [
        "owner",
        "admin",
      ]);

    // Cannot ban yourself
    if (args.userId === user._id) {
      throw new Error("Cannot ban yourself");
    }

    // Cannot ban the owner
    if (targetRole === "owner") {
      throw new Error("Cannot ban the channel owner");
    }

    // Check if already banned
    if (targetMembership.isBanned) {
      throw new Error("User is already banned from this channel");
    }

    // Apply ban
    await ctx.db.patch(targetMembership._id, {
      isBanned: true,
      bannedAt: Date.now(),
      bannedBy: user._id,
      // Also clear any mute state since ban supersedes mute
      isMuted: false,
      mutedUntil: undefined,
      mutedBy: undefined,
    });

    // Update channel member count
    await ctx.db.patch(args.channelId, {
      memberCount: Math.max(0, channel.memberCount - 1),
    });

    return null;
  },
});

/**
 * Unban a member from a channel.
 *
 * Permission: owner or admin only.
 *
 * @param channelId - The channel ID
 * @param userId - The user to unban
 */
export const unbanMember = mutation({
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

    // Check caller permissions
    const hasPermission = await hasChannelRole(
      ctx,
      args.channelId,
      user._id,
      "admin"
    );
    if (!hasPermission) {
      throw new Error("Forbidden: Channel admin access required");
    }

    // Get target's membership
    const targetMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (!targetMembership) {
      throw new Error("User is not a member of this channel");
    }

    // Check if actually banned
    if (!targetMembership.isBanned) {
      throw new Error("User is not banned");
    }

    // Clear ban
    await ctx.db.patch(targetMembership._id, {
      isBanned: false,
      bannedAt: undefined,
      bannedBy: undefined,
      // User is no longer a member after unban - they need to rejoin
      leftAt: Date.now(),
    });

    return null;
  },
});

// ============================================================================
// T168: Paginated Channel Members Query
// ============================================================================

/**
 * Get channel members with pagination and optional search.
 *
 * Returns member details including moderation state (muted, banned).
 *
 * @param channelId - The channel ID
 * @param limit - Number of results per page (default 20, max 100)
 * @param cursor - Pagination cursor
 * @param searchQuery - Optional filter by user name
 */
export const getChannelMembersWithPagination = query({
  args: {
    channelId: v.id("channels"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  returns: v.object({
    members: v.array(
      v.object({
        _id: v.id("channelMembers"),
        userId: v.id("users"),
        role: v.string(),
        joinedAt: v.number(),
        isMuted: v.boolean(),
        mutedUntil: v.optional(v.number()),
        isBanned: v.boolean(),
        bannedAt: v.optional(v.number()),
        user: v.object({
          name: v.string(),
          imageUrl: v.optional(v.string()),
        }),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Check if user can view members (must be member or global admin)
    const isMember = await hasChannelRole(
      ctx,
      args.channelId,
      user._id,
      "member"
    );
    if (!isMember && user.role !== "admin") {
      throw new Error("Forbidden: Must be a channel member to view members");
    }

    const limit = Math.min(args.limit ?? 20, 100);

    // Query all members for this channel using index
    const membersQuery = ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId));

    // Collect all and filter in memory (Convex doesn't support cursor-based pagination on indexed queries easily)
    const allMembers = await membersQuery.collect();

    // Filter out left members (but include banned for admin visibility)
    const activeMembers = allMembers.filter((m) => !m.leftAt);

    // Apply search filter if provided
    const memberUserMap = new Map<string, { name: string; imageUrl?: string }>();
    const memberIds = activeMembers.map((m) => m.userId);

    // Batch fetch user data
    for (const memberId of memberIds) {
      const memberUser = await ctx.db.get(memberId);
      if (memberUser) {
        memberUserMap.set(memberId.toString(), {
          name: memberUser.name,
          imageUrl: memberUser.avatarUrl,
        });
      }
    }

    // Filter by search query if provided
    let filteredMembers = activeMembers;
    if (args.searchQuery && args.searchQuery.trim() !== "") {
      const searchLower = args.searchQuery.toLowerCase().trim();
      filteredMembers = activeMembers.filter((m) => {
        const userData = memberUserMap.get(m.userId.toString());
        return userData?.name.toLowerCase().includes(searchLower);
      });
    }

    // Sort by role (owner first, then admin, moderator, member) and then by joinedAt
    filteredMembers.sort((a, b) => {
      const roleOrder = { owner: 0, admin: 1, moderator: 2, member: 3 };
      const aRole = roleOrder[a.role as keyof typeof roleOrder] ?? 4;
      const bRole = roleOrder[b.role as keyof typeof roleOrder] ?? 4;
      if (aRole !== bRole) return aRole - bRole;
      return a.joinedAt - b.joinedAt;
    });

    // Apply cursor-based pagination
    let startIndex = 0;
    if (args.cursor) {
      const cursorIndex = parseInt(args.cursor, 10);
      if (!isNaN(cursorIndex)) {
        startIndex = cursorIndex;
      }
    }

    const paginatedMembers = filteredMembers.slice(
      startIndex,
      startIndex + limit
    );
    const hasMore = startIndex + limit < filteredMembers.length;
    const nextCursor = hasMore ? String(startIndex + limit) : undefined;

    // Build result with user data
    const members = paginatedMembers.map((m) => {
      const userData = memberUserMap.get(m.userId.toString()) ?? {
        name: "Unknown",
        imageUrl: undefined,
      };
      return {
        _id: m._id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        isMuted: m.isMuted,
        mutedUntil: m.mutedUntil,
        isBanned: m.isBanned,
        bannedAt: m.bannedAt,
        user: userData,
      };
    });

    return {
      members,
      nextCursor,
      hasMore,
    };
  },
});

// ============================================================================
// T170: Restore Deleted Message
// ============================================================================

/**
 * Restore a soft-deleted message.
 *
 * Permission: owner or admin only.
 * Restriction: Can only restore messages deleted within 90 days.
 *
 * @param messageId - The message to restore
 */
export const restoreDeletedMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Message must be in a channel
    if (!message.channelId) {
      throw new Error("Only channel messages can be restored");
    }

    // Check if message is deleted
    if (!message.deletedAt) {
      throw new Error("Message is not deleted");
    }

    // Check 90-day limit
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    if (Date.now() - message.deletedAt > NINETY_DAYS_MS) {
      throw new Error(
        "Cannot restore message: deleted more than 90 days ago"
      );
    }

    // Check caller permissions (owner or admin only)
    const hasPermission = await hasChannelRole(
      ctx,
      message.channelId,
      user._id,
      "admin"
    );
    if (!hasPermission) {
      throw new Error(
        "Forbidden: Only channel owner or admin can restore messages"
      );
    }

    // Restore the message
    await ctx.db.patch(args.messageId, {
      deletedAt: undefined,
      deletedBy: undefined,
    });

    return null;
  },
});
