// ============================================================================
// Types for DM List Components
// ============================================================================

/**
 * Props for the DMList component.
 */
export interface DMListProps {
  /**
   * Optional className for the container.
   */
  className?: string;
  /**
   * Callback when a conversation is selected.
   */
  onConversationSelect?: (conversationId: string) => void;
}

/**
 * Participant data from the API.
 */
export interface Participant {
  _id: string;
  name: string;
  avatarUrl?: string;
  status: "online" | "offline" | "away" | "dnd";
}

/**
 * Conversation data from the API.
 */
export interface Conversation {
  _id: string;
  type: "direct" | "group" | "broadcast";
  updatedAt: number;
  participants: Participant[];
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    createdAt: number;
  };
  unreadCount: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Formats a timestamp as a relative time string (e.g., "2m ago", "1h ago").
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) {
    return "now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  if (diffHours < 24) {
    return `${diffHours}h`;
  }
  if (diffDays < 7) {
    return `${diffDays}d`;
  }
  return `${diffWeeks}w`;
}

/**
 * Gets the initials from a name for avatar fallback.
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Gets the display name for a conversation.
 */
export function getConversationDisplayName(
  participants: Participant[],
  type: "direct" | "group" | "broadcast"
): string {
  if (participants.length === 0) {
    return "Unknown";
  }
  if (type === "direct") {
    return participants[0]?.name ?? "Unknown";
  }
  if (participants.length <= 3) {
    return participants.map((p) => p.name.split(" ")[0]).join(", ");
  }
  const firstTwo = participants.slice(0, 2).map((p) => p.name.split(" ")[0]);
  return `${firstTwo.join(", ")} +${participants.length - 2}`;
}
