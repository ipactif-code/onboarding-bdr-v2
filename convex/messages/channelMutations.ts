import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth, requireChannelMember } from "../lib/auth";
import { checkRateLimit } from "../lib/rateLimits";
import { MAX_MESSAGE_LENGTH, extractAndStoreMentions } from "./helpers";

// ============================================================================
// Channel Message Mutations
// ============================================================================

/**
 * Send a text message to a channel.
 *
 * FR-010: Rich text formatting support (content is stored as JSON string)
 * FR-044: Rate limit of 30 messages per minute per user
 * FR-046: 4000 character max message length
 *
 * T023: Create messages.sendToChannel mutation
 */
export const sendToChannel = mutation({
  args: {
    channelId: v.id("channels"),
    content: v.string(),
    parentId: v.optional(v.id("messages")),
    lessonId: v.optional(v.id("lessons")),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    // Require channel membership
    const user = await requireChannelMember(ctx, args.channelId);

    // Check if user is muted in the channel
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    if (membership?.isMuted) {
      // Check if mute has expired
      if (membership.mutedUntil && membership.mutedUntil > Date.now()) {
        throw new Error(
          `You are muted in this channel until ${new Date(membership.mutedUntil).toISOString()}`
        );
      } else if (membership.mutedUntil === undefined) {
        throw new Error("You are muted in this channel");
      }
      // Mute has expired - clear it
      await ctx.db.patch(membership._id, {
        isMuted: false,
        mutedUntil: undefined,
      });
    }

    // Check rate limit (FR-044: 30 messages per minute)
    const rateLimitResult = await checkRateLimit(ctx, user._id, "text_message");
    if (!rateLimitResult.allowed) {
      throw new Error(
        `Rate limit exceeded. Try again after ${new Date(rateLimitResult.resetAt).toISOString()}`
      );
    }

    // Validate content length (FR-046: 4000 chars max)
    if (args.content.length === 0) {
      throw new Error("Message content cannot be empty");
    }
    if (args.content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(
        `Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`
      );
    }

    // Get the channel
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    if (channel.isArchived) {
      throw new Error("Cannot send messages to an archived channel");
    }

    // Validate parent message if provided (for threading)
    if (args.parentId) {
      const parentMessage = await ctx.db.get(args.parentId);
      if (!parentMessage) {
        throw new Error("Parent message not found");
      }
      if (parentMessage.channelId !== args.channelId) {
        throw new Error("Parent message must be in the same channel");
      }
      if (parentMessage.deletedAt) {
        throw new Error("Cannot reply to a deleted message");
      }
    }

    // Validate lesson if provided
    if (args.lessonId) {
      const lesson = await ctx.db.get(args.lessonId);
      if (!lesson) {
        throw new Error("Lesson not found");
      }
    }

    const now = Date.now();

    // Create the message
    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      senderId: user._id,
      content: args.content,
      contentType: "text",
      parentId: args.parentId,
      lessonId: args.lessonId,
      createdAt: now,
      status: "sent",
      reactionCount: 0,
      threadReplyCount: args.parentId ? undefined : 0,
    });

    // Update parent message thread count if this is a reply
    if (args.parentId) {
      const parentMessage = await ctx.db.get(args.parentId);
      if (parentMessage) {
        await ctx.db.patch(args.parentId, {
          threadReplyCount: (parentMessage.threadReplyCount ?? 0) + 1,
          threadLastReplyAt: now,
        });
      }
    }

    // Update channel's lastMessageAt
    await ctx.db.patch(args.channelId, {
      lastMessageAt: now,
    });

    // Extract and store mentions
    await extractAndStoreMentions(ctx, messageId, args.content, args.channelId);

    return messageId;
  },
});

/**
 * Edit a channel message.
 * Only the sender can edit their own messages within 15 minutes.
 */
export const editChannelMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Only the sender can edit
    if (message.senderId !== user._id) {
      throw new Error("Forbidden: You can only edit your own messages");
    }

    // Check if message is deleted
    if (message.deletedAt) {
      throw new Error("Cannot edit a deleted message");
    }

    // Check edit time window (15 minutes)
    const EDIT_WINDOW_MS = 15 * 60 * 1000;
    if (Date.now() - message.createdAt > EDIT_WINDOW_MS) {
      throw new Error("Edit window has expired (15 minutes)");
    }

    // Validate content
    if (args.content.length === 0) {
      throw new Error("Message content cannot be empty");
    }
    if (args.content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(
        `Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`
      );
    }

    // Store edit history
    const editHistory = message.editHistory ?? [];
    editHistory.push({
      content: message.content,
      editedAt: Date.now(),
    });

    await ctx.db.patch(args.messageId, {
      content: args.content,
      isEdited: true,
      updatedAt: Date.now(),
      editHistory,
    });

    return null;
  },
});

/**
 * Delete a channel message.
 * Sender can delete their own messages.
 * Channel admins/mods and global admins can delete any message.
 */
export const deleteChannelMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.deletedAt) {
      throw new Error("Message is already deleted");
    }

    // Check permissions
    const isSender = message.senderId === user._id;
    const isGlobalAdmin = user.role === "admin";

    let isChannelMod = false;
    if (message.channelId && !isSender && !isGlobalAdmin) {
      const channelMembership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", message.channelId!).eq("userId", user._id)
        )
        .unique();

      isChannelMod =
        !!channelMembership &&
        !channelMembership.leftAt &&
        !channelMembership.isBanned &&
        (channelMembership.role === "owner" ||
          channelMembership.role === "admin" ||
          channelMembership.role === "moderator");
    }

    if (!isSender && !isGlobalAdmin && !isChannelMod) {
      throw new Error("Forbidden: You cannot delete this message");
    }

    // Soft delete
    await ctx.db.patch(args.messageId, {
      deletedAt: Date.now(),
      deletedBy: user._id,
    });

    return null;
  },
});

/**
 * Mark channel messages as read up to a specific timestamp.
 */
export const markChannelAsRead = mutation({
  args: {
    channelId: v.id("channels"),
    readAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id)
      )
      .unique();

    if (!membership) {
      throw new Error("You are not a member of this channel");
    }

    if (membership.leftAt || membership.isBanned) {
      throw new Error("You are not an active member of this channel");
    }

    const readAt = args.readAt ?? Date.now();

    await ctx.db.patch(membership._id, {
      lastReadAt: readAt,
    });

    return null;
  },
});
