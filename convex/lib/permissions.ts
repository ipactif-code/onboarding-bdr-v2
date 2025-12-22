import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Channel role hierarchy: owner > admin > moderator > member
 */
export type ChannelRole = "owner" | "admin" | "moderator" | "member";

const ROLE_HIERARCHY: Record<ChannelRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

/**
 * Check if a user is an active member of a channel.
 * Active means: leftAt is null/undefined AND isBanned is false.
 */
export async function isChannelMember(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">
): Promise<boolean> {
  const membership = await ctx.db
    .query("channelMembers")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", userId)
    )
    .unique();

  if (!membership) {
    return false;
  }

  // Active member = not left AND not banned
  return membership.leftAt === undefined && !membership.isBanned;
}

/**
 * Check if a user can access a channel.
 * Access is granted if:
 * 1. User is an active member of the channel, OR
 * 2. Channel is public (anyone can view), OR
 * 3. User is a global admin (user.role === "admin"), OR
 * 4. User has additional admin privileges via channelAdmins table
 */
export async function canAccessChannel(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">
): Promise<boolean> {
  // Check if user is a global admin
  const user = await ctx.db.get(userId);
  if (!user) {
    return false;
  }
  if (user.role === "admin") {
    return true;
  }

  // Check if channel exists
  const channel = await ctx.db.get(channelId);
  if (!channel) {
    return false;
  }

  // Public channels are accessible to anyone UNLESS they are banned
  if (channel.type === "public") {
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channelId).eq("userId", userId)
      )
      .unique();

    // If user has a membership and is banned, deny access
    if (membership?.isBanned) {
      return false;
    }
    return true;
  }

  // Check if user is an active member
  const isMember = await isChannelMember(ctx, channelId, userId);
  if (isMember) {
    return true;
  }

  // Check channelAdmins table for additional privileges (e.g., course instructors)
  const adminAccess = await ctx.db
    .query("channelAdmins")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", userId)
    )
    .unique();

  return adminAccess !== null;
}

/**
 * Check if a user has a specific role (or higher) in a channel.
 * Role hierarchy: owner > admin > moderator > member
 *
 * Returns true if:
 * 1. User is a global admin (has all channel permissions), OR
 * 2. User is an active member with a role >= requiredRole, OR
 * 3. User has admin privileges via channelAdmins table (grants admin-level access)
 */
export async function hasChannelRole(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">,
  requiredRole: ChannelRole
): Promise<boolean> {
  // Check if user is a global admin
  const user = await ctx.db.get(userId);
  if (!user) {
    return false;
  }
  if (user.role === "admin") {
    return true;
  }

  // Check channel membership
  const membership = await ctx.db
    .query("channelMembers")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", userId)
    )
    .unique();

  if (membership && membership.leftAt === undefined && !membership.isBanned) {
    const userRoleLevel = ROLE_HIERARCHY[membership.role];
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole];

    if (userRoleLevel >= requiredRoleLevel) {
      return true;
    }
  }

  // Check channelAdmins table for additional admin privileges
  // channelAdmins grants admin-level access (useful for course instructors)
  if (ROLE_HIERARCHY[requiredRole] <= ROLE_HIERARCHY.admin) {
    // First check if user is banned as a member - if so, deny admin access
    // Note: We may already have checked membership above, but we need to ensure
    // banned users cannot bypass via channelAdmins even if not previously checked
    const memberRecord = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channelId).eq("userId", userId)
      )
      .unique();

    if (memberRecord?.isBanned) {
      return false; // Banned users cannot use channelAdmins access
    }

    const adminAccess = await ctx.db
      .query("channelAdmins")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channelId).eq("userId", userId)
      )
      .unique();

    if (adminAccess !== null) {
      return true;
    }
  }

  return false;
}
