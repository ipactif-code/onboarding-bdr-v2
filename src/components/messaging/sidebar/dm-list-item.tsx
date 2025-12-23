"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OnlineIndicator, type Status } from "../online-indicator";

interface DMListItemProps {
  conversationId: string;
  name: string;
  avatarUrl?: string;
  status?: Status;
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
      {/* Avatar with online indicator */}
      <div className="relative shrink-0">
        <Avatar className="size-6">
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <OnlineIndicator status={status} size="sm" showAsBadge />
      </div>

      {/* Name only - no preview/timestamp */}
      <span className="flex-1 truncate">{name}</span>
    </Link>
  );
}

export type { DMListItemProps };
