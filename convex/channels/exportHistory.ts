/**
 * Channel History Export Action
 *
 * Implements FR-039: Export channel message history in JSON or CSV format.
 *
 * Features:
 * - Export all messages in a channel with optional date filtering
 * - Support for JSON and CSV formats
 * - Includes author name, content, timestamp, attachments info
 * - Rate limited to 1 export per 5 minutes per user
 * - Only owner/admin/moderator can export
 */

import { action, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// Type workaround: Use require() to avoid TS2589 deep type instantiation on 'internal'
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { internal } = require("../_generated/api") as { internal: any };
import {
  formatAsJSON,
  formatAsCSV,
  generateExportFilename,
  type ExportMessage,
} from "../lib/exportHelpers";

// ============================================================================
// Rate Limit Configuration
// ============================================================================

/**
 * Rate limit for channel exports: 1 export per 5 minutes per user.
 */
const EXPORT_RATE_LIMIT = {
  limit: 1,
  windowMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Roles allowed to export channel history.
 */
const EXPORT_ALLOWED_ROLES = ["owner", "admin", "moderator"];

// ============================================================================
// Internal Functions for Action Database Access
// ============================================================================

/**
 * Internal query to check and verify export permissions and rate limits.
 * Returns data needed for the export without modifying database.
 */
export const checkExportPermissions = internalQuery({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  returns: v.object({
    allowed: v.boolean(),
    error: v.optional(v.string()),
    channelName: v.optional(v.string()),
    rateLimitResetAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { allowed: false, error: "User not found" };
    }

    // Get channel
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      return { allowed: false, error: "Channel not found" };
    }

    // Get user's membership in the channel
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    // Check if user has permission (global admin OR channel role)
    let hasPermission = user.role === "admin";

    if (!hasPermission && membership) {
      // Check channel role
      if (
        membership.leftAt === undefined &&
        !membership.isBanned &&
        EXPORT_ALLOWED_ROLES.includes(membership.role)
      ) {
        hasPermission = true;
      }
    }

    // Also check channelAdmins table for additional privileges
    if (!hasPermission) {
      const adminAccess = await ctx.db
        .query("channelAdmins")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", args.channelId).eq("userId", args.userId)
        )
        .unique();

      if (adminAccess !== null) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return {
        allowed: false,
        error: "Forbidden: Only owners, admins, and moderators can export channel history",
      };
    }

    // Check rate limit
    const now = Date.now();
    const rateLimitRecord = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", args.userId).eq("type", "channel_export")
      )
      .unique();

    if (rateLimitRecord) {
      const windowEnd = rateLimitRecord.windowStart + EXPORT_RATE_LIMIT.windowMs;

      // Check if window has expired
      if (now < windowEnd && rateLimitRecord.count >= EXPORT_RATE_LIMIT.limit) {
        return {
          allowed: false,
          error: "Rate limit exceeded: You can only export once every 5 minutes",
          rateLimitResetAt: windowEnd,
        };
      }
    }

    return {
      allowed: true,
      channelName: channel.name,
    };
  },
});

/**
 * Internal query to fetch all messages for export.
 */
export const getMessagesForExport = internalQuery({
  args: {
    channelId: v.id("channels"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      senderId: v.id("users"),
      content: v.string(),
      contentType: v.optional(v.string()),
      createdAt: v.number(),
      deletedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    // Fetch messages using the by_channel_time index for efficient retrieval
    const query = ctx.db
      .query("messages")
      .withIndex("by_channel_time", (q) => q.eq("channelId", args.channelId));

    const allMessages = await query.collect();

    // Filter by date range if provided
    let filteredMessages = allMessages;

    if (args.startDate !== undefined) {
      filteredMessages = filteredMessages.filter(
        (m) => m.createdAt >= args.startDate!
      );
    }

    if (args.endDate !== undefined) {
      filteredMessages = filteredMessages.filter(
        (m) => m.createdAt <= args.endDate!
      );
    }

    // Return only the fields we need for export
    return filteredMessages.map((m) => ({
      _id: m._id,
      senderId: m.senderId,
      content: m.content,
      contentType: m.contentType,
      createdAt: m.createdAt,
      deletedAt: m.deletedAt,
    }));
  },
});

/**
 * Internal query to get user names for a list of user IDs.
 */
export const getUserNamesForExport = internalQuery({
  args: {
    userIds: v.array(v.id("users")),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const results: { userId: Id<"users">; name: string }[] = [];

    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      if (user) {
        results.push({
          userId,
          name: user.name,
        });
      } else {
        results.push({
          userId,
          name: "Deleted User",
        });
      }
    }

    return results;
  },
});

/**
 * Internal query to get attachment counts for messages.
 */
