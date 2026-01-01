import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { Id } from "./_generated/dataModel";

// Type workaround: Use require() to avoid TS2589 deep type instantiation on 'internal'
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { internal } = require("./_generated/api") as { internal: any };

// ============================================================================
// GDPR Data Export & Deletion Requests
// ============================================================================

/**
 * Export file expires after 7 days.
 */
export const EXPORT_EXPIRY_DAYS = 7;

/**
 * Maximum pending requests per user.
 */
export const MAX_PENDING_REQUESTS = 1;

/**
 * Cooldown between requests (24 hours in milliseconds).
 */
export const REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Number of requests to process per cron invocation.
 */
export const BATCH_SIZE = 10;

/**
 * Maximum retry attempts for failed requests.
 */
export const MAX_RETRY_COUNT = 3;

// ============================================================================
// Mutations
// ============================================================================

/**
 * Request export of all user data (GDPR Article 20 - Data Portability).
 *
 * Creates a new GDPR export request for the authenticated user.
 * The request will be processed asynchronously and the user will be
 * able to download their data once processing is complete.
 *
 * Constraints:
 * - User can only have one pending/processing request at a time
 * - 24-hour cooldown between completed requests
 *
 * @returns Object containing success status, optional requestId, and optional error message
 */
export const requestDataExport = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    requestId: v.optional(v.id("gdprRequests")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Check for existing pending or processing requests
    const existingActiveRequest = await ctx.db
      .query("gdprRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "processing")
        )
      )
      .first();

    if (existingActiveRequest) {
      return {
        success: false,
        error: `You already have a ${existingActiveRequest.status} export request. Please wait for it to complete.`,
      };
    }

    // Check cooldown period since last completed request
    const now = Date.now();
    const lastCompletedRequest = await ctx.db
      .query("gdprRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "export"),
          q.eq(q.field("status"), "completed")
        )
      )
      .order("desc")
      .first();

    if (lastCompletedRequest && lastCompletedRequest.completedAt) {
      const timeSinceLastRequest = now - lastCompletedRequest.completedAt;
      if (timeSinceLastRequest < REQUEST_COOLDOWN_MS) {
        const remainingMs = REQUEST_COOLDOWN_MS - timeSinceLastRequest;
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        return {
          success: false,
          error: `Please wait ${remainingHours} hour(s) before requesting another export.`,
        };
      }
    }

    // Create new GDPR export request
    const requestId = await ctx.db.insert("gdprRequests", {
      userId: user._id,
      type: "export",
      status: "pending",
      requestedAt: now,
      retryCount: 0,
    });

    return {
      success: true,
      requestId,
    };
  },
});

/**
 * Request account deletion (GDPR Article 17 - Right to Erasure).
 *
 * Creates a new GDPR deletion request for the authenticated user.
 * The request will be processed asynchronously and all user data
 * will be permanently deleted or anonymized.
 *
 * Constraints:
 * - User can only have one pending/processing deletion request at a time
 * - 24-hour cooldown after a completed deletion request
 *
 * @returns Object containing success status, optional requestId, and optional error message
 */
export const requestAccountDeletion = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    requestId: v.optional(v.id("gdprRequests")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Check for existing pending or processing deletion requests
    const existingActiveRequest = await ctx.db
      .query("gdprRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "deletion"),
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "processing")
          )
        )
      )
      .first();

    if (existingActiveRequest) {
      return {
        success: false,
        error: `You already have a ${existingActiveRequest.status} deletion request. Please wait for it to complete.`,
      };
    }

    // Check cooldown period since last completed deletion request
    const now = Date.now();
    const lastCompletedRequest = await ctx.db
      .query("gdprRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "deletion"),
          q.eq(q.field("status"), "completed")
        )
      )
      .order("desc")
      .first();

    if (lastCompletedRequest && lastCompletedRequest.completedAt) {
      const timeSinceLastRequest = now - lastCompletedRequest.completedAt;
      if (timeSinceLastRequest < REQUEST_COOLDOWN_MS) {
        const remainingMs = REQUEST_COOLDOWN_MS - timeSinceLastRequest;
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        return {
          success: false,
          error: `Please wait ${remainingHours} hour(s) before requesting another deletion.`,
        };
      }
    }

    // Create new GDPR deletion request
    const requestId = await ctx.db.insert("gdprRequests", {
      userId: user._id,
      type: "deletion",
      status: "pending",
      requestedAt: now,
      retryCount: 0,
    });

    return {
      success: true,
      requestId,
    };
  },
});

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all GDPR requests for the current authenticated user.
 *
 * Returns a list of the user's data export and deletion requests,
 * sorted by request time (newest first).
 *
 * @returns Array of GDPR request objects with status and timing information
 */
