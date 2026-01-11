"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { Value } from "platejs";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import type { Id } from "../../../convex/_generated/dataModel";

import type { CommentListItem, CommentReply } from "./use-comments";

// ============================================================================
// Plate.js Types (from discussion-kit.tsx)
// ============================================================================

/**
 * Plate.js comment format for discussions.
 */
export type TComment = {
  id: string;
  contentRich: Value;
  createdAt: Date;
  discussionId: string;
  isEdited: boolean;
  userId: string;
};

/**
 * Plate.js discussion format.
 */
export type TDiscussion = {
  id: string;
  comments: TComment[];
  createdAt: Date;
  isResolved: boolean;
  userId: string;
  documentContent?: string;
  /** Selection start position for inline comments (character offset from document start) */
  selectionStart?: number;
  /** Selection end position for inline comments (character offset from document start) */
  selectionEnd?: number;
};

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Options for the useKBDiscussions hook.
 */
export interface UseKBDiscussionsOptions {
  /** The document ID to fetch discussions for */
  documentId: Id<"kbDocuments">;
  /** Whether to include resolved discussions (default: false) */
  includeResolved?: boolean;
}

/**
 * Return type for the useKBDiscussions hook.
 */
export interface UseKBDiscussionsReturn {
  /** Discussions in Plate.js TDiscussion[] format */
  discussions: TDiscussion[];
  /** Whether discussions are loading */
  isLoading: boolean;
}

/**
 * User map type for efficient lookup during transformation.
 */
type UsersMap = Map<string, { id: string; name: string; avatarUrl?: string }>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize content to Plate.js Value format.
 * Handles both string content and existing Plate.js Value arrays.
 *
 * @param content - Raw content from Convex (string or Value)
 * @returns Plate.js Value format
 */
export function normalizeContent(content: unknown): Value {
  // Already a Plate.js Value (array of nodes)
  if (Array.isArray(content)) {
    return content as Value;
  }

  // String content - wrap in paragraph node
  if (typeof content === "string") {
    return [
      {
        type: "p",
        children: [{ text: content }],
      },
    ];
  }

  // Fallback for undefined/null/other - empty paragraph
  return [
    {
      type: "p",
      children: [{ text: "" }],
    },
  ];
}

/**
 * Transform a single Convex comment to Plate.js TComment format.
 *
 * @param comment - Convex comment data (CommentListItem or CommentReply)
 * @param discussionId - The parent discussion ID
 * @param usersMap - Map of user IDs to user info for efficient lookup
 * @returns Plate.js TComment format
 */
export function transformToTComment(
  comment: CommentListItem | CommentReply,
  discussionId: string,
  usersMap: UsersMap
): TComment {
  // Get user ID - handle both CommentListItem and CommentReply shapes
  const authorId = comment.author._id.toString();
  const userInfo = usersMap.get(authorId);

  return {
    id: comment._id.toString(),
    contentRich: normalizeContent(comment.content),
    createdAt: new Date(comment.createdAt),
    discussionId,
    isEdited: comment.isEdited,
    userId: userInfo?.id ?? authorId,
  };
}

/**
 * Transform a top-level comment and its replies into a Plate.js TDiscussion.
 *
 * @param comment - Top-level Convex comment
 * @param replies - Array of reply comments
 * @param usersMap - Map of user IDs to user info
 * @returns Plate.js TDiscussion format
 */
export function transformToDiscussion(
  comment: CommentListItem,
  replies: CommentReply[],
  usersMap: UsersMap
): TDiscussion {
  const discussionId = comment._id.toString();
  const authorId = comment.author._id.toString();
  const userInfo = usersMap.get(authorId);

  // Transform top-level comment
  const topLevelComment = transformToTComment(comment, discussionId, usersMap);

  // Transform replies
  const replyComments = replies.map((reply) =>
    transformToTComment(reply, discussionId, usersMap)
  );

  // Combine: top-level comment first, then replies
  const allComments = [topLevelComment, ...replyComments];

  return {
    id: discussionId,
    comments: allComments,
    createdAt: new Date(comment.createdAt),
    isResolved: comment.isResolved,
    userId: userInfo?.id ?? authorId,
    documentContent: comment.selectedText,
    selectionStart: comment.selectionStart,
    selectionEnd: comment.selectionEnd,
  };
}

