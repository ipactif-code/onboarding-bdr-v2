import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAdmin } from "./lib/auth";

// ============================================================================
// Queries
// ============================================================================

/**
 * List all comments for a course (top-level only, with reply counts).
 * T180: Implement comments.listForCourse query
 */
export const listForCourse = query({
  args: {
    courseId: v.id("courses"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  returns: v.object({
    comments: v.array(
      v.object({
        _id: v.id("comments"),
        authorId: v.id("users"),
        authorName: v.string(),
        authorAvatarUrl: v.optional(v.string()),
        content: v.string(),
        isPinned: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
        replyCount: v.number(),
        isOwn: v.boolean(),
      })
    ),
    nextCursor: v.optional(v.number()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const limit = args.limit ?? 20;

    // Get top-level comments (no parentId) for this course
    let comments = await ctx.db
      .query("comments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    // Filter to top-level comments only
    comments = comments.filter((c) => !c.parentId);

    // Apply cursor (timestamp-based pagination)
    if (args.cursor) {
      comments = comments.filter((c) => c.createdAt < args.cursor!);
    }

    // Sort: pinned first, then by createdAt descending
    comments.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt - a.createdAt;
    });

    // Paginate
    const paginatedComments = comments.slice(0, limit + 1);
    const hasMore = paginatedComments.length > limit;
    const resultComments = paginatedComments.slice(0, limit);

    // Get author details and reply counts
    const result = await Promise.all(
      resultComments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);

        // Count replies
        const replies = await ctx.db
          .query("comments")
          .withIndex("by_parent", (q) => q.eq("parentId", comment._id))
          .collect();

        return {
          _id: comment._id,
          authorId: comment.authorId,
          authorName: author?.name ?? "Unknown User",
          authorAvatarUrl: author?.avatarUrl,
          content: comment.content,
          isPinned: comment.isPinned,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          replyCount: replies.length,
          isOwn: comment.authorId === user._id,
        };
      })
    );

    return {
      comments: result,
      nextCursor: hasMore
        ? resultComments[resultComments.length - 1]?.createdAt
        : undefined,
      hasMore,
    };
  },
});

/**
 * List all comments for a lesson (top-level only, with reply counts).
 * T181: Implement comments.listForLesson query
 */
export const listForLesson = query({
  args: {
    lessonId: v.id("lessons"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  returns: v.object({
    comments: v.array(
      v.object({
        _id: v.id("comments"),
        authorId: v.id("users"),
        authorName: v.string(),
        authorAvatarUrl: v.optional(v.string()),
        content: v.string(),
        isPinned: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
        replyCount: v.number(),
        isOwn: v.boolean(),
      })
    ),
    nextCursor: v.optional(v.number()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const limit = args.limit ?? 20;

    // Get top-level comments for this lesson
    let comments = await ctx.db
      .query("comments")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();

    // Filter to top-level comments only
    comments = comments.filter((c) => !c.parentId);

    // Apply cursor
    if (args.cursor) {
      comments = comments.filter((c) => c.createdAt < args.cursor!);
    }

    // Sort: pinned first, then by createdAt descending
    comments.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt - a.createdAt;
    });

    // Paginate
    const paginatedComments = comments.slice(0, limit + 1);
    const hasMore = paginatedComments.length > limit;
    const resultComments = paginatedComments.slice(0, limit);

    // Get author details and reply counts
    const result = await Promise.all(
      resultComments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);

        const replies = await ctx.db
          .query("comments")
          .withIndex("by_parent", (q) => q.eq("parentId", comment._id))
          .collect();

        return {
          _id: comment._id,
          authorId: comment.authorId,
          authorName: author?.name ?? "Unknown User",
          authorAvatarUrl: author?.avatarUrl,
          content: comment.content,
          isPinned: comment.isPinned,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          replyCount: replies.length,
          isOwn: comment.authorId === user._id,
        };
      })
    );

    return {
      comments: result,
      nextCursor: hasMore
        ? resultComments[resultComments.length - 1]?.createdAt
        : undefined,
      hasMore,
    };
  },
});

/**
 * Get replies to a comment.
 * T182: Implement comments.getReplies query
 */
