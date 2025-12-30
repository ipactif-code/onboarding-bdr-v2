"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

/**
 * Presence status type
 */
export type PresenceStatus = "online" | "away" | "dnd" | "offline";

/**
 * Presence data for a single user
 */
export interface PresenceData {
  /**
   * The user's computed status based on activity
   */
  status: PresenceStatus;

  /**
   * Timestamp of the user's last activity, or null if unknown
   */
  lastActiveAt: number | null;

  /**
   * Optional custom status text
   */
  customStatus?: string;

  /**
   * Optional custom status emoji
   */
  customStatusEmoji?: string;

  /**
   * Whether the custom status has expired
   */
  isExpired: boolean;
}

/**
 * Return type for the usePresence hook
 */
export interface UsePresenceReturn {
  /**
   * Map of user IDs to their presence data
   */
  users: Map<Id<"users">, PresenceData>;

  /**
   * Whether the presence data is still loading
   */
  isLoading: boolean;

  /**
   * Error that occurred during fetch, or null if none
   */
  error: Error | null;
}

/**
 * Hook to get presence data for one or more users.
 *
 * Uses Convex's real-time subscriptions to automatically update
 * when user presence changes.
 *
 * @param userIds - Array of user IDs to fetch presence for
 * @returns Object with users Map, isLoading, and error states
 *
 * @example
 * ```tsx
 * const { users, isLoading } = usePresence([userId1, userId2]);
 *
 * if (isLoading) return <Skeleton />;
 *
 * const user1Status = users.get(userId1);
 * if (user1Status?.status === "online") {
 *   // User is online
 * }
 * ```
 */
export function usePresence(userIds: Id<"users">[]): UsePresenceReturn {
  // Memoize userIds array to prevent unnecessary re-fetches
  // when the array reference changes but contents are the same
  const userIdsKey = JSON.stringify(userIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally using JSON key for deep comparison
  const memoizedUserIds = useMemo(() => userIds, [userIdsKey]);

  // Fetch presence data from Convex
  const presenceData = useQuery(
    api.presence.getMultiple,
    memoizedUserIds.length > 0 ? { userIds: memoizedUserIds } : "skip"
  );

  // Build the result map
  const users = useMemo(() => {
    const map = new Map<Id<"users">, PresenceData>();

    if (!presenceData) {
      return map;
    }

    const now = Date.now();

    for (const entry of presenceData) {
      // Check if custom status has expired
      const isExpired =
        entry.customStatusExpiresAt !== undefined &&
        entry.customStatusExpiresAt < now;

      map.set(entry.userId, {
        status: entry.status,
        lastActiveAt: entry.lastActiveAt ?? null,
        customStatus: isExpired ? undefined : entry.customStatus,
        customStatusEmoji: isExpired ? undefined : entry.customStatusEmoji,
        isExpired,
      });
    }

    return map;
  }, [presenceData]);

  return {
    users,
    isLoading: presenceData === undefined && memoizedUserIds.length > 0,
    error: null, // Convex handles errors differently - would throw
  };
}

/**
 * Hook to get presence status for a single user.
 *
 * Convenience wrapper around usePresence for single-user lookups.
 *
 * @param userId - The user ID to fetch presence for
 * @returns Object with presence data, isLoading, and error states
 *
 * @example
 * ```tsx
 * const { presence, isLoading } = useSingleUserPresence(userId);
 *
 * if (presence?.status === "online") {
 *   // User is online
 * }
 * ```
 */
export function useSingleUserPresence(userId: Id<"users"> | null): {
  presence: PresenceData | null;
  isLoading: boolean;
  error: Error | null;
} {
  const userIds = useMemo(
    () => (userId ? [userId] : []),
    [userId]
  );

  const { users, isLoading, error } = usePresence(userIds);

  return {
    presence: userId ? users.get(userId) ?? null : null,
    isLoading,
    error,
  };
}
