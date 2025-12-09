import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

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
