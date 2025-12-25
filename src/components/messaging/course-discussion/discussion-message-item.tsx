"use client";

import { MessageCircle } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { DiscussionMessageItemProps } from "./types";
import { getInitials, formatTimestamp, getTextContent } from "./utils";

/**
 * Renders a single discussion message.
 */
export function DiscussionMessageItem({
  message,
  onReply,
}: DiscussionMessageItemProps): React.ReactElement {
  const displayContent = getTextContent(message.content);

  return (
    <div
      data-slot="discussion-message-item"
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30",
        message.status === "sending" && "opacity-60"
      )}
    >
      {/* Avatar */}
      <Avatar size="sm" className="mt-0.5 shrink-0">
        {message.sender.avatarUrl ? (
          <AvatarImage src={message.sender.avatarUrl} alt={message.sender.name} />
        ) : null}
        <AvatarFallback>{getInitials(message.sender.name)}</AvatarFallback>
      </Avatar>

      {/* Message content area */}
      <div className="min-w-0 flex-1">
        {/* Header: sender name, timestamp */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {message.sender.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(message.createdAt)}
          </span>
          {message.isEdited && (
            <span className="text-xs text-muted-foreground italic">
              <span className="sr-only">Message </span>(edited)
            </span>
          )}
        </div>

        {/* Message body */}
        <div className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
          {displayContent}
        </div>

        {/* Thread reply count */}
        {(message.threadReplyCount ?? 0) > 0 && (
          <button
            type="button"
            onClick={onReply}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <MessageCircle className="size-3" />
            <span>
              {message.threadReplyCount}{" "}
              {message.threadReplyCount === 1 ? "reply" : "replies"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
