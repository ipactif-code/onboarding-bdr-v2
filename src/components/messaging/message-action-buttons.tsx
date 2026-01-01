"use client";

import { useState } from "react";

import { useMutation, useQuery } from "convex/react";
import {
  Bookmark,
  BookmarkCheck,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import * as apiModule from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-plate/tooltip";
import { cn } from "@/lib/utils";

import { EmojiPicker } from "./emoji-picker";

// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;

// ============================================================================
// Types
// ============================================================================

export interface MessageActionButtonsProps {
  /** The message ID for adding reactions. */
  messageId: Id<"messages">;
  /** Whether this message belongs to the current user. */
  isOwn: boolean;
  /** Whether to show the thread reply button. */
  showThreadButton?: boolean;
  /** Callback when reply button is clicked. */
  onReply?: () => void;
  /** Callback when edit button is clicked. */
  onEdit?: () => void;
  /** Callback when delete button is clicked. */
  onDelete?: () => void;
  /** Optional className for the container. */
  className?: string;
  /** The channel ID (for channel pin functionality). */
  channelId?: Id<"channels">;
  /** The conversation ID (for DM pin functionality). */
  conversationId?: Id<"conversations">;
  /** Whether the current user is a channel admin. */
  isChannelAdmin?: boolean;
}

// ============================================================================
// MessageActionButtons Component
// ============================================================================

/**
 * MessageActionButtons displays hover action buttons for a message.
 * Shows reaction picker, reply, edit (own messages only), delete (own messages only), and more options.
 * Buttons have 44x44px minimum touch targets for WCAG 2.5.5 compliance.
 */
export function MessageActionButtons({
  messageId,
  isOwn,
  showThreadButton = true,
  onReply,
  onEdit,
  onDelete,
  className,
  channelId,
  conversationId,
  isChannelAdmin = false,
}: MessageActionButtonsProps): React.ReactElement {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Mutations
  const addReaction = useMutation(api.reactions.addReaction);
  const pinMessage = useMutation(api.pins.pinMessage);
  const unpinMessage = useMutation(api.pins.unpinMessage);
  const addBookmark = useMutation(api.bookmarks.addBookmark);
  const removeBookmark = useMutation(api.bookmarks.removeBookmark);

  // Queries for pin/bookmark status
  const pinStatus = useQuery(api.pins.getByMessage, { messageId });
  const bookmarkStatus = useQuery(api.bookmarks.getByMessage, { messageId });

  // Derived state
  const isPinned = pinStatus !== undefined && pinStatus !== null;
  const isBookmarked = bookmarkStatus !== undefined && bookmarkStatus !== null;

  // Authorization:
  // - Channels: Can pin if channel admin OR message creator
  // - DMs: Any participant can pin (backend enforces participant check)
  const canPin = channelId ? (isChannelAdmin || isOwn) : conversationId ? true : false;

  const handleEmojiSelect = async (emoji: string): Promise<void> => {
    try {
      await addReaction({ messageId, emoji });
      setShowEmojiPicker(false);
    } catch {
      toast.error("Failed to add reaction");
    }
  };

  const handlePinToggle = async (): Promise<void> => {
    // Must have either channelId or conversationId to pin
    if (!channelId && !conversationId) return;

    try {
      if (isPinned && pinStatus) {
        await unpinMessage({ pinId: pinStatus._id });
        toast.success("Message unpinned");
      } else {
        // Pin to channel or conversation (DM)
        if (channelId) {
          await pinMessage({ channelId, messageId });
        } else if (conversationId) {
          await pinMessage({ conversationId, messageId });
        }
        toast.success("Message pinned");
      }
    } catch {
      toast.error(isPinned ? "Failed to unpin message" : "Failed to pin message");
    }
  };

  const handleBookmarkToggle = async (): Promise<void> => {
    try {
      if (isBookmarked && bookmarkStatus) {
        await removeBookmark({ bookmarkId: bookmarkStatus._id });
        toast.success("Bookmark removed");
      } else {
        await addBookmark({ messageId });
        toast.success("Message bookmarked");
      }
    } catch {
      toast.error(
        isBookmarked ? "Failed to remove bookmark" : "Failed to bookmark message"
      );
    }
  };

  return (
    <div
      data-slot="message-action-buttons"
      className={cn(
        "absolute right-4 top-2 flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 shadow-sm",
        "opacity-0 transition-opacity",
        "group-hover:opacity-100",
        "focus-within:opacity-100",
        "group-focus-within:opacity-100",
        className
      )}
    >
      {/* Add Reaction Button with Emoji Picker */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <EmojiPicker
              open={showEmojiPicker}
              onOpenChange={setShowEmojiPicker}
              onEmojiSelect={handleEmojiSelect}
              triggerClassName="min-h-11 min-w-11"
              side="top"
              align="start"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>Add reaction</TooltipContent>
      </Tooltip>

      {showThreadButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={onReply}
              aria-label="Reply in thread"
            >
              <MessageSquare className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reply in thread</TooltipContent>
        </Tooltip>
      )}

      {/* Edit button - only for own messages */}
      {isOwn && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={onEdit}
              aria-label="Edit message"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      )}

      {/* Delete button - for own messages OR channel admins */}
      {(isOwn || isChannelAdmin) && onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
              aria-label="Delete message"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      )}

      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label="More actions"
                />
              }
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>More</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" side="top" sideOffset={4}>
          {/* Pin/Unpin Action - only shown if user can pin */}
          {canPin && (
            <>
              <DropdownMenuItem
                onClick={handlePinToggle}
                aria-label={isPinned ? "Unpin message" : "Pin message"}
              >
                {isPinned ? (
                  <>
                    <PinOff className="size-4" aria-hidden="true" />
                    <span>Unpin Message</span>
                  </>
                ) : (
                  <>
                    <Pin className="size-4" aria-hidden="true" />
                    <span>Pin Message</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Bookmark/Remove Bookmark Action - always available */}
          <DropdownMenuItem
            onClick={handleBookmarkToggle}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark message"}
          >
            {isBookmarked ? (
              <>
                <BookmarkCheck className="size-4" aria-hidden="true" />
                <span>Remove Bookmark</span>
              </>
            ) : (
              <>
                <Bookmark className="size-4" aria-hidden="true" />
                <span>Bookmark Message</span>
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
