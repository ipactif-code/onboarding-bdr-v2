"use client";

import { Check, MessageSquare } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-plate/tooltip";
import { cn } from "@/lib/utils";
import { getInitials, formatTimestamp } from "@/lib/message-utils";
import { LessonBadge } from "@/components/messaging/lesson-badge";
import { MessageItemSkeleton } from "@/components/messaging/message-item-skeleton";
import { MessageActionButtons } from "@/components/messaging/message-action-buttons";
import { RichTextRenderer } from "@/components/messaging/rich-text-renderer";

// ============================================================================
// Types
// ============================================================================

export interface MessageItemProps {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  createdAt: number;
  isOwn: boolean;
  isEdited?: boolean;
  threadReplyCount?: number;
  status?: "sending" | "sent" | "failed";
  /** Lesson information for messages linked to a course lesson. */
  lesson?: {
    title: string;
  };
  /**
   * Whether to show the thread reply button and indicator.
   * Set to false when displaying messages inside a thread panel to avoid nested navigation.
   * @default true
   */
  showThreadButton?: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// ============================================================================
// MessageItem Component
// ============================================================================

/**
 * MessageItem component displays a single message in a conversation.
 * Supports different visual states for sending, sent, and failed messages.
 * Shows action buttons on hover for reply, edit (own messages), and delete (own messages).
 */
export function MessageItem({
  id,
  content,
  senderId,
  senderName,
  senderAvatarUrl,
  createdAt,
  isOwn,
  isEdited = false,
  threadReplyCount = 0,
  status = "sent",
  lesson,
  showThreadButton = true,
  onReply,
  onEdit,
  onDelete,
}: MessageItemProps): React.ReactElement {
  return (
    <div
      data-slot="message-item"
      data-message-id={id}
      data-sender-id={senderId}
      data-status={status}
      className={cn(
        "group relative flex gap-3 px-4 py-2 transition-colors hover:bg-muted/50",
        isOwn && "bg-muted/30",
        status === "sending" && "opacity-60",
        status === "failed" && "border-l-2 border-destructive bg-destructive/5"
      )}
    >
      {/* Avatar */}
      <Avatar size="default" className="mt-0.5 shrink-0">
        {senderAvatarUrl ? (
          <AvatarImage src={senderAvatarUrl} alt={senderName} />
        ) : null}
        <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
      </Avatar>

      {/* Message content area */}
      <div className="min-w-0 flex-1">
        {/* Header: sender name, timestamp, status indicator */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {senderName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(createdAt)}
          </span>
          {isEdited && (
            <span className="text-xs text-muted-foreground italic">
              (edited)
            </span>
          )}
          {isOwn && status === "sent" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex" aria-label="Message sent">
                  <Check className="size-3 text-muted-foreground" aria-hidden="true" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Sent</TooltipContent>
            </Tooltip>
          )}
          {status === "failed" && (
            <span className="text-xs font-medium text-destructive">
              Failed to send
            </span>
          )}
        </div>

        {/* Lesson badge for messages linked to a course lesson */}
        {lesson && (
          <div className="mt-1">
            <LessonBadge lessonTitle={lesson.title} />
          </div>
        )}

        {/* Message body */}
        <div className="mt-1 break-words text-foreground">
          <RichTextRenderer content={content} />
        </div>

        {/* Thread reply count indicator */}
        {showThreadButton && threadReplyCount > 0 && (
          <button
            type="button"
            onClick={onReply}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
            aria-label={`View ${threadReplyCount} ${threadReplyCount === 1 ? "reply" : "replies"}`}
          >
            <MessageSquare className="size-3" aria-hidden="true" />
            <span>
              {threadReplyCount} {threadReplyCount === 1 ? "reply" : "replies"}
            </span>
          </button>
        )}
      </div>

      {/* Action buttons (visible on hover/focus) */}
      <MessageActionButtons
        isOwn={isOwn}
        showThreadButton={showThreadButton}
        onReply={onReply}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

export { MessageItemSkeleton };
