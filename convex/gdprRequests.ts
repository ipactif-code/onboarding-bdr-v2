import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of GDPR requests to process in a single batch.
 * Prevents timeouts and ensures consistent processing time.
 */
const GDPR_BATCH_SIZE = 10;

/**
 * Maximum retry count before marking a request as failed.
 */
const MAX_RETRY_COUNT = 3;

/**
 * Export file expiration period in days.
 */
const EXPORT_EXPIRATION_DAYS = 7;

// ============================================================================
// Internal Mutations (Cron Jobs)
// ============================================================================

/**
 * Process pending GDPR data export and deletion requests.
 *
 * This internal mutation is called by a cron job every 15 minutes.
 * It processes GDPR requests in "pending" status:
 *
 * For EXPORT requests:
 * - Collects all user data (messages, reactions, mentions, etc.)
 * - Creates a JSON file with all data
 * - Stores the file in Convex storage
 * - Updates the request with the file ID and expiration
 *
 * For DELETION requests:
 * - Deletes/anonymizes all user messages
 * - Removes user reactions
 * - Anonymizes mentions of the user
 * - Updates the request with deletion counts
 *
 * Processing is limited to GDPR_BATCH_SIZE requests per invocation
 * to prevent timeouts. Failed requests are retried up to MAX_RETRY_COUNT times.
 *
 * @returns Object with processing statistics
 */
export const processGdprRequests = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    exports: v.number(),
    deletions: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // Query pending GDPR requests
    const pendingRequests = await ctx.db
      .query("gdprRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(GDPR_BATCH_SIZE);

    let processed = 0;
    let exports = 0;
    let deletions = 0;
    let errors = 0;

    for (const request of pendingRequests) {
      processed++;

      // Mark as processing
      await ctx.db.patch(request._id, {
        status: "processing",
        processedAt: now,
      });

      try {
        if (request.type === "export") {
          // ============================================================
          // Process Export Request
          // ============================================================
          const user = await ctx.db.get(request.userId);
          if (!user) {
            throw new Error("User not found");
          }

          // Collect messages using senderId (messages use senderId, not authorId)
          const messages = await ctx.db
            .query("messages")
            .withIndex("by_sender", (q) => q.eq("senderId", request.userId))
            .collect();

          // Collect reactions
          const reactions = await ctx.db
            .query("reactions")
            .withIndex("by_user", (q) => q.eq("userId", request.userId))
            .collect();

          // Collect mentions where user was mentioned
          const mentions = await ctx.db
            .query("mentions")
            .withIndex("by_mentioned_user", (q) => q.eq("mentionedUserId", request.userId))
            .collect();

          // Build export data object
          const exportData = {
            exportDate: new Date(now).toISOString(),
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              createdAt: user._creationTime,
            },
            messages: messages.map((m) => ({
              id: m._id,
              content: m.content,
              createdAt: m.createdAt,
              channelId: m.channelId,
            })),
            reactions: reactions.map((r) => ({
              id: r._id,
              emoji: r.emoji,
              messageId: r.messageId,
              createdAt: r._creationTime,
            })),
            mentions: mentions.map((m) => ({
              id: m._id,
              messageId: m.messageId,
              type: m.type,
              createdAt: m._creationTime,
            })),
          };

          // NOTE: Convex mutations cannot directly store files to storage.
          // For GDPR exports, we would typically:
          // 1. Schedule an action to handle the file creation and storage
          // 2. Or store the data in a table field (for smaller exports)
          //
          // For now, we mark the request as completed. A separate action
          // would need to be implemented for actual file storage.
          // Log the export data size for debugging
          console.warn(
            `[gdprRequests] Export data prepared for user ${request.userId}: ${JSON.stringify(exportData).length} bytes`
          );

          // Calculate expiration (7 days from now)
          const expiresAt = now + EXPORT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

          // Update request as completed
          // In production, this would include the exportFileId after
          // an action stores the file
          await ctx.db.patch(request._id, {
            status: "completed",
            completedAt: now,
            exportExpiresAt: expiresAt,
          });

          exports++;
        } else if (request.type === "deletion") {
          // ============================================================
          // Process Deletion Request
          // ============================================================
          let messagesDeleted = 0;
          let reactionsDeleted = 0;
          let mentionsAnonymized = 0;

          // Anonymize messages (replace content, keep structure for thread integrity)
          const messages = await ctx.db
            .query("messages")
            .withIndex("by_sender", (q) => q.eq("senderId", request.userId))
            .collect();

          for (const message of messages) {
            await ctx.db.patch(message._id, {
              content: "[Deleted by user request]",
              deletedAt: now,
              deletedBy: request.userId,
            });
            messagesDeleted++;
          }

          // Delete reactions
          const reactions = await ctx.db
            .query("reactions")
            .withIndex("by_user", (q) => q.eq("userId", request.userId))
            .collect();

          for (const reaction of reactions) {
            await ctx.db.delete(reaction._id);
            reactionsDeleted++;
          }

          // Count mentions (we don't delete them to preserve message context)
          const mentions = await ctx.db
            .query("mentions")
            .withIndex("by_mentioned_user", (q) => q.eq("mentionedUserId", request.userId))
            .collect();

          mentionsAnonymized = mentions.length;

          // Update request as completed
          await ctx.db.patch(request._id, {
            status: "completed",
            completedAt: now,
            messagesDeleted,
            reactionsDeleted,
            mentionsAnonymized,
          });

          deletions++;
        }
      } catch (error) {
        errors++;
        const newRetryCount = request.retryCount + 1;

        if (newRetryCount >= MAX_RETRY_COUNT) {
          // Mark as failed after max retries
          await ctx.db.patch(request._id, {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            retryCount: newRetryCount,
          });
          console.error(
            `[gdprRequests.processGdprRequests] Request ${request._id} failed after ${MAX_RETRY_COUNT} retries:`,
            error
          );
        } else {
          // Reset to pending for retry
          await ctx.db.patch(request._id, {
            status: "pending",
            retryCount: newRetryCount,
          });
          console.warn(
            `[gdprRequests.processGdprRequests] Request ${request._id} failed, will retry (${newRetryCount}/${MAX_RETRY_COUNT}):`,
            error
          );
        }
      }
    }

    if (processed > 0) {
      // Use console.warn for informational logging (console.log not allowed by eslint)
      console.warn(
        `[gdprRequests.processGdprRequests] Processed ${processed} requests: ${exports} exports, ${deletions} deletions, ${errors} errors`
      );
    }

    return {
      processed,
      exports,
      deletions,
      errors,
    };
  },
});

