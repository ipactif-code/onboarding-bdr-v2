import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { MAX_MESSAGE_LENGTH } from "./helpers";

// Type workaround: Use require() to avoid TS2589 deep type instantiation on 'internal'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { internal } = require("../_generated/api") as { internal: any };

// ============================================================================
// Channel Message Edit/Delete Mutations
// ============================================================================

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

    // Update parent thread metadata if this was a reply
    if (message.parentId) {
      await ctx.runMutation(
        internal.messages.threadInternals.updateThreadMetadata,
        { parentId: message.parentId }
      );
    }

    return null;
  },
});
