import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { searchUserResultValidator } from "./helpers";

// ============================================================================
// Direct Messages - User Search Queries
// Phase 4 - User Story 2: Direct Messages
// ============================================================================

/**
 * T043: Search users by name or email for starting DMs.
 * Returns matching users excluding the current user.
 * Case-insensitive search on name and email fields.
 */
export const searchUsers = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(searchUserResultValidator),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const searchQuery = args.query.toLowerCase().trim();
    const limit = args.limit ?? 10;

    if (searchQuery.length === 0) {
      return [];
    }

    // Get all users and filter (Convex doesn't have LIKE/ILIKE support in indexes)
    // For production, consider using a search index
    const allUsers = await ctx.db.query("users").collect();

    const matchingUsers = allUsers
      .filter((u) => {
        // Exclude current user
        if (u._id === user._id) {
          return false;
        }

        // Case-insensitive search on name and email
        const nameMatch = u.name.toLowerCase().includes(searchQuery);
        const emailMatch = u.email.toLowerCase().includes(searchQuery);

        return nameMatch || emailMatch;
      })
      .slice(0, limit)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        status: u.status,
      }));

    return matchingUsers;
  },
});
