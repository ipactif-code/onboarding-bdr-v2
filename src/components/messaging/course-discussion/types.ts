// ============================================================================
// Types for Course Discussion Panel
// ============================================================================

import { Id } from "../../../../convex/_generated/dataModel";

/**
 * Props for the CourseDiscussionPanel component.
 */
export interface CourseDiscussionPanelProps {
  /** The current course ID */
  courseId: Id<"courses">;
  /** The current lesson ID being viewed */
  lessonId: Id<"lessons">;
}

/**
 * User status for presence indication.
 */
export type UserStatus = "online" | "offline" | "away" | "dnd";

/**
 * Message sender information.
 */
export interface MessageSender {
  _id: Id<"users">;
  name: string;
  avatarUrl?: string;
  status: UserStatus;
}

/**
 * Discussion message structure from the API.
 */
export interface DiscussionMessage {
  _id: Id<"messages">;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  senderId: Id<"users">;
  sender: MessageSender;
  content: string;
  contentType?: "text" | "voice" | "file" | "system";
  parentId?: Id<"messages">;
  threadReplyCount?: number;
  threadLastReplyAt?: number;
  lessonId?: Id<"lessons">;
  createdAt: number;
  updatedAt?: number;
  isEdited?: boolean;
  deletedAt?: number;
  reactionCount?: number;
  status?: "sending" | "sent" | "failed";
}

/**
 * Props for the DiscussionMessageItem component.
 */
export interface DiscussionMessageItemProps {
  message: DiscussionMessage;
  onReply?: () => void;
}
