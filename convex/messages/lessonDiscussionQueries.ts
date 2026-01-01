import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { canAccessChannel } from "../lib/permissions";
import {
  channelMessageWithSenderValidator,
  getHasAttachmentsForMessages,
} from "./helpers";

// ============================================================================
// Lesson Discussion Queries
// ============================================================================

/**
 * Get messages linked to a specific lesson within a course channel.
 *
 * T062: Returns lesson discussion messages with sender info, sorted by createdAt.
 * T001-T002: Includes lesson data for each message.
 * Includes threadReplyCount for thread indicators.
 * User must have access to the course channel.
 *
 * @param courseId - The ID of the course
 * @param lessonId - The ID of the lesson
 * @returns Array of messages with sender information
 */
export const getLessonDiscussion = query({
  args: {
    courseId: v.id("courses"),
    lessonId: v.id("lessons"),
    limit: v.optional(v.number()),
    before: v.optional(v.number()), // Cursor: get messages before this timestamp
  },
  returns: v.object({
    messages: v.array(channelMessageWithSenderValidator),
    hasMore: v.boolean(),
    channelId: v.union(v.id("channels"), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Find the course channel
    const channel = await ctx.db
      .query("channels")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .unique();

    if (!channel) {
      // No channel exists for this course
      return { messages: [], hasMore: false, channelId: null };
    }

    // Check user has access to the course channel
    const hasAccess = await canAccessChannel(ctx, channel._id, user._id);
    if (!hasAccess) {
      throw new Error("Forbidden: You do not have access to this course channel");
    }

    const limit = Math.min(args.limit ?? 50, 100);

    // T001-T002: Fetch the lesson data once (all messages have same lessonId)
    const lessonDoc = await ctx.db.get(args.lessonId);
    const lesson = lessonDoc
      ? { _id: lessonDoc._id, title: lessonDoc.title }
      : undefined;

    // Query messages by lessonId using the by_lesson index
    // Then filter by channelId to ensure we only get messages from this course channel
    const allLessonMessages = await ctx.db
      .query("messages")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();

    // Filter to only messages in this channel and apply cursor
    // Exclude thread replies (messages with parentId) - they should only appear in thread view
    let filteredMessages = allLessonMessages.filter(
      (m) => m.channelId === channel._id && !m.deletedAt && !m.parentId
    );

    // Apply cursor if provided
    if (args.before) {
      filteredMessages = filteredMessages.filter(
        (m) => m.createdAt < args.before!
      );
    }

    // Sort by createdAt ascending (oldest first for discussions)
    filteredMessages.sort((a, b) => a.createdAt - b.createdAt);

    // Apply pagination
    const hasMore = filteredMessages.length > limit;
    const resultMessages = filteredMessages.slice(0, limit);

    // T004: Batch check for attachments on all messages in parallel
    const messageIds = resultMessages.map((m) => m._id);
    const attachmentsMap = await getHasAttachmentsForMessages(ctx, messageIds);

    // Get sender info for each message
    const result = await Promise.all(
      resultMessages.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);

        return {
          _id: message._id,
          channelId: message.channelId,
          conversationId: message.conversationId,
          senderId: message.senderId,
          sender: sender
            ? {
                _id: sender._id,
                name: sender.name,
                avatarUrl: sender.avatarUrl,
                status: sender.status,
              }
            : {
                _id: message.senderId,
                name: "Unknown User",
                avatarUrl: undefined,
                status: "offline" as const,
              },
          content: message.content,
          contentType: message.contentType,
          parentId: message.parentId,
          threadReplyCount: message.threadReplyCount,
          threadLastReplyAt: message.threadLastReplyAt,
          lessonId: message.lessonId,
          // T001-T002: Include lesson data (same for all messages in this query)
          lesson,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          isEdited: message.isEdited,
          deletedAt: message.deletedAt,
          reactionCount: message.reactionCount,
          status: message.status,
          // T004: Include attachment status
          hasAttachments: attachmentsMap.get(message._id.toString()) ?? false,
        };
      })
    );

    return {
      messages: result,
      hasMore,
      channelId: channel._id,
    };
  },
});
