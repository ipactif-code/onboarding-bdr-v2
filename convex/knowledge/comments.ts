import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { requireKBAuth, checkPermission } from "../lib/kbAuth";
import { hydrateUsers, HydratedUser } from "../lib/users";
import { serializeToText } from "../lib/plateSerializer";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum comment content length in characters */
const MAX_COMMENT_LENGTH = 10000;

/** Maximum number of reactions to fetch per comment */
const MAX_REACTIONS_PER_COMMENT = 100;

// ============================================================================
// VALIDATORS
// ============================================================================

const commentTypeValidator = v.union(v.literal("page"), v.literal("inline"));

const mentionTypeValidator = v.union(
  v.literal("user"),
  v.literal("here"),
  v.literal("everyone")
);

const authorValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  avatarUrl: v.optional(v.string()),
});

const commentListItemValidator = v.object({
  _id: v.id("kbDocumentComments"),
  documentId: v.id("kbDocuments"),
  type: commentTypeValidator,
  content: v.string(),
  author: authorValidator,
  isResolved: v.boolean(),
  resolvedAt: v.optional(v.number()),
  isEdited: v.boolean(),
  editedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  replyCount: v.number(),
  // Inline comment metadata
  selectionStart: v.optional(v.number()),
  selectionEnd: v.optional(v.number()),
  selectedText: v.optional(v.string()),
});

const reactionGroupValidator = v.object({
  emoji: v.string(),
  count: v.number(),
  users: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
    })
  ),
  hasReacted: v.boolean(),
});

const mentionValidator = v.object({
  _id: v.id("kbCommentMentions"),
  type: mentionTypeValidator,
  mentionedUserId: v.optional(v.id("users")),
  mentionedUserName: v.optional(v.string()),
});

const commentDetailValidator = v.object({
  _id: v.id("kbDocumentComments"),
  documentId: v.id("kbDocuments"),
  type: commentTypeValidator,
  parentId: v.optional(v.id("kbDocumentComments")),
  content: v.string(),
  author: authorValidator,
  isResolved: v.boolean(),
  resolvedAt: v.optional(v.number()),
  resolvedBy: v.optional(authorValidator),
  isEdited: v.boolean(),
  editedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  // Inline comment metadata
  selectionStart: v.optional(v.number()),
  selectionEnd: v.optional(v.number()),
  selectedText: v.optional(v.string()),
  // Hydrated data
  reactions: v.array(reactionGroupValidator),
  mentions: v.array(mentionValidator),
});

