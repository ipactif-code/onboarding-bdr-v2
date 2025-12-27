"use client";

import { useState } from "react";

import { useMutation } from "convex/react";
import { MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as apiModule from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
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
}: MessageActionButtonsProps): React.ReactElement {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const addReaction = useMutation(api.reactions.addReaction);

  const handleEmojiSelect = async (emoji: string): Promise<void> => {
    try {
      await addReaction({ messageId, emoji });
      setShowEmojiPicker(false);
    } catch {
      toast.error("Failed to add reaction");
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

      {isOwn && (
        <>
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
        </>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            aria-label="More actions"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>More</TooltipContent>
      </Tooltip>
    </div>
  );
}
