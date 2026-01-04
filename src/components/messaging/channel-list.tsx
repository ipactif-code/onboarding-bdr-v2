"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Hash, Lock, Users } from "lucide-react";

import { useChannelList, type ChannelWithMembership } from "@/hooks/use-channel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UnreadBadge } from "@/components/messaging/unread-badge";

// ============================================================================
// Types
// ============================================================================

export interface ChannelListProps {
  /**
   * Filter channels by type.
   */
  type?: "public" | "private" | "course";
  /**
   * Whether to include archived channels.
   */
  includeArchived?: boolean;
  /**
   * Callback when a channel is selected.
   */
  onChannelSelect?: (channelId: string) => void;
  /**
   * Optional className for the container.
   */
  className?: string;
}

// ============================================================================
// ChannelListItem Component
// ============================================================================

interface ChannelListItemProps {
  channel: ChannelWithMembership;
  isActive: boolean;
  onClick?: () => void;
}

function ChannelListItem({
  channel,
  isActive,
  onClick,
}: ChannelListItemProps): React.ReactElement {
  const unreadCount = channel.membership?.unreadCount ?? 0;
  const isMuted = channel.membership?.isMuted ?? false;

  return (
    <Link
      href={`/messages/${channel._id}`}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive && "bg-accent text-accent-foreground",
        isMuted && "opacity-60"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Channel icon */}
      <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
        {channel.isArchived ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Archive className="size-4" aria-label="Archived channel" />
            </TooltipTrigger>
            <TooltipContent>Archived</TooltipContent>
          </Tooltip>
        ) : channel.type === "private" ? (
          <Lock className="size-4" aria-label="Private channel" />
        ) : (
          <Hash className="size-4" aria-label="Public channel" />
        )}
      </span>

      {/* Channel name */}
      <span
        className={cn(
          "flex-1 truncate",
          unreadCount > 0 && !isMuted && "font-semibold text-foreground"
        )}
      >
        {channel.name}
      </span>

      {/* Unread badge */}
      {unreadCount > 0 && !isMuted && (
        <UnreadBadge count={unreadCount} size="sm" />
      )}

      {/* Muted indicator */}
      {isMuted && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="size-2 rounded-full bg-muted-foreground/40"
              aria-label="Muted channel"
            />
          </TooltipTrigger>
          <TooltipContent>Muted</TooltipContent>
        </Tooltip>
      )}
    </Link>
  );
}

// ============================================================================
// ChannelList Component
// ============================================================================

/**
 * ChannelList displays the list of channels the current user has access to.
 *
 * Features:
 * - Real-time updates via Convex subscription
 * - Unread badges for channels with new messages
 * - Active state for currently viewed channel
 * - Public/private/archived channel indicators
 * - Sorted by last activity
 *
 * @example
 * ```tsx
 * <ChannelList
 *   type="public"
 *   onChannelSelect={(id) => console.log("Selected:", id)}
 * />
 * ```
 */
export function ChannelList({
  type,
  includeArchived = false,
  onChannelSelect,
  className,
}: ChannelListProps): React.ReactElement {
  const pathname = usePathname();
  const { channels, isLoading, totalUnreadCount, markAllAsRead } = useChannelList({
    type,
    includeArchived,
  });

  // Determine which channel is active based on the current route
  const activeChannelId = pathname?.split("/messages/")[1]?.split("/")[0];

  // Handle channel selection
  const handleChannelClick = useCallback(
    (channelId: string) => {
      onChannelSelect?.(channelId);
    },
    [onChannelSelect]
  );

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch {
      // Error handling is done via toast in the mutation
    }
  }, [markAllAsRead]);

  if (isLoading) {
    return <ChannelListSkeleton className={className} />;
  }

  // Filter out favorited channels (they appear in Favorites section)
  // Then separate remaining channels by membership
  const nonFavoriteChannels = channels.filter(
    (c) => !c.membership?.isFavorite
  );
  const memberChannels = nonFavoriteChannels.filter((c) => c.membership !== null);
  const otherChannels = nonFavoriteChannels.filter((c) => c.membership === null);

  return (
    <nav
      data-slot="channel-list"
      aria-label="Channel navigation"
      className={cn("flex h-full flex-col", className)}
    >
      {/* Skip link for keyboard users to bypass channel list */}
      <a
        href="#message-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-background focus:p-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to messages
      </a>
      {/* Header with mark all as read */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Channels</span>
          {totalUnreadCount > 0 && (
            <UnreadBadge count={totalUnreadCount} size="sm" />
          )}
        </div>
        {totalUnreadCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-6 px-2 text-xs"
              >
                Mark all read
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark all channels as read</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Channel list */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-2">
          {/* Channels user is a member of */}
          {memberChannels.length > 0 && (
            <div>
              <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your Channels
              </div>
              <div className="space-y-0.5">
                {memberChannels.map((channel) => (
                  <ChannelListItem
                    key={channel._id}
                    channel={channel}
                    isActive={activeChannelId === channel._id}
                    onClick={() => handleChannelClick(channel._id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Public channels user can join */}
          {otherChannels.length > 0 && (
            <div>
              <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Browse Channels
              </div>
              <div className="space-y-0.5">
                {otherChannels.map((channel) => (
                  <ChannelListItem
                    key={channel._id}
                    channel={channel}
                    isActive={activeChannelId === channel._id}
                    onClick={() => handleChannelClick(channel._id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {channels.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-8 text-center"
              role="status"
              aria-live="polite"
            >
              <Hash className="mb-2 size-8 text-muted-foreground/50" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">No channels found</p>
              <p className="text-xs text-muted-foreground/70">
                Channels will appear here when available
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </nav>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function ChannelListSkeleton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      data-slot="channel-list-skeleton"
      className={cn("flex h-full flex-col", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Header skeleton */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Channel items skeleton */}
      <div className="space-y-4 p-2">
        <div>
          <Skeleton className="mb-2 h-3 w-24" />
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="size-5 shrink-0" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading channels</span>
    </div>
  );
}

export { ChannelListSkeleton };