const replyValidator = v.object({
  _id: v.id("kbDocumentComments"),
  content: v.string(),
  author: authorValidator,
  isEdited: v.boolean(),
  editedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const unreadMentionValidator = v.object({
  _id: v.id("kbCommentMentions"),
  type: mentionTypeValidator,
  createdAt: v.number(),
  comment: v.object({
    _id: v.id("kbDocumentComments"),
    content: v.string(),
    author: authorValidator,
    createdAt: v.number(),
  }),
  document: v.object({
    _id: v.id("kbDocuments"),
    title: v.string(),
  }),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse @mentions from comment content.
 * Supports @username, @here, and @everyone patterns.
 *
 * @param content - The comment content to parse
 * @returns Array of parsed mentions with type and username
 */
function parseMentions(
  content: string
): Array<{ type: "user" | "here" | "everyone"; username: string }> {
  const mentions: Array<{
    type: "user" | "here" | "everyone";
    username: string;
  }> = [];
  const seen = new Set<string>();

  // Match @username patterns (alphanumeric + underscore, 1-50 chars)
  const userMentionRegex = /@(\w{1,50})/g;
  let match;

  while ((match = userMentionRegex.exec(content)) !== null) {
    const username = match[1];
    if (!username) continue;

    // Skip duplicates
    const key = username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (username.toLowerCase() === "here") {
      mentions.push({ type: "here", username: "here" });
    } else if (username.toLowerCase() === "everyone") {
      mentions.push({ type: "everyone", username: "everyone" });
    } else {
      mentions.push({ type: "user", username });
    }
  }

  return mentions;
}


// ============================================================================
// T052 - QUERIES
// ============================================================================

/**
 * List comments for a document (top-level only, parentId = null).
 * Returns comments with author hydrated and reply count.
 *
 * @param documentId - The document ID to list comments for
 * @param type - Optional filter by comment type (page/inline)
 * @param isResolved - Optional filter by resolution status
 * @param limit - Maximum number of comments to return (default: 50)
 * @returns Array of comment list items
 */
export const list = query({
  args: {
    documentId: v.id("kbDocuments"),
    type: v.optional(commentTypeValidator),
    isResolved: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(commentListItemValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify read access to the document
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "read"
    );

    if (!hasAccess) {
      throw new ConvexError(
        "Forbidden: You do not have access to this document"
      );
    }

    const limit = Math.min(args.limit ?? 50, 100);

    // Query comments using appropriate index
    const commentsQuery = ctx.db
      .query("kbDocumentComments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId));

    // Collect and filter
    let comments = await commentsQuery.order("desc").collect();

    // Filter to top-level comments only (no parentId)
    comments = comments.filter((c) => !c.parentId);

    // Apply type filter if provided
    if (args.type) {
      comments = comments.filter((c) => c.type === args.type);
    }

    // Apply isResolved filter if provided
    if (args.isResolved !== undefined) {
      comments = comments.filter((c) => c.isResolved === args.isResolved);
    }

    // Limit results
    const limitedComments = comments.slice(0, limit);

    // Batch hydrate all authors for better performance
    const authorIds = limitedComments.map((c) => c.authorId);
    const usersMap = await hydrateUsers(ctx, authorIds);

    // Hydrate with author info and reply counts
    const result = await Promise.all(
      limitedComments.map(async (comment) => {
        const author = usersMap.get(comment.authorId) ?? {
          _id: comment.authorId,
          name: "Unknown User",
        };

        // Count replies
        const replies = await ctx.db
          .query("kbDocumentComments")
          .withIndex("by_parent", (q) => q.eq("parentId", comment._id))
          .collect();

        return {
          _id: comment._id,
          documentId: comment.documentId,
          type: comment.type,
          content: comment.content,
          author,
          isResolved: comment.isResolved,
          resolvedAt: comment.resolvedAt,
          isEdited: comment.isEdited,
          editedAt: comment.editedAt,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          replyCount: replies.length,
          // Inline comment metadata
          selectionStart: comment.selectionStart,
          selectionEnd: comment.selectionEnd,
          selectedText: comment.selectedText,
        };
      })
    );

    return result;
  },
});

/**
 * Get a single comment with full details including author, reactions, and mentions.
 *
 * @param commentId - The comment ID to retrieve
 * @returns Full comment details or null if not found/no access
 */
export const get = query({
  args: {
    commentId: v.id("kbDocumentComments"),
  },
  returns: v.union(commentDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Get the comment
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      return null;
    }

    // Verify read access to the document
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      comment.documentId,
      "read"
    );

    if (!hasAccess) {
      return null;
    }

    // Batch hydrate author and resolvedBy for better performance
    const userIdsToHydrate: Id<"users">[] = [comment.authorId];
    if (comment.resolvedBy) {
      userIdsToHydrate.push(comment.resolvedBy);
    }
    const usersMap = await hydrateUsers(ctx, userIdsToHydrate);

    // Get hydrated author
    const author = usersMap.get(comment.authorId) ?? {
      _id: comment.authorId,
      name: "Unknown User",
    };

    // Get hydrated resolvedBy if present
    let resolvedBy: HydratedUser | undefined;
    if (comment.resolvedBy) {
      resolvedBy = usersMap.get(comment.resolvedBy);
    }

    // Get reactions grouped by emoji
    const reactions = await ctx.db
      .query("kbCommentReactions")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .take(MAX_REACTIONS_PER_COMMENT);

    // Get mentions
    const mentions = await ctx.db
      .query("kbCommentMentions")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();

    // Batch hydrate all users for reactions and mentions
    const reactionUserIds = reactions.map((r) => r.userId);
    const mentionUserIds = mentions
      .filter((m) => m.mentionedUserId)
      .map((m) => m.mentionedUserId as Id<"users">);
    const allUserIds = [...reactionUserIds, ...mentionUserIds];
    const reactionMentionUsersMap = await hydrateUsers(ctx, allUserIds);

    // Group reactions by emoji using batch-hydrated users
    const reactionMap = new Map<
      string,
      { users: Array<{ _id: Id<"users">; name: string }>; hasReacted: boolean }
    >();

    for (const reaction of reactions) {
      const existing = reactionMap.get(reaction.emoji);
      const hydratedUser = reactionMentionUsersMap.get(reaction.userId);
      const userData = {
        _id: reaction.userId,
        name: hydratedUser?.name ?? "Unknown",
      };

      if (existing) {
        existing.users.push(userData);
        if (reaction.userId === userId) {
          existing.hasReacted = true;
        }
      } else {
        reactionMap.set(reaction.emoji, {
          users: [userData],
          hasReacted: reaction.userId === userId,
        });
      }
    }

    const groupedReactions = Array.from(reactionMap.entries()).map(
      ([emoji, data]) => ({
        emoji,
        count: data.users.length,
        users: data.users,
        hasReacted: data.hasReacted,
      })
    );

    // Hydrate mentions with user names using batch-hydrated users
    const hydratedMentions = mentions.map((mention) => {
      let mentionedUserName: string | undefined;
      if (mention.mentionedUserId) {
        const hydratedMentionedUser = reactionMentionUsersMap.get(
          mention.mentionedUserId
        );
        mentionedUserName = hydratedMentionedUser?.name;
      }

      return {
        _id: mention._id,
        type: mention.type,
        mentionedUserId: mention.mentionedUserId,
        mentionedUserName,
      };
    });

    return {
      _id: comment._id,
      documentId: comment.documentId,
      type: comment.type,
      parentId: comment.parentId,
      content: comment.content,
      author,
      isResolved: comment.isResolved,
      resolvedAt: comment.resolvedAt,
      resolvedBy,
      isEdited: comment.isEdited,
      editedAt: comment.editedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      // Inline comment metadata
      selectionStart: comment.selectionStart,
      selectionEnd: comment.selectionEnd,
      selectedText: comment.selectedText,
      reactions: groupedReactions,
      mentions: hydratedMentions,
    };
  },
});

/**
 * Get thread children (replies) for a parent comment.
 * Returns replies ordered chronologically (oldest first).
 *
 * @param parentId - The parent comment ID
 * @returns Array of reply comments
 */
export const getReplies = query({
  args: {
    parentId: v.id("kbDocumentComments"),
  },
  returns: v.array(replyValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Get the parent comment to verify document access
    const parentComment = await ctx.db.get(args.parentId);
    if (!parentComment) {
      return [];
    }

    // Verify read access to the document
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      parentComment.documentId,
      "read"
    );

    if (!hasAccess) {
      return [];
    }

    // Get replies ordered chronologically (asc)
    const replies = await ctx.db
      .query("kbDocumentComments")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .order("asc")
      .collect();

    // Batch hydrate all authors for better performance
    const authorIds = replies.map((r) => r.authorId);
    const authorsMap = await hydrateUsers(ctx, authorIds);

    // Map replies with hydrated author info
    const result = replies.map((reply) => {
      const author = authorsMap.get(reply.authorId) ?? {
        _id: reply.authorId,
        name: "Unknown User",
      };

      return {
        _id: reply._id,
        content: reply.content,
        author,
        isEdited: reply.isEdited,
        editedAt: reply.editedAt,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      };
    });

    return result;
  },
});

/**
 * Get inline comments for a document (for editor markers).
 * Returns inline comments with position metadata.
 *
 * @param documentId - The document ID
 * @param includeResolved - Whether to include resolved comments (default: false)
 * @returns Array of inline comment list items
 */
export const getInline = query({
  args: {
    documentId: v.id("kbDocuments"),
    includeResolved: v.optional(v.boolean()),
  },
  returns: v.array(commentListItemValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify read access to the document
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "read"
    );

    if (!hasAccess) {
      throw new ConvexError(
        "Forbidden: You do not have access to this document"
      );
    }

    // Query inline comments using the by_document_type index
    let comments = await ctx.db
      .query("kbDocumentComments")
      .withIndex("by_document_type", (q) =>
        q.eq("documentId", args.documentId).eq("type", "inline")
      )
      .order("asc")
      .collect();

    // Filter to top-level comments only (no parentId)
    comments = comments.filter((c) => !c.parentId);

    // Filter out resolved unless includeResolved is true
    if (!args.includeResolved) {
      comments = comments.filter((c) => !c.isResolved);
    }

    // Batch hydrate all authors for better performance
    const authorIds = comments.map((c) => c.authorId);
    const authorsMap = await hydrateUsers(ctx, authorIds);

    // Hydrate with author info and reply counts
    const result = await Promise.all(
      comments.map(async (comment) => {
        const author = authorsMap.get(comment.authorId) ?? {
          _id: comment.authorId,
          name: "Unknown User",
        };

        // Count replies
        const replies = await ctx.db
          .query("kbDocumentComments")
          .withIndex("by_parent", (q) => q.eq("parentId", comment._id))
          .collect();

        return {
          _id: comment._id,
          documentId: comment.documentId,
          type: comment.type,
          content: comment.content,
          author,
          isResolved: comment.isResolved,
          resolvedAt: comment.resolvedAt,
          isEdited: comment.isEdited,
          editedAt: comment.editedAt,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          replyCount: replies.length,
          // Inline comment metadata
          selectionStart: comment.selectionStart,
          selectionEnd: comment.selectionEnd,
          selectedText: comment.selectedText,
        };
      })
    );

    return result;
  },
});

/**
 * Get unread mentions for the current user.
 * Returns mentions where notifiedAt is undefined (unread).
 *
 * @param limit - Maximum number of mentions to return (default: 20)
 * @returns Array of unread mention items with comment and document context
 */
export const getUnreadMentions = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(unreadMentionValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const limit = Math.min(args.limit ?? 20, 100);

    // Query unread mentions using by_user_unread index
    // The index is [mentionedUserId, notifiedAt], so we query where notifiedAt is undefined
    const mentions = await ctx.db
      .query("kbCommentMentions")
      .withIndex("by_user_unread", (q) =>
        q.eq("mentionedUserId", userId).eq("notifiedAt", undefined)
      )
      .order("desc")
      .take(limit);

    // First pass: fetch all comments and documents
    const mentionData: Array<{
      mention: (typeof mentions)[number];
      comment: Doc<"kbDocumentComments">;
      document: Doc<"kbDocuments">;
    }> = [];

    for (const mention of mentions) {
      const comment = await ctx.db.get(mention.commentId);
      if (!comment) continue;

      const document = await ctx.db.get(comment.documentId);
      if (!document) continue;

      // Check read permission on document
      const hasAccess = await checkPermission(
        ctx,
        userId,
        "document",
        comment.documentId,
        "read"
      );
      if (!hasAccess) continue;

      mentionData.push({ mention, comment, document });
    }

    // Batch hydrate all comment authors
    const authorIds = mentionData.map((d) => d.comment.authorId);
    const authorsMap = await hydrateUsers(ctx, authorIds);

    // Build final result with hydrated authors
    const result: Array<{
      _id: Id<"kbCommentMentions">;
      type: "user" | "here" | "everyone";
      createdAt: number;
      comment: {
        _id: Id<"kbDocumentComments">;
        content: string;
        author: { _id: Id<"users">; name: string; avatarUrl?: string };
        createdAt: number;
      };
      document: {
        _id: Id<"kbDocuments">;
        title: string;
      };
    }> = [];

    for (const { mention, comment, document } of mentionData) {
      const author = authorsMap.get(comment.authorId) ?? {
        _id: comment.authorId,
        name: "Unknown User",
      };

      result.push({
        _id: mention._id,
        type: mention.type,
        createdAt: mention.createdAt,
        comment: {
          _id: comment._id,
          content: comment.content,
          author,
          createdAt: comment.createdAt,
        },
        document: {
          _id: document._id,
          title: document.title,
        },
      });
    }

    return result;
  },
});

