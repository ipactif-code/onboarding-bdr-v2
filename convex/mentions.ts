import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// Re-export queries for backward compatibility
export { getMentionsForUser, getUnreadMentionCount } from "./mentionQueries";

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of pending mentions to process in a single batch.
 * Prevents timeouts and ensures consistent processing time.
 */
const MENTION_BATCH_SIZE = 100;

// ============================================================================
// Mutations
// ============================================================================

/**
 * Mark a mention as read by setting the notifiedAt timestamp.
 * Only the mentioned user can mark their own mentions as read.
 *
 * @param mentionId - The ID of the mention to mark as read
 * @throws Error if user is not authenticated
 * @throws Error if mention does not exist
 * @throws Error if user is not the mentioned user (security check)
 */
export const markMentionAsRead = mutation({
  args: {
    mentionId: v.id("mentions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);

    // Get the mention
    const mention = await ctx.db.get(args.mentionId);
    if (!mention) {
      throw new Error("Mention not found");
    }

    // Security check: only the mentioned user can mark as read
    if (mention.mentionedUserId !== currentUser._id) {
      throw new Error("Forbidden: You can only mark your own mentions as read");
    }

    // Mark as read by setting notifiedAt timestamp
    await ctx.db.patch(args.mentionId, {
      notifiedAt: Date.now(),
    });

    return null;
  },
});

// ============================================================================
// Internal Mutations (Cron Jobs)
// ============================================================================

/**
 * Process pending mention notifications (placeholder for future notification system).
 *
 * This internal mutation is called by a cron job every minute to process
 * mentions that have not yet been marked as notified (notifiedAt is undefined).
 *
 * CURRENT BEHAVIOR (Placeholder):
 * - Marks mentions as notified by setting the notifiedAt timestamp
 * - Does NOT actually send any notifications (push, email, etc.)
 *
 * FUTURE IMPLEMENTATION:
 * When a real notification system is implemented, this function should:
 * 1. Queue a notification action for push/email delivery
 * 2. Check user's notification preferences (notificationPreferences table)
 * 3. Respect DND settings (dndEnabled, dndStart, dndEnd)
 * 4. Handle @here and @everyone mentions differently
 *
 * Processing is limited to MENTION_BATCH_SIZE entries per invocation to
 * prevent timeouts and ensure consistent performance.
 *
 * NOTE: The by_user_unnotified index is designed for querying unnotified mentions
 * for a specific user. For batch processing across ALL users, we must scan the
 * table and filter. This is acceptable for a cron job that runs every minute
 * with a batch limit.
 *
 * @returns Number of mentions processed
 */
export const processPendingMentions = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();

    // Query mentions where notifiedAt is undefined (not yet notified).
    // We cannot use the by_user_unnotified index here because it requires
    // a specific mentionedUserId in the first position. For batch processing
    // across all users, we must scan and filter.
    // This is acceptable for a cron job with batch limits.
    const pendingMentions = await ctx.db
      .query("mentions")
      .filter((q) => q.eq(q.field("notifiedAt"), undefined))
      .take(MENTION_BATCH_SIZE);

    let processedCount = 0;

    for (const mention of pendingMentions) {
      // Mark the mention as notified.
      // NOTE: This is a PLACEHOLDER - no actual notification is sent.
      // In a full implementation, this is where we would:
      // 1. Queue a notification action for push/email delivery
      // 2. Check user's notification preferences
      // 3. Respect DND settings
      await ctx.db.patch(mention._id, {
        notifiedAt: now,
      });
      processedCount++;
    }

    return processedCount;
  },
});