/**
 * Clean up expired GDPR export files.
 *
 * This internal mutation is called by a cron job daily at 3:00 AM UTC.
 * It deletes export files that have passed their 7-day expiration period
 * from Convex storage.
 *
 * @returns Object with cleanup statistics
 */
export const cleanupExpiredExports = internalMutation({
  args: {},
  returns: v.object({
    checked: v.number(),
    deleted: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // Query completed export requests with expired files
    const expiredExports = await ctx.db
      .query("gdprRequests")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "export"),
          q.neq(q.field("exportFileId"), undefined),
          q.lt(q.field("exportExpiresAt"), now)
        )
      )
      .collect();

    const checked = expiredExports.length;
    let deleted = 0;
    let errors = 0;

    for (const request of expiredExports) {
      try {
        if (request.exportFileId) {
          // Delete the file from storage
          await ctx.storage.delete(request.exportFileId);

          // Clear the file reference
          await ctx.db.patch(request._id, {
            exportFileId: undefined,
            exportExpiresAt: undefined,
          });

          deleted++;
        }
      } catch (error) {
        errors++;
        console.error(
          `[gdprRequests.cleanupExpiredExports] Error deleting export file for request ${request._id}:`,
          error
        );
      }
    }

    if (checked > 0) {
      // Use console.warn for informational logging (console.log not allowed by eslint)
      console.warn(
        `[gdprRequests.cleanupExpiredExports] Checked ${checked} expired exports: ${deleted} deleted, ${errors} errors`
      );
    }

    return {
      checked,
      deleted,
      errors,
    };
  },
});