// ============================================================================
// T053 - COMMENT MUTATIONS
// ============================================================================

/**
 * Create a new comment (page-level or inline).
 * Extracts @mentions from content and creates kbCommentMentions records.
 *
 * @param documentId - The document to comment on
 * @param type - Comment type (page or inline)
 * @param content - Comment text content
 * @param parentId - Optional parent comment ID for replies
 * @param selectionStart - For inline: selection start position
 * @param selectionEnd - For inline: selection end position
 * @param selectedText - For inline: quoted selected text
 * @returns The new comment ID
 */
export const create = mutation({
  args: {
    documentId: v.id("kbDocuments"),
    type: commentTypeValidator,
    content: v.string(),
    parentId: v.optional(v.id("kbDocumentComments")),
    // Selection positions for inline comments
    selectionStart: v.optional(v.number()),
    selectionEnd: v.optional(v.number()),
    selectedText: v.optional(v.string()),
  },
  returns: v.id("kbDocumentComments"),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Verify read access (commenting requires at least read access)
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "read"
    );

    if (!hasAccess) {
      throw new ConvexError(
        "Forbidden: You do not have access to this document"
      );
    }

    // Validate content
    if (!args.content.trim()) {
      throw new ConvexError("Comment content cannot be empty");
    }

    if (args.content.length > MAX_COMMENT_LENGTH) {
      throw new ConvexError(
        `Comment content is too long (max ${MAX_COMMENT_LENGTH} characters)`
      );
    }

    // Validate inline comment requirements (only for new inline comments, not replies)
    // Replies inherit the selection from their parent comment
    if (args.type === "inline" && !args.parentId) {
      if (args.selectionStart === undefined || args.selectionEnd === undefined) {
        throw new ConvexError(
          "Inline comments require selectionStart and selectionEnd positions"
        );
      }
    }

    // Validate parent comment if provided
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) {
        throw new ConvexError("Parent comment not found");
      }
      if (parent.documentId !== args.documentId) {
        throw new ConvexError(
          "Parent comment must belong to the same document"
        );
      }
      // Prevent nested replies (only one level allowed)
      if (parent.parentId) {
        throw new ConvexError(
          "Cannot reply to a reply. Reply to the original comment instead."
        );
      }
    }

    const now = Date.now();

    // Create the comment
    const commentId = await ctx.db.insert("kbDocumentComments", {
      documentId: args.documentId,
      type: args.type,
      parentId: args.parentId,
      content: args.content.trim(),
      authorId: userId,
      isResolved: false,
      isEdited: false,
      createdAt: now,
      updatedAt: now,
      // Selection positions for inline comments
      selectionStart: args.selectionStart,
      selectionEnd: args.selectionEnd,
      selectedText: args.selectedText,
    });

    // Parse and create mentions from plain text content
    // serializeToText handles both string and Plate.js Value array
    const parsedMentions = parseMentions(serializeToText(args.content));

    for (const mention of parsedMentions) {
      if (mention.type === "user") {
        // Look up user by name (case-insensitive)
        const users = await ctx.db
          .query("users")
          .filter((q) =>
            q.eq(
              q.field("name"),
              mention.username
            )
          )
          .take(1);

        const mentionedUser = users[0];
        if (mentionedUser) {
          await ctx.db.insert("kbCommentMentions", {
            commentId,
            type: "user",
            mentionedUserId: mentionedUser._id,
            createdAt: now,
          });
        }
      } else {
        // @here or @everyone - no specific user
        await ctx.db.insert("kbCommentMentions", {
          commentId,
          type: mention.type,
          createdAt: now,
        });
      }
    }

    return commentId;
  },
});

