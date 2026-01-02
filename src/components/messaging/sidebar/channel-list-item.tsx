"use client";

import * as React from "react";
import Link from "next/link";
import { Hash, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelListItemProps {
  id: string;
  name: string;
  isPrivate?: boolean;
  unreadCount?: number;
  isActive?: boolean;
  onClick?: () => void;
}

/**
 * Simplified channel list item for sidebar.
 * Shows: # or lock icon + name + unread badge
 */
export function ChannelListItem({
  id,
  name,
  isPrivate = false,
  unreadCount = 0,
  isActive = false,
  onClick,
}: ChannelListItemProps): React.ReactElement {
  const Icon = isPrivate ? Lock : Hash;

  return (
    <Link
      href={`/messages/${id}`}
      onClick={onClick}
      data-slot="channel-list-item"
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1 text-sm",
        // Mobile touch target: min 44px height
        "min-h-11 md:min-h-0",
        "transition-colors duration-150",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-foreground/80 hover:bg-accent/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{name}</span>
      {unreadCount > 0 && (
        <span
          className="ml-auto flex size-5 min-w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
          aria-label={`${unreadCount} unread messages`}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

export type { ChannelListItemProps };
