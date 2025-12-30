"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusIndicator, type PresenceStatus } from "@/components/presence";
import { UnreadBadge } from "@/components/messaging/unread-badge";

interface DMListItemProps {
  conversationId: string;
  name: string;
  avatarUrl?: string;
  status?: PresenceStatus;
  unreadCount?: number;
  isActive?: boolean;
  onClick?: () => void;
}

/**
 * Simplified DM list item for sidebar.
 * Shows: avatar with online status + name
 * NO message preview, NO timestamp (per Slack-like design spec)
 */
export function DMListItem({
  conversationId,
  name,
  avatarUrl,
  status = "offline",
  unreadCount,
  isActive = false,
  onClick,
}: DMListItemProps): React.ReactElement {
  // Generate initials from name
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link
      href={`/messages/dm/${conversationId}`}
      onClick={onClick}
      data-slot="dm-list-item"
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1 text-sm",
        "transition-colors duration-150",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-foreground/80 hover:bg-accent/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {/* Avatar with status indicator */}
      <div className="relative shrink-0">
        <Avatar className="size-6">
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <StatusIndicator
          status={status}
          size="sm"
          className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background"
        />
      </div>

      {/* Name only - no preview/timestamp */}
      <span className="flex-1 truncate">{name}</span>

      {/* Unread badge */}
      {unreadCount !== undefined && unreadCount > 0 && (
        <UnreadBadge count={unreadCount} size="sm" />
      )}
    </Link>
  );
}

export type { DMListItemProps };