/**
 * Update a comment's content.
 * Only the author can edit their comment.
 * Re-extracts mentions and updates kbCommentMentions records.
 *
 * @param commentId - The comment ID to update
 * @param content - New comment text content
 * @returns null
 */
export const update = mutation({
  args: {
    commentId: v.id("kbDocumentComments"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Get the comment
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError("Comment not found");
    }

    // Only author can edit
    if (comment.authorId !== userId) {
      throw new ConvexError("Forbidden: You can only edit your own comments");
    }

    // Validate content
    if (!args.content.trim()) {
      throw new ConvexError("Comment content cannot be empty");
    }

    if (args.content.length > MAX_COMMENT_LENGTH) {
      throw new ConvexError(
        `Comment content is too long (max ${MAX_COMMENT_LENGTH} characters)`
      );
    }

    const now = Date.now();

    // Update the comment
    await ctx.db.patch(args.commentId, {
      content: args.content.trim(),
      isEdited: true,
      editedAt: now,
      updatedAt: now,
    });

    // Delete old mentions
    const oldMentions = await ctx.db
      .query("kbCommentMentions")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();

    for (const mention of oldMentions) {
      await ctx.db.delete(mention._id);
    }

    // Re-extract and create new mentions from plain text content
    // serializeToText handles both string and Plate.js Value array
    const parsedMentions = parseMentions(serializeToText(args.content));

    for (const mention of parsedMentions) {
      if (mention.type === "user") {
        const users = await ctx.db
          .query("users")
          .filter((q) =>
            q.eq(
              q.field("name"),
              mention.username
            )
          )
          .take(1);

        const mentionedUser = users[0];
        if (mentionedUser) {
          await ctx.db.insert("kbCommentMentions", {
            commentId: args.commentId,
            type: "user",
            mentionedUserId: mentionedUser._id,
            createdAt: now,
          });
        }
      } else {
        await ctx.db.insert("kbCommentMentions", {
          commentId: args.commentId,
          type: mention.type,
          createdAt: now,
        });
      }
    }

    return null;
  },
});

