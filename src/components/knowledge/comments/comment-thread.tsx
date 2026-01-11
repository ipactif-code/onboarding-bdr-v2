"use client";

import { useState, useCallback, type ReactElement } from "react";
import { useQuery, useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Check,
  RotateCcw,
  MoreVertical,
  Pencil,
  Trash2,
  Reply,
  SmilePlus,
} from "lucide-react";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../convex/_generated/api").api;
import type { Id } from "../../../../convex/_generated/dataModel";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

import type {
  CommentListItem,
  CommentAuthor,
  CommentReply,
  ReactionGroup,
} from "@/hooks/knowledge/use-comments";

// ============================================================================
// Types
// ============================================================================

interface CommentThreadProps {
  /** The comment to display */
  comment: CommentListItem;
  /** Callback when comment is resolved */
  onResolve?: (commentId: Id<"kbDocumentComments">) => Promise<void>;
  /** Callback when comment is unresolved */
  onUnresolve?: (commentId: Id<"kbDocumentComments">) => Promise<void>;
  /** Callback when reply is added */
  onReply?: (parentId: Id<"kbDocumentComments">, content: string) => Promise<void>;
  /** Current user ID for determining edit/delete permissions */
  currentUserId?: Id<"users">;
  /** Whether the thread is expanded by default */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface CommentItemProps {
  /** Comment data */
  comment: CommentListItem | CommentReply;
  /** Author information */
  author: CommentAuthor;
  /** Whether this is a reply (indented) */
  isReply?: boolean;
  /** Reactions for this comment */
  reactions?: ReactionGroup[];
  /** Whether user can edit this comment */
  canEdit?: boolean;
  /** Whether user can delete this comment */
  canDelete?: boolean;
  /** Callback when edit is requested */
  onEdit?: (content: string) => Promise<void>;
  /** Callback when delete is requested */
  onDelete?: () => Promise<void>;
  /** Callback when reaction is toggled */
  onReaction?: (emoji: string, hasReacted: boolean) => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Common Reactions
// ============================================================================

const COMMON_REACTIONS = ["👍", "👎", "❤️", "😄", "😕", "🎉"];

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// CommentItem Component
// ============================================================================

function CommentItem({
  comment,
  author,
  isReply = false,
  reactions = [],
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  onReaction,
  className,
}: CommentItemProps): ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const handleSaveEdit = useCallback(async () => {
    if (!onEdit || !editContent.trim()) return;

    try {
      await onEdit(editContent.trim());
      setIsEditing(false);
    } catch {
      // Error handled by parent
    }
  }, [onEdit, editContent]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete]);

  const handleReaction = useCallback(
    async (emoji: string) => {
      if (!onReaction) return;

      const existingReaction = reactions.find((r) => r.emoji === emoji);
      await onReaction(emoji, existingReaction?.hasReacted ?? false);
      setShowReactionPicker(false);
    },
    [onReaction, reactions]
  );

  const isEdited = "isEdited" in comment && comment.isEdited;
  const editedAt = "editedAt" in comment ? comment.editedAt : undefined;

