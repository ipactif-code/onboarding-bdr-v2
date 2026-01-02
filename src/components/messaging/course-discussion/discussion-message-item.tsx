"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MAX_MESSAGE_CHARS } from "@/components/messaging/rich-text-renderer-utils";

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

  // State for expanding/collapsing long messages
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate if content should be truncated
  const shouldTruncate = useMemo(() => {
    return displayContent.length > MAX_MESSAGE_CHARS;
  }, [displayContent]);

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
        <div
          data-slot="message-content-wrapper"
          data-should-truncate={shouldTruncate}
          data-is-expanded={isExpanded}
        >
          {/* Collapsible content container */}
          <div
            className={cn(
              "relative mt-1 text-sm text-foreground whitespace-pre-wrap break-words overflow-hidden transition-[max-height] duration-300 ease-in-out",
              shouldTruncate && !isExpanded && "max-h-32"
            )}
          >
            {displayContent}
            {/* Gradient fade overlay when collapsed */}
            {shouldTruncate && !isExpanded && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Show more / Show less toggle button */}
          {shouldTruncate && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              className={cn(
                "mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground",
                "hover:text-foreground focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm transition-colors"
              )}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="size-3.5" aria-hidden="true" />
                  <span>Show less</span>
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                  <span>Show more</span>
                </>
              )}
            </button>
          )}
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