/**
 * Delete a comment.
 * Only the author can delete their comment.
 * Cascades: deletes mentions, reactions, and replies.
 *
 * @param commentId - The comment ID to delete
 * @returns null
 */
export const deleteComment = mutation({
  args: {
    commentId: v.id("kbDocumentComments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, user } = await requireKBAuth(ctx);

    // Get the comment
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError("Comment not found");
    }

    // Only author or admin can delete
    if (comment.authorId !== userId && user.role !== "admin") {
      throw new ConvexError(
        "Forbidden: You can only delete your own comments"
      );
    }

    // Delete mentions for this comment
    const mentions = await ctx.db
      .query("kbCommentMentions")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();

    for (const mention of mentions) {
      await ctx.db.delete(mention._id);
    }

    // Delete reactions for this comment
    const reactions = await ctx.db
      .query("kbCommentReactions")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();

    for (const reaction of reactions) {
      await ctx.db.delete(reaction._id);
    }

    // If this is a top-level comment, delete all replies and their mentions/reactions
    if (!comment.parentId) {
      const replies = await ctx.db
        .query("kbDocumentComments")
        .withIndex("by_parent", (q) => q.eq("parentId", args.commentId))
        .collect();

      for (const reply of replies) {
        // Delete reply mentions
        const replyMentions = await ctx.db
          .query("kbCommentMentions")
          .withIndex("by_comment", (q) => q.eq("commentId", reply._id))
          .collect();
        for (const mention of replyMentions) {
          await ctx.db.delete(mention._id);
        }

        // Delete reply reactions
        const replyReactions = await ctx.db
          .query("kbCommentReactions")
          .withIndex("by_comment", (q) => q.eq("commentId", reply._id))
          .collect();
        for (const reaction of replyReactions) {
          await ctx.db.delete(reaction._id);
        }

        // Delete the reply
        await ctx.db.delete(reply._id);
      }
    }

    // Delete the comment
    await ctx.db.delete(args.commentId);

    return null;
  },
});

