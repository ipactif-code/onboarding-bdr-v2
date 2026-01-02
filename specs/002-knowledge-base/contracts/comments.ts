/**
 * API Contracts: Comments & Discussions
 *
 * Convex queries and mutations for document comments.
 * Supports page-level and inline (text selection) comments with threading.
 * All functions require authentication via requireAuth().
 */

import { v } from "convex/values";

// =============================================================================
// VALIDATORS
// =============================================================================

export const commentType = v.union(
  v.literal("page"),   // Page-level comment
  v.literal("inline")  // Attached to text selection
);

export const commentCreateInput = v.object({
  documentId: v.id("kbDocuments"),
  type: commentType,
  content: v.string(),
  // For inline comments
  selectionStart: v.optional(v.number()),
  selectionEnd: v.optional(v.number()),
  selectedText: v.optional(v.string()),
  // For replies
  parentId: v.optional(v.id("kbDocumentComments")),
});

export const commentUpdateInput = v.object({
  commentId: v.id("kbDocumentComments"),
  content: v.string(),
});

// =============================================================================
// QUERIES
// =============================================================================

/**
 * List all comments for a document.
 *
 * Returns threaded comments with replies nested.
 *
 * @param documentId - Document to get comments for
 * @param type - Filter by comment type (optional)
 * @param includeResolved - Include resolved comments (default: false)
 * @returns Array of top-level comments with nested replies
 *
 * @example
 * const comments = useQuery(api.knowledge.comments.list, { documentId });
 */
export const list = {
  args: {
    documentId: v.id("kbDocuments"),
    type: v.optional(commentType),
    includeResolved: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbDocumentComments"),
      type: commentType,
      content: v.string(),
      // For inline comments
      selectionStart: v.optional(v.number()),
      selectionEnd: v.optional(v.number()),
      selectedText: v.optional(v.string()),
      // Author
      author: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      // State
      isResolved: v.boolean(),
      resolvedAt: v.optional(v.number()),
      resolvedBy: v.optional(
        v.object({
          _id: v.id("users"),
          name: v.string(),
        })
      ),
      isEdited: v.boolean(),
      // Replies (nested)
      replies: v.array(
        v.object({
          _id: v.id("kbDocumentComments"),
          content: v.string(),
          author: v.object({
            _id: v.id("users"),
            name: v.string(),
            avatarUrl: v.optional(v.string()),
          }),
          isEdited: v.boolean(),
          createdAt: v.number(),
        })
      ),
      // Reactions summary
      reactions: v.array(
        v.object({
          emoji: v.string(),
          count: v.number(),
          hasReacted: v.boolean(), // Current user has reacted
        })
      ),
      replyCount: v.number(),
      // Timestamps
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
};

/**
 * Get inline comments for rendering in editor.
 *
 * Returns only inline comments with their positions for overlay rendering.
 *
 * @param documentId - Document to get inline comments for
 * @returns Array of inline comments with position data
 *
 * @example
 * const inlineComments = useQuery(api.knowledge.comments.getInline, { documentId });
 */
export const getInline = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbDocumentComments"),
      selectionStart: v.number(),
      selectionEnd: v.number(),
      selectedText: v.string(),
      isResolved: v.boolean(),
      replyCount: v.number(),
      author: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
    })
  ),
};

/**
 * Get a single comment with full details.
 *
 * @param commentId - Comment to retrieve
 * @returns Comment with all replies and reactions
 *
 * @example
 * const comment = useQuery(api.knowledge.comments.get, { commentId });
 */