export const getMyRequests = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("gdprRequests"),
      type: v.union(v.literal("export"), v.literal("deletion")),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      requestedAt: v.number(),
      completedAt: v.optional(v.number()),
      exportExpiresAt: v.optional(v.number()),
      error: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const requests = await ctx.db
      .query("gdprRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return requests.map((request) => ({
      _id: request._id,
      type: request.type,
      status: request.status,
      requestedAt: request.requestedAt,
      completedAt: request.completedAt,
      exportExpiresAt: request.exportExpiresAt,
      error: request.error,
    }));
  },
});

/**
 * Get download URL for a completed GDPR data export.
 *
 * Validates that:
 * - The request belongs to the authenticated user
 * - The request is completed with an export file
 * - The export has not expired
 *
 * @param requestId - The GDPR request ID to get the download URL for
 * @returns Object with success status and either the download URL or error message
 */
export const getExportDownloadUrl = query({
  args: {
    requestId: v.id("gdprRequests"),
  },
  returns: v.union(
    v.object({ success: v.literal(true), url: v.string() }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, { requestId }) => {
    const user = await requireAuth(ctx);

    const request = await ctx.db.get(requestId);

    // Check request exists
    if (!request) {
      return {
        success: false as const,
        error: "Export request not found",
      };
    }

    // Check user owns this request
    if (request.userId !== user._id) {
      return {
        success: false as const,
        error: "Forbidden: This request does not belong to you",
      };
    }

    // Check request type is export
    if (request.type !== "export") {
      return {
        success: false as const,
        error: "This request is not an export request",
      };
    }

    // Check request is completed
    if (request.status !== "completed") {
      return {
        success: false as const,
        error: `Export is not ready. Current status: ${request.status}`,
      };
    }

    // Check export file exists
    if (!request.exportFileId) {
      return {
        success: false as const,
        error: "Export file not found. The export may have failed.",
      };
    }

    // Check export has not expired
    const now = Date.now();
    if (request.exportExpiresAt && request.exportExpiresAt < now) {
      return {
        success: false as const,
        error: "Export has expired. Please request a new export.",
      };
    }

    // Get download URL from storage
    const url = await ctx.storage.getUrl(request.exportFileId);

    if (!url) {
      return {
        success: false as const,
        error: "Could not generate download URL. The file may have been deleted.",
      };
    }

    return {
      success: true as const,
      url,
    };
  },
});

// ============================================================================
// Internal Functions (Cron Jobs)
// ============================================================================

/**
 * Get pending GDPR requests for processing.
 * Internal query to fetch pending requests for the processing action.
 */
export const getPendingRequests = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("gdprRequests"),
      userId: v.id("users"),
      type: v.union(v.literal("export"), v.literal("deletion")),
      retryCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const pendingRequests = await ctx.db
      .query("gdprRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(BATCH_SIZE);

    return pendingRequests.map((r) => ({
      _id: r._id,
      userId: r.userId,
      type: r.type,
      retryCount: r.retryCount,
    }));
  },
});

/**
 * Collect user data for export.
 * Internal query to gather all user-related data from the database.
 */
