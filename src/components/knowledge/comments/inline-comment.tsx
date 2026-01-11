"use client";

import { type ReactElement } from "react";
import { MessageSquare } from "lucide-react";

import type { Id } from "../../../../convex/_generated/dataModel";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { CommentListItem } from "@/hooks/knowledge/use-comments";

// ============================================================================
// Types
// ============================================================================

export interface InlineCommentProps {
  /** The inline comment data */
  comment: CommentListItem;
  /** Callback when the marker is clicked */
  onClick?: (commentId: Id<"kbDocumentComments">) => void;
  /** Whether this comment is currently selected/active */
  isActive?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// InlineComment Component
// ============================================================================

/**
 * Inline comment marker displayed in the editor.
 *
 * Shows a small icon with optional reply count badge.
 * Yellow highlight for unresolved comments, gray for resolved.
 *
 * @example
 * ```tsx
 * <InlineComment
 *   comment={inlineComment}
 *   onClick={(id) => setSidebarComment(id)}
 *   isActive={activeCommentId === inlineComment._id}
 * />
 * ```
 */
export function InlineComment({
  comment,
  onClick,
  isActive = false,
  className,
}: InlineCommentProps): ReactElement {
  const isResolved = comment.isResolved;
  const replyCount = comment.replyCount;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-slot="inline-comment"
          data-resolved={isResolved}
          data-active={isActive}
          onClick={() => onClick?.(comment._id)}
          className={cn(
            "inline-flex items-center gap-0.5 rounded px-1 py-0.5 cursor-pointer transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            // Unresolved: yellow highlight
            !isResolved && [
              "bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50",
              "text-yellow-700 dark:text-yellow-400",
            ],
            // Resolved: gray highlight
            isResolved && [
              "bg-muted hover:bg-muted/80",
              "text-muted-foreground",
            ],
            // Active state
            isActive && [
              !isResolved && "ring-2 ring-yellow-500/50",
              isResolved && "ring-2 ring-muted-foreground/50",
            ],
            className
          )}
          aria-label={`${isResolved ? "Resolved" : "Open"} comment${replyCount > 0 ? ` with ${replyCount} ${replyCount === 1 ? "reply" : "replies"}` : ""}`}
        >
          <MessageSquare
            className={cn(
              "size-3.5 shrink-0",
              !isResolved && "fill-yellow-500/20",
              isResolved && "fill-muted-foreground/20"
            )}
          />
          {replyCount > 0 && (
            <Badge
              variant={isResolved ? "secondary" : "default"}
              className={cn(
                "h-4 min-w-4 px-1 text-[10px] leading-none",
                !isResolved && "bg-yellow-600 hover:bg-yellow-600 text-white"
              )}
            >
              {replyCount}
            </Badge>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        <div className="text-xs">
          <p className="font-medium">{comment.author.name}</p>
          <p className="text-muted-foreground line-clamp-2 max-w-48">
            {comment.content}
          </p>
          {replyCount > 0 && (
            <p className="text-muted-foreground mt-1">
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </p>
          )}
          {isResolved && (
            <p className="text-green-500 mt-1">Resolved</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// InlineCommentHighlight Component
// ============================================================================

export interface InlineCommentHighlightProps {
  /** Child content to wrap with highlight */
  children: React.ReactNode;
  /** The inline comment data */
  comment: CommentListItem;
  /** Callback when the highlighted area is clicked */
  onClick?: (commentId: Id<"kbDocumentComments">) => void;
  /** Whether this comment is currently selected/active */
  isActive?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Wrapper component that highlights text associated with an inline comment.
 *
 * Use this to wrap the actual text content that was commented on.
 *
 * @example
 * ```tsx
 * <InlineCommentHighlight
 *   comment={inlineComment}
 *   onClick={(id) => setSidebarComment(id)}
 * >
 *   {selectedTextContent}
 * </InlineCommentHighlight>
 * ```
 */
export function InlineCommentHighlight({
  children,
  comment,
  onClick,
  isActive = false,
  className,
}: InlineCommentHighlightProps): ReactElement {
  const isResolved = comment.isResolved;

  return (
    <span
      data-slot="inline-comment-highlight"
      data-comment-id={comment._id}
      data-resolved={isResolved}
      data-active={isActive}
      onClick={() => onClick?.(comment._id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick?.(comment._id);
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "cursor-pointer transition-colors rounded-sm",
        // Unresolved: yellow underline/highlight
        !isResolved && [
          "bg-yellow-100/50 dark:bg-yellow-900/20",
          "border-b-2 border-yellow-400 dark:border-yellow-600",
          "hover:bg-yellow-100 dark:hover:bg-yellow-900/40",
        ],
        // Resolved: subtle gray
        isResolved && [
          "bg-muted/30",
          "border-b border-dashed border-muted-foreground/30",
          "hover:bg-muted/50",
        ],
        // Active state
        isActive && [
          !isResolved && "bg-yellow-200 dark:bg-yellow-900/50",
          isResolved && "bg-muted/70",
        ],
        className
      )}
      aria-label={`Commented text: ${comment.selectedText || "selection"}`}
    >
      {children}
    </span>
  );
}
