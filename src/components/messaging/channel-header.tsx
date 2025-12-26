"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Archive, BellOff, Hash, Info, Lock, MoreHorizontal, Settings, Star, Users } from "lucide-react";
import { toast } from "sonner";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { type ChannelWithMembership } from "@/hooks/use-channel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-plate/tooltip";
import { ChannelMembersDialog } from "./channel-members-dialog";
import { ChannelSettingsDialog } from "./channel-settings-dialog";

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
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);

  // Get current user to check if they are a global admin
  const currentUser = useQuery(api.users.me);

  // Mutations for archive/unarchive and favorites
  const archiveChannel = useMutation(api.channels.archive);
  const unarchiveChannel = useMutation(api.channels.unarchive);
  const toggleFavorite = useMutation(api.channels.toggleFavorite);

  // Check user role for archive permission
  // Channel owner, channel admin, or global admin can archive
  const canArchive =
    channel?.membership?.role === "owner" ||
    channel?.membership?.role === "admin" ||
    currentUser?.role === "admin";

  // Only global admin can unarchive
  const canUnarchive = currentUser?.role === "admin";

  // Check user role for settings permission
  // Channel owner, channel admin, channel moderator, or global admin can access settings
  const canManageSettings =
    channel?.membership?.role === "owner" ||
    channel?.membership?.role === "admin" ||
    channel?.membership?.role === "moderator" ||
    currentUser?.role === "admin";

  const handleArchive = async (): Promise<void> => {
    if (!channel) return;
    try {
      setIsArchiving(true);
      await archiveChannel({ channelId: channel._id });
      setShowArchiveDialog(false);
      toast.success("Channel archived successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive channel"
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async (): Promise<void> => {
    if (!channel) return;
    try {
      setIsUnarchiving(true);
      await unarchiveChannel({ channelId: channel._id });
      toast.success("Channel unarchived successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unarchive channel"
      );
    } finally {
      setIsUnarchiving(false);
    }
  };

  const handleToggleFavorite = async (): Promise<void> => {
    if (!channel) return;
    try {
      const newState = await toggleFavorite({ channelId: channel._id });
      toast.success(
        newState ? "Added to favorites" : "Removed from favorites"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update favorite"
      );
    }
  };

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
    <>
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

        {/* Member count - clickable to open members dialog */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMembersDialogOpen(true)}
              className="shrink-0 gap-1 text-muted-foreground hover:text-foreground"
              aria-label={`${channel.memberCount} ${channel.memberCount === 1 ? "member" : "members"}. Click to manage members.`}
            >
              <Users className="size-4" />
              <span>{channel.memberCount}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Manage members</TooltipContent>
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

        {/* Channel options dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Channel options"
                className="shrink-0"
              />
            }
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleToggleFavorite}>
              <Star className="mr-2 size-4" aria-hidden="true" />
              {channel.membership?.isFavorite ? "Remove from favorites" : "Add to favorites"}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BellOff className="mr-2 size-4" aria-hidden="true" />
              Mute channel
            </DropdownMenuItem>
            {canManageSettings && (
              <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                <Settings className="mr-2 size-4" aria-hidden="true" />
                Channel settings
              </DropdownMenuItem>
            )}
            {canArchive && !channel.isArchived && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowArchiveDialog(true)}
                  variant="destructive"
                >
                  <Archive className="mr-2 size-4" aria-hidden="true" />
                  Archive channel
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Archived channel banner */}
      {channel.isArchived && (
        <div className="flex items-center justify-between bg-yellow-100 px-4 py-2 text-sm border-b dark:bg-yellow-900/30">
          <div className="flex items-center gap-2">
            <Archive className="size-4" aria-hidden="true" />
            <span>This channel is archived and read-only.</span>
          </div>
          {canUnarchive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnarchive}
              disabled={isUnarchiving}
            >
              {isUnarchiving ? "Unarchiving..." : "Unarchive"}
            </Button>
          )}
        </div>
      )}

      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Channel</AlertDialogTitle>
            <AlertDialogDescription>
              This will make the channel read-only. Members can still view message
              history but cannot send new messages. You can unarchive at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isArchiving}>
              {isArchiving ? "Archiving..." : "Archive Channel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Channel Members Dialog */}
      <ChannelMembersDialog
        channelId={channel._id}
        open={isMembersDialogOpen}
        onOpenChange={setIsMembersDialogOpen}
        userRole={channel.membership?.role}
      />

      {/* Channel Settings Dialog */}
      <ChannelSettingsDialog
        channelId={channel._id}
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </>
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