export const collectUserDataForExport = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    user: v.object({
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.string(),
      status: v.string(),
      customStatus: v.optional(v.string()),
      customStatusEmoji: v.optional(v.string()),
    }),
    messages: v.array(
      v.object({
        content: v.string(),
        createdAt: v.number(),
        channelId: v.optional(v.string()),
        conversationId: v.optional(v.string()),
      })
    ),
    reactions: v.array(
      v.object({
        emoji: v.string(),
        messageId: v.string(),
        createdAt: v.number(),
      })
    ),
    bookmarks: v.array(
      v.object({
        messageId: v.string(),
        note: v.optional(v.string()),
        createdAt: v.number(),
      })
    ),
    progress: v.array(
      v.object({
        lessonId: v.string(),
        status: v.string(),
        completedAt: v.optional(v.number()),
        timeSpent: v.number(),
      })
    ),
    quizAttempts: v.array(
      v.object({
        quizConfigId: v.string(),
        score: v.number(),
        maxScore: v.number(),
        passed: v.boolean(),
        submittedAt: v.number(),
      })
    ),
    comments: v.array(
      v.object({
        content: v.string(),
        courseId: v.optional(v.string()),
        lessonId: v.optional(v.string()),
        createdAt: v.number(),
      })
    ),
    activityLogs: v.array(
      v.object({
        actionType: v.string(),
        category: v.string(),
        timestamp: v.number(),
      })
    ),
  }),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Collect messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .collect();

    // Collect reactions
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Collect bookmarks
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Collect progress
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Collect quiz attempts
    const quizAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Collect comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .collect();

    // Collect activity logs
    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      user: {
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        customStatus: user.customStatus,
        customStatusEmoji: user.customStatusEmoji,
      },
      messages: messages.map((m) => ({
        content: m.content,
        createdAt: m.createdAt,
        channelId: m.channelId ? String(m.channelId) : undefined,
        conversationId: m.conversationId ? String(m.conversationId) : undefined,
      })),
      reactions: reactions.map((r) => ({
        emoji: r.emoji,
        messageId: String(r.messageId),
        createdAt: r.createdAt,
      })),
      bookmarks: bookmarks.map((b) => ({
        messageId: String(b.messageId),
        note: b.note,
        createdAt: b.createdAt,
      })),
      progress: progress.map((p) => ({
        lessonId: String(p.lessonId),
        status: p.status,
        completedAt: p.completedAt,
        timeSpent: p.timeSpent,
      })),
      quizAttempts: quizAttempts.map((qa) => ({
        quizConfigId: String(qa.quizConfigId),
        score: qa.score,
        maxScore: qa.maxScore,
        passed: qa.passed,
        submittedAt: qa.submittedAt,
      })),
      comments: comments.map((c) => ({
        content: c.content,
        courseId: c.courseId ? String(c.courseId) : undefined,
        lessonId: c.lessonId ? String(c.lessonId) : undefined,
        createdAt: c.createdAt,
      })),
      activityLogs: activityLogs.map((al) => ({
        actionType: al.actionType,
        category: al.category,
        timestamp: al.timestamp,
      })),
    };
  },
});

/**
 * Mark a request as processing.
 * Internal mutation to update request status.
 */