/**
 * Resolve a comment thread.
 * Sets isResolved to true with resolver info.
 *
 * @param commentId - The comment ID to resolve
 * @returns null
 */
export const resolve = mutation({
  args: {
    commentId: v.id("kbDocumentComments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Get the comment
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError("Comment not found");
    }

    // Verify write access to the document (resolving requires write)
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      comment.documentId,
      "write"
    );

    if (!hasAccess) {
      throw new ConvexError(
        "Forbidden: You do not have permission to resolve comments on this document"
      );
    }

    // Can only resolve top-level comments
    if (comment.parentId) {
      throw new ConvexError("Can only resolve top-level comments");
    }

    // Already resolved
    if (comment.isResolved) {
      return null;
    }

    const now = Date.now();

    await ctx.db.patch(args.commentId, {
      isResolved: true,
      resolvedAt: now,
      resolvedBy: userId,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Unresolve a previously resolved comment thread.
 * Sets isResolved to false and clears resolver info.
 *
 * @param commentId - The comment ID to unresolve
 * @returns null
 */
export const unresolve = mutation({
  args: {
    commentId: v.id("kbDocumentComments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Get the comment
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError("Comment not found");
    }

    // Verify write access to the document
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      comment.documentId,
      "write"
    );

    if (!hasAccess) {
      throw new ConvexError(
        "Forbidden: You do not have permission to unresolve comments on this document"
      );
    }

    // Not resolved
    if (!comment.isResolved) {
      return null;
    }

    const now = Date.now();

    await ctx.db.patch(args.commentId, {
      isResolved: false,
      resolvedAt: undefined,
      resolvedBy: undefined,
      updatedAt: now,
    });

    return null;
  },
});

// ============================================================================
// T054 - REACTION MUTATIONS
// ============================================================================

/**
 * Add an emoji reaction to a comment.
 * Prevents duplicates (same user + emoji + comment).
 * Idempotent - no error if reaction already exists.
 *
 * @param commentId - The comment ID to react to
 * @param emoji - The emoji character to add
 * @returns null
 */
export const addReaction = mutation({
  args: {
    commentId: v.id("kbDocumentComments"),
    emoji: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Get the comment
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new ConvexError("Comment not found");
    }

    // Verify read access to the document (reacting requires at least read)
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      comment.documentId,
      "read"
    );

    if (!hasAccess) {
      throw new ConvexError(
        "Forbidden: You do not have access to this document"
      );
    }

    // Validate emoji (basic check - at least 1 char)
    if (!args.emoji || args.emoji.length < 1) {
      throw new ConvexError("Invalid emoji");
    }

    // Check for existing reaction (prevent duplicates)
    const existing = await ctx.db
      .query("kbCommentReactions")
      .withIndex("by_comment_user", (q) =>
        q.eq("commentId", args.commentId).eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("emoji"), args.emoji))
      .first();

    // Idempotent - no error if already exists
    if (existing) {
      return null;
    }

    // Add reaction
    await ctx.db.insert("kbCommentReactions", {
      commentId: args.commentId,
      userId,
      emoji: args.emoji,
      createdAt: Date.now(),
    });

    return null;
  },
});

