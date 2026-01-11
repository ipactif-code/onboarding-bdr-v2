"use client";

import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

/**
 * Comment type (page-level or inline).
 */
type CommentType = "page" | "inline";

/**
 * Mention type for @mentions.
 */
type MentionType = "user" | "here" | "everyone";

/**
 * Author information hydrated from user record.
 */
export interface CommentAuthor {
  _id: Id<"users">;
  name: string;
  avatarUrl?: string;
}

/**
 * Comment list item returned from the list query.
 */
export interface CommentListItem {
  _id: Id<"kbDocumentComments">;
  documentId: Id<"kbDocuments">;
  type: CommentType;
  content: string;
  author: CommentAuthor;
  isResolved: boolean;
  resolvedAt?: number;
  isEdited: boolean;
  editedAt?: number;
  createdAt: number;
  updatedAt: number;
  replyCount: number;
  // Inline comment metadata
  selectionStart?: number;
  selectionEnd?: number;
  selectedText?: string;
}

/**
 * Reaction group with users who reacted.
 */
export interface ReactionGroup {
  emoji: string;
  count: number;
  users: Array<{ _id: Id<"users">; name: string }>;
  hasReacted: boolean;
}

/**
 * Mention record from comment.
 */
export interface CommentMention {
  _id: Id<"kbCommentMentions">;
  type: MentionType;
  mentionedUserId?: Id<"users">;
  mentionedUserName?: string;
}

/**
 * Full comment detail with reactions and mentions.
 */
export interface CommentDetail {
  _id: Id<"kbDocumentComments">;
  documentId: Id<"kbDocuments">;
  type: CommentType;
  parentId?: Id<"kbDocumentComments">;
  content: string;
  author: CommentAuthor;
  isResolved: boolean;
  resolvedAt?: number;
  resolvedBy?: CommentAuthor;
  isEdited: boolean;
  editedAt?: number;
  createdAt: number;
  updatedAt: number;
  // Inline comment metadata
  selectionStart?: number;
  selectionEnd?: number;
  selectedText?: string;
  // Hydrated data
  reactions: ReactionGroup[];
  mentions: CommentMention[];
}

/**
 * Reply item in a thread.
 */
export interface CommentReply {
  _id: Id<"kbDocumentComments">;
  content: string;
  author: CommentAuthor;
  isEdited: boolean;
  editedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Unread mention notification.
 */
export interface UnreadMention {
  _id: Id<"kbCommentMentions">;
  type: MentionType;
  createdAt: number;
  comment: {
    _id: Id<"kbDocumentComments">;
    content: string;
    author: CommentAuthor;
    createdAt: number;
  };
  document: {
    _id: Id<"kbDocuments">;
    title: string;
  };
}

/**
 * Arguments for creating a new comment.
 */
export interface CreateCommentArgs {
  documentId: Id<"kbDocuments">;
  type: CommentType;
  content: string;
  parentId?: Id<"kbDocumentComments">;
  selectionStart?: number;
  selectionEnd?: number;
  selectedText?: string;
}

/**
 * Options for the useComments hook.
 */
export interface UseCommentsOptions {
  /** The document ID to fetch comments for */
  documentId: Id<"kbDocuments">;
}

/**
 * Return type for the useComments hook.
 */
export interface UseCommentsReturn {
  // Data
  /** Page-level comments (unresolved, top-level only) */
  pageComments: CommentListItem[] | undefined;
  /** Inline comments for editor markers */
  inlineComments: CommentListItem[] | undefined;
  /** Resolved comments (all types) */
  resolvedComments: CommentListItem[] | undefined;
  /** Unread mentions for current user */
  unreadMentions: UnreadMention[] | undefined;
  /** Whether comments are loading */
  isLoading: boolean;

