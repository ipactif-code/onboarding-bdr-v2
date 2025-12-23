"use client";

import { ArrowLeft, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

// ============================================================================
// Types
// ============================================================================

export interface Participant {
  _id: string;
  name: string;
  avatarUrl?: string;
  status: "online" | "offline" | "away" | "dnd";
}

export interface DMHeaderProps {
  participants: Participant[];
  displayName: string;
  conversationType: "direct" | "group" | "broadcast";
  onBack: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates initials from a display name.
 * Returns up to 2 characters (first letter of first two words).
 */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const firstWord = words[0];
  const secondWord = words[1];

  if (!firstWord) {
    return "?";
  }

  if (!secondWord) {
    return firstWord.length >= 2
      ? firstWord.slice(0, 2).toUpperCase()
      : firstWord.toUpperCase();
  }

  const first = firstWord[0] ?? "";
  const second = secondWord[0] ?? "";
  return (first + second).toUpperCase();
}

/**
 * Gets the status color class for a user status.
 */
function getStatusColor(status: Participant["status"]): string {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "away":
      return "bg-yellow-500";
    case "dnd":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

// ============================================================================
// DMHeader Component
// ============================================================================

/**
 * Header component for direct message conversations.
 * Displays participant info, avatars, and online status.
 */
export function DMHeader({
  participants,
  displayName,
  conversationType,
  onBack,
}: DMHeaderProps): React.ReactElement {
  const firstParticipant = participants[0];
  const isGroup = conversationType === "group" || participants.length > 1;

  return (
    <div
      data-slot="dm-header"
      className="flex h-14 items-center gap-3 border-b px-4"
    >
      {/* Back button (mobile-friendly) */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onBack}
        aria-label="Back to messages"
      >
        <ArrowLeft className="size-5" />
      </Button>

      {/* Avatar(s) */}
      {isGroup ? (
        <div className="relative flex size-10 items-center justify-center rounded-full bg-muted">
          <Users className="size-5 text-muted-foreground" />
        </div>
      ) : firstParticipant ? (
        <div className="relative">
          <Avatar size="default">
            {firstParticipant.avatarUrl ? (
              <AvatarImage
                src={firstParticipant.avatarUrl}
                alt={firstParticipant.name}
              />
            ) : null}
            <AvatarFallback>{getInitials(firstParticipant.name)}</AvatarFallback>
          </Avatar>
          {/* Online status indicator */}
          <span
            className={cn(
              "absolute bottom-0 right-0 size-3 rounded-full border-2 border-background",
              getStatusColor(firstParticipant.status)
            )}
            aria-label={`Status: ${firstParticipant.status}`}
          />
        </div>
      ) : null}

      {/* Name and status */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <h1 className="truncate text-sm font-semibold">{displayName}</h1>
        {!isGroup && firstParticipant && (
          <span className="text-xs text-muted-foreground capitalize">
            {firstParticipant.status === "dnd"
              ? "Do not disturb"
              : firstParticipant.status}
          </span>
        )}
        {isGroup && (
          <span className="text-xs text-muted-foreground">
            {participants.length} participants
          </span>
        )}
      </div>
    </div>
  );
}