export const get = {
  args: {
    commentId: v.id("kbDocumentComments"),
  },
  returns: v.union(
    v.object({
      _id: v.id("kbDocumentComments"),
      documentId: v.id("kbDocuments"),
      type: commentType,
      content: v.string(),
      selectionStart: v.optional(v.number()),
      selectionEnd: v.optional(v.number()),
      selectedText: v.optional(v.string()),
      author: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      isResolved: v.boolean(),
      resolvedAt: v.optional(v.number()),
      resolvedBy: v.optional(
        v.object({
          _id: v.id("users"),
          name: v.string(),
        })
      ),
      isEdited: v.boolean(),
      editedAt: v.optional(v.number()),
      replies: v.array(
        v.object({
          _id: v.id("kbDocumentComments"),
          content: v.string(),
          author: v.object({
            _id: v.id("users"),
            name: v.string(),
            avatarUrl: v.optional(v.string()),
          }),
          isEdited: v.boolean(),
          editedAt: v.optional(v.number()),
          reactions: v.array(
            v.object({
              emoji: v.string(),
              count: v.number(),
              hasReacted: v.boolean(),
            })
          ),
          createdAt: v.number(),
        })
      ),
      reactions: v.array(
        v.object({
          emoji: v.string(),
          count: v.number(),
          hasReacted: v.boolean(),
        })
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
};

/**
 * Get unread comment mentions for current user.
 *
 * @returns Array of unread mentions
 *
 * @example
 * const mentions = useQuery(api.knowledge.comments.getUnreadMentions);
 */
export const getUnreadMentions = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("kbCommentMentions"),
      comment: v.object({
        _id: v.id("kbDocumentComments"),
        content: v.string(),
        documentId: v.id("kbDocuments"),
        documentTitle: v.string(),
      }),
      author: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      createdAt: v.number(),
    })
  ),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create a new comment or reply.
 *
 * Extracts @mentions and creates notification entries.
 *
 * @param input - Comment creation data
 * @returns Created comment ID
 * @throws Error if user lacks read permission on document
 *
 * @example
 * // Page-level comment
 * const commentId = await createComment({
 *   documentId,
 *   type: "page",
 *   content: "Great documentation!",
 * });
 *
 * // Inline comment
 * const inlineId = await createComment({
 *   documentId,
 *   type: "inline",
 *   content: "This needs clarification",
 *   selectionStart: 100,
 *   selectionEnd: 150,
 *   selectedText: "important text",
 * });
 *
 * // Reply to comment
 * const replyId = await createComment({
 *   documentId,
 *   type: "page",
 *   content: "I agree!",
 *   parentId: commentId,
 * });
 */
export const create = {
  args: commentCreateInput,
  returns: v.id("kbDocumentComments"),
};

/**
 * Update comment content.
 *
 * Only the comment author can edit.
 *
 * @param input - Comment update data
 * @throws Error if user is not the author
 *
 * @example
 * await updateComment({
 *   commentId,
 *   content: "Updated content",
 * });
 */
export const update = {
  args: commentUpdateInput,
  returns: v.null(),
};

/**
 * Delete a comment.
 *
 * Author can delete their own comments.
 * Admins can delete any comment.
 *
 * @param commentId - Comment to delete
 * @throws Error if user lacks permission
 *
 * @example
 * await deleteComment({ commentId });
 */
export const deleteComment = {
  args: {
    commentId: v.id("kbDocumentComments"),
  },
  returns: v.null(),
};

/**
 * Resolve a comment thread.
 *
 * Only the comment author or document admins can resolve.
 *
 * @param commentId - Comment to resolve
 * @throws Error if user lacks permission
 *
 * @example
 * await resolveComment({ commentId });
 */
export const resolve = {
  args: {
    commentId: v.id("kbDocumentComments"),
  },
  returns: v.null(),
};

/**
 * Unresolve a comment thread.
 *
 * @param commentId - Comment to unresolve
 * @throws Error if user lacks permission
 *
 * @example
 * await unresolveComment({ commentId });
 */
export const unresolve = {
  args: {
    commentId: v.id("kbDocumentComments"),
  },
  returns: v.null(),
};

/**
 * Add a reaction to a comment.
 *
 * @param commentId - Comment to react to
 * @param emoji - Emoji to add
 *
 * @example
 * await addReaction({ commentId, emoji: "👍" });
 */
export const addReaction = {
  args: {
    commentId: v.id("kbDocumentComments"),
    emoji: v.string(),
  },
  returns: v.null(),
};

/**
 * Remove a reaction from a comment.
 *
 * @param commentId - Comment to remove reaction from
 * @param emoji - Emoji to remove
 *
 * @example
 * await removeReaction({ commentId, emoji: "👍" });
 */
export const removeReaction = {
  args: {
    commentId: v.id("kbDocumentComments"),
    emoji: v.string(),
  },
  returns: v.null(),
};

/**
 * Mark mention as read.
 *
 * @param mentionId - Mention to mark as read
 *
 * @example
 * await markMentionRead({ mentionId });
 */
export const markMentionRead = {
  args: {
    mentionId: v.id("kbCommentMentions"),
  },
  returns: v.null(),
};

/**
 * Mark all mentions as read.
 *
 * @example
 * await markAllMentionsRead();
 */
export const markAllMentionsRead = {
  args: {},
  returns: v.null(),
};
