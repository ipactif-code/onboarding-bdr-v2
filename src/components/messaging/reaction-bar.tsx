"use client";

/**
 * ReactionBar - Displays message reactions grouped by emoji.
 *
 * Features:
 * - Displays reactions as buttons with emoji and count
 * - Highlights reactions the current user has added
 * - Click to toggle reaction (add if not reacted, remove if already reacted)
 * - Hover tooltip shows list of users who reacted (max 5 with "+X more")
 * - Add reaction button opens emoji picker
 * - Optimistic updates for instant feedback
 * - Accessible (keyboard navigable, aria-labels)
 * - Responsive (wraps on small screens)
 */

import { useState } from "react";
import { useMutation } from "convex/react";

import type { Id } from "../../../convex/_generated/dataModel";
import * as apiModule from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmojiPicker } from "@/components/messaging/emoji-picker";
import { ReactionButton } from "@/components/messaging/reaction-button";

// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;

// ============================================================================
// Types
// ============================================================================

export interface ReactionGroup {
  /** The emoji character */
  emoji: string;
  /** Number of users who reacted with this emoji */
  count: number;
  /** Array of user IDs who reacted */
  userIds: Id<"users">[];
  /** Whether the current user has reacted with this emoji */
  currentUserReacted: boolean;
}

export interface ReactionBarProps {
  /** The message ID to add/remove reactions for */
  messageId: Id<"messages">;
  /** Array of grouped reactions with emoji, count, userIds, and currentUserReacted */
  reactions: ReactionGroup[];
  /** Optional className for the container */
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ReactionBar displays message reactions grouped by emoji.
 */
export function ReactionBar({
  messageId,
  reactions,
  className,
}: ReactionBarProps): React.ReactElement | null {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null);

  const addReaction = useMutation(api.reactions.addReaction);
  const removeReaction = useMutation(api.reactions.removeReaction);

  /**
   * Handle toggling a reaction.
   * Uses optimistic updates by tracking pending state.
   */
  const handleToggleReaction = async (
    emoji: string,
    currentUserReacted: boolean
  ): Promise<void> => {
    setPendingEmoji(emoji);

    // Debug logging

    try {
      if (currentUserReacted) {
        const _result = await removeReaction({ messageId, emoji });
      } else {
        const _result = await addReaction({ messageId, emoji });
      }
    } catch (err) {
      console.error("[ReactionBar] Toggle reaction error:", err);
      toast.error(
        currentUserReacted
          ? "Failed to remove reaction"
          : "Failed to add reaction"
      );
    } finally {
      setPendingEmoji(null);
    }
  };

  /**
   * Handle adding a new reaction from the emoji picker.
   */
  const handleAddNewReaction = async (emoji: string): Promise<void> => {
    setEmojiPickerOpen(false);
    setPendingEmoji(emoji);

    // Debug logging

    try {
      const _result = await addReaction({ messageId, emoji });
    } catch (err) {
      console.error("[ReactionBar] Reaction error details:", err);
      toast.error("Failed to add reaction");
    } finally {
      setPendingEmoji(null);
    }
  };

  // Don't render anything if no reactions and we want to hide the add button
  // For now, always show the add button for accessibility
  const hasReactions = reactions.length > 0;

  return (
    <div
      data-slot="reaction-bar"
      className={cn(
        "flex flex-wrap items-center gap-1",
        className
      )}
      role="group"
      aria-label="Message reactions"
    >
      {/* Existing reactions */}
      {reactions.map((reaction) => (
        <ReactionButton
          key={reaction.emoji}
          emoji={reaction.emoji}
          count={reaction.count}
          userIds={reaction.userIds}
          currentUserReacted={reaction.currentUserReacted}
          isPending={pendingEmoji === reaction.emoji}
          onToggle={() =>
            handleToggleReaction(reaction.emoji, reaction.currentUserReacted)
          }
        />
      ))}

      {/* Add reaction button with emoji picker */}
      <EmojiPicker
        open={emojiPickerOpen}
        onOpenChange={setEmojiPickerOpen}
        onEmojiSelect={handleAddNewReaction}
        side="top"
        align="start"
        disabled={pendingEmoji !== null}
        triggerClassName={cn(
          "h-7 w-7",
          !hasReactions && "opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        )}
      />
    </div>
  );
}

// ============================================================================
// Skeleton Component
// ============================================================================

/**
 * Loading skeleton for ReactionBar.
 */
export function ReactionBarSkeleton(): React.ReactElement {
  return (
    <div
      data-slot="reaction-bar-skeleton"
      className="flex items-center gap-1"
      aria-hidden="true"
    >
      <div className="h-7 w-12 motion-safe:animate-pulse rounded-md bg-muted" />
      <div className="h-7 w-12 motion-safe:animate-pulse rounded-md bg-muted" />
    </div>
  );
}