export const getReplies = query({
  args: {
    parentId: v.id("comments"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  returns: v.object({
    replies: v.array(
      v.object({
        _id: v.id("comments"),
        authorId: v.id("users"),
        authorName: v.string(),
        authorAvatarUrl: v.optional(v.string()),
        content: v.string(),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
        isOwn: v.boolean(),
      })
    ),
    nextCursor: v.optional(v.number()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const limit = args.limit ?? 50;

    // Get replies
    let replies = await ctx.db
      .query("comments")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();

    // Sort by createdAt ascending (oldest first for replies)
    replies.sort((a, b) => a.createdAt - b.createdAt);

    // Apply cursor
    if (args.cursor) {
      replies = replies.filter((r) => r.createdAt > args.cursor!);
    }

    // Paginate
    const paginatedReplies = replies.slice(0, limit + 1);
    const hasMore = paginatedReplies.length > limit;
    const resultReplies = paginatedReplies.slice(0, limit);

    // Get author details
    const result = await Promise.all(
      resultReplies.map(async (reply) => {
        const author = await ctx.db.get(reply.authorId);

        return {
          _id: reply._id,
          authorId: reply.authorId,
          authorName: author?.name ?? "Unknown User",
          authorAvatarUrl: author?.avatarUrl,
          content: reply.content,
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
          isOwn: reply.authorId === user._id,
        };
      })
    );

    return {
      replies: result,
      nextCursor: hasMore
        ? resultReplies[resultReplies.length - 1]?.createdAt
        : undefined,
      hasMore,
    };
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new comment on a course or lesson.
 * T183: Implement comments.create mutation
 */
export const create = mutation({
  args: {
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
    content: v.string(),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate that exactly one of courseId or lessonId is provided
    if (!args.courseId && !args.lessonId) {
      throw new Error("Either courseId or lessonId must be provided");
    }

    if (args.courseId && args.lessonId) {
      throw new Error("Cannot specify both courseId and lessonId");
    }

    // Validate content
    if (!args.content.trim()) {
      throw new Error("Comment content cannot be empty");
    }

    if (args.content.length > 5000) {
      throw new Error("Comment content is too long (max 5000 characters)");
    }

    // Verify course/lesson exists
    if (args.courseId) {
      const course = await ctx.db.get(args.courseId);
      if (!course) {
        throw new Error("Course not found");
      }
    }

    if (args.lessonId) {
      const lesson = await ctx.db.get(args.lessonId);
      if (!lesson) {
        throw new Error("Lesson not found");
      }
    }

    return await ctx.db.insert("comments", {
      authorId: user._id,
      courseId: args.courseId,
      lessonId: args.lessonId,
      content: args.content.trim(),
      isPinned: false,
      createdAt: Date.now(),
    });
  },
});

/**
 * Reply to an existing comment.
 * T184: Implement comments.reply mutation
 */
export const reply = mutation({
  args: {
    parentId: v.id("comments"),
    content: v.string(),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get parent comment
    const parent = await ctx.db.get(args.parentId);
    if (!parent) {
      throw new Error("Parent comment not found");
    }

    // Prevent nested replies (only allow one level of replies)
    if (parent.parentId) {
      throw new Error("Cannot reply to a reply. Reply to the original comment instead.");
    }

    // Validate content
    if (!args.content.trim()) {
      throw new Error("Reply content cannot be empty");
    }

    if (args.content.length > 5000) {
      throw new Error("Reply content is too long (max 5000 characters)");
    }

    return await ctx.db.insert("comments", {
      authorId: user._id,
      courseId: parent.courseId,
      lessonId: parent.lessonId,
      parentId: args.parentId,
      content: args.content.trim(),
      isPinned: false,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update a comment (author only).
 * T185: Implement comments.update mutation
 */
export const update = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Only author or admin can edit
    if (comment.authorId !== user._id && user.role !== "admin") {
      throw new Error("You can only edit your own comments");
    }

    // Validate content
    if (!args.content.trim()) {
      throw new Error("Comment content cannot be empty");
    }

    if (args.content.length > 5000) {
      throw new Error("Comment content is too long (max 5000 characters)");
    }

    await ctx.db.patch(args.commentId, {
      content: args.content.trim(),
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Delete a comment (author or admin).
 * T186: Implement comments.remove mutation
 */
export const remove = mutation({
  args: {
    commentId: v.id("comments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Only author or admin can delete
    if (comment.authorId !== user._id && user.role !== "admin") {
      throw new Error("You can only delete your own comments");
    }

    // If this is a parent comment, delete all replies first
    if (!comment.parentId) {
      const replies = await ctx.db
        .query("comments")
        .withIndex("by_parent", (q) => q.eq("parentId", args.commentId))
        .collect();

      for (const reply of replies) {
        await ctx.db.delete(reply._id);
      }
    }

    await ctx.db.delete(args.commentId);

    return null;
  },
});

/**
 * Pin a comment (admin only).
 * T187: Implement comments.pin mutation
 */
export const pin = mutation({
  args: {
    commentId: v.id("comments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Can only pin top-level comments
    if (comment.parentId) {
      throw new Error("Can only pin top-level comments");
    }

    await ctx.db.patch(args.commentId, {
      isPinned: true,
    });

    return null;
  },
});

/**
 * Unpin a comment (admin only).
 * T188: Implement comments.unpin mutation
 */
export const unpin = mutation({
  args: {
    commentId: v.id("comments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    await ctx.db.patch(args.commentId, {
      isPinned: false,
    });

    return null;
  },
});