  return (
    <div
      data-slot="comment-item"
      className={cn(
        "group/comment flex gap-3",
        isReply && "ml-10",
        className
      )}
    >
      {/* Avatar */}
      <Avatar size="sm">
        {author.avatarUrl ? (
          <AvatarImage src={author.avatarUrl} alt={author.name} />
        ) : null}
        <AvatarFallback>{getInitials(author.name)}</AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{author.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
          </span>
          {isEdited && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground">(edited)</span>
              </TooltipTrigger>
              <TooltipContent>
                {editedAt
                  ? `Edited ${formatDistanceToNow(editedAt, { addSuffix: true })}`
                  : "Edited"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
            {onReaction && (
              <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Add reaction"
                    />
                  }
                >
                  <SmilePlus className="size-3.5" />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="end">
                  <div className="flex gap-1">
                    {COMMON_REACTIONS.map((emoji) => (
                      <Button
                        key={emoji}
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleReaction(emoji)}
                        className="text-base"
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {(canEdit || canDelete) && (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="More actions"
                    />
                  }
                >
                  <MoreVertical className="size-3.5" />
                </PopoverTrigger>
                <PopoverContent className="w-32 p-1" align="end">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      <Trash2 className="size-3.5" />
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Content or Edit Form */}
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-16 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {reactions.map((reaction) => (
              <Tooltip key={reaction.emoji}>
                <TooltipTrigger asChild>
                  <Button
                    variant={reaction.hasReacted ? "secondary" : "outline"}
                    size="xs"
                    className="gap-1 h-6 px-1.5"
                    onClick={() =>
                      onReaction?.(reaction.emoji, reaction.hasReacted)
                    }
                  >
                    <span>{reaction.emoji}</span>
                    <span className="text-xs">{reaction.count}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {reaction.users.map((u) => u.name).join(", ")}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CommentThread Component
// ============================================================================

export function CommentThread({
  comment,
  onResolve,
  onUnresolve,
  onReply,
  currentUserId,
  defaultExpanded = false,
  className,
}: CommentThreadProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Fetch replies when expanded
  const replies = useQuery(
    api.knowledge.comments.getReplies,
    isExpanded || comment.replyCount > 0
      ? { parentId: comment._id }
      : "skip"
  ) as CommentReply[] | undefined;

  // Fetch full comment detail for reactions
  const commentDetail = useQuery(api.knowledge.comments.get, {
    commentId: comment._id,
  });

  // Mutations for this comment
  const updateMutation = useMutation(api.knowledge.comments.update);
  const deleteMutation = useMutation(api.knowledge.comments.deleteComment);
  const addReactionMutation = useMutation(api.knowledge.comments.addReaction);
  const removeReactionMutation = useMutation(api.knowledge.comments.removeReaction);

  const canEdit = currentUserId === comment.author._id;
  const canDelete = currentUserId === comment.author._id;

  const handleEdit = useCallback(
    async (content: string) => {
      try {
        await updateMutation({ commentId: comment._id, content });
        toast.success("Comment updated");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update comment";
        toast.error(message);
        throw error;
      }
    },
    [comment._id, updateMutation]
  );

  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation({ commentId: comment._id });
      toast.success("Comment deleted");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete comment";
      toast.error(message);
      throw error;
    }
  }, [comment._id, deleteMutation]);

  const handleReaction = useCallback(
    async (emoji: string, hasReacted: boolean) => {
      try {
        if (hasReacted) {
          await removeReactionMutation({ commentId: comment._id, emoji });
        } else {
          await addReactionMutation({ commentId: comment._id, emoji });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update reaction";
        toast.error(message);
      }
    },
    [comment._id, addReactionMutation, removeReactionMutation]
  );

  const handleSubmitReply = useCallback(async () => {
    if (!onReply || !replyContent.trim()) return;

    setIsSubmittingReply(true);
    try {
      await onReply(comment._id, replyContent.trim());
      setReplyContent("");
      setIsReplying(false);
      setIsExpanded(true);
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmittingReply(false);
    }
  }, [onReply, comment._id, replyContent]);

  const reactions = commentDetail?.reactions ?? [];

  return (
    <div
      data-slot="comment-thread"
      className={cn(
        "rounded-lg border bg-card p-4",
        comment.isResolved && "bg-muted/50",
        className
      )}
    >
      {/* Inline comment quote */}
      {comment.type === "inline" && comment.selectedText && (
        <div className="mb-3 border-l-2 border-primary/50 bg-muted/50 px-3 py-2 rounded-r-md">
          <p className="text-sm text-muted-foreground italic truncate">
            &ldquo;{comment.selectedText}&rdquo;
          </p>
        </div>
      )}

      {/* Main comment */}
      <CommentItem
        comment={comment}
        author={comment.author}
        reactions={reactions}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReaction={handleReaction}
      />

      {/* Thread actions */}
      <div className="mt-3 flex items-center gap-2">
        {/* Reply count / expand */}
        {comment.replyCount > 0 && (
          <Button
            variant="ghost"
            size="xs"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <MessageSquare className="size-3.5" />
            {isExpanded ? "Hide" : "Show"} {comment.replyCount}{" "}
            {comment.replyCount === 1 ? "reply" : "replies"}
          </Button>
        )}

        {/* Reply button */}
        {onReply && !comment.isResolved && (
          <Button
            variant="ghost"
            size="xs"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setIsReplying(!isReplying)}
          >
            <Reply className="size-3.5" />
            Reply
          </Button>
        )}

        {/* Resolve/Unresolve */}
        {comment.isResolved ? (
          onUnresolve && (
            <Button
              variant="ghost"
              size="xs"
              className="gap-1.5 text-muted-foreground ml-auto"
              onClick={() => onUnresolve(comment._id)}
            >
              <RotateCcw className="size-3.5" />
              Reopen
            </Button>
          )
        ) : (
          onResolve && (
            <Button
              variant="ghost"
              size="xs"
              className="gap-1.5 text-muted-foreground ml-auto"
              onClick={() => onResolve(comment._id)}
            >
              <Check className="size-3.5" />
              Resolve
            </Button>
          )
        )}
      </div>

      {/* Replies */}
      {isExpanded && (
        <div className="mt-4 space-y-4 border-l-2 border-border pl-4">
          {replies === undefined ? (
            <CommentThreadSkeleton />
          ) : (
            replies.map((reply) => (
              <ReplyItem
                key={reply._id}
                reply={reply}
                currentUserId={currentUserId}
              />
            ))
          )}
        </div>
      )}

      {/* Reply input */}
      {isReplying && (
        <div className="mt-4 ml-10 space-y-2">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="min-h-16 text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmitReply}
              disabled={isSubmittingReply || !replyContent.trim()}
            >
              {isSubmittingReply ? "Sending..." : "Send"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsReplying(false);
                setReplyContent("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ReplyItem Component (separate for mutations)
// ============================================================================

interface ReplyItemProps {
  reply: CommentReply;
  currentUserId?: Id<"users">;
}

function ReplyItem({ reply, currentUserId }: ReplyItemProps): ReactElement {
  const updateMutation = useMutation(api.knowledge.comments.update);
  const deleteMutation = useMutation(api.knowledge.comments.deleteComment);
  const addReactionMutation = useMutation(api.knowledge.comments.addReaction);
  const removeReactionMutation = useMutation(api.knowledge.comments.removeReaction);

  // Fetch reactions for reply
  const replyDetail = useQuery(api.knowledge.comments.get, {
    commentId: reply._id,
  });

  const canEdit = currentUserId === reply.author._id;
  const canDelete = currentUserId === reply.author._id;

  const handleEdit = useCallback(
    async (content: string) => {
      try {
        await updateMutation({ commentId: reply._id, content });
        toast.success("Reply updated");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update reply";
        toast.error(message);
        throw error;
      }
    },
    [reply._id, updateMutation]
  );

  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation({ commentId: reply._id });
      toast.success("Reply deleted");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete reply";
      toast.error(message);
      throw error;
    }
  }, [reply._id, deleteMutation]);

  const handleReaction = useCallback(
    async (emoji: string, hasReacted: boolean) => {
      try {
        if (hasReacted) {
          await removeReactionMutation({ commentId: reply._id, emoji });
        } else {
          await addReactionMutation({ commentId: reply._id, emoji });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update reaction";
        toast.error(message);
      }
    },
    [reply._id, addReactionMutation, removeReactionMutation]
  );

  return (
    <CommentItem
      comment={reply}
      author={reply.author}
      isReply
      reactions={replyDetail?.reactions ?? []}
      canEdit={canEdit}
      canDelete={canDelete}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onReaction={handleReaction}
    />
  );
}

// ============================================================================
// Skeleton Component
// ============================================================================

export function CommentThreadSkeleton(): ReactElement {
  return (
    <div data-slot="comment-thread-skeleton" className="space-y-3">
      <div className="flex gap-3">
        <Skeleton className="size-6 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
