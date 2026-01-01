import { v, Infer } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { requireAuth } from "../lib/auth";
import { canAccessChannel } from "../lib/permissions";
import {
  channelMessageWithSenderValidator,
  getReactionsForMessages,
  getHasAttachmentsForMessages,
} from "./helpers";

// Re-export listThreadsWithActivity for backward compatibility
export { listThreadsWithActivity } from "./channelThreadListQueries";

// ============================================================================
// Thread Queries
// ============================================================================

/**
 * Get a thread with its parent message and all replies.
 * Returns the parent message and all thread replies sorted by createdAt ASC.
 * T080.1: Thread view support for channel messages.
 */
export const getThread = query({
  args: {
    parentMessageId: v.id("messages"),
  },
  returns: v.union(
    v.object({
      parent: channelMessageWithSenderValidator,
      replies: v.array(channelMessageWithSenderValidator),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get parent message
    const parentMessage = await ctx.db.get(args.parentMessageId);
    if (!parentMessage) {
      return null;
    }

    // Parent must be a channel message (not a conversation message)
    if (!parentMessage.channelId) {
      throw new Error("Invalid thread: Parent message must be a channel message");
    }

    // Parent should not itself be a reply (must be a top-level message)
    if (parentMessage.parentId) {
      throw new Error("Invalid thread: Cannot get thread from a reply message");
    }

    // Check user has access to the channel
    const hasAccess = await canAccessChannel(
      ctx,
      parentMessage.channelId,
      user._id
    );
    if (!hasAccess) {
      throw new Error("Forbidden: You do not have access to this channel");
    }

    // Get all thread replies using by_parent_time index (sorted ASC by createdAt)
    const replies = await ctx.db
      .query("messages")
      .withIndex("by_parent_time", (q) => q.eq("parentId", args.parentMessageId))
      .order("asc")
      .filter((q) => q.eq(q.field("deletedAt"), undefined)) // Exclude soft-deleted
      .collect();

    // Collect all unique sender IDs for batch fetching (parent + replies)
    const senderIds = new Set<string>();
    senderIds.add(parentMessage.senderId);
    for (const reply of replies) {
      senderIds.add(reply.senderId);
    }

    // Batch fetch all senders
    const senderPromises = [...senderIds].map((id) =>
      ctx.db.get(id as typeof parentMessage.senderId)
    );
    const senders = await Promise.all(senderPromises);
    const senderMap = new Map(
      senders
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s])
    );

    // Collect all unique lesson IDs for batch fetching
    const lessonIds = new Set<string>();
    if (parentMessage.lessonId) {
      lessonIds.add(parentMessage.lessonId);
    }
    for (const reply of replies) {
      if (reply.lessonId) {
        lessonIds.add(reply.lessonId);
      }
    }

    // Batch fetch all lessons
    const lessonPromises = [...lessonIds].map((id) =>
      ctx.db.get(id as Id<"lessons">)
    );
    const lessons = await Promise.all(lessonPromises);
    const lessonMap = new Map(
      lessons
        .filter((l): l is NonNullable<typeof l> => l !== null)
        .map((l) => [l._id, { _id: l._id, title: l.title }])
    );

    // T108: Batch fetch reactions for parent and all replies in parallel
    const allMessageIds = [parentMessage._id, ...replies.map((r) => r._id)];
    const reactionsMap = await getReactionsForMessages(ctx, allMessageIds);

    // T004: Batch check for attachments on all messages in parallel
    const attachmentsMap = await getHasAttachmentsForMessages(ctx, allMessageIds);

    // Helper function to hydrate a message with sender, lesson, reactions, and attachments info
    const hydrateMessage = (
      message: typeof parentMessage
    ): Infer<typeof channelMessageWithSenderValidator> => {
      const sender = senderMap.get(message.senderId);
      const lesson = message.lessonId ? lessonMap.get(message.lessonId) : undefined;
      const reactions = reactionsMap.get(message._id.toString()) ?? [];
      const hasAttachments = attachmentsMap.get(message._id.toString()) ?? false;

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
        lesson,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        isEdited: message.isEdited,
        deletedAt: message.deletedAt,
        reactionCount: message.reactionCount,
        // T108: Include grouped reactions
        reactions,
        status: message.status,
        // T004: Include attachment status
        hasAttachments,
      };
    };

    return {
      parent: hydrateMessage(parentMessage),
      replies: replies.map(hydrateMessage),
    };
  },
});
