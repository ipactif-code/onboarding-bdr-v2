"use client";

import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

/**
 * Channel type from Convex schema.
 */
type ChannelType = "public" | "private" | "course";

/**
 * Channel membership information.
 */
interface ChannelMembership {
  role: "owner" | "admin" | "moderator" | "member";
  joinedAt: number;
  notificationLevel: "all" | "mentions" | "none";
  isMuted: boolean;
  unreadCount: number;
  lastReadAt?: number;
  isFavorite?: boolean;
}

/**
 * Channel with membership information returned from the API.
 */
export interface ChannelWithMembership {
  _id: Id<"channels">;
  name: string;
  description?: string;
  topic?: string;
  type: ChannelType;
  courseId?: Id<"courses">;
  creatorId: Id<"users">;
  createdAt: number;
  isArchived: boolean;
  memberCount: number;
  lastMessageAt?: number;
  membership: ChannelMembership | null;
}

// ============================================================================
// useChannel Hook
// ============================================================================

interface UseChannelOptions {
  channelId: Id<"channels"> | undefined;
}

interface UseChannelReturn {
  channel: ChannelWithMembership | null | undefined;
  isLoading: boolean;
  isMember: boolean;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  markAsRead: (readAt?: number) => Promise<void>;
}

/**
 * Hook for subscribing to a single channel and performing channel actions.
 *
 * @param options.channelId - The ID of the channel to subscribe to
 * @returns Channel data and action functions
 *
 * @example
 * ```tsx
 * const { channel, isLoading, isMember, join, markAsRead } = useChannel({
 *   channelId: params.channelId as Id<"channels">,
 * });
 *
 * if (isLoading) return <Skeleton />;
 * if (!channel) return <div>Channel not found</div>;
 * ```
 */
export function useChannel(options: UseChannelOptions): UseChannelReturn {
  const { channelId } = options;

  // Subscribe to channel data
  const channel = useQuery(
    api.channels.get,
    channelId ? { channelId } : "skip"
  );

  // Mutations
  const joinMutation = useMutation(api.channels.join);
  const leaveMutation = useMutation(api.channels.leave);
  const markAsReadMutation = useMutation(api.messages.markChannelAsRead);

  // Action handlers
  const join = useCallback(async () => {
    if (!channelId) return;
    await joinMutation({ channelId });
  }, [channelId, joinMutation]);

  const leave = useCallback(async () => {
    if (!channelId) return;
    await leaveMutation({ channelId });
  }, [channelId, leaveMutation]);

  const markAsRead = useCallback(
    async (readAt?: number) => {
      if (!channelId) return;
      await markAsReadMutation({ channelId, readAt });
    },
    [channelId, markAsReadMutation]
  );

  return {
    channel,
    isLoading: channel === undefined,
    isMember: channel?.membership !== null && channel?.membership !== undefined,
    join,
    leave,
    markAsRead,
  };
}

// ============================================================================
// useChannelList Hook
// ============================================================================

interface UseChannelListOptions {
  type?: ChannelType;
  includeArchived?: boolean;
}

interface UseChannelListReturn {
  channels: ChannelWithMembership[];
  isLoading: boolean;
  totalUnreadCount: number;
  markAllAsRead: () => Promise<void>;
}

/**
 * Hook for subscribing to the list of channels the current user has access to.
 *
 * @param options.type - Filter channels by type (public, private, course)
 * @param options.includeArchived - Include archived channels in the list
 * @returns List of channels with membership information
 *
 * @example
 * ```tsx
 * const { channels, isLoading, totalUnreadCount, markAllAsRead } = useChannelList();
 *
 * if (isLoading) return <Skeleton />;
 *
 * return (
 *   <ul>
 *     {channels.map((channel) => (
 *       <li key={channel._id}>
 *         #{channel.name}
 *         {channel.membership?.unreadCount ? (
 *           <UnreadBadge count={channel.membership.unreadCount} />
 *         ) : null}
 *       </li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useChannelList(
  options: UseChannelListOptions = {}
): UseChannelListReturn {
  const { type, includeArchived } = options;

  // Subscribe to channel list
  const channels = useQuery(api.channels.list, {
    type,
    includeArchived,
  });

  // Mutation for marking all as read
  const markAllAsReadMutation = useMutation(api.channels.markAllAsRead);

  // Calculate total unread count across all channels
  const totalUnreadCount =
    channels?.reduce((total, channel) => {
      return total + (channel.membership?.unreadCount ?? 0);
    }, 0) ?? 0;

  // Action handler
  const markAllAsRead = useCallback(async () => {
    await markAllAsReadMutation({});
  }, [markAllAsReadMutation]);

  return {
    channels: channels ?? [],
    isLoading: channels === undefined,
    totalUnreadCount,
    markAllAsRead,
  };
}
