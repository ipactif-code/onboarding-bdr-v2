import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";
import { hasChannelRole } from "./lib/permissions";
import { Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a user is an active participant in a conversation.
 * Active means: leftAt is undefined.
 */
async function isActiveConversationParticipant(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">
): Promise<boolean> {
  const participation = await ctx.db
    .query("conversationParticipants")
    .withIndex("by_user_conversation", (q) =>
      q.eq("userId", userId).eq("conversationId", conversationId)
    )
    .unique();

  return participation !== null && participation.leftAt === undefined;
}

// ============================================================================
// PIN MUTATIONS
// ============================================================================

/**
 * Pin a message to a channel or conversation (DM).
 *
 * Authorization:
 * - Channels: Only channel admins OR the message creator can pin
 * - DMs: Any active participant can pin
 *
 * @param channelId - The channel containing the message (optional, mutually exclusive with conversationId)
 * @param conversationId - The conversation containing the message (optional, mutually exclusive with channelId)
 * @param messageId - The message to pin
 * @returns The ID of the created pin, or existing pin ID if already pinned
 */
export const pinMessage = mutation({
  args: {
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
    messageId: v.id("messages"),
  },
  returns: v.id("pins"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate: exactly one of channelId or conversationId must be provided
    if (args.channelId && args.conversationId) {
      throw new Error(
        "Invalid request: cannot pin to both a channel and a conversation"
      );
    }

    if (!args.channelId && !args.conversationId) {
      throw new Error(
        "Invalid request: must provide either channelId or conversationId"
      );
    }

    // Verify message exists
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check if message is deleted
    if (message.deletedAt) {
      throw new Error("Cannot pin a deleted message");
    }

    // Check if message is already pinned
    const existingPin = await ctx.db
      .query("pins")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (existingPin) {
      // Return existing pin ID if already pinned
      return existingPin._id;
    }

    // Handle channel pins
    if (args.channelId) {
      // Verify channel exists
      const channel = await ctx.db.get(args.channelId);
      if (!channel) {
        throw new Error("Channel not found");
      }

      if (channel.isArchived) {
        throw new Error("Cannot pin messages in an archived channel");
      }

      // Verify message belongs to the channel
      if (message.channelId !== args.channelId) {
        throw new Error("Message does not belong to this channel");
      }

      // Authorization check (FR-018):
      // 1. Global admin can pin any message
      // 2. Channel admin can pin any message
      // 3. Message author can pin their own message
      const isChannelAdmin = await hasChannelRole(
        ctx,
        args.channelId,
        user._id,
        "admin"
      );
      const isMessageAuthor = message.senderId === user._id;

      if (!isChannelAdmin && !isMessageAuthor) {
        throw new Error(
          "Forbidden: Only channel admins or message author can pin messages"
        );
      }

      // Create the pin
      const pinId = await ctx.db.insert("pins", {
        channelId: args.channelId,
        messageId: args.messageId,
        pinnedBy: user._id,
        pinnedAt: Date.now(),
      });

      return pinId;
    }

    // Handle DM/conversation pins
    if (args.conversationId) {
      // Verify conversation exists
      const conversation = await ctx.db.get(args.conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Verify message belongs to the conversation
      if (message.conversationId !== args.conversationId) {
        throw new Error("Message does not belong to this conversation");
      }

      // Authorization: Any active participant can pin in DMs (no admin concept)
      const isParticipant = await isActiveConversationParticipant(
        ctx,
        args.conversationId,
        user._id
      );

      if (!isParticipant) {
        throw new Error(
          "Forbidden: Only active conversation participants can pin messages"
        );
      }

      // Create the pin
      const pinId = await ctx.db.insert("pins", {
        conversationId: args.conversationId,
        messageId: args.messageId,
        pinnedBy: user._id,
        pinnedAt: Date.now(),
      });

      return pinId;
    }

    // This should never be reached due to earlier validation
    throw new Error("Invalid request: no context provided");
  },
});

/**
 * Unpin a message from a channel or conversation.
 *
 * Authorization:
 * - Channels: Only channel admins or the user who pinned can unpin
 * - DMs: Any active participant can unpin
 *
 * @param pinId - The ID of the pin to remove
 * @returns null on success
 */
export const unpinMessage = mutation({
  args: {
    pinId: v.id("pins"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const pin = await ctx.db.get(args.pinId);
    if (!pin) {
      throw new Error("Pin not found");
    }

    // Handle channel pins
    if (pin.channelId) {
      // Authorization check:
      // 1. Global admin can unpin any message
      // 2. Channel admin can unpin any message
      // 3. User who created the pin can unpin
      const isChannelAdmin = await hasChannelRole(
        ctx,
        pin.channelId,
        user._id,
        "admin"
      );
      const isPinCreator = pin.pinnedBy === user._id;

      if (!isChannelAdmin && !isPinCreator) {
        throw new Error(
          "Forbidden: Only channel admins or pin creator can unpin messages"
        );
      }

      await ctx.db.delete(args.pinId);
      return null;
    }

    // Handle DM/conversation pins
    if (pin.conversationId) {
      // Authorization: Any active participant can unpin in DMs
      const isParticipant = await isActiveConversationParticipant(
        ctx,
        pin.conversationId,
        user._id
      );

      if (!isParticipant) {
        throw new Error(
          "Forbidden: Only active conversation participants can unpin messages"
        );
      }

      await ctx.db.delete(args.pinId);
      return null;
    }

    // Pin has neither channelId nor conversationId - data integrity issue
    throw new Error("Invalid pin: missing context (channelId or conversationId)");
  },
});

// ============================================================================
// PIN QUERIES
// ============================================================================

/**
 * List all pinned messages in a channel.
 * Sorted by pin time (newest first).
 *
 * Returns pin info along with the message content and sender details.
 *
 * @param channelId - The channel to list pins for
 * @returns Array of pinned messages with sender information
 */
export const listByChannel = query({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.array(
    v.object({
      _id: v.id("pins"),
      channelId: v.optional(v.id("channels")),
      conversationId: v.optional(v.id("conversations")),
      messageId: v.id("messages"),
      pinnedBy: v.id("users"),
      pinnedAt: v.number(),
      message: v.union(
        v.null(),
        v.object({
          _id: v.id("messages"),
          content: v.string(),
          contentType: v.optional(
            v.union(
              v.literal("text"),
              v.literal("voice"),
              v.literal("file"),
              v.literal("system")
            )
          ),
          createdAt: v.number(),
          isEdited: v.optional(v.boolean()),
          senderId: v.id("users"),
          sender: v.union(
            v.null(),
            v.object({
              _id: v.id("users"),
              name: v.string(),
              avatarUrl: v.optional(v.string()),
            })
          ),
        })
      ),
      pinnedByUser: v.union(
        v.null(),
        v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Verify channel exists
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Get pins sorted by pinnedAt descending (newest first)
    const pins = await ctx.db
      .query("pins")
      .withIndex("by_channel_time", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .collect();

    // Enrich with message and user details
    const enrichedPins = await Promise.all(
      pins.map(async (pin) => {
        const message = await ctx.db.get(pin.messageId);
        const pinnedByUser = await ctx.db.get(pin.pinnedBy);

        let enrichedMessage = null;
        if (message && !message.deletedAt) {
          const sender = await ctx.db.get(message.senderId);
          enrichedMessage = {
            _id: message._id,
            content: message.content,
            contentType: message.contentType,
            createdAt: message.createdAt,
            isEdited: message.isEdited,
            senderId: message.senderId,
            sender: sender
              ? {
                  _id: sender._id,
                  name: sender.name,
                  avatarUrl: sender.avatarUrl,
                }
              : null,
          };
        }

        return {
          _id: pin._id,
          channelId: pin.channelId,
          conversationId: pin.conversationId,
          messageId: pin.messageId,
          pinnedBy: pin.pinnedBy,
          pinnedAt: pin.pinnedAt,
          message: enrichedMessage,
          pinnedByUser: pinnedByUser
            ? {
                _id: pinnedByUser._id,
                name: pinnedByUser.name,
                avatarUrl: pinnedByUser.avatarUrl,
              }
            : null,
        };
      })
    );

    return enrichedPins;
  },
});

/**
 * List all pinned messages in a conversation (DM).
 * Sorted by pin time (newest first).
 *
 * Returns pin info along with the message content and sender details.
 *
 * @param conversationId - The conversation to list pins for
 * @returns Array of pinned messages with sender information
 */
export const listByConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("pins"),
      channelId: v.optional(v.id("channels")),
      conversationId: v.optional(v.id("conversations")),
      messageId: v.id("messages"),
      pinnedBy: v.id("users"),
      pinnedAt: v.number(),
      message: v.union(
        v.null(),
        v.object({
          _id: v.id("messages"),
          content: v.string(),
          contentType: v.optional(
            v.union(
              v.literal("text"),
              v.literal("voice"),
              v.literal("file"),
              v.literal("system")
            )
          ),
          createdAt: v.number(),
          isEdited: v.optional(v.boolean()),
          senderId: v.id("users"),
          sender: v.union(
            v.null(),
            v.object({
              _id: v.id("users"),
              name: v.string(),
              avatarUrl: v.optional(v.string()),
            })
          ),
        })
      ),
      pinnedByUser: v.union(
        v.null(),
        v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify conversation exists
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Verify current user is a participant
    const isParticipant = await isActiveConversationParticipant(
      ctx,
      args.conversationId,
      user._id
    );

    if (!isParticipant) {
      throw new Error("Forbidden: You are not a participant in this conversation");
    }

    // Get pins sorted by pinnedAt descending (newest first)
    const pins = await ctx.db
      .query("pins")
      .withIndex("by_conversation_time", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .collect();

    // Enrich with message and user details
    const enrichedPins = await Promise.all(
      pins.map(async (pin) => {
        const message = await ctx.db.get(pin.messageId);
        const pinnedByUser = await ctx.db.get(pin.pinnedBy);

        let enrichedMessage = null;
        if (message && !message.deletedAt) {
          const sender = await ctx.db.get(message.senderId);
          enrichedMessage = {
            _id: message._id,
            content: message.content,
            contentType: message.contentType,
            createdAt: message.createdAt,
            isEdited: message.isEdited,
            senderId: message.senderId,
            sender: sender
              ? {
                  _id: sender._id,
                  name: sender.name,
                  avatarUrl: sender.avatarUrl,
                }
              : null,
          };
        }

        return {
          _id: pin._id,
          channelId: pin.channelId,
          conversationId: pin.conversationId,
          messageId: pin.messageId,
          pinnedBy: pin.pinnedBy,
          pinnedAt: pin.pinnedAt,
          message: enrichedMessage,
          pinnedByUser: pinnedByUser
            ? {
                _id: pinnedByUser._id,
                name: pinnedByUser.name,
                avatarUrl: pinnedByUser.avatarUrl,
              }
            : null,
        };
      })
    );

    return enrichedPins;
  },
});

/**
 * Check if a message is pinned.
 *
 * @param messageId - The message to check
 * @returns The pin if exists, null otherwise
 */
export const getByMessage = query({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("pins"),
      _creationTime: v.number(),
      channelId: v.optional(v.id("channels")),
      conversationId: v.optional(v.id("conversations")),
      messageId: v.id("messages"),
      pinnedBy: v.id("users"),
      pinnedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const pin = await ctx.db
      .query("pins")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();

    return pin;
  },
});
