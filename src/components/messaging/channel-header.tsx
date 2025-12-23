"use client";

import { Archive, Hash, Info, Lock, Users } from "lucide-react";

import { type ChannelWithMembership } from "@/hooks/use-channel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-plate/tooltip";

// ============================================================================
// Types
// ============================================================================

export interface ChannelHeaderProps {
  /**
   * The channel to display.
   */
  channel: ChannelWithMembership | null | undefined;
  /**
   * Whether the channel data is loading.
   */
  isLoading?: boolean;
  /**
   * Callback when the info button is clicked.
   */
  onInfoClick?: () => void;
  /**
   * Optional className for the container.
   */
  className?: string;
}

// ============================================================================
// ChannelHeader Component
// ============================================================================

/**
 * ChannelHeader displays the header of a channel view.
 *
 * Shows:
 * - Channel name with # prefix (or lock for private)
 * - Topic (if set)
 * - Member count
 * - Archive indicator if archived
 *
 * @example
 * ```tsx
 * const { channel, isLoading } = useChannel({ channelId });
 *
 * <ChannelHeader
 *   channel={channel}
 *   isLoading={isLoading}
 *   onInfoClick={() => setShowInfo(true)}
 * />
 * ```
 */
export function ChannelHeader({
  channel,
  isLoading = false,
  onInfoClick,
  className,
}: ChannelHeaderProps): React.ReactElement {
  if (isLoading) {
    return <ChannelHeaderSkeleton className={className} />;
  }

  if (!channel) {
    return (
      <div
        data-slot="channel-header"
        className={cn(
          "flex h-14 shrink-0 items-center border-b bg-background px-4",
          className
        )}
      >
        <span className="text-muted-foreground">Channel not found</span>
      </div>
    );
  }

  return (
    <header
      data-slot="channel-header"
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4",
        className
      )}
    >
      {/* Channel icon */}
      <div className="flex items-center gap-1.5">
        {channel.isArchived ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Archive
                className="size-5 text-muted-foreground"
                aria-label="Archived channel"
              />
            </TooltipTrigger>
            <TooltipContent>This channel is archived</TooltipContent>
          </Tooltip>
        ) : channel.type === "private" ? (
          <Lock
            className="size-5 text-muted-foreground"
            aria-label="Private channel"
          />
        ) : (
          <Hash
            className="size-5 text-muted-foreground"
            aria-label="Public channel"
          />
        )}
      </div>

      {/* Channel name and topic */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-base font-semibold">{channel.name}</h1>
          {channel.isArchived && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              Archived
            </span>
          )}
        </div>
        {channel.topic && (
          <p className="truncate text-xs text-muted-foreground">
            {channel.topic}
          </p>
        )}
      </div>

      {/* Member count */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground"
            aria-label={`${channel.memberCount} ${channel.memberCount === 1 ? "member" : "members"}`}
          >
            <Users className="size-4" />
            <span>{channel.memberCount}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {channel.memberCount} {channel.memberCount === 1 ? "member" : "members"}
        </TooltipContent>
      </Tooltip>

      {/* Info button */}
      {onInfoClick && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onInfoClick}
              aria-label="Channel info"
              className="shrink-0"
            >
              <Info className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Channel info</TooltipContent>
        </Tooltip>
      )}
    </header>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function ChannelHeaderSkeleton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      data-slot="channel-header-skeleton"
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4",
        className
      )}
    >
      <Skeleton className="size-5" />
      <div className="flex flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="size-8" />
    </div>
  );
}

export { ChannelHeaderSkeleton };