/**
 * Build a user map from comment authors for efficient lookup.
 *
 * @param comments - Array of comments
 * @param replies - Map of parent ID to replies
 * @returns UsersMap for lookup
 */
function buildUsersMap(
  comments: CommentListItem[],
  repliesMap: Map<string, CommentReply[]>
): UsersMap {
  const usersMap: UsersMap = new Map();

  // Add authors from top-level comments
  for (const comment of comments) {
    const authorId = comment.author._id.toString();
    if (!usersMap.has(authorId)) {
      usersMap.set(authorId, {
        id: authorId,
        name: comment.author.name,
        avatarUrl: comment.author.avatarUrl,
      });
    }
  }

  // Add authors from replies
  for (const replies of repliesMap.values()) {
    for (const reply of replies) {
      const authorId = reply.author._id.toString();
      if (!usersMap.has(authorId)) {
        usersMap.set(authorId, {
          id: authorId,
          name: reply.author.name,
          avatarUrl: reply.author.avatarUrl,
        });
      }
    }
  }

  return usersMap;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook that transforms Convex KB comments into Plate.js TDiscussion format.
 *
 * Fetches inline comments for a document, groups them by thread (top-level
 * comments with their replies), and transforms them to the format expected
 * by the Plate.js discussion plugin.
 *
 * @param options - Configuration options
 * @returns Discussions in Plate.js format with loading state
 *
 * @example
 * ```tsx
 * const { discussions, isLoading } = useKBDiscussions({
 *   documentId: params.documentId,
 * });
 *
 * if (isLoading) {
 *   return <Skeleton />;
 * }
 *
 * // Pass to Plate.js discussion plugin
 * editor.setOption(discussionPlugin, 'discussions', discussions);
 * ```
 */
export function useKBDiscussions(
  options: UseKBDiscussionsOptions
): UseKBDiscussionsReturn {
  const { documentId, includeResolved = false } = options;

  // Fetch inline comments (top-level only, excludes replies)
  const inlineComments = useQuery(api.knowledge.comments.getInline, {
    documentId,
    includeResolved,
  }) as CommentListItem[] | undefined;

  // For each top-level comment, we need to fetch replies
  // We'll fetch them all at once and group them
  const commentIds = useMemo(() => {
    if (!inlineComments) return [];
    return inlineComments.map((c) => c._id);
  }, [inlineComments]);

  // Fetch replies for all top-level comments
  // Note: This uses individual queries per comment which Convex batches efficiently
  // For a more optimized approach, we could add a bulk getReplies endpoint
  const replies0 = useQuery(
    api.knowledge.comments.getReplies,
    commentIds[0] ? { parentId: commentIds[0] } : "skip"
  ) as CommentReply[] | undefined;
  const replies1 = useQuery(
    api.knowledge.comments.getReplies,
    commentIds[1] ? { parentId: commentIds[1] } : "skip"
  ) as CommentReply[] | undefined;
  const replies2 = useQuery(
    api.knowledge.comments.getReplies,
    commentIds[2] ? { parentId: commentIds[2] } : "skip"
  ) as CommentReply[] | undefined;
  const replies3 = useQuery(
    api.knowledge.comments.getReplies,
    commentIds[3] ? { parentId: commentIds[3] } : "skip"
  ) as CommentReply[] | undefined;
  const replies4 = useQuery(
    api.knowledge.comments.getReplies,
    commentIds[4] ? { parentId: commentIds[4] } : "skip"
  ) as CommentReply[] | undefined;
  const replies5 = useQuery(
    api.knowledge.comments.getReplies,
    commentIds[5] ? { parentId: commentIds[5] } : "skip"
  ) as CommentReply[] | undefined;
  const replies6 = useQuery(
    api.knowledge.comments.getReplies,
    commentIds[6] ? { parentId: commentIds[6] } : "skip"
  ) as CommentReply[] | undefined;
  const replies7 = useQuery(
    api.knowledge.comments.getReplies,
    commentIds[7] ? { parentId: commentIds[7] } : "skip"
  ) as CommentReply[] | undefined;
  const replies8 = useQuery(
    api.knowledge.comments.getReplies,
    commentIds[8] ? { parentId: commentIds[8] } : "skip"
  ) as CommentReply[] | undefined;
  const replies9 = useQuery(
    api.knowledge.comments.getReplies,
    commentIds[9] ? { parentId: commentIds[9] } : "skip"
  ) as CommentReply[] | undefined;

  // Build replies map from fetched replies
  const repliesMap = useMemo(() => {
    const map = new Map<string, CommentReply[]>();

    const repliesArray = [
      replies0,
      replies1,
      replies2,
      replies3,
      replies4,
      replies5,
      replies6,
      replies7,
      replies8,
      replies9,
    ];

    for (let i = 0; i < commentIds.length && i < 10; i++) {
      const parentId = commentIds[i];
      const replies = repliesArray[i];
      if (parentId && replies) {
        map.set(parentId.toString(), replies);
      }
    }

    return map;
  }, [
    commentIds,
    replies0,
    replies1,
    replies2,
    replies3,
    replies4,
    replies5,
    replies6,
    replies7,
    replies8,
    replies9,
  ]);

  // Check if we're still loading
  const isLoading = useMemo(() => {
    // Main comments still loading
    if (inlineComments === undefined) return true;

    // Check if any replies are still loading (for comments that exist)
    const repliesArray = [
      replies0,
      replies1,
      replies2,
      replies3,
      replies4,
      replies5,
      replies6,
      replies7,
      replies8,
      replies9,
    ];

    for (let i = 0; i < commentIds.length && i < 10; i++) {
      if (commentIds[i] && repliesArray[i] === undefined) {
        return true;
      }
    }

    return false;
  }, [
    inlineComments,
    commentIds,
    replies0,
    replies1,
    replies2,
    replies3,
    replies4,
    replies5,
    replies6,
    replies7,
    replies8,
    replies9,
  ]);

  // Transform comments to discussions
  const discussions = useMemo<TDiscussion[]>(() => {
    if (!inlineComments || isLoading) {
      return [];
    }

    // Build users map for efficient lookup
    const usersMap = buildUsersMap(inlineComments, repliesMap);

    // Transform each top-level comment into a discussion
    const transformed = inlineComments.map((comment) => {
      const replies = repliesMap.get(comment._id.toString()) ?? [];
      return transformToDiscussion(comment, replies, usersMap);
    });

    return transformed;
  }, [inlineComments, repliesMap, isLoading]);

  return {
    discussions,
    isLoading,
  };
}

/**
 * Standalone hook to transform a single comment thread to TDiscussion.
 * Useful when you have the data already and just need to transform it.
 *
 * @param comment - Top-level comment from Convex
 * @param replies - Replies to the comment
 * @returns TDiscussion in Plate.js format
 *
 * @example
 * ```tsx
 * const comment = useCommentDetail(commentId);
 * const replies = useCommentReplies(commentId);
 *
 * const discussion = useTransformToDiscussion(comment, replies);
 * ```
 */
export function useTransformToDiscussion(
  comment: CommentListItem | null | undefined,
  replies: CommentReply[] | undefined
): TDiscussion | null {
  return useMemo(() => {
    if (!comment) return null;

    const repliesArray = replies ?? [];
    const repliesMap = new Map<string, CommentReply[]>();
    repliesMap.set(comment._id.toString(), repliesArray);

    const usersMap = buildUsersMap([comment], repliesMap);

    return transformToDiscussion(comment, repliesArray, usersMap);
  }, [comment, replies]);
}
