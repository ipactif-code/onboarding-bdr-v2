import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { isChannelMember, hasChannelRole } from "./permissions";

// Type workaround: Use require() to avoid TS2589 deep type instantiation on 'internal'
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { internal } = require("../_generated/api") as { internal: any };

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

/**
 * User type returned from internal query (for action contexts).
 */
type UserFromInternalQuery = {
  _id: string;
  clerkId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: "user" | "admin";
} | null;

/**
 * Verify admin access in an action context.
 * Actions cannot use ctx.db directly, so we use internal queries.
 *
 * Use this in actions that require admin access. It performs the same
 * checks as requireAdmin but works with ActionCtx instead of QueryCtx/MutationCtx.
 *
 * @param ctx - Action context
 * @returns The authenticated admin user document
 * @throws Error if not authenticated, user not found, or not an admin
 */
export async function requireAdminInAction(ctx: ActionCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: Authentication required");
  }

  const user: UserFromInternalQuery = await ctx.runQuery(
    internal.users.getByClerkIdInternal,
    { clerkId: identity.subject }
  );

  if (!user) {
    throw new Error("Unauthorized: User not found");
  }

  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }

  // Return as Doc<"users"> - the internal query returns the same structure
  return user as unknown as Doc<"users">;
}
