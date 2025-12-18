/**
 * Message API Contracts
 *
 * This file defines the TypeScript signatures for all message-related
 * Convex queries and mutations. Messages work for both channels and DMs.
 */

import { Id } from "convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type MessageContentType = "text" | "voice" | "file" | "system";

export type MessageStatus = "sending" | "sent" | "failed";

export interface Message {
  _id: Id<"messages">;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  senderId: Id<"users">;
  content: string;
  contentType: MessageContentType;
  parentId?: Id<"messages">;
  threadReplyCount: number;
  threadLastReplyAt?: number;
  lessonId?: Id<"lessons">;
  createdAt: number;
  updatedAt?: number;
  isEdited: boolean;
  deletedAt?: number;
  reactionCount: number;
  status: MessageStatus;
}

export interface MessageWithSender extends Message {
  sender: {
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
    status: "online" | "offline" | "away" | "dnd";
  };
  reactions: Array<{
    emoji: string;
    count: number;
    users: Array<{ _id: Id<"users">; name: string }>;
    hasReacted: boolean; // Current user has this reaction
  }>;
  voiceMessage?: {
    duration: number;
    waveformData: number[];
    transcription?: string;
    transcriptionStatus: "pending" | "processing" | "completed" | "failed";
  };
  attachments?: Array<{
    _id: Id<"messageAttachments">;
    fileName: string;
    fileSize: number;
    fileType: string;
    downloadUrl: string;
    thumbnailUrl?: string;
  }>;
  mentions: Array<{
    type: "user" | "here" | "everyone";
    userId?: Id<"users">;
    userName?: string;
  }>;
}