/**
 * Remove an emoji reaction from a comment.
 * Only the user's own reaction can be removed.
 * Idempotent - no error if reaction doesn't exist.
 *
 * @param commentId - The comment ID to remove reaction from
 * @param emoji - The emoji character to remove
 * @returns null
 */
export const removeReaction = mutation({
  args: {
    commentId: v.id("kbDocumentComments"),
    emoji: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Find the user's reaction
    const existing = await ctx.db
      .query("kbCommentReactions")
      .withIndex("by_comment_user", (q) =>
        q.eq("commentId", args.commentId).eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("emoji"), args.emoji))
      .first();

    // Idempotent - no error if doesn't exist
    if (!existing) {
      return null;
    }

    // Delete the reaction
    await ctx.db.delete(existing._id);

    return null;
  },
});

// ============================================================================
// T055 - MENTION HANDLING
// ============================================================================

/**
 * Mark a mention as read.
 * Sets the notifiedAt timestamp.
 * Only the mentioned user can mark their own mentions as read.
 *
 * @param mentionId - The mention ID to mark as read
 * @returns null
 */
export const markMentionRead = mutation({
  args: {
    mentionId: v.id("kbCommentMentions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Get the mention
    const mention = await ctx.db.get(args.mentionId);
    if (!mention) {
      throw new ConvexError("Mention not found");
    }

    // Only the mentioned user can mark as read
    if (mention.mentionedUserId !== userId) {
      throw new ConvexError(
        "Forbidden: You can only mark your own mentions as read"
      );
    }

    // Already read
    if (mention.notifiedAt !== undefined) {
      return null;
    }

    // Mark as read
    await ctx.db.patch(args.mentionId, {
      notifiedAt: Date.now(),
    });

    return null;
  },
});
