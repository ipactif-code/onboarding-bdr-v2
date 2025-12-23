import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";

// ============================================================================
// Constants
// ============================================================================

/**
 * Time threshold (in milliseconds) within which a user is considered "online".
 * Default: 60 seconds
 */
const ONLINE_THRESHOLD = 60 * 1000;

/**
 * Time threshold (in milliseconds) within which a user is considered "away".
 * Beyond this threshold, the user is considered "offline".
 * Default: 5 minutes
 */
const AWAY_THRESHOLD = 5 * 60 * 1000;

// ============================================================================
// Status validator (reusable)
// ============================================================================

const statusValidator = v.union(
  v.literal("online"),
  v.literal("offline"),
  v.literal("away"),
  v.literal("dnd")
);

// ============================================================================
// Queries
// ============================================================================

/**
 * Get the online status of multiple users with activity-based status computation.
 *
 * Status logic:
 * - "dnd" status is always respected (manual override)
 * - Active within ONLINE_THRESHOLD (60s) -> "online"
 * - Active within AWAY_THRESHOLD (5min) -> "away"
 * - Otherwise -> "offline"
 *
 * @param userIds - Array of user IDs to check status for
 * @returns Array of user status objects with userId, computed status, and lastActiveAt
 */
export const getOnlineStatus = query({
  args: {
    userIds: v.array(v.id("users")),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      status: statusValidator,
      lastActiveAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const now = Date.now();
    const results: Array<{
      userId: Id<"users">;
      status: "online" | "offline" | "away" | "dnd";
      lastActiveAt: number | undefined;
    }> = [];

    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);

      if (!user) {
        // User not found - treat as offline
        results.push({
          userId,
          status: "offline",
          lastActiveAt: undefined,
        });
        continue;
      }

      // Compute status based on activity
      const timeSinceActive = now - (user.lastActiveAt ?? 0);

      let computedStatus: "online" | "offline" | "away" | "dnd";

      // DND is always respected as a manual override
      if (user.status === "dnd") {
        computedStatus = "dnd";
      } else if (timeSinceActive <= ONLINE_THRESHOLD) {
        computedStatus = "online";
      } else if (timeSinceActive <= AWAY_THRESHOLD) {
        computedStatus = "away";
      } else {
        computedStatus = "offline";
      }

      results.push({
        userId,
        status: computedStatus,
        lastActiveAt: user.lastActiveAt,
      });
    }

    return results;
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Update the current user's presence (heartbeat).
 *
 * This mutation should be called periodically (every 30 seconds) by the client
 * to indicate the user is still active. It updates the lastActiveAt timestamp
 * and sets the status to "online" if the user was previously "offline".
 *
 * Note: Does not change "away" or "dnd" status as these are manual overrides.
 */
export const updatePresence = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const updates: {
      lastActiveAt: number;
      status?: "online" | "offline" | "away" | "dnd";
    } = {
      lastActiveAt: Date.now(),
    };

    // Only auto-set to "online" if user was "offline"
    // Preserve "away" and "dnd" as they are manual overrides
    if (user.status === "offline") {
      updates.status = "online";
    }

    await ctx.db.patch(user._id, updates);

    return null;
  },
});

/**
 * Manually set the current user's status.
 *
 * Allowed statuses:
 * - "online": User is active and available
 * - "away": User is temporarily away
 * - "dnd": Do Not Disturb - user does not want to be contacted
 *
 * Note: "offline" cannot be manually set - it is computed based on inactivity.
 * Setting any status also updates lastActiveAt to the current time.
 *
 * @param status - The desired status ("online", "away", or "dnd")
 */
export const setStatus = mutation({
  args: {
    status: v.union(v.literal("online"), v.literal("away"), v.literal("dnd")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await ctx.db.patch(user._id, {
      status: args.status,
      lastActiveAt: Date.now(),
    });

    return null;
  },
});