export interface ThreadPreview {
  messageId: Id<"messages">;
  replyCount: number;
  lastReplyAt: number;
  participants: Array<{
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
  }>;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * List messages in a channel with pagination
 *
 * Returns messages in reverse chronological order (newest first).
 * Supports cursor-based pagination for infinite scroll.
 */
export interface ListChannelMessagesArgs {
  channelId: Id<"channels">;
  cursor?: string;
  limit?: number; // Default 50
  includeDeleted?: boolean; // Admin only
}

export interface ListChannelMessagesResult {
  messages: MessageWithSender[];
  nextCursor?: string;
  hasMore: boolean;
}

// Query: api.messages.listForChannel

/**
 * List messages in a DM conversation with pagination
 */
export interface ListConversationMessagesArgs {
  conversationId: Id<"conversations">;
  cursor?: string;
  limit?: number;
}

export interface ListConversationMessagesResult {
  messages: MessageWithSender[];
  nextCursor?: string;
  hasMore: boolean;
}

// Query: api.messages.listForConversation

/**
 * Get thread replies for a message
 */
export interface GetThreadArgs {
  parentId: Id<"messages">;
  cursor?: string;
  limit?: number;
}

export interface GetThreadResult {
  parentMessage: MessageWithSender;
  replies: MessageWithSender[];
  nextCursor?: string;
  hasMore: boolean;
}

// Query: api.messages.getThread

/**
 * Get messages linked to a specific lesson (course discussions)
 */
export interface GetLessonDiscussionArgs {
  lessonId: Id<"lessons">;
  cursor?: string;
  limit?: number;
}

export interface GetLessonDiscussionResult {
  channelId: Id<"channels">;
  threads: Array<{
    message: MessageWithSender;
    replyCount: number;
    lastReplyAt?: number;
    preview: string; // First 100 chars
  }>;
  nextCursor?: string;
  hasMore: boolean;
}

// Query: api.messages.getLessonDiscussion

/**
 * Get a single message by ID
 */
export interface GetMessageArgs {
  messageId: Id<"messages">;
}

export interface GetMessageResult {
  message: MessageWithSender;
  context: {
    channelName?: string;
    conversationParticipants?: Array<{ name: string }>;
  };
}

// Query: api.messages.get

/**
 * Get message context (surrounding messages)
 *
 * Used when navigating to a message from search results.
 */
export interface GetMessageContextArgs {
  messageId: Id<"messages">;
  before?: number; // Messages before
  after?: number; // Messages after
}

export interface GetMessageContextResult {
  targetMessage: MessageWithSender;
  messagesBefore: MessageWithSender[];
  messagesAfter: MessageWithSender[];
}

// Query: api.messages.getContext

// ============================================================================
// Mutations
// ============================================================================

/**
 * Send a text message to a channel
 *
 * Supports rich text content, mentions, and optional thread parent.
 * Rate limited to 30 messages per minute (FR-044).
 * Maximum 4000 characters (FR-046).
 */
export interface SendChannelMessageArgs {
  channelId: Id<"channels">;
  content: string;
  parentId?: Id<"messages">; // For thread replies
  lessonId?: Id<"lessons">; // For lesson discussions
  mentions?: Array<{
    type: "user" | "here" | "everyone";
    userId?: Id<"users">;
  }>;
}

export interface SendChannelMessageResult {
  messageId: Id<"messages">;
}

// Mutation: api.messages.sendToChannel

/**
 * Send a text message to a DM conversation
 */
export interface SendConversationMessageArgs {
  conversationId: Id<"conversations">;
  content: string;
  mentions?: Array<{
    type: "user";
    userId: Id<"users">;
  }>;
}

export interface SendConversationMessageResult {
  messageId: Id<"messages">;
}

// Mutation: api.messages.sendToConversation

/**
 * Edit an existing message
 *
 * Only the sender can edit. Preserves edit history.
 * Must be within edit time window (if configured).
 */
export interface EditMessageArgs {
  messageId: Id<"messages">;
  content: string;
}

export interface EditMessageResult {
  success: boolean;
}

// Mutation: api.messages.edit

/**
 * Delete a message (soft delete)
 *
 * Sender can delete own messages.
 * Admins can delete any message (FR-037).
 * Deleted messages are hidden but retained for 90 days (FR-014).
 */
export interface DeleteMessageArgs {
  messageId: Id<"messages">;
}

export interface DeleteMessageResult {
  success: boolean;
}

// Mutation: api.messages.delete

/**
 * Restore a deleted message
 *
 * Admin only. Must be within 90-day retention window.
 */
export interface RestoreMessageArgs {
  messageId: Id<"messages">;
}

export interface RestoreMessageResult {
  success: boolean;
}

// Mutation: api.messages.restore

/**
 * Add a reaction to a message
 */
export interface AddReactionArgs {
  messageId: Id<"messages">;
  emoji: string;
}

export interface AddReactionResult {
  success: boolean;
}

// Mutation: api.messages.addReaction

/**
 * Remove a reaction from a message
 */
export interface RemoveReactionArgs {
  messageId: Id<"messages">;
  emoji: string;
}

export interface RemoveReactionResult {
  success: boolean;
}

// Mutation: api.messages.removeReaction

/**
 * Pin a message in a channel
 *
 * Requires admin or creator role (FR-018).
 */
export interface PinMessageArgs {
  messageId: Id<"messages">;
}

export interface PinMessageResult {
  success: boolean;
}

// Mutation: api.messages.pin

/**
 * Unpin a message
 */
export interface UnpinMessageArgs {
  messageId: Id<"messages">;
}

export interface UnpinMessageResult {
  success: boolean;
}

// Mutation: api.messages.unpin

/**
 * Bookmark a message for personal reference
 */
export interface BookmarkMessageArgs {
  messageId: Id<"messages">;
  note?: string;
}

export interface BookmarkMessageResult {
  bookmarkId: Id<"bookmarks">;
}

// Mutation: api.messages.bookmark

/**
 * Remove a bookmark
 */
export interface RemoveBookmarkArgs {
  messageId: Id<"messages">;
}

export interface RemoveBookmarkResult {
  success: boolean;
}

// Mutation: api.messages.removeBookmark

// ============================================================================
// Bookmark Queries
// ============================================================================

/**
 * List user's bookmarks
 */
export interface ListBookmarksArgs {
  cursor?: string;
  limit?: number;
}

export interface ListBookmarksResult {
  bookmarks: Array<{
    _id: Id<"bookmarks">;
    message: MessageWithSender;
    note?: string;
    createdAt: number;
    context: {
      channelName?: string;
      conversationParticipants?: string[];
    };
  }>;
  nextCursor?: string;
  hasMore: boolean;
}

// Query: api.messages.listBookmarks

// ============================================================================
// Pinned Messages Queries
// ============================================================================

/**
 * List pinned messages in a channel
 */
export interface ListPinnedMessagesArgs {
  channelId: Id<"channels">;
}

export interface ListPinnedMessagesResult {
  pins: Array<{
    message: MessageWithSender;
    pinnedBy: {
      _id: Id<"users">;
      name: string;
    };
    pinnedAt: number;
  }>;
}

// Query: api.messages.listPinned

// ============================================================================
// Admin Mutations
// ============================================================================

/**
 * Export channel history
 *
 * Admin only (FR-039). Returns download URL for JSON/CSV file.
 */
export interface ExportChannelHistoryArgs {
  channelId: Id<"channels">;
  format: "json" | "csv";
  startDate?: number;
  endDate?: number;
}

export interface ExportChannelHistoryResult {
  downloadUrl: string;
  messageCount: number;
  exportedAt: number;
}

// Mutation: api.messages.exportChannelHistory
