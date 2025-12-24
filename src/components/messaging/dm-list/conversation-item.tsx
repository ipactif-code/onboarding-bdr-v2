"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { MoreVertical, Star, BellOff, EyeOff, LogOut } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
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
 * - Dropdown menu for hide/leave actions on hover
 */
export function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps): React.ReactElement {
  const router = useRouter();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const hideConversation = useMutation(api.directMessages.hide);
  const leaveGroup = useMutation(api.directMessages.leaveGroup);
  const toggleFavorite = useMutation(api.directMessages.toggleFavorite);

  const displayName = getConversationDisplayName(
    conversation.participants,
    conversation.type
  );
  const hasUnread = conversation.unreadCount > 0;
  const timeAgo = conversation.lastMessage
    ? formatRelativeTime(conversation.lastMessage.createdAt)
    : formatRelativeTime(conversation.updatedAt);

  // Determine if this is a group DM (3+ participants)
  const isGroupDM =
    conversation.type === "group" && conversation.participants.length >= 2;

  // Determine if any participant is online (for group indicator)
  const hasOnlineParticipant =
    conversation.type !== "direct" &&
    conversation.participants.some((p) => p.status === "online");

  // Build descriptive aria-label for screen readers
  const ariaLabel = hasUnread
    ? `${displayName}, ${conversation.unreadCount} unread message${conversation.unreadCount > 1 ? "s" : ""}, last activity ${timeAgo}`
    : `${displayName}, last activity ${timeAgo}`;

  const handleHide = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setIsHiding(true);
      await hideConversation({
        conversationId: conversation._id as Id<"conversations">,
      });
      toast.success("Conversation hidden");
      // Navigate away if we're on this conversation
      if (isActive) {
        router.push("/messages");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to hide conversation"
      );
    } finally {
      setIsHiding(false);
    }
  };

  const handleLeaveGroup = async (): Promise<void> => {
    try {
      setIsLeaving(true);
      await leaveGroup({
        conversationId: conversation._id as Id<"conversations">,
      });
      setShowLeaveDialog(false);
      toast.success("You have left the group");
      // Navigate away if we're on this conversation
      if (isActive) {
        router.push("/messages");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to leave group"
      );
    } finally {
      setIsLeaving(false);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const newState = await toggleFavorite({
        conversationId: conversation._id as Id<"conversations">,
      });
      toast.success(
        newState ? "Added to favorites" : "Removed from favorites"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update favorite"
      );
    }
  };

  return (
    <>
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

        {/* Dropdown menu - shows on hover */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label="Conversation options"
              />
            }
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem onClick={handleToggleFavorite}>
              <Star className="mr-2 size-4" aria-hidden="true" />
              Toggle favorite
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <BellOff className="mr-2 size-4" aria-hidden="true" />
              Mute conversation
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!isGroupDM && (
              <DropdownMenuItem onClick={handleHide} disabled={isHiding}>
                <EyeOff className="mr-2 size-4" aria-hidden="true" />
                {isHiding ? "Hiding..." : "Hide conversation"}
              </DropdownMenuItem>
            )}
            {isGroupDM && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowLeaveDialog(true);
                }}
                variant="destructive"
              >
                <LogOut className="mr-2 size-4" aria-hidden="true" />
                Leave group
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </Link>

      {/* Leave Group Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer receive messages from this group. You cannot
              rejoin unless someone adds you back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveGroup}
              disabled={isLeaving}
              variant="destructive"
            >
              {isLeaving ? "Leaving..." : "Leave Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
