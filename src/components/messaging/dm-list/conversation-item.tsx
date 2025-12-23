"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-plate/tooltip";
import { UnreadBadge } from "@/components/messaging/unread-badge";
import { ConversationAvatar } from "./conversation-avatar";
import {
  type Conversation,
  formatRelativeTime,
  getConversationDisplayName,
} from "./types";

// ============================================================================
// ConversationItem Component
// ============================================================================

export interface ConversationItemProps {
  /** The conversation data to display */
  conversation: Conversation;
  /** Whether this conversation is currently active/selected */
  isActive: boolean;
  /** Callback when the conversation is clicked */
  onClick?: () => void;
}

/**
 * ConversationItem renders a single conversation row in the DM list.
 *
 * Features:
 * - Avatar with online status indicator
 * - Display name (participant name for DMs, multiple names for groups)
 * - Last message preview with sender name in groups
 * - Relative timestamp
 * - Unread count badge
 * - Active state highlighting
 * - Keyboard accessible with proper focus states
 */
export function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps): React.ReactElement {
  const displayName = getConversationDisplayName(
    conversation.participants,
    conversation.type
  );
  const hasUnread = conversation.unreadCount > 0;
  const timeAgo = conversation.lastMessage
    ? formatRelativeTime(conversation.lastMessage.createdAt)
    : formatRelativeTime(conversation.updatedAt);

  // Determine if any participant is online (for group indicator)
  const hasOnlineParticipant =
    conversation.type !== "direct" &&
    conversation.participants.some((p) => p.status === "online");

  // Build descriptive aria-label for screen readers
  const ariaLabel = hasUnread
    ? `${displayName}, ${conversation.unreadCount} unread message${conversation.unreadCount > 1 ? "s" : ""}, last activity ${timeAgo}`
    : `${displayName}, last activity ${timeAgo}`;

  return (
    <Link
      href={`/messages/dm/${conversation._id}`}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-md px-2 py-2 transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive && "bg-accent text-accent-foreground"
      )}
      aria-current={isActive ? "page" : undefined}
      aria-label={ariaLabel}
    >
      {/* Avatar section */}
      <div className="relative shrink-0">
        <ConversationAvatar
          participants={conversation.participants}
          type={conversation.type}
        />
        {/* Group online indicator */}
        {hasOnlineParticipant && conversation.type !== "direct" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="img"
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-green-500"
                aria-label="Members online"
              />
            </TooltipTrigger>
            <TooltipContent>Members online</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Content section */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          {/* Name */}
          <span
            className={cn(
              "truncate text-sm",
              hasUnread && "font-semibold text-foreground"
            )}
          >
            {displayName}
          </span>
          {/* Time */}
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo}
          </span>
        </div>
        {/* Last message preview */}
        {conversation.lastMessage && (
          <p
            className={cn(
              "truncate text-xs text-muted-foreground",
              hasUnread && "text-foreground/70"
            )}
          >
            {conversation.type !== "direct" && (
              <span className="font-medium">
                {conversation.lastMessage.senderName.split(" ")[0]}:{" "}
              </span>
            )}
            {conversation.lastMessage.content}
          </p>
        )}
      </div>

      {/* Unread badge */}
      {hasUnread && (
        <UnreadBadge count={conversation.unreadCount} size="sm" />
      )}
    </Link>
  );
}
