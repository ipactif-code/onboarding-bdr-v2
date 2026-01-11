"use client";

import { useState, useCallback, type ReactElement } from "react";
import { X, MessageSquare, CheckCircle2 } from "lucide-react";

import type { Id } from "../../../../convex/_generated/dataModel";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

import { useComments, type CommentListItem } from "@/hooks/knowledge/use-comments";
import { CommentThread, CommentThreadSkeleton } from "./comment-thread";
import { CommentInput } from "./comment-input";

// ============================================================================
// Types
// ============================================================================

export interface CommentSidebarProps {
  /** Document ID for the comments */
  documentId: Id<"kbDocuments">;
  /** Current user ID for edit/delete permissions */
  currentUserId?: Id<"users">;
  /** Callback when the sidebar should close */
  onClose?: () => void;
  /** Whether the sidebar is open */
  isOpen?: boolean;
  /** Comment ID to highlight/scroll to */
  activeCommentId?: Id<"kbDocumentComments">;
  /** Callback when a comment is clicked */
  onCommentClick?: (commentId: Id<"kbDocumentComments">) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// CommentSection Component
// ============================================================================

interface CommentSectionProps {
  /** Section title */
  title: string;
  /** Comments to display */
  comments: CommentListItem[] | undefined;
  /** Whether comments are loading */
  isLoading: boolean;
  /** Empty state message */
  emptyMessage: string;
  /** Current user ID */
  currentUserId?: Id<"users">;
  /** Active comment ID for highlighting */
  activeCommentId?: Id<"kbDocumentComments">;
  /** Resolve handler */
  onResolve?: (commentId: Id<"kbDocumentComments">) => Promise<void>;
  /** Unresolve handler */
  onUnresolve?: (commentId: Id<"kbDocumentComments">) => Promise<void>;
  /** Reply handler */
  onReply?: (parentId: Id<"kbDocumentComments">, content: string) => Promise<void>;
}

function CommentSection({
  title,
  comments,
  isLoading,
  emptyMessage,
  currentUserId,
  activeCommentId,
  onResolve,
  onUnresolve,
  onReply,
}: CommentSectionProps): ReactElement {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <CommentThreadSkeleton />
        <CommentThreadSkeleton />
      </div>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground text-center py-4">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {title} ({comments.length})
      </h3>
      <div className="space-y-3">
        {comments.map((comment) => (
          <CommentThread
            key={comment._id}
            comment={comment}
            currentUserId={currentUserId}
            onResolve={onResolve}
            onUnresolve={onUnresolve}
            onReply={onReply}
            defaultExpanded={comment._id === activeCommentId}
            className={cn(
              comment._id === activeCommentId && "ring-2 ring-primary/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// CommentSidebar Component
// ============================================================================

/**
 * Sidebar panel showing all comments for a document.
 *
 * Features:
 * - Fixed position right side (w-96)
 * - Tabs for Active and Resolved comments
 * - New comment input at top
 * - Page comments section
 * - Inline comments section
 * - Scrollable content area
 *
 * @example
 * ```tsx
 * <CommentSidebar
 *   documentId={documentId}
 *   currentUserId={currentUserId}
 *   isOpen={showComments}
 *   onClose={() => setShowComments(false)}
 *   activeCommentId={selectedCommentId}
 * />
 * ```
 */
export function CommentSidebar({
  documentId,
  currentUserId,
  onClose,
  isOpen = true,
  activeCommentId,
  onCommentClick: _onCommentClick,
  className,
}: CommentSidebarProps): ReactElement | null {
  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active");

  const {
    pageComments,
    inlineComments,
    resolvedComments,
    isLoading,
    createComment,
    resolve,
    unresolve,
  } = useComments({ documentId });

  // Handle new comment submission
  const handleNewComment = useCallback(
    async (content: string) => {
      await createComment({
        documentId,
        type: "page",
        content,
      });
    },
    [createComment, documentId]
  );

  // Handle reply submission
  const handleReply = useCallback(
    async (parentId: Id<"kbDocumentComments">, content: string) => {
      await createComment({
        documentId,
        type: "page",
        content,
        parentId,
      });
    },
    [createComment, documentId]
  );

  // Count totals for tabs
  const activeCount =
    (pageComments?.length ?? 0) + (inlineComments?.length ?? 0);
  const resolvedCount = resolvedComments?.length ?? 0;

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      data-slot="comment-sidebar"
      className={cn(
        "fixed right-0 top-0 z-40 h-screen w-96 border-l bg-background shadow-lg flex flex-col",
        "animate-in slide-in-from-right duration-200",
        className
      )}
      aria-label="Comments panel"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="size-5" />
          Comments
        </h2>
        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close comments panel"
          >
            <X className="size-4" />
          </Button>
        )}
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "active" | "resolved")}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList variant="line" className="px-4 shrink-0">
          <TabsTrigger value="active" className="gap-1.5">
            <MessageSquare className="size-3.5" />
            Active
            {activeCount > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {activeCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1.5">
            <CheckCircle2 className="size-3.5" />
            Resolved
            {resolvedCount > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                {resolvedCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Active Tab Content */}
        <TabsContent value="active" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* New comment input */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Add a comment
                </h3>
                <CommentInput
                  documentId={documentId}
                  type="page"
                  onSubmit={handleNewComment}
                  placeholder="Write a comment..."
                  compact
                />
              </div>

              {/* Page comments */}
              <CommentSection
                title="Page Comments"
                comments={pageComments}
                isLoading={isLoading}
                emptyMessage="No page comments yet"
                currentUserId={currentUserId}
                activeCommentId={activeCommentId}
                onResolve={resolve}
                onUnresolve={unresolve}
                onReply={handleReply}
              />

              {/* Inline comments */}
              <CommentSection
                title="Inline Comments"
                comments={inlineComments}
                isLoading={isLoading}
                emptyMessage="No inline comments yet"
                currentUserId={currentUserId}
                activeCommentId={activeCommentId}
                onResolve={resolve}
                onUnresolve={unresolve}
                onReply={handleReply}
              />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Resolved Tab Content */}
        <TabsContent value="resolved" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  <CommentThreadSkeleton />
                  <CommentThreadSkeleton />
                </div>
              ) : resolvedComments && resolvedComments.length > 0 ? (
                <div className="space-y-3">
                  {resolvedComments.map((comment) => (
                    <CommentThread
                      key={comment._id}
                      comment={comment}
                      currentUserId={currentUserId}
                      onUnresolve={unresolve}
                      defaultExpanded={comment._id === activeCommentId}
                      className={cn(
                        comment._id === activeCommentId &&
                          "ring-2 ring-primary/50"
                      )}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="size-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No resolved comments
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Resolved comments will appear here
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

// ============================================================================
// CommentSidebarSkeleton Component
// ============================================================================

export function CommentSidebarSkeleton(): ReactElement {
  return (
    <aside
      data-slot="comment-sidebar-skeleton"
      className="fixed right-0 top-0 z-40 h-screen w-96 border-l bg-background shadow-lg flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-8" />
      </header>

      {/* Tabs */}
      <div className="px-4 py-2 border-b">
        <Skeleton className="h-8 w-48" />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-6">
        {/* Input skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-20 w-full" />
        </div>

        {/* Comments skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <CommentThreadSkeleton />
          <CommentThreadSkeleton />
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// CommentSidebarToggle Component
// ============================================================================

export interface CommentSidebarToggleProps {
  /** Number of comments to display in badge */
  commentCount?: number;
  /** Whether there are unread comments */
  hasUnread?: boolean;
  /** Callback when toggle is clicked */
  onClick?: () => void;
  /** Whether the sidebar is currently open */
  isOpen?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Toggle button for the comment sidebar.
 *
 * @example
 * ```tsx
 * <CommentSidebarToggle
 *   commentCount={5}
 *   hasUnread={true}
 *   onClick={() => setShowComments(!showComments)}
 *   isOpen={showComments}
 * />
 * ```
 */
export function CommentSidebarToggle({
  commentCount = 0,
  hasUnread = false,
  onClick,
  isOpen = false,
  className,
}: CommentSidebarToggleProps): ReactElement {
  return (
    <Button
      variant={isOpen ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      className={cn("gap-1.5 relative", className)}
      aria-label={`${isOpen ? "Hide" : "Show"} comments${commentCount > 0 ? ` (${commentCount})` : ""}`}
      aria-expanded={isOpen}
    >
      <MessageSquare className="size-4" />
      {commentCount > 0 && (
        <span className="text-xs">{commentCount}</span>
      )}
      {hasUnread && (
        <span className="absolute -top-1 -right-1 size-2.5 bg-primary rounded-full" />
      )}
    </Button>
  );
}
