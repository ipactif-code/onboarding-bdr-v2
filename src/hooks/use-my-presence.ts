"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

/**
 * Presence status type
 */
export type PresenceStatus = "online" | "away" | "dnd" | "offline";

/**
 * Custom status configuration
 */
export interface CustomStatus {
  /**
   * Custom status text (max 100 characters)
   */
  text?: string;

  /**
   * Custom status emoji
   */
  emoji?: string;

  /**
   * Unix timestamp (milliseconds) when the status should auto-clear
   */
  expiresAt?: number;
}

/**
 * Parameters for setting custom status
 */
export interface SetCustomStatusParams {
  /**
   * Custom status text (max 100 characters)
   */
  text?: string;

  /**
   * Custom status emoji
   */
  emoji?: string;

  /**
   * Unix timestamp (milliseconds) when the status should auto-clear
   */
  expiresAt?: number;
}

/**
 * Return type for the useMyPresence hook
 */
export interface UseMyPresenceReturn {
  /**
   * Current user's status
   */
  status: PresenceStatus;

  /**
   * Current user's custom status, or null if none set
   */
  customStatus: CustomStatus | null;

  /**
   * Set the user's presence status
   */
  setStatus: (status: PresenceStatus) => Promise<void>;

  /**
   * Set a custom status message and/or emoji
   */
  setCustomStatus: (params: SetCustomStatusParams) => Promise<void>;

  /**
   * Clear the custom status
   */
  clearCustomStatus: () => Promise<void>;

  /**
   * Whether any update operation is in progress
   */
  isUpdating: boolean;

  /**
   * Whether the initial data is still loading
   */
  isLoading: boolean;
}

/**
 * Hook to manage the current user's presence and status.
 *
 * Provides methods to:
 * - Get current status
 * - Set presence status (online, away, dnd, offline)
 * - Set custom status text and emoji with optional expiration
 * - Clear custom status
 *
 * Uses Convex's real-time subscriptions to automatically update
 * when the user's status changes from other sources.
 *
 * @returns Object with status, customStatus, and control methods
 *
 * @example
 * ```tsx
 * const { status, customStatus, setStatus, setCustomStatus, clearCustomStatus, isUpdating } = useMyPresence();
 *
 * // Set to Do Not Disturb
 * await setStatus("dnd");
 *
 * // Set a custom status
 * await setCustomStatus({
 *   text: "In a meeting",
 *   emoji: "📅",
 *   expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour from now
 * });
 *
 * // Clear custom status
 * await clearCustomStatus();
 * ```
 */
export function useMyPresence(): UseMyPresenceReturn {
  const [isUpdating, setIsUpdating] = useState(false);

  // Get current user data (includes status)
  const userData = useQuery(api.users.me);

  // Mutations
  const setStatusMutation = useMutation(api.presence.setStatus);
  const setCustomStatusMutation = useMutation(api.presence.setCustomStatus);
  const clearCustomStatusMutation = useMutation(api.presence.clearCustomStatus);

  /**
   * Set the user's presence status.
   */
  const setStatus = useCallback(
    async (newStatus: PresenceStatus): Promise<void> => {
      setIsUpdating(true);
      try {
        await setStatusMutation({ status: newStatus });
      } finally {
        setIsUpdating(false);
      }
    },
    [setStatusMutation]
  );

  /**
   * Set a custom status message and/or emoji.
   */
  const setCustomStatus = useCallback(
    async (params: SetCustomStatusParams): Promise<void> => {
      setIsUpdating(true);
      try {
        await setCustomStatusMutation({
          text: params.text,
          emoji: params.emoji,
          expiresAt: params.expiresAt,
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [setCustomStatusMutation]
  );

  /**
   * Clear the custom status.
   */
  const clearCustomStatus = useCallback(async (): Promise<void> => {
    setIsUpdating(true);
    try {
      await clearCustomStatusMutation();
    } finally {
      setIsUpdating(false);
    }
  }, [clearCustomStatusMutation]);

  // Build custom status object from user data
  // The users.me query includes customStatus, customStatusEmoji, customStatusExpiresAt
  const customStatus: CustomStatus | null = (() => {
    if (!userData) return null;

    const { customStatus: text, customStatusEmoji: emoji, customStatusExpiresAt: expiresAt } = userData;

    // If no custom status data, return null
    if (!text && !emoji) return null;

    // Check if status has expired
    if (expiresAt && expiresAt < Date.now()) return null;

    return {
      text,
      emoji,
      expiresAt,
    };
  })();

  return {
    status: userData?.status ?? "offline",
    customStatus,
    setStatus,
    setCustomStatus,
    clearCustomStatus,
    isUpdating,
    isLoading: userData === undefined,
  };
}
