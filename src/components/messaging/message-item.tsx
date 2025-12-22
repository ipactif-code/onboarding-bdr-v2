"use client";

import { formatDistanceToNow } from "date-fns";
import { Check, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-plate/tooltip";
import { cn } from "@/lib/utils";

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
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Generates initials from a display name.
 * Returns up to 2 characters (first letter of first two words).
 */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const firstWord = words[0];
  const secondWord = words[1];

  if (!firstWord) {
    return "?";
  }

  if (!secondWord) {
    return firstWord.length >= 2
      ? firstWord.slice(0, 2).toUpperCase()
      : firstWord.toUpperCase();
  }

  const first = firstWord[0] ?? "";
  const second = secondWord[0] ?? "";
  return (first + second).toUpperCase();
}

/**
 * Formats a timestamp into a human-readable relative time.
 * For recent messages shows relative time, for older messages shows date.
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays < 7) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

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
                <Check className="size-3 text-muted-foreground" />
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

        {/* Message body */}
        <div className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
          {content}
        </div>

        {/* Thread reply count */}
        {threadReplyCount > 0 && (
          <button
            type="button"
            onClick={onReply}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <MessageSquare className="size-3" />
            <span>
              {threadReplyCount} {threadReplyCount === 1 ? "reply" : "replies"}
            </span>
          </button>
        )}
      </div>

      {/* Action buttons (visible on hover) */}
      <div
        className={cn(
          "absolute right-4 top-2 flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 shadow-sm",
          "opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onReply}
              aria-label="Reply to message"
            >
              <MessageSquare className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reply</TooltipContent>
        </Tooltip>

        {isOwn && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onEdit}
                  aria-label="Edit message"
                >
                  <Pencil className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onDelete}
                  aria-label="Delete message"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>More</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for MessageItem.
 * Displays placeholder UI while message data is loading.
 */
export function MessageItemSkeleton(): React.ReactElement {
  return (
    <div className="flex gap-3 px-4 py-2">
      <Skeleton className="size-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
