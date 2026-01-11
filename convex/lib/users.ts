import { QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

/**
 * Hydrated user info for display purposes.
 * Used when returning user data alongside comments, mentions, or reactions.
 */
export type HydratedUser = {
  _id: Id<"users">;
  name: string;
  avatarUrl?: string;
};

/**
 * Batch-fetch user information for efficient hydration.
 * Handles deduplication of user IDs and returns a Map for O(1) lookups.
 *
 * Use this helper when you need to hydrate multiple user references
 * (e.g., authors in a list of comments) to avoid N+1 query patterns.
 *
 * @param ctx - Query context with database access
 * @param userIds - Array of user IDs (may contain duplicates)
 * @returns Map of user ID to hydrated user info. Missing users return "Unknown User" placeholder.
 *
 * @example
 * ```typescript
 * const authorIds = comments.map(c => c.authorId);
 * const usersMap = await hydrateUsers(ctx, authorIds);
 *
 * const hydratedComments = comments.map(c => ({
 *   ...c,
 *   author: usersMap.get(c.authorId) ?? { _id: c.authorId, name: "Unknown" }
 * }));
 * ```
 */
export async function hydrateUsers(
  ctx: QueryCtx,
  userIds: Id<"users">[]
): Promise<Map<Id<"users">, HydratedUser>> {
  // Return empty map if no user IDs provided
  if (userIds.length === 0) {
    return new Map();
  }

  // Deduplicate user IDs using Set and Array.from for compatibility
  const uniqueUserIds = Array.from(new Set(userIds));

  // Batch fetch all users in parallel
  const userPromises = uniqueUserIds.map((userId) => ctx.db.get(userId));
  const users = await Promise.all(userPromises);

  // Build the result map
  const usersMap = new Map<Id<"users">, HydratedUser>();

  for (let i = 0; i < uniqueUserIds.length; i++) {
    const userId = uniqueUserIds[i]!; // Assert non-null since we control array bounds
    const user = users[i] as Doc<"users"> | null;

    // Handle missing users gracefully with "Unknown User" placeholder
    usersMap.set(userId, {
      _id: userId,
      name: user?.name ?? "Unknown User",
      avatarUrl: user?.avatarUrl,
    });
  }

  return usersMap;
}

/**
 * Hydrate a single user by ID.
 * Convenience wrapper around hydrateUsers for single user lookups.
 *
 * @param ctx - Query context with database access
 * @param userId - User ID to hydrate
 * @returns Hydrated user info with fallback for missing users
 */
export async function hydrateUser(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<HydratedUser> {
  const usersMap = await hydrateUsers(ctx, [userId]);
  return usersMap.get(userId) ?? { _id: userId, name: "Unknown User" };
}
