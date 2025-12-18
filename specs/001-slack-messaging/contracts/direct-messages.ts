/**
 * Direct Message API Contracts
 *
 * This file defines the TypeScript signatures for DM-related
 * Convex queries and mutations.
 */

import { Id } from "convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type ConversationType = "direct" | "group" | "broadcast";

export interface Conversation {
  _id: Id<"conversations">;
  type: ConversationType;
  name?: string; // For group DMs
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  isActive: boolean;
}

export interface ConversationParticipant {
  _id: Id<"conversationParticipants">;
  conversationId: Id<"conversations">;
  userId: Id<"users">;
  joinedAt: number;
  leftAt?: number;
  lastReadMessageId?: Id<"messages">;
  lastReadAt?: number;
  notificationLevel: "all" | "mentions" | "none";
  addedBy?: Id<"users">;
}

export interface ConversationWithDetails extends Conversation {
  participants: Array<{
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
    status: "online" | "offline" | "away" | "dnd";
  }>;
  lastMessage?: {
    content: string;
    senderName: string;
    createdAt: number;
  };
  unreadCount: number;
  typingUsers?: Array<{
    _id: Id<"users">;
    name: string;
  }>;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * List all DM conversations for the current user
 *
 * Returns conversations sorted by last message time.
 */
export interface ListConversationsArgs {
  type?: ConversationType;
  cursor?: string;
  limit?: number;
}

export interface ListConversationsResult {
  conversations: ConversationWithDetails[];
  nextCursor?: string;
  hasMore: boolean;
}

// Query: api.directMessages.list

/**
 * Get a single conversation with full details
 */
export interface GetConversationArgs {
  conversationId: Id<"conversations">;
}

export interface GetConversationResult {
  conversation: ConversationWithDetails;
}

// Query: api.directMessages.get

/**
 * Find existing DM conversation with a user
 *
 * Returns existing conversation or null if none exists.
 */
export interface FindConversationWithUserArgs {
  userId: Id<"users">;
}

export interface FindConversationWithUserResult {
  conversation: ConversationWithDetails | null;
}

// Query: api.directMessages.findWithUser

/**
 * Find existing group DM with exact participants
 */
export interface FindGroupConversationArgs {
  participantIds: Id<"users">[];
}

export interface FindGroupConversationResult {
  conversation: ConversationWithDetails | null;
}

// Query: api.directMessages.findGroup

/**
 * Get typing indicators for a conversation
 *
 * Only available for DMs in v1 (FR-009a).
 */
export interface GetTypingIndicatorsArgs {
  conversationId: Id<"conversations">;
}

export interface GetTypingIndicatorsResult {
  typingUsers: Array<{
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
  }>;
}

// Query: api.directMessages.getTypingIndicators

/**
 * Search users to start a DM with
 *
 * Excludes current user. Returns users matching query.
 */
export interface SearchUsersForDmArgs {
  query: string;
  limit?: number;
}

export interface SearchUsersForDmResult {
  users: Array<{
    _id: Id<"users">;
    name: string;
    email: string;
    avatarUrl?: string;
    status: "online" | "offline" | "away" | "dnd";
    hasExistingConversation: boolean;
    existingConversationId?: Id<"conversations">;
  }>;
}

// Query: api.directMessages.searchUsers

// ============================================================================
// Mutations
// ============================================================================

/**
 * Start or get existing 1:1 DM conversation
 *
 * If conversation exists, returns existing. Otherwise creates new.
 */
export interface StartDirectMessageArgs {
  userId: Id<"users">;
}

export interface StartDirectMessageResult {
  conversationId: Id<"conversations">;
  isNew: boolean;
}

// Mutation: api.directMessages.startDirect

/**
 * Create a group DM
 *
 * Requires 2-8 participants total including creator (FR-008).
 */
export interface CreateGroupDmArgs {
  participantIds: Id<"users">[];
  name?: string;
}

export interface CreateGroupDmResult {
  conversationId: Id<"conversations">;
}

// Mutation: api.directMessages.createGroup

/**
 * Add participant to group DM
 *
 * Max 8 participants. Only existing participants can add.
 */
export interface AddParticipantArgs {
  conversationId: Id<"conversations">;
  userId: Id<"users">;
}

export interface AddParticipantResult {
  success: boolean;
}

// Mutation: api.directMessages.addParticipant

/**
 * Leave a group DM
 *
 * Cannot leave 1:1 DMs (hide instead).
 */
export interface LeaveGroupDmArgs {
  conversationId: Id<"conversations">;
}

export interface LeaveGroupDmResult {
  success: boolean;
}

// Mutation: api.directMessages.leaveGroup

/**
 * Update group DM name
 */
export interface UpdateGroupNameArgs {
  conversationId: Id<"conversations">;
  name: string;
}

export interface UpdateGroupNameResult {
  success: boolean;
}

// Mutation: api.directMessages.updateGroupName

/**
 * Set typing indicator
 *
 * Called on keystroke (debounced client-side).
 * Auto-expires after 3 seconds.
 */
export interface SetTypingArgs {
  conversationId: Id<"conversations">;
}

export interface SetTypingResult {
  success: boolean;
}

// Mutation: api.directMessages.setTyping

/**
 * Clear typing indicator
 *
 * Called when message is sent or input is cleared.
 */
export interface ClearTypingArgs {
  conversationId: Id<"conversations">;
}

export interface ClearTypingResult {
  success: boolean;
}

// Mutation: api.directMessages.clearTyping

/**
 * Mark conversation as read up to a message
 */
export interface MarkConversationReadArgs {
  conversationId: Id<"conversations">;
  messageId: Id<"messages">;
}

export interface MarkConversationReadResult {
  success: boolean;
}

// Mutation: api.directMessages.markAsRead

/**
 * Mark all messages in conversation as read
 */
export interface MarkAllReadArgs {
  conversationId: Id<"conversations">;
}

export interface MarkAllReadResult {
  success: boolean;
}

// Mutation: api.directMessages.markAllAsRead

/**
 * Update notification preferences for a conversation
 */
export interface UpdateConversationNotificationsArgs {
  conversationId: Id<"conversations">;
  notificationLevel: "all" | "mentions" | "none";
}

export interface UpdateConversationNotificationsResult {
  success: boolean;
}

// Mutation: api.directMessages.updateNotifications

/**
 * Hide a conversation from list
 *
 * Conversation reappears when new message received.
 * Used instead of "leave" for 1:1 DMs.
 */
export interface HideConversationArgs {
  conversationId: Id<"conversations">;
}

export interface HideConversationResult {
  success: boolean;
}

// Mutation: api.directMessages.hide

// ============================================================================
// Unread Counts
// ============================================================================

/**
 * Get total unread count across all conversations
 *
 * Used for sidebar badge.
 */
export interface GetTotalUnreadCountResult {
  totalUnread: number;
  conversationsWithUnread: number;
}

// Query: api.directMessages.getTotalUnreadCount