export const getAttachmentCounts = internalQuery({
  args: {
    messageIds: v.array(v.id("messages")),
  },
  returns: v.array(
    v.object({
      messageId: v.id("messages"),
      count: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const results: { messageId: Id<"messages">; count: number }[] = [];

    for (const messageId of args.messageIds) {
      const attachments = await ctx.db
        .query("messageAttachments")
        .withIndex("by_message", (q) => q.eq("messageId", messageId))
        .collect();

      results.push({
        messageId,
        count: attachments.length,
      });
    }

    return results;
  },
});

/**
 * Internal mutation to consume a rate limit request for export.
 */
export const consumeExportRateLimit = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    const existingRecord = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", args.userId).eq("type", "channel_export")
      )
      .unique();

    if (existingRecord) {
      const windowEnd = existingRecord.windowStart + EXPORT_RATE_LIMIT.windowMs;

      if (now >= windowEnd) {
        // Window expired - reset
        await ctx.db.patch(existingRecord._id, {
          windowStart: now,
          count: 1,
        });
      } else {
        // Increment count
        await ctx.db.patch(existingRecord._id, {
          count: existingRecord.count + 1,
        });
      }
    } else {
      // Create new record
      await ctx.db.insert("rateLimits", {
        userId: args.userId,
        type: "channel_export",
        windowStart: now,
        count: 1,
      });
    }

    return null;
  },
});

// ============================================================================
// Public Action
// ============================================================================

/**
 * Export channel message history in JSON or CSV format.
 *
 * FR-039: Implements channel history export with:
 * - Support for JSON and CSV formats
 * - Optional date range filtering
 * - Rate limiting (1 export per 5 minutes)
 * - Authorization (owner/admin/moderator only)
 *
 * @param channelId - The channel to export
 * @param format - Export format: "json" or "csv"
 * @param startDate - Optional: filter messages after this timestamp (ms)
 * @param endDate - Optional: filter messages before this timestamp (ms)
 * @returns Export data with suggested filename and MIME type
 */
export const exportChannelHistory = action({
  args: {
    channelId: v.id("channels"),
    format: v.union(v.literal("json"), v.literal("csv")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    data: v.string(),
    filename: v.string(),
    mimeType: v.string(),
    messageCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // 1. Authenticate user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Get user from database
    const user = await ctx.runQuery(internal.users.getByClerkIdInternal, {
      clerkId: identity.subject,
    });

    if (!user) {
      throw new Error("Unauthorized: User not found in database");
    }

    // 2. Check permissions and rate limit
    const permissionCheck = await ctx.runQuery(
      internal.channels.exportHistory.checkExportPermissions,
      {
        channelId: args.channelId,
        userId: user._id,
      }
    );

    if (!permissionCheck.allowed) {
      const errorMsg = permissionCheck.error || "Export not allowed";
      if (permissionCheck.rateLimitResetAt) {
        const resetDate = new Date(permissionCheck.rateLimitResetAt);
        throw new Error(`${errorMsg}. Try again after ${resetDate.toLocaleTimeString()}`);
      }
      throw new Error(errorMsg);
    }

    // 3. Consume rate limit BEFORE starting the export
    await ctx.runMutation(internal.channels.exportHistory.consumeExportRateLimit, {
      userId: user._id,
    });

    // 4. Fetch messages
    // Type for messages returned from internal query
    type MessageForExport = {
      _id: Id<"messages">;
      senderId: Id<"users">;
      content: string;
      contentType?: string;
      createdAt: number;
      deletedAt?: number;
    };
    const messages: MessageForExport[] = await ctx.runQuery(
      internal.channels.exportHistory.getMessagesForExport,
      {
        channelId: args.channelId,
        startDate: args.startDate,
        endDate: args.endDate,
      }
    );

    // 5. Get unique sender IDs and fetch user names
    const uniqueSenderIds = [...new Set(messages.map((m: MessageForExport) => m.senderId))];
    type UserNameResult = { userId: Id<"users">; name: string };
    const userNames: UserNameResult[] = await ctx.runQuery(
      internal.channels.exportHistory.getUserNamesForExport,
      {
        userIds: uniqueSenderIds,
      }
    );
    const userNameMap = new Map(userNames.map((u: UserNameResult) => [u.userId.toString(), u.name]));

    // 6. Get attachment counts
    const messageIds = messages.map((m: MessageForExport) => m._id);
    type AttachmentCountResult = { messageId: Id<"messages">; count: number };
    const attachmentCounts: AttachmentCountResult[] = await ctx.runQuery(
      internal.channels.exportHistory.getAttachmentCounts,
      {
        messageIds,
      }
    );
    const attachmentCountMap = new Map(
      attachmentCounts.map((a: AttachmentCountResult) => [a.messageId.toString(), a.count])
    );

    // 7. Transform to export format
    const exportMessages: ExportMessage[] = messages.map((m: MessageForExport) => {
      const attachmentCount = attachmentCountMap.get(m._id.toString()) || 0;
      return {
        id: m._id,
        author: userNameMap.get(m.senderId.toString()) || "Unknown",
        content: m.deletedAt ? "[Message deleted]" : m.content,
        timestamp: new Date(m.createdAt).toISOString(),
        hasAttachments: attachmentCount > 0,
        attachmentCount,
        isDeleted: m.deletedAt !== undefined,
        contentType: m.contentType || "text",
      };
    });

    // 8. Format the data
    const data =
      args.format === "json"
        ? formatAsJSON(exportMessages)
        : formatAsCSV(exportMessages);

    const mimeType = args.format === "json" ? "application/json" : "text/csv";
    const filename = generateExportFilename(
      permissionCheck.channelName || "channel",
      args.format
    );

    return {
      data,
      filename,
      mimeType,
      messageCount: exportMessages.length,
    };
  },
});
