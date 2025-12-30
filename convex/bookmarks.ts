import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// ============================================================================
// Personal Bookmarks (FR-019)
// ============================================================================

/**
 * Add a bookmark to a message for the authenticated user.
 *
 * Personal bookmarks are per-user - each user can bookmark any message they
 * have access to, with an optional personal note.
 *
 * If the user has already bookmarked this message, updates the note if provided.
 * Otherwise, creates a new bookmark.
 *
 * @param messageId - The message to bookmark
 * @param note - Optional personal note about the bookmark
 * @returns The bookmark document ID
 */
export const addBookmark = mutation({
  args: {
    messageId: v.id("messages"),
    note: v.optional(v.string()),
  },
  returns: v.id("bookmarks"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify message exists
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check if message is deleted
    if (message.deletedAt) {
      throw new Error("Cannot bookmark a deleted message");
    }

    // Security: Verify user has access to the channel (if channel message)
    if (message.channelId) {
      const membership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", message.channelId!).eq("userId", user._id)
        )
        .first();

      if (!membership || membership.leftAt || membership.isBanned) {
        throw new Error("Not authorized to bookmark messages in this channel");
      }
    }

    // Security: Verify user is a participant in conversation (if DM message)
    if (message.conversationId) {
      const participant = await ctx.db
        .query("conversationParticipants")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", user._id).eq("conversationId", message.conversationId!)
        )
        .first();

      if (!participant || participant.leftAt) {
        throw new Error(
          "Not authorized to bookmark messages in this conversation"
        );
      }
    }

    // Check if user already bookmarked this message using the compound index
    const existingBookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", user._id).eq("messageId", args.messageId)
      )
      .unique();

    if (existingBookmark) {
      // User already bookmarked - update note if provided
      if (args.note !== undefined) {
        await ctx.db.patch(existingBookmark._id, {
          note: args.note,
        });
      }
      return existingBookmark._id;
    }

    // Create new bookmark
    const bookmarkId = await ctx.db.insert("bookmarks", {
      userId: user._id,
      messageId: args.messageId,
      note: args.note,
      createdAt: Date.now(),
    });

    return bookmarkId;
  },
});

/**
 * Remove a bookmark from a message.
 *
 * Users can only remove their own bookmarks.
 *
 * @param bookmarkId - The ID of the bookmark to remove
 * @returns null on success
 */
export const removeBookmark = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const bookmark = await ctx.db.get(args.bookmarkId);
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }

    // Verify ownership - users can only remove their own bookmarks
    if (bookmark.userId !== user._id) {
      throw new Error("Forbidden: Can only remove your own bookmarks");
    }

    await ctx.db.delete(args.bookmarkId);

    return null;
  },
});

/**
 * List all bookmarks for the current user.
 * Sorted by creation time (newest first).
 *
 * Returns bookmark info along with the message content and context.
 *
 * @returns Array of bookmarks with message and context information
 */
export const listBookmarks = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("bookmarks"),
      messageId: v.id("messages"),
      note: v.optional(v.string()),
      createdAt: v.number(),
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
      context: v.union(
        v.null(),
        v.object({
          type: v.union(v.literal("channel"), v.literal("conversation")),
          id: v.string(),
          name: v.string(),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get bookmarks sorted by createdAt descending (newest first)
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_time", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Enrich with message and context details
    const enrichedBookmarks = await Promise.all(
      bookmarks.map(async (bookmark) => {
        const message = await ctx.db.get(bookmark.messageId);

        let enrichedMessage = null;
        let context = null;

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

          // Get context (channel or conversation)
          if (message.channelId) {
            const channel = await ctx.db.get(message.channelId);
            if (channel) {
              context = {
                type: "channel" as const,
                id: message.channelId,
                name: channel.name,
              };
            }
          } else if (message.conversationId) {
            const conversation = await ctx.db.get(message.conversationId);
            if (conversation) {
              context = {
                type: "conversation" as const,
                id: message.conversationId,
                name: conversation.name ?? "Direct Message",
              };
            }
          }
        }

        return {
          _id: bookmark._id,
          messageId: bookmark.messageId,
          note: bookmark.note,
          createdAt: bookmark.createdAt,
          message: enrichedMessage,
          context,
        };
      })
    );

    return enrichedBookmarks;
  },
});

/**
 * Check if the current user has bookmarked a message.
 *
 * @param messageId - The message to check
 * @returns The bookmark if exists, null otherwise
 */
export const getByMessage = query({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("bookmarks"),
      _creationTime: v.number(),
      userId: v.id("users"),
      messageId: v.id("messages"),
      note: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const bookmark = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", user._id).eq("messageId", args.messageId)
      )
      .unique();

    return bookmark;
  },
});

/**
 * Update the note on an existing bookmark.
 *
 * @param bookmarkId - The bookmark to update
 * @param note - The new note (or null to remove)
 * @returns null on success
 */
export const updateNote = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const bookmark = await ctx.db.get(args.bookmarkId);
    if (!bookmark) {
      throw new Error("Bookmark not found");
    }

    // Verify ownership
    if (bookmark.userId !== user._id) {
      throw new Error("Forbidden: Can only update your own bookmarks");
    }

    await ctx.db.patch(args.bookmarkId, {
      note: args.note,
    });

    return null;
  },
});
