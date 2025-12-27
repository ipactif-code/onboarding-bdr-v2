import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";

// ============================================================================
// Mention Queries
// ============================================================================

/**
 * Get unread mentions for the current user or a specified user.
 * Uses the by_user_unnotified index for efficient lookup of mentions
 * that have not yet been marked as notified.
 *
 * Returns mentions with message context including sender, channel/conversation,
 * and timestamp so the frontend can navigate to the message.
 */
export const getMentionsForUser = query({
  args: {
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("mentions"),
      messageId: v.id("messages"),
      type: v.union(v.literal("user"), v.literal("here"), v.literal("everyone")),
      channelId: v.optional(v.id("channels")),
      conversationId: v.optional(v.id("conversations")),
      createdAt: v.number(),
      // Message context
      message: v.union(
        v.object({
          _id: v.id("messages"),
          content: v.string(),
          createdAt: v.number(),
          sender: v.object({
            _id: v.id("users"),
            name: v.string(),
            avatarUrl: v.optional(v.string()),
          }),
        }),
        v.null()
      ),
      // Channel context (if applicable)
      channel: v.optional(
        v.object({
          _id: v.id("channels"),
          name: v.string(),
        })
      ),
      // Conversation context (if applicable)
      conversation: v.optional(
        v.object({
          _id: v.id("conversations"),
          type: v.union(
            v.literal("direct"),
            v.literal("group"),
            v.literal("broadcast")
          ),
          name: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);

    // Use provided userId or default to current user
    const targetUserId = args.userId ?? currentUser._id;

    // Authorization check: users can only view their own mentions, admins can view anyone's
    if (targetUserId !== currentUser._id && currentUser.role !== "admin") {
      throw new Error("Not authorized to view other users' mentions");
    }

    // Limit defaults to 50
    const limit = args.limit ?? 50;

    // Query mentions for the user where notifiedAt is undefined (unread)
    // Using the by_user_unnotified index: [mentionedUserId, notifiedAt]
    // We query for specific user and undefined notifiedAt
    const mentions = await ctx.db
      .query("mentions")
      .withIndex("by_user_unnotified", (q) =>
        q.eq("mentionedUserId", targetUserId).eq("notifiedAt", undefined)
      )
      .order("desc")
      .take(limit);

    // Enrich each mention with message and context data
    const enrichedMentions = await Promise.all(
      mentions.map(async (mention) => {
        // Get the message
        const message = await ctx.db.get(mention.messageId);

        // Get sender info if message exists
        let messageData: {
          _id: typeof mention.messageId;
          content: string;
          createdAt: number;
          sender: {
            _id: typeof currentUser._id;
            name: string;
            avatarUrl: string | undefined;
          };
        } | null = null;

        if (message && !message.deletedAt) {
          const sender = await ctx.db.get(message.senderId);
          if (sender) {
            messageData = {
              _id: message._id,
              content: message.content,
              createdAt: message.createdAt,
              sender: {
                _id: sender._id,
                name: sender.name,
                avatarUrl: sender.avatarUrl,
              },
            };
          }
        }

        // Get channel context if applicable
        let channelData:
          | { _id: Id<"channels">; name: string }
          | undefined = undefined;
        if (mention.channelId) {
          const channel = await ctx.db.get(mention.channelId);
          if (channel) {
            channelData = {
              _id: channel._id,
              name: channel.name,
            };
          }
        }

        // Get conversation context if applicable
        let conversationData:
          | {
              _id: Id<"conversations">;
              type: "direct" | "group" | "broadcast";
              name: string | undefined;
            }
          | undefined = undefined;
        if (mention.conversationId) {
          const conversation = await ctx.db.get(mention.conversationId);
          if (conversation) {
            conversationData = {
              _id: conversation._id,
              type: conversation.type,
              name: conversation.name,
            };
          }
        }

        return {
          _id: mention._id,
          messageId: mention.messageId,
          type: mention.type,
          channelId: mention.channelId,
          conversationId: mention.conversationId,
          createdAt: mention.createdAt,
          message: messageData,
          channel: channelData,
          conversation: conversationData,
        };
      })
    );

    return enrichedMentions;
  },
});

/**
 * Get the count of unread mentions for the current user.
 * Useful for displaying badge counts in the UI.
 */
export const getUnreadMentionCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const currentUser = await requireAuth(ctx);

    const mentions = await ctx.db
      .query("mentions")
      .withIndex("by_user_unnotified", (q) =>
        q.eq("mentionedUserId", currentUser._id).eq("notifiedAt", undefined)
      )
      .collect();

    return mentions.length;
  },
});
