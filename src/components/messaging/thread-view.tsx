"use client";

import { MessageCircle } from "lucide-react";

import { useThread } from "@/hooks/use-thread";
import { cn } from "@/lib/utils";
import { MessageItem } from "@/components/messaging/message-item";
import { ThreadHeader } from "@/components/messaging/thread-header";
import { ThreadViewSkeleton } from "@/components/messaging/thread-view-skeleton";
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

interface ThreadViewProps {
  /** The ID of the parent message for the thread. */
  parentMessageId: Id<"messages">;
  /** The current user's ID for determining message ownership. */
  currentUserId: Id<"users">;
  /** The current user's display name for highlighting @mentions. */
  currentUserName?: string;
  /** Callback when the thread view should be closed. */
  onClose?: () => void;
  /** Callback when user wants to edit a message. */
  onEdit?: (messageId: Id<"messages">) => void;
  /** Callback when user wants to delete a message. */
  onDelete?: (messageId: Id<"messages">) => void;
  /** Optional className for the container. */
  className?: string;
  /** Ref for the close button to enable focus management (WCAG 2.4.3). */
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

// ============================================================================
// ThreadView Component
// ============================================================================

/**
 * ThreadView displays a thread's parent message and all its replies.
 *
 * Features:
 * - Real-time updates via Convex subscription
 * - Parent message displayed prominently at top
 * - Chronologically sorted replies
 * - Loading skeleton state
 * - Empty state when no replies
 * - Disables nested threading (no reply button on messages)
 */
export function ThreadView({
  parentMessageId,
  currentUserId,
  currentUserName,
  onClose,
  onEdit,
  onDelete,
  className,
  closeButtonRef,
}: ThreadViewProps): React.ReactElement {
  const { parent, replies, isLoading } = useThread({ parentMessageId });

  // Loading state
  if (isLoading) {
    return (
      <div data-slot="thread-view" className={cn("flex h-full flex-col", className)}>
        <ThreadHeader onClose={onClose} closeButtonRef={closeButtonRef} />
        <ThreadViewSkeleton />
      </div>
    );
  }

  // Thread not found state
  if (!parent) {
    return (
      <div data-slot="thread-view" className={cn("flex h-full flex-col", className)}>
        <ThreadHeader onClose={onClose} closeButtonRef={closeButtonRef} />
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <MessageCircle
            className="mb-4 size-12 text-muted-foreground/50"
            aria-hidden="true"
          />
          <h3 className="text-lg font-medium">Thread not found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This thread may have been deleted or you don&apos;t have access to it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-slot="thread-view" className={cn("flex h-full flex-col", className)}>
      <ThreadHeader onClose={onClose} closeButtonRef={closeButtonRef} />

      {/* Parent message - highlighted */}
      <div className="shrink-0 border-b bg-muted/30">
        <MessageItem
          id={parent._id}
          content={parent.content}
          contentType={parent.contentType}
          senderId={parent.senderId}
          senderName={parent.sender.name}
          senderAvatarUrl={parent.sender.avatarUrl}
          createdAt={parent.createdAt}
          isOwn={parent.senderId === currentUserId}
          isEdited={parent.isEdited}
          threadReplyCount={parent.threadReplyCount}
          status={parent.status ?? "sent"}
          lesson={parent.lesson}
          showThreadButton={false}
          currentUserName={currentUserName}
        />
      </div>

      {/* Thread replies */}
      <div
        role="feed"
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions"
        aria-label={`Thread replies. ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
        className="flex-1 overflow-y-auto"
      >
        {replies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle
              className="mb-3 size-8 text-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              No replies yet. Start the conversation!
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {replies.map((reply, index) => (
              <article
                key={reply._id}
                role="article"
                aria-posinset={index + 1}
                aria-setsize={replies.length}
              >
                <MessageItem
                  id={reply._id}
                  content={reply.content}
                  contentType={reply.contentType}
                  senderId={reply.senderId}
                  senderName={reply.sender.name}
                  senderAvatarUrl={reply.sender.avatarUrl}
                  createdAt={reply.createdAt}
                  isOwn={reply.senderId === currentUserId}
                  isEdited={reply.isEdited}
                  status={reply.status ?? "sent"}
                  lesson={reply.lesson}
                  showThreadButton={false}
                  currentUserName={currentUserName}
                  onEdit={
                    onEdit && currentUserId === reply.senderId
                      ? () => onEdit(reply._id)
                      : undefined
                  }
                  onDelete={
                    onDelete && currentUserId === reply.senderId
                      ? () => onDelete(reply._id)
                      : undefined
                  }
                />
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { ThreadViewSkeleton };