  // Mutations
  /** Create a new comment or reply */
  createComment: (args: CreateCommentArgs) => Promise<Id<"kbDocumentComments">>;
  /** Update comment content */
  updateComment: (args: {
    commentId: Id<"kbDocumentComments">;
    content: string;
  }) => Promise<null>;
  /** Delete a comment */
  deleteComment: (commentId: Id<"kbDocumentComments">) => Promise<void>;
  /** Resolve a comment thread */
  resolve: (commentId: Id<"kbDocumentComments">) => Promise<void>;
  /** Unresolve a comment thread */
  unresolve: (commentId: Id<"kbDocumentComments">) => Promise<void>;
  /** Add reaction to a comment */
  addReaction: (args: {
    commentId: Id<"kbDocumentComments">;
    emoji: string;
  }) => Promise<null>;
  /** Remove reaction from a comment */
  removeReaction: (args: {
    commentId: Id<"kbDocumentComments">;
    emoji: string;
  }) => Promise<null>;
  /** Mark a mention as read */
  markMentionRead: (mentionId: Id<"kbCommentMentions">) => Promise<void>;

  // Query functions for on-demand fetching
  /** Get replies for a comment */
  getReplies: (parentId: Id<"kbDocumentComments">) => CommentReply[] | undefined;
  /** Get full comment detail */
  getCommentDetail: (
    commentId: Id<"kbDocumentComments">
  ) => CommentDetail | null | undefined;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Comments management hook for Knowledge Base documents.
 *
 * Provides:
 * - Real-time subscriptions for page and inline comments
 * - Mutation wrappers with toast notifications
 * - Reaction handling
 * - Mention tracking
 *
 * @param options - Configuration options
 * @returns Comment data, mutations, and query helpers
 *
 * @example
 * ```tsx
 * const {
 *   pageComments,
 *   inlineComments,
 *   isLoading,
 *   createComment,
 *   resolve,
 * } = useComments({ documentId: params.documentId });
 *
 * if (isLoading) return <Skeleton />;
 *
 * return (
 *   <CommentList
 *     comments={pageComments}
 *     onResolve={resolve}
 *   />
 * );
 * ```
 */
export function useComments(options: UseCommentsOptions): UseCommentsReturn {
  const { documentId } = options;

  // ============================================================================
  // Queries
  // ============================================================================

  // Page-level comments (unresolved)
  const pageComments = useQuery(api.knowledge.comments.list, {
    documentId,
    type: "page" as const,
    isResolved: false,
  });

  // Inline comments for editor markers
  const inlineComments = useQuery(api.knowledge.comments.getInline, {
    documentId,
    includeResolved: false,
  });

  // Resolved comments (all types)
  const resolvedComments = useQuery(api.knowledge.comments.list, {
    documentId,
    isResolved: true,
  });

  // Unread mentions for current user
  const unreadMentions = useQuery(api.knowledge.comments.getUnreadMentions, {
    limit: 20,
  });

  // ============================================================================
  // Mutations
  // ============================================================================

  const createMutation = useMutation(api.knowledge.comments.create);
  const updateMutation = useMutation(api.knowledge.comments.update);
  const deleteMutation = useMutation(api.knowledge.comments.deleteComment);
  const resolveMutation = useMutation(api.knowledge.comments.resolve);
  const unresolveMutation = useMutation(api.knowledge.comments.unresolve);
  const addReactionMutation = useMutation(api.knowledge.comments.addReaction);
  const removeReactionMutation = useMutation(
    api.knowledge.comments.removeReaction
  );
  const markMentionReadMutation = useMutation(
    api.knowledge.comments.markMentionRead
  );

  // ============================================================================
  // Mutation Handlers
  // ============================================================================

  /**
   * Create a new comment or reply.
   */
  const createComment = useCallback(
    async (args: CreateCommentArgs): Promise<Id<"kbDocumentComments">> => {
      try {
        const id = await createMutation(args);
        toast.success(args.parentId ? "Reply added" : "Comment added");
        return id;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to add comment";
        toast.error(message);
        throw error;
      }
    },
    [createMutation]
  );

  /**
   * Update comment content.
   */
  const updateComment = useCallback(
    async (args: {
      commentId: Id<"kbDocumentComments">;
      content: string;
    }): Promise<null> => {
      try {
        await updateMutation(args);
        toast.success("Comment updated");
        return null;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update comment";
        toast.error(message);
        throw error;
      }
    },
    [updateMutation]
  );

  /**
   * Delete a comment.
   */
  const deleteComment = useCallback(
    async (commentId: Id<"kbDocumentComments">): Promise<void> => {
      try {
        await deleteMutation({ commentId });
        toast.success("Comment deleted");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete comment";
        toast.error(message);
        throw error;
      }
    },
    [deleteMutation]
  );

  /**
   * Resolve a comment thread.
   */
  const resolve = useCallback(
    async (commentId: Id<"kbDocumentComments">): Promise<void> => {
      try {
        await resolveMutation({ commentId });
        toast.success("Comment resolved");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to resolve comment";
        toast.error(message);
        throw error;
      }
    },
    [resolveMutation]
  );

  /**
   * Unresolve a previously resolved comment thread.
   */
  const unresolve = useCallback(
    async (commentId: Id<"kbDocumentComments">): Promise<void> => {
      try {
        await unresolveMutation({ commentId });
        toast.success("Comment reopened");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to reopen comment";
        toast.error(message);
        throw error;
      }
    },
    [unresolveMutation]
  );

  /**
   * Add an emoji reaction to a comment.
   */
  const addReaction = useCallback(
    async (args: {
      commentId: Id<"kbDocumentComments">;
      emoji: string;
    }): Promise<null> => {
      try {
        await addReactionMutation(args);
        // No toast for reactions - they're quick interactions
        return null;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to add reaction";
        toast.error(message);
        throw error;
      }
    },
    [addReactionMutation]
  );

  /**
   * Remove an emoji reaction from a comment.
   */
  const removeReaction = useCallback(
    async (args: {
      commentId: Id<"kbDocumentComments">;
      emoji: string;
    }): Promise<null> => {
      try {
        await removeReactionMutation(args);
        // No toast for reactions - they're quick interactions
        return null;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to remove reaction";
        toast.error(message);
        throw error;
      }
    },
    [removeReactionMutation]
  );

  /**
   * Mark a mention as read.
   */
  const markMentionRead = useCallback(
    async (mentionId: Id<"kbCommentMentions">): Promise<void> => {
      try {
        await markMentionReadMutation({ mentionId });
        // No toast for marking as read
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to mark mention as read";
        toast.error(message);
        throw error;
      }
    },
    [markMentionReadMutation]
  );

  // ============================================================================
  // Query Helpers (hooks that need to be called at component level)
  // ============================================================================

  /**
   * Hook to get replies for a comment.
   * Note: This returns the raw query result - use at component level.
   */
  const getReplies = useCallback(
    (_parentId: Id<"kbDocumentComments">): CommentReply[] | undefined => {
      // This is a placeholder - actual implementation requires calling useQuery
      // at the component level due to Rules of Hooks
      return undefined;
    },
    []
  );

  /**
   * Hook to get full comment detail.
   * Note: This returns the raw query result - use at component level.
   */
  const getCommentDetail = useCallback(
    (
      _commentId: Id<"kbDocumentComments">
    ): CommentDetail | null | undefined => {
      // This is a placeholder - actual implementation requires calling useQuery
      // at the component level due to Rules of Hooks
      return undefined;
    },
    []
  );

  // ============================================================================
  // Computed Properties
  // ============================================================================

  const isLoading =
    pageComments === undefined ||
    inlineComments === undefined ||
    resolvedComments === undefined;

  return {
    // Data
    pageComments,
    inlineComments,
    resolvedComments,
    unreadMentions,
    isLoading,

    // Mutations
    createComment,
    updateComment,
    deleteComment,
    resolve,
    unresolve,
    addReaction,
    removeReaction,
    markMentionRead,

    // Query helpers
    getReplies,
    getCommentDetail,
  };
}

// ============================================================================
// Standalone Query Hooks
// ============================================================================

/**
 * Hook to get replies for a specific comment.
 * Use this at the component level to subscribe to reply updates.
 *
 * @param parentId - The parent comment ID
 * @returns Array of replies or undefined if loading
 */
export function useCommentReplies(
  parentId: Id<"kbDocumentComments">
): CommentReply[] | undefined {
  return useQuery(api.knowledge.comments.getReplies, { parentId });
}

/**
 * Hook to get full detail for a specific comment.
 * Use this at the component level to subscribe to comment updates.
 *
 * @param commentId - The comment ID
 * @returns Comment detail or null/undefined
 */
export function useCommentDetail(
  commentId: Id<"kbDocumentComments">
): CommentDetail | null | undefined {
  return useQuery(api.knowledge.comments.get, { commentId });
}
