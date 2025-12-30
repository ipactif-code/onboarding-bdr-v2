"use client";

import { Users } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { StatusIndicator } from "@/components/presence";
import { type Participant, getInitials } from "./types";

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
  // For direct messages, show a single avatar with status indicator
  if (type === "direct" && participants.length > 0) {
    const participant = participants[0];
    return (
      <div className="relative">
        <Avatar size="default">
          <AvatarImage
            src={participant?.avatarUrl}
            alt={participant?.name ?? "User"}
          />
          <AvatarFallback>
            {getInitials(participant?.name ?? "U")}
          </AvatarFallback>
        </Avatar>
        {participant && (
          <StatusIndicator
            status={participant.status}
            size="sm"
            className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background"
          />
        )}
      </div>
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
