"use client";

import * as React from "react";
import { type ReactElement } from "react";
import { useQuery } from "convex/react";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Load API with require to avoid TS2589
// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require("../../../../convex/_generated/api").api;

// ============================================================================
// Types
// ============================================================================

interface Collaborator {
  _id: Id<"kbDocumentCollaborators">;
  userId: Id<"users">;
  cursorColor: string;
  cursorPosition?: unknown;
  selectionRange?: unknown;
  isTyping: boolean;
  lastActiveAt: number;
  user: {
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
  } | null;
}

interface PresenceAvatarsProps {
  /** The document ID to show collaborators for */
  documentId: Id<"kbDocuments">;
  /** Maximum number of avatars to display before showing overflow count */
  maxAvatars?: number;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from a name (e.g., "John Doe" -> "JD")
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ============================================================================
// Typing Indicator Component
// ============================================================================

interface TypingIndicatorProps {
  color: string;
}

function TypingIndicator({ color }: TypingIndicatorProps): ReactElement {
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 flex size-2.5"
      aria-label="Currently typing"
    >
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

// ============================================================================
// Individual Avatar Component
// ============================================================================

interface CollaboratorAvatarProps {
  collaborator: Collaborator;
  zIndex: number;
}

function CollaboratorAvatar({
  collaborator,
  zIndex,
}: CollaboratorAvatarProps): ReactElement {
  const userName = collaborator.user?.name || "Unknown";
  const avatarUrl = collaborator.user?.avatarUrl;
  const { cursorColor, isTyping } = collaborator;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative" style={{ zIndex }}>
          <Avatar
            size="sm"
            className={cn(
              "border-2 transition-transform hover:scale-110 hover:z-10"
            )}
            style={{ borderColor: cursorColor }}
          >
            <AvatarImage src={avatarUrl} alt={userName} />
            <AvatarFallback
              className="text-xs font-medium"
              style={{ backgroundColor: cursorColor, color: "white" }}
            >
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          {isTyping && <TypingIndicator color={cursorColor} />}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="flex items-center gap-2">
          <div
            className="size-2 rounded-full"
            style={{ backgroundColor: cursorColor }}
            aria-hidden="true"
          />
          <span>{userName}</span>
          {isTyping && (
            <span className="text-muted-foreground">typing...</span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Overflow Indicator Component
// ============================================================================

interface OverflowIndicatorProps {
  overflowCount: number;
  overflowCollaborators: Collaborator[];
}

function OverflowIndicator({
  overflowCount,
  overflowCollaborators,
}: OverflowIndicatorProps): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AvatarGroupCount aria-label={`${overflowCount} more collaborators`}>
          +{overflowCount}
        </AvatarGroupCount>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="space-y-1">
          {overflowCollaborators.map((collab) => (
            <div key={collab._id} className="flex items-center gap-2">
              <div
                className="size-2 rounded-full"
                style={{ backgroundColor: collab.cursorColor }}
                aria-hidden="true"
              />
              <span>{collab.user?.name || "Unknown"}</span>
              {collab.isTyping && (
                <span className="text-muted-foreground">typing...</span>
              )}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Displays avatars of users currently editing the document.
 * Shows stacked avatars with overflow indicator when there are more
 * collaborators than maxAvatars.
 *
 * Features:
 * - Real-time updates via Convex subscription
 * - Cursor color borders for visual identification
 * - Typing indicator (pulsing dot) when user is actively typing
 * - Overflow count with tooltip showing additional users
 * - Accessible tooltips with user names
 */
export function PresenceAvatars({
  documentId,
  maxAvatars = 5,
  className,
}: PresenceAvatarsProps): ReactElement | null {
  const collaborators = useQuery(api.knowledge.collaboration.getActiveCollaborators, {
    documentId,
  }) as Collaborator[] | undefined;

  // Return null while loading or if no collaborators
  if (!collaborators || collaborators.length === 0) {
    return null;
  }

  const visibleCollaborators = collaborators.slice(0, maxAvatars);
  const overflowCollaborators = collaborators.slice(maxAvatars);
  const overflowCount = overflowCollaborators.length;

  return (
    <TooltipProvider delay={300}>
      <AvatarGroup
        className={cn("items-center", className)}
        role="group"
        aria-label={`${collaborators.length} collaborator${collaborators.length !== 1 ? "s" : ""} currently editing`}
      >
        {visibleCollaborators.map((collab, index) => (
          <CollaboratorAvatar
            key={collab._id}
            collaborator={collab}
            zIndex={visibleCollaborators.length - index}
          />
        ))}

        {overflowCount > 0 && (
          <OverflowIndicator
            overflowCount={overflowCount}
            overflowCollaborators={overflowCollaborators}
          />
        )}
      </AvatarGroup>
    </TooltipProvider>
  );
}
