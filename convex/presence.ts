import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
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

/**
 * Fetch presence data for multiple users at once.
 *
 * Returns full presence information including status, lastActiveAt, and custom status fields.
 * Status is computed based on activity:
 * - "dnd" status is always respected (manual override)
 * - Active within ONLINE_THRESHOLD (60s) -> "online"
 * - Active within AWAY_THRESHOLD (5min) -> "away"
 * - Otherwise -> "offline"
 *
 * @param userIds - Array of user IDs to fetch presence data for
 * @returns Array of presence objects with userId, computed status, timestamps, and custom status
 */
export const getMultiple = query({
  args: {
    userIds: v.array(v.id("users")),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      status: statusValidator,
      lastActiveAt: v.optional(v.number()),
      customStatus: v.optional(v.string()),
      customStatusEmoji: v.optional(v.string()),
      customStatusExpiresAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const now = Date.now();
    const results: Array<{
      userId: Id<"users">;
      status: "online" | "offline" | "away" | "dnd";
      lastActiveAt: number | undefined;
      customStatus: string | undefined;
      customStatusEmoji: string | undefined;
      customStatusExpiresAt: number | undefined;
    }> = [];

    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);

      if (!user) {
        // User not found - treat as offline with no custom status
        results.push({
          userId,
          status: "offline",
          lastActiveAt: undefined,
          customStatus: undefined,
          customStatusEmoji: undefined,
          customStatusExpiresAt: undefined,
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

      // Check if custom status has expired
      const customStatusExpired =
        user.customStatusExpiresAt !== undefined &&
        user.customStatusExpiresAt < now;

      results.push({
        userId,
        status: computedStatus,
        lastActiveAt: user.lastActiveAt,
        customStatus: customStatusExpired ? undefined : user.customStatus,
        customStatusEmoji: customStatusExpired
          ? undefined
          : user.customStatusEmoji,
        customStatusExpiresAt: customStatusExpired
          ? undefined
          : user.customStatusExpiresAt,
      });
    }

    return results;
  },
});

/**
 * Get all currently online users (for @here mentions).
 *
 * Returns users who are either:
 * - Status explicitly set to "online", OR
 * - Have been active within the last 5 minutes (AWAY_THRESHOLD)
 *
 * This is useful for @here mentions which should notify all "active" users.
 *
 * @returns Array of objects with userId and name for each online user
 */
export const getOnlineUsers = query({
  args: {},
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
    })
  ),
  handler: async (ctx) => {
    await requireAuth(ctx);

    const now = Date.now();
    const cutoffTime = now - AWAY_THRESHOLD;

    // Get all users with "online" status
    const onlineByStatus = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "online"))
      .collect();

    // Get all users who were recently active using the lastActiveAt index
    // We need to filter for those active within the threshold
    const recentlyActive = await ctx.db
      .query("users")
      .withIndex("by_last_active")
      .filter((q) =>
        q.and(
          q.neq(q.field("lastActiveAt"), undefined),
          q.gte(q.field("lastActiveAt"), cutoffTime)
        )
      )
      .collect();

    // Merge results and deduplicate by user ID
    const userMap = new Map<
      string,
      { userId: Id<"users">; name: string }
    >();

    for (const user of onlineByStatus) {
      userMap.set(user._id, {
        userId: user._id,
        name: user.name,
      });
    }

    for (const user of recentlyActive) {
      if (!userMap.has(user._id)) {
        userMap.set(user._id, {
          userId: user._id,
          name: user.name,
        });
      }
    }

    return Array.from(userMap.values());
  },
});

// ============================================================================
// Internal Mutations (Cron Jobs)
// ============================================================================

/**
 * Internal mutation to auto-set "away" for inactive users.
 *
 * This function is called by a cron job every minute to check for users
 * who have been inactive for more than 5 minutes (AWAY_THRESHOLD) but
 * still have their status set to "online".
 *
 * These users are automatically transitioned to "away" status.
 *
 * @returns Number of users whose status was updated to "away"
 */
export const checkInactiveUsers = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - AWAY_THRESHOLD;

    // Find all users with "online" status
    const onlineUsers = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "online"))
      .collect();

    let updatedCount = 0;

    for (const user of onlineUsers) {
      // Check if user has been inactive for too long
      const lastActive = user.lastActiveAt ?? 0;
      if (lastActive < cutoffTime) {
        await ctx.db.patch(user._id, { status: "away" });
        updatedCount++;
      }
    }

    return updatedCount;
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Update the current user's presence heartbeat.
 *
 * CLIENT CONTRACT: This mutation MUST be called every 30 seconds by the client
 * to maintain accurate presence status. The client should:
 * 1. Start a 30-second interval timer on mount
 * 2. Call this mutation on each interval tick
 * 3. Clear the interval on unmount (and optionally call goOffline)
 *
 * Behavior:
 * - Updates lastActiveAt timestamp to current time
 * - If user's status is "offline", auto-sets status to "online"
 * - Preserves "away" and "dnd" status as these are manual overrides
 *
 * The server uses this timestamp to compute effective status:
 * - Active within 60s = "online"
 * - Active within 5min = "away"
 * - Otherwise = "offline"
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
 * - "offline": User has explicitly gone offline
 *
 * Setting any status also updates lastActiveAt to the current time.
 *
 * @param status - The desired status ("online", "away", "dnd", or "offline")
 */
export const setStatus = mutation({
  args: {
    status: statusValidator,
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

/**
 * Set a custom status message and emoji for the current user.
 *
 * Custom status allows users to display a personalized message (e.g., "In a meeting",
 * "On vacation") along with an optional emoji. The status can optionally expire
 * at a specified time.
 *
 * @param text - Optional custom status text (max 100 characters)
 * @param emoji - Optional emoji to display with the status
 * @param expiresAt - Optional Unix timestamp (milliseconds) when the status should auto-clear
 */
export const setCustomStatus = mutation({
  args: {
    text: v.optional(v.string()),
    emoji: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate text length if provided
    if (args.text !== undefined && args.text.length > 100) {
      throw new Error("Custom status text must be 100 characters or less");
    }

    await ctx.db.patch(user._id, {
      customStatus: args.text,
      customStatusEmoji: args.emoji,
      customStatusExpiresAt: args.expiresAt,
    });

    return null;
  },
});

/**
 * Clear the current user's custom status.
 *
 * Removes the custom status text, emoji, and expiration time.
 * This does not affect the user's online/offline/away/dnd status.
 */
export const clearCustomStatus = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    await ctx.db.patch(user._id, {
      customStatus: undefined,
      customStatusEmoji: undefined,
      customStatusExpiresAt: undefined,
    });

    return null;
  },
});

/**
 * Set the current user's status to offline.
 *
 * This mutation is designed to be called from the client's beforeunload event
 * when the user is closing the browser tab or navigating away. It immediately
 * sets the user's status to "offline" to provide accurate presence information
 * to other users.
 *
 * Note: This is a best-effort call from beforeunload - it may not always succeed
 * due to browser limitations on synchronous requests during page unload.
 */
export const goOffline = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    await ctx.db.patch(user._id, {
      status: "offline",
    });

    return null;
  },
});
