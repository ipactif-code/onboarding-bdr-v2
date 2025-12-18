/**
 * Channel API Contracts
 *
 * This file defines the TypeScript signatures for all channel-related
 * Convex queries and mutations. These are contracts for implementation.
 */

import { Id } from "convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type ChannelType = "public" | "private" | "course";

export type ChannelRole = "owner" | "admin" | "moderator" | "member";

export type NotificationLevel = "all" | "mentions" | "none";

export interface Channel {
  _id: Id<"channels">;
  name: string;
  description?: string;
  topic?: string;
  type: ChannelType;
  courseId?: Id<"courses">;
  creatorId: Id<"users">;
  createdAt: number;
  isArchived: boolean;
  archivedAt?: number;
  archivedBy?: Id<"users">;
  memberCount: number;
  lastMessageAt?: number;
}

export interface ChannelMember {
  _id: Id<"channelMembers">;
  channelId: Id<"channels">;
  userId: Id<"users">;
  role: ChannelRole;
  joinedAt: number;
  leftAt?: number;
  lastReadMessageId?: Id<"messages">;
  lastReadAt?: number;
  notificationLevel: NotificationLevel;
  isMuted: boolean;
  mutedUntil?: number;
  isBanned: boolean;
}

export interface ChannelWithMembership extends Channel {
  membership: {
    role: ChannelRole;
    unreadCount: number;
    lastReadAt?: number;
    notificationLevel: NotificationLevel;
    isMuted: boolean;
  } | null;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * List all channels accessible to the current user
 *
 * Returns public channels, private channels user is member of,
 * and course channels for enrolled courses.
 */
export interface ListChannelsArgs {
  type?: ChannelType;
  includeArchived?: boolean;
}

export interface ListChannelsResult {
  channels: ChannelWithMembership[];
}

// Query: api.channels.list

/**
 * Get a single channel by ID with membership info
 *
 * Throws if user doesn't have access to the channel.
 */
export interface GetChannelArgs {
  channelId: Id<"channels">;
}

export interface GetChannelResult {
  channel: ChannelWithMembership;
  members: Array<{
    user: {
      _id: Id<"users">;
      name: string;
      avatarUrl?: string;
      status: "online" | "offline" | "away" | "dnd";
    };
    role: ChannelRole;
    joinedAt: number;
  }>;
  pinnedMessages: Array<{
    messageId: Id<"messages">;
    pinnedBy: Id<"users">;
    pinnedAt: number;
  }>;
}

// Query: api.channels.get

/**
 * Get channel members with pagination
 */
export interface GetMembersArgs {
  channelId: Id<"channels">;
  cursor?: string;
  limit?: number;
}

export interface GetMembersResult {
  members: Array<{
    user: {
      _id: Id<"users">;
      name: string;
      email: string;
      avatarUrl?: string;
      status: "online" | "offline" | "away" | "dnd";
    };
    role: ChannelRole;
    joinedAt: number;
    isMuted: boolean;
    isBanned: boolean;
  }>;
  nextCursor?: string;
  hasMore: boolean;
}

// Query: api.channels.getMembers

/**
 * Search for channels by name
 */
export interface SearchChannelsArgs {
  query: string;
  type?: ChannelType;
  limit?: number;
}

export interface SearchChannelsResult {
  channels: Array<{
    _id: Id<"channels">;
    name: string;
    description?: string;
    type: ChannelType;
    memberCount: number;
    isMember: boolean;
  }>;
}

// Query: api.channels.search

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new channel
 *
 * Only admins and designated users can create channels (FR-036).
 * Course channels are auto-created by the system.
 */
export interface CreateChannelArgs {
  name: string;
  description?: string;
  type: "public" | "private";
  initialMemberIds?: Id<"users">[];
}

export interface CreateChannelResult {
  channelId: Id<"channels">;
}

// Mutation: api.channels.create

/**
 * Update channel settings
 *
 * Requires owner or admin role in the channel.
 */
export interface UpdateChannelArgs {
  channelId: Id<"channels">;
  name?: string;
  description?: string;
  topic?: string;
}

export interface UpdateChannelResult {
  success: boolean;
}

// Mutation: api.channels.update

/**
 * Archive a channel
 *
 * Archived channels become read-only (FR-006).
 * Requires owner, admin, or global admin role.
 */
export interface ArchiveChannelArgs {
  channelId: Id<"channels">;
}

export interface ArchiveChannelResult {
  success: boolean;
}

// Mutation: api.channels.archive

/**
 * Unarchive a channel
 *
 * Requires global admin role.
 */
export interface UnarchiveChannelArgs {
  channelId: Id<"channels">;
}

export interface UnarchiveChannelResult {
  success: boolean;
}

// Mutation: api.channels.unarchive

/**
 * Join a public channel
 *
 * Only works for public channels. Private channels require invite.
 */
export interface JoinChannelArgs {
  channelId: Id<"channels">;
}

export interface JoinChannelResult {
  success: boolean;
}

// Mutation: api.channels.join

/**
 * Leave a channel
 *
 * Cannot leave if you're the only owner (must transfer first).
 * Course channel membership is managed by enrollment.
 */
export interface LeaveChannelArgs {
  channelId: Id<"channels">;
}

export interface LeaveChannelResult {
  success: boolean;
}

// Mutation: api.channels.leave

/**
 * Invite users to a private channel
 *
 * Requires admin role in the channel.
 */
export interface InviteMembersArgs {
  channelId: Id<"channels">;
  userIds: Id<"users">[];
}

export interface InviteMembersResult {
  invited: number;
  alreadyMembers: number;
}

// Mutation: api.channels.inviteMembers

/**
 * Remove a member from a channel
 *
 * Requires admin role. Cannot remove owner.
 */
export interface RemoveMemberArgs {
  channelId: Id<"channels">;
  userId: Id<"users">;
}

export interface RemoveMemberResult {
  success: boolean;
}

// Mutation: api.channels.removeMember

/**
 * Update a member's role
 *
 * Requires owner role to promote to admin.
 * Requires admin role to change moderator/member.
 */
export interface UpdateMemberRoleArgs {
  channelId: Id<"channels">;
  userId: Id<"users">;
  role: ChannelRole;
}

export interface UpdateMemberRoleResult {
  success: boolean;
}

// Mutation: api.channels.updateMemberRole

/**
 * Mute a member (prevent them from sending messages)
 *
 * Requires moderator or higher role.
 */
export interface MuteMemberArgs {
  channelId: Id<"channels">;
  userId: Id<"users">;
  duration?: number; // Minutes, undefined = indefinite
}

export interface MuteMemberResult {
  success: boolean;
  mutedUntil?: number;
}

// Mutation: api.channels.muteMember

/**
 * Unmute a member
 */
export interface UnmuteMemberArgs {
  channelId: Id<"channels">;
  userId: Id<"users">;
}

export interface UnmuteMemberResult {
  success: boolean;
}

// Mutation: api.channels.unmuteMember

/**
 * Ban a member from the channel
 *
 * Requires admin role.
 */
export interface BanMemberArgs {
  channelId: Id<"channels">;
  userId: Id<"users">;
  reason?: string;
}

export interface BanMemberResult {
  success: boolean;
}

// Mutation: api.channels.banMember

/**
 * Unban a member
 */
export interface UnbanMemberArgs {
  channelId: Id<"channels">;
  userId: Id<"users">;
}

export interface UnbanMemberResult {
  success: boolean;
}

// Mutation: api.channels.unbanMember

/**
 * Update notification preferences for a channel
 */
export interface UpdateNotificationPrefsArgs {
  channelId: Id<"channels">;
  notificationLevel: NotificationLevel;
}

export interface UpdateNotificationPrefsResult {
  success: boolean;
}

// Mutation: api.channels.updateNotificationPrefs

/**
 * Mark channel as read up to a specific message
 *
 * Called by viewport intersection observer.
 */
export interface MarkAsReadArgs {
  channelId: Id<"channels">;
  messageId: Id<"messages">;
}

export interface MarkAsReadResult {
  success: boolean;
}

// Mutation: api.channels.markAsRead

/**
 * Mark all messages in channel as read
 */
export interface MarkAllAsReadArgs {
  channelId: Id<"channels">;
}

export interface MarkAllAsReadResult {
  success: boolean;
}

// Mutation: api.channels.markAllAsRead

// ============================================================================
// Internal Mutations (System Use)
// ============================================================================

/**
 * Create a course channel when course is published
 *
 * Called internally by course publish flow.
 */
export interface CreateCourseChannelArgs {
  courseId: Id<"courses">;
  courseName: string;
  instructorIds: Id<"users">[];
}

// Internal mutation: api.channels.createCourseChannel

/**
 * Add user to course channel on enrollment
 */
export interface AddCourseEnrolleeArgs {
  courseId: Id<"courses">;
  userId: Id<"users">;
}

// Internal mutation: api.channels.addCourseEnrollee

/**
 * Remove user from course channel on enrollment revocation
 */
export interface RemoveCourseEnrolleeArgs {
  courseId: Id<"courses">;
  userId: Id<"users">;
}

// Internal mutation: api.channels.removeCourseEnrollee
