"use client";

/**
 * ReactionButton - Individual reaction button with tooltip showing user names.
 *
 * This component is extracted from reaction-bar.tsx for better maintainability.
 * It displays a single reaction with:
 * - Emoji and count
 * - Visual highlight if the current user reacted
 * - Tooltip with user names who reacted
 * - Accessible labels and aria attributes
 */

import { useQuery } from "convex/react";

import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================================
// Constants
// ============================================================================

const MAX_TOOLTIP_NAMES = 5;

// ============================================================================
// Types
// ============================================================================

export interface ReactionButtonProps {
  /** The emoji character */
  emoji: string;
  /** Number of users who reacted */
  count: number;
  /** Array of user IDs who reacted */
  userIds: Id<"users">[];
  /** Whether the current user has reacted */
  currentUserReacted: boolean;
  /** Whether the reaction is pending */
  isPending: boolean;
  /** Callback when the button is clicked */
  onToggle: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build tooltip text from user names.
 */
function buildTooltipText(
  userNames: { userId: Id<"users">; name: string }[] | undefined,
  totalCount: number
): string {
  if (!userNames || userNames.length === 0) {
    return `${totalCount} ${totalCount === 1 ? "person" : "people"}`;
  }

  const names = userNames.map((u) => u.name);
  const displayedNames = names.slice(0, MAX_TOOLTIP_NAMES);
  const remainingCount = names.length - MAX_TOOLTIP_NAMES;

  if (remainingCount > 0) {
    return `${displayedNames.join(", ")} +${remainingCount} more`;
  }

  return displayedNames.join(", ");
}

// ============================================================================
// Component
// ============================================================================

/**
 * Individual reaction button with tooltip showing user names.
 */
export function ReactionButton({
  emoji,
  count,
  userIds,
  currentUserReacted,
  isPending,
  onToggle,
}: ReactionButtonProps): React.ReactElement {
  // Fetch user names for tooltip - only fetch when there are userIds
  const userNames = useQuery(
    api.reactions.getReactionUserNames,
    userIds.length > 0 ? { userIds } : "skip"
  ) as { userId: Id<"users">; name: string }[] | undefined;

  // Build tooltip text showing user names
  const tooltipText = buildTooltipText(userNames, userIds.length);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={onToggle}
          className={cn(
            "h-7 gap-1 px-2 text-sm font-normal",
            "hover:bg-muted",
            "min-h-11 min-w-11", // WCAG 2.5.5 touch target
            currentUserReacted && "bg-primary/10 text-primary hover:bg-primary/20",
            isPending && "opacity-50"
          )}
          aria-label={`${emoji} reaction, ${count} ${count === 1 ? "person" : "people"}${currentUserReacted ? ", you reacted" : ""}`}
          aria-pressed={currentUserReacted}
        >
          <span className="text-base" aria-hidden="true">
            {emoji}
          </span>
          <span className="tabular-nums">{count}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}
