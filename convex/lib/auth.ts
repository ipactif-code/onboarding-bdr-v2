import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import * as apiModule from "../_generated/api";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internal = (apiModule as any).internal;
import { isChannelMember, hasChannelRole } from "./permissions";

/**
 * Get the current authenticated user from the context.
 * Returns null if no user is authenticated or user doesn't exist in DB.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/**
 * Ensure the current authenticated user exists in the database.
 * Creates the user if they don't exist (for mutation contexts only).
 * Returns the user or null if not authenticated.
 *
 * T008: When creating a new user, schedules enrollment in all "all_teams" course channels.
 */
export async function ensureUser(
  ctx: MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Try to find existing user by Clerk ID
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (existingUser) {
    return existingUser;
  }

  // User is authenticated with Clerk but doesn't exist in our database
  // This can happen if the webhook hasn't fired yet or failed
  // Auto-create the user
  const email = identity.email ?? `${identity.subject}@unknown.com`;
  const name = identity.name ?? identity.nickname ?? email.split("@")[0] ?? "User";

  const userId = await ctx.db.insert("users", {
    clerkId: identity.subject,
    email,
    name,
    avatarUrl: identity.pictureUrl,
    role: "user",
    status: "online",
    lastActiveAt: Date.now(),
  });

  // T008: Enroll new user in all "all_teams" course channels
  await ctx.scheduler.runAfter(
    0,
    internal.channels.courseChannelCreation.enrollUserInAllTeamsChannels,
    { userId }
  );

  return await ctx.db.get(userId);
}

/**
 * Get the current authenticated user or throw an error.
 * Use this in functions that require authentication.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Unauthorized: Authentication required");
  }
  return user;
}

/**
 * Get the current authenticated admin user or throw an error.
 * Use this in functions that require admin access.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}

/**
 * Check if the current user is the specified user or an admin.
 * Use this for operations that can be done by the user themselves or an admin.
 */
export async function requireSelfOrAdmin(
  ctx: QueryCtx | MutationCtx,
  targetUserId: Doc<"users">["_id"]
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user._id !== targetUserId && user.role !== "admin") {
    throw new Error("Forbidden: You can only access your own data");
  }
  return user;
}

/**
 * Require the current user to be an active member of a channel.
 * Use this in functions that require channel membership (e.g., sending messages,
 * viewing private channel content).
 *
 * Throws if:
 * - User is not authenticated
 * - User is not an active member of the channel (left or banned)
 *
 * @param ctx - Query or mutation context
 * @param channelId - The channel to check membership for
 * @returns The authenticated user document
 */
export async function requireChannelMember(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);

  const isMember = await isChannelMember(ctx, channelId, user._id);
  if (!isMember) {
    throw new Error("Forbidden: Channel membership required");
  }

  return user;
}

/**
 * Require the current user to have admin role or higher in a channel.
 * Use this in functions that require channel administration privileges
 * (e.g., managing members, updating channel settings, deleting messages).
 *
 * Admin access is granted if:
 * - User is a global admin (user.role === "admin")
 * - User has admin or owner role in the channel
 * - User has admin privileges via channelAdmins table
 *
 * Throws if:
 * - User is not authenticated
 * - User doesn't have admin-level access to the channel
 *
 * @param ctx - Query or mutation context
 * @param channelId - The channel to check admin access for
 * @returns The authenticated user document
 */
export async function requireChannelAdmin(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);

  const isAdmin = await hasChannelRole(ctx, channelId, user._id, "admin");
  if (!isAdmin) {
    throw new Error("Forbidden: Channel admin access required");
  }

  return user;
}
