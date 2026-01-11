"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { Value } from "platejs";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useKBCommentMutations hook.
 */
export interface UseKBCommentMutationsOptions {
  /** The document ID for new comments */
  documentId: Id<"kbDocuments">;
}

/**
 * Arguments for creating a new comment/discussion.
 */
export interface CreateCommentArgs {
  /** Comment type - page-level or inline (text selection) */
  type: "page" | "inline";
  /** Comment content in Plate.js Value format */
  content: Value;
  /** Parent comment ID for replies (optional) */
  parentId?: string;
  /** For inline comments: selection start position (document-wide) */
  selectionStart?: number;
  /** For inline comments: selection end position (document-wide) */
  selectionEnd?: number;
  /** For inline comments: the selected text */
  selectedText?: string;
}

/**
 * Return type for the useKBCommentMutations hook.
 * Provides Plate.js-compatible callbacks for comment operations.
 */
export interface UseKBCommentMutationsReturn {
  /**
   * Create a new comment or reply.
   * This is the primary method for persisting comments to Convex.
   * @param args - Comment creation arguments
   * @returns The new comment ID as a string
   */
  createComment: (args: CreateCommentArgs) => Promise<string>;

  /**
   * Add a new comment to a discussion (legacy - for replies only).
   * Creates a new discussion if discussionId doesn't exist yet.
   * @param discussionId - The string ID of the discussion (Plate.js format)
   * @param content - The comment content in Plate.js Value format
   * @returns The new comment ID as a string
   * @deprecated Use createComment instead for new discussions
   */
  addComment: (discussionId: string, content: Value) => Promise<string>;

  /**
   * Edit an existing comment's content.
   * @param commentId - The string ID of the comment (Plate.js format)
   * @param content - The new content in Plate.js Value format
   */
  editComment: (commentId: string, content: Value) => Promise<void>;

  /**
   * Delete a comment.
   * @param commentId - The string ID of the comment to delete
   */
  deleteComment: (commentId: string) => Promise<void>;

  /**
   * Resolve a discussion (mark as resolved).
   * @param discussionId - The string ID of the discussion to resolve
   */
  resolveDiscussion: (discussionId: string) => Promise<void>;

  /**
   * Unresolve a discussion (reopen it).
   * @param discussionId - The string ID of the discussion to unresolve
   */
  unresolveDiscussion: (discussionId: string) => Promise<void>;

  /**
   * Add a reaction emoji to a comment.
   * @param commentId - The string ID of the comment
   * @param emoji - The emoji character to add
   */
  addReaction: (commentId: string, emoji: string) => Promise<void>;

