"use client";

import { Users } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
} from "@/components/ui/avatar";
import { type Participant, getInitials } from "./types";

// ============================================================================
// OnlineIndicator Component
// ============================================================================

interface OnlineIndicatorProps {
  status: "online" | "offline" | "away" | "dnd";
}

/**
 * Displays an online status indicator badge on avatars.
 */
function OnlineIndicator({
  status,
}: OnlineIndicatorProps): React.ReactElement | null {
  if (status !== "online") {
    return null;
  }

  return <AvatarBadge className="bg-green-500" role="img" aria-label="Online" />;
}

// ============================================================================
// ConversationAvatar Component
// ============================================================================

export interface ConversationAvatarProps {
  /** List of participants in the conversation */
  participants: Participant[];
  /** Type of conversation */
  type: "direct" | "group" | "broadcast";
}

/**
 * ConversationAvatar displays the appropriate avatar(s) for a conversation.
 *
 * - For direct messages: Shows a single avatar with online indicator
 * - For group conversations: Shows stacked avatars with count overflow
 * - Fallback: Shows a Users icon for empty participant lists
 */
export function ConversationAvatar({
  participants,
  type,
}: ConversationAvatarProps): React.ReactElement {
  // For direct messages, show a single avatar with online indicator
  if (type === "direct" && participants.length > 0) {
    const participant = participants[0];
    return (
      <Avatar size="default">
        <AvatarImage
          src={participant?.avatarUrl}
          alt={participant?.name ?? "User"}
        />
        <AvatarFallback>
          {getInitials(participant?.name ?? "U")}
        </AvatarFallback>
        {participant && <OnlineIndicator status={participant.status} />}
      </Avatar>
    );
  }

  // For group conversations, show stacked avatars
  if (participants.length > 0) {
    const displayParticipants = participants.slice(0, 3);
    const remainingCount = participants.length - 3;

    return (
      <AvatarGroup>
        {displayParticipants.map((participant) => (
          <Avatar key={participant._id} size="sm">
            <AvatarImage src={participant.avatarUrl} alt={participant.name} />
            <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
          </Avatar>
        ))}
        {remainingCount > 0 && (
          <AvatarGroupCount>+{remainingCount}</AvatarGroupCount>
        )}
      </AvatarGroup>
    );
  }

  // Fallback for no participants
  return (
    <Avatar size="default">
      <AvatarFallback>
        <Users className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}
