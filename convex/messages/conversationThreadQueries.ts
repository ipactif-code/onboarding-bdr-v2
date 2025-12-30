import { v, Infer } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import {
  messageReactionValidator,
  getReactionsForMessages,
} from "./helpers";

// ============================================================================
// Validators
// ============================================================================

/**
 * Validator for conversation message with sender information.
 * Used for thread parent and replies in DM contexts.
 */
export const conversationMessageWithSenderValidator = v.object({
  _id: v.id("messages"),
  conversationId: v.id("conversations"),
  senderId: v.id("users"),
  sender: v.object({
    _id: v.id("users"),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    status: v.union(
      v.literal("online"),
      v.literal("offline"),
      v.literal("away"),
      v.literal("dnd")
    ),
  }),
  content: v.string(),
  contentType: v.optional(
    v.union(
      v.literal("text"),
      v.literal("voice"),
      v.literal("file"),
      v.literal("system")
    )
  ),
  parentId: v.optional(v.id("messages")),
  threadReplyCount: v.optional(v.number()),
  threadLastReplyAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
  isEdited: v.optional(v.boolean()),
  deletedAt: v.optional(v.number()),
  reactionCount: v.optional(v.number()),
  reactions: v.optional(v.array(messageReactionValidator)),
  status: v.optional(
    v.union(v.literal("sending"), v.literal("sent"), v.literal("failed"))
  ),
});

/** Type for conversation message with sender */
export type ConversationMessageWithSender = Infer<
  typeof conversationMessageWithSenderValidator
>;

// ============================================================================
// Thread Queries for Conversations (DMs)
// ============================================================================

/**
 * Get a thread with its parent message and all replies for a conversation (DM).
 * Returns the parent message and all thread replies sorted by createdAt ASC.
 *
 * Validates:
 * - Parent message exists and is a conversation message
 * - User is an active participant in the conversation
 * - Parent is not itself a reply (no nested threads)
 */
export const getConversationThread = query({
  args: {
    parentMessageId: v.id("messages"),
  },
  returns: v.union(
    v.object({
      parent: conversationMessageWithSenderValidator,
      replies: v.array(conversationMessageWithSenderValidator),
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

    // Parent must be a conversation message (not a channel message)
    if (!parentMessage.conversationId) {
      throw new Error(
        "Invalid thread: Parent message must be a conversation message"
      );
    }

    // Parent should not itself be a reply (must be a top-level message)
    if (parentMessage.parentId) {
      throw new Error("Invalid thread: Cannot get thread from a reply message");
    }

    // Verify user is an active participant in the conversation
    const participant = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q
          .eq("userId", user._id)
          .eq("conversationId", parentMessage.conversationId!)
      )
      .first();

    if (!participant) {
      throw new Error("Forbidden: Not a participant in this conversation");
    }

    if (participant.leftAt) {
      throw new Error("Forbidden: You have left this conversation");
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

    // Batch fetch reactions for parent and all replies in parallel
    const allMessageIds = [parentMessage._id, ...replies.map((r) => r._id)];
    const reactionsMap = await getReactionsForMessages(ctx, allMessageIds);

    // Helper function to hydrate a message with sender and reactions info
    const hydrateMessage = (
      message: typeof parentMessage
    ): ConversationMessageWithSender => {
      const sender = senderMap.get(message.senderId);
      const reactions = reactionsMap.get(message._id.toString()) ?? [];

      return {
        _id: message._id,
        conversationId: message.conversationId!,
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
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        isEdited: message.isEdited,
        deletedAt: message.deletedAt,
        reactionCount: message.reactionCount,
        reactions,
        status: message.status,
      };
    };

    return {
      parent: hydrateMessage(parentMessage),
      replies: replies.map(hydrateMessage),
    };
  },
});