  /**
   * Remove a reaction emoji from a comment.
   * @param commentId - The string ID of the comment
   * @param emoji - The emoji character to remove
   */
  removeReaction: (commentId: string, emoji: string) => Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a string ID to a Convex Id<"kbDocumentComments"> type.
 * This is safe because Convex IDs are strings internally.
 */
function toCommentId(stringId: string): Id<"kbDocumentComments"> {
  return stringId as Id<"kbDocumentComments">;
}

/**
 * Type guard to check if a node is a text node.
 */
function isTextNode(node: unknown): node is { text: string } {
  return (
    typeof node === "object" &&
    node !== null &&
    "text" in node &&
    typeof (node as { text: unknown }).text === "string"
  );
}

/**
 * Type guard to check if a node is an element node with children.
 */
function isElementNode(
  node: unknown
): node is { children?: unknown[]; type?: string; value?: string } {
  return (
    typeof node === "object" &&
    node !== null &&
    !("text" in node) &&
    ("children" in node || "type" in node)
  );
}

/**
 * Serialize Plate.js Value to plain text for Convex storage.
 * This is a client-side mirror of convex/lib/plateSerializer.ts
 *
 * @param content - Plate.js Value array
 * @returns Plain text string
 */
function serializeValueToText(content: Value): string {
  if (!Array.isArray(content)) {
    return "";
  }

  const extractText = (nodes: unknown[]): string => {
    const parts: string[] = [];

    for (const node of nodes) {
      if (isTextNode(node)) {
        parts.push(node.text);
      } else if (isElementNode(node)) {
        // Handle mention nodes
        if (
          (node.type === "mention" || node.type === "mention_input") &&
          typeof node.value === "string" &&
          node.value.length > 0
        ) {
          parts.push(`@${node.value}`);
        } else if (Array.isArray(node.children) && node.children.length > 0) {
          const childText = extractText(node.children);
          if (childText.length > 0) {
            parts.push(childText);
          }
        }
      }
    }

    return parts.join("");
  };

  return extractText(content).trim();
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook providing Plate.js-compatible mutation callbacks for KB document comments.
 *
 * This hook wraps the raw Convex mutations to:
 * - Accept string IDs (Plate.js format) instead of Convex Id types
 * - Accept Plate.js Value format for content
 * - Provide user-friendly toast notifications
 * - Handle errors gracefully
 *
 * @param options - Configuration options including the document ID
 * @returns Object with mutation callbacks matching Plate.js discussion plugin expectations
 *
 * @example
 * ```tsx
 * const { addComment, resolveDiscussion } = useKBCommentMutations({
 *   documentId: params.documentId,
 * });
 *
 * // In Plate.js discussion plugin
 * const handleAddComment = async (discussionId: string, content: Value) => {
 *   await addComment(discussionId, content);
 * };
 * ```
 */
export function useKBCommentMutations(
  options: UseKBCommentMutationsOptions
): UseKBCommentMutationsReturn {
  const { documentId } = options;

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

  // ============================================================================
  // Mutation Handlers
  // ============================================================================

  /**
   * Create a new comment or reply.
   * This is the primary method for persisting comments to Convex.
   * Handles both new discussions (no parentId) and replies (with parentId).
   */
  const createComment = useCallback(
    async (args: CreateCommentArgs): Promise<string> => {
      try {
        // Serialize Plate.js Value to plain text for Convex storage
        const contentText = serializeValueToText(args.content);

        if (!contentText.trim()) {
          throw new Error("Comment content cannot be empty");
        }

        const id = await createMutation({
          documentId,
          type: args.type,
          content: contentText,
          parentId: args.parentId ? toCommentId(args.parentId) : undefined,
          selectionStart: args.selectionStart,
          selectionEnd: args.selectionEnd,
          selectedText: args.selectedText,
        });

        // Don't show toast for successful creation - the UI update is enough
        return id;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create comment";
        toast.error(message);
        throw error;
      }
    },
    [createMutation, documentId]
  );

  /**
   * Add a comment to a discussion (legacy - for replies).
   * For new discussions, use createComment instead.
   * For replies, it creates a child comment under the parent discussion.
   * @deprecated Use createComment instead for new discussions
   */
  const addComment = useCallback(
    async (discussionId: string, content: Value): Promise<string> => {
      try {
        // Serialize Plate.js Value to plain text for Convex storage
        const contentText = serializeValueToText(content);

        // For Plate.js, the discussionId is the ID of the parent comment/discussion
        const id = await createMutation({
          documentId,
          type: "inline" as const, // Plate.js discussions are inline comments
          content: contentText,
          parentId: toCommentId(discussionId),
        });
        toast.success("Comment added");
        return id;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to add comment";
        toast.error(message);
        throw error;
      }
    },
    [createMutation, documentId]
  );

  /**
   * Edit an existing comment's content.
   */
  const editComment = useCallback(
    async (commentId: string, content: Value): Promise<void> => {
      try {
        // Serialize Plate.js Value to plain text for Convex storage
        const contentText = serializeValueToText(content);

        await updateMutation({
          commentId: toCommentId(commentId),
          content: contentText,
        });
        toast.success("Comment updated");
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
    async (commentId: string): Promise<void> => {
      try {
        await deleteMutation({
          commentId: toCommentId(commentId),
        });
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
   * Resolve a discussion thread.
   */
  const resolveDiscussion = useCallback(
    async (discussionId: string): Promise<void> => {
      try {
        await resolveMutation({
          commentId: toCommentId(discussionId),
        });
        toast.success("Discussion resolved");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to resolve discussion";
        toast.error(message);
        throw error;
      }
    },
    [resolveMutation]
  );

  /**
   * Unresolve a previously resolved discussion thread.
   */
  const unresolveDiscussion = useCallback(
    async (discussionId: string): Promise<void> => {
      try {
        await unresolveMutation({
          commentId: toCommentId(discussionId),
        });
        toast.success("Discussion reopened");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to reopen discussion";
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
    async (commentId: string, emoji: string): Promise<void> => {
      try {
        await addReactionMutation({
          commentId: toCommentId(commentId),
          emoji,
        });
        // No toast for reactions - they're quick interactions
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
    async (commentId: string, emoji: string): Promise<void> => {
      try {
        await removeReactionMutation({
          commentId: toCommentId(commentId),
          emoji,
        });
        // No toast for reactions - they're quick interactions
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to remove reaction";
        toast.error(message);
        throw error;
      }
    },
    [removeReactionMutation]
  );

  return {
    createComment,
    addComment,
    editComment,
    deleteComment,
    resolveDiscussion,
    unresolveDiscussion,
    addReaction,
    removeReaction,
  };
}
