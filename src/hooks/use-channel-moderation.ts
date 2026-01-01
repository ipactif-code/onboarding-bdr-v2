"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { Id } from "../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

// ============================================================================
// Types
// ============================================================================

export interface UseChannelModerationOptions {
  /**
   * The ID of the channel to moderate.
   */
  channelId: Id<"channels">;
}

export interface UseChannelModerationReturn {
  /**
   * Mute a member for a specified duration.
   */
  muteMember: (userId: Id<"users">, durationMinutes: number) => Promise<void>;
  /**
   * Unmute a muted member.
   */
  unmuteMember: (userId: Id<"users">) => Promise<void>;
  /**
   * Ban a member from the channel.
   */
  banMember: (userId: Id<"users">, reason?: string) => Promise<void>;
  /**
   * Unban a banned member.
   */
  unbanMember: (userId: Id<"users">) => Promise<void>;
  /**
   * Whether a moderation action is currently in progress.
   */
  isLoading: boolean;
}

// ============================================================================
// useChannelModeration Hook
// ============================================================================

/**
 * Hook for performing moderation actions on channel members.
 *
 * @param options.channelId - The ID of the channel to moderate
 * @returns Moderation action functions and loading state
 *
 * @example
 * ```tsx
 * const { muteMember, banMember, isLoading } = useChannelModeration({
 *   channelId,
 * });
 *
 * const handleMute = async (userId: Id<"users">) => {
 *   await muteMember(userId, 60); // Mute for 1 hour
 * };
 * ```
 */
export function useChannelModeration(
  options: UseChannelModerationOptions
): UseChannelModerationReturn {
  const { channelId } = options;
  const [isLoading, setIsLoading] = useState(false);

  // Mutations
  const muteMutation = useMutation(api.channels.moderation.muteMember);
  const unmuteMutation = useMutation(api.channels.moderation.unmuteMember);
  const banMutation = useMutation(api.channels.moderation.banMember);
  const unbanMutation = useMutation(api.channels.moderation.unbanMember);

  // Mute a member
  const muteMember = useCallback(
    async (userId: Id<"users">, durationMinutes: number) => {
      setIsLoading(true);
      try {
        await muteMutation({ channelId, userId, durationMinutes });
        toast.success("Member muted successfully");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to mute member";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [channelId, muteMutation]
  );

  // Unmute a member
  const unmuteMember = useCallback(
    async (userId: Id<"users">) => {
      setIsLoading(true);
      try {
        await unmuteMutation({ channelId, userId });
        toast.success("Member unmuted successfully");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to unmute member";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [channelId, unmuteMutation]
  );

  // Ban a member
  const banMember = useCallback(
    async (userId: Id<"users">, reason?: string) => {
      setIsLoading(true);
      try {
        await banMutation({ channelId, userId, reason });
        toast.success("Member banned from channel");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to ban member";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [channelId, banMutation]
  );

  // Unban a member
  const unbanMember = useCallback(
    async (userId: Id<"users">) => {
      setIsLoading(true);
      try {
        await unbanMutation({ channelId, userId });
        toast.success("Member unbanned successfully");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to unban member";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [channelId, unbanMutation]
  );

  return {
    muteMember,
    unmuteMember,
    banMember,
    unbanMember,
    isLoading,
  };
}