export const markRequestProcessing = internalMutation({
  args: {
    requestId: v.id("gdprRequests"),
  },
  returns: v.null(),
  handler: async (ctx, { requestId }) => {
    await ctx.db.patch(requestId, {
      status: "processing",
      processedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Complete an export request with file reference.
 * Internal mutation to finalize export request.
 */
export const completeExportRequest = internalMutation({
  args: {
    requestId: v.id("gdprRequests"),
    storageId: v.id("_storage"),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { requestId, storageId, expiresAt }) => {
    await ctx.db.patch(requestId, {
      status: "completed",
      completedAt: Date.now(),
      exportFileId: storageId,
      exportExpiresAt: expiresAt,
    });
    return null;
  },
});

/**
 * Process deletion request - delete/anonymize all user data.
 * Internal mutation to handle account deletion.
 */
export const processDeletionRequest = internalMutation({
  args: {
    requestId: v.id("gdprRequests"),
    userId: v.id("users"),
  },
  returns: v.object({
    messagesDeleted: v.number(),
    reactionsDeleted: v.number(),
    mentionsAnonymized: v.number(),
  }),
  handler: async (ctx, { requestId, userId }) => {
    const now = Date.now();
    let messagesDeleted = 0;
    let reactionsDeleted = 0;
    let mentionsAnonymized = 0;

    // Delete all user messages (anonymize content, keep for thread integrity)
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .collect();

    for (const message of messages) {
      await ctx.db.patch(message._id, {
        content: "[Deleted by user - GDPR]",
        deletedAt: now,
        deletedBy: userId,
        anonymizedAt: now,
      });
      messagesDeleted++;
    }

    // Delete all user reactions
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const reaction of reactions) {
      await ctx.db.delete(reaction._id);
      reactionsDeleted++;
    }

    // Delete all user bookmarks
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const bookmark of bookmarks) {
      await ctx.db.delete(bookmark._id);
    }

    // Delete all user progress
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const prog of progress) {
      await ctx.db.delete(prog._id);
    }

    // Delete quiz attempts
    const quizAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const attempt of quizAttempts) {
      await ctx.db.delete(attempt._id);
    }

    // Delete comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Anonymize mentions where user is mentioned
    const mentions = await ctx.db
      .query("mentions")
      .withIndex("by_mentioned_user", (q) => q.eq("mentionedUserId", userId))
      .collect();

    for (const mention of mentions) {
      // Remove the user reference but keep the mention record
      await ctx.db.patch(mention._id, {
        mentionedUserId: undefined,
      });
      mentionsAnonymized++;
    }

    // Anonymize user record (keep ID, clear PII)
    await ctx.db.patch(userId, {
      email: `deleted-${userId}@anonymized.local`,
      name: "Deleted User",
      avatarUrl: undefined,
      customStatus: undefined,
      customStatusEmoji: undefined,
      customStatusExpiresAt: undefined,
      status: "offline" as const,
    });

    // Mark request as completed
    await ctx.db.patch(requestId, {
      status: "completed",
      completedAt: now,
      messagesDeleted,
      reactionsDeleted,
      mentionsAnonymized,
    });

    return {
      messagesDeleted,
      reactionsDeleted,
      mentionsAnonymized,
    };
  },
});

/**
 * Mark a request as failed with error.
 * Internal mutation to handle processing failures.
 */
export const markRequestFailed = internalMutation({
  args: {
    requestId: v.id("gdprRequests"),
    error: v.string(),
    retryCount: v.number(),
    isFinal: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { requestId, error, retryCount, isFinal }) => {
    if (isFinal) {
      await ctx.db.patch(requestId, {
        status: "failed",
        error: `Failed after ${MAX_RETRY_COUNT} attempts: ${error}`,
        retryCount,
      });
    } else {
      await ctx.db.patch(requestId, {
        status: "pending",
        error: `Attempt ${retryCount} failed: ${error}`,
        retryCount,
      });
    }
    return null;
  },
});

/**
 * Process pending GDPR requests (internal action called by cron).
 *
 * Handles both export and deletion requests:
 * - Export: Collects user data, creates JSON file, stores in Convex storage
 * - Deletion: Deletes/anonymizes all user data (via internal mutation)
 *
 * Processes BATCH_SIZE requests per invocation to avoid timeout.
 * Implements retry logic with MAX_RETRY_COUNT attempts.
 *
 * @returns Object with processing statistics
 */
export const processGdprRequests = internalAction({
  args: {},
  returns: v.object({
    processed: v.number(),
    succeeded: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> => {
    // Get pending requests
    const pendingRequests: Array<{
      _id: Id<"gdprRequests">;
      userId: Id<"users">;
      type: "export" | "deletion";
      retryCount: number;
    }> = await ctx.runQuery(internal.gdprRequests.getPendingRequests);

    let succeeded = 0;
    let failed = 0;

    for (const request of pendingRequests) {
      // Mark as processing
      await ctx.runMutation(internal.gdprRequests.markRequestProcessing, {
        requestId: request._id,
      });

      try {
        if (request.type === "export") {
          // Collect user data
          const userData = await ctx.runQuery(
            internal.gdprRequests.collectUserDataForExport,
            { userId: request.userId }
          );

          // Build export data structure
          const exportData = {
            exportedAt: new Date().toISOString(),
            ...userData,
          };

          // Create JSON file as Blob and store
          const jsonContent = JSON.stringify(exportData, null, 2);
          const blob = new Blob([jsonContent], { type: "application/json" });
          const storageId = await ctx.storage.store(blob);

          // Calculate expiry date (7 days)
          const expiresAt =
            Date.now() + EXPORT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

          // Complete the request
          await ctx.runMutation(internal.gdprRequests.completeExportRequest, {
            requestId: request._id,
            storageId,
            expiresAt,
          });

          succeeded++;
        } else if (request.type === "deletion") {
          // Process deletion via internal mutation
          await ctx.runMutation(internal.gdprRequests.processDeletionRequest, {
            requestId: request._id,
            userId: request.userId,
          });

          succeeded++;
        }
      } catch (error) {
        // Handle failure
        const newRetryCount = request.retryCount + 1;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        await ctx.runMutation(internal.gdprRequests.markRequestFailed, {
          requestId: request._id,
          error: errorMessage,
          retryCount: newRetryCount,
          isFinal: newRetryCount >= MAX_RETRY_COUNT,
        });

        failed++;
      }
    }

    return {
      processed: pendingRequests.length,
      succeeded,
      failed,
    };
  },
});

/**
 * Clean up expired export files (internal mutation called by cron).
 *
 * Deletes export files that have passed their exportExpiresAt timestamp.
 * Also updates the request record to remove the file reference.
 *
 * @returns Number of expired exports cleaned up
 */
export const cleanupExpiredExports = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();

    // Find completed export requests with expired files
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

    let cleanedUp = 0;

    for (const request of expiredExports) {
      if (request.exportFileId) {
        try {
          // Delete the file from storage
          await ctx.storage.delete(request.exportFileId);

          // Update request to remove file reference
          await ctx.db.patch(request._id, {
            exportFileId: undefined,
            exportExpiresAt: undefined,
          });

          cleanedUp++;
        } catch (error) {
          // Log error but continue processing other files
          console.error(
            `Failed to delete expired export file for request ${request._id}:`,
            error
          );
        }
      }
    }

    return cleanedUp;
  },
});
