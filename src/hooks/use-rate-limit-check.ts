"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

// ============================================================================
// Types
// ============================================================================

/**
 * Rate limit status for a specific message type.
 */
export interface RateLimitStatus {
  /** Whether the user is currently rate limited */
  isRateLimited: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Timestamp (ms) when the rate limit resets */
  resetAt: number;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/**
 * Return type for the useRateLimitCheck hook.
 */
export interface UseRateLimitCheckReturn {
  /** Rate limit status for text messages (30/min) */
  textStatus: RateLimitStatus | null;
  /** Rate limit status for voice messages (20/hr) */
  voiceStatus: RateLimitStatus | null;
  /** Whether the rate limit data is currently loading */
  isLoading: boolean;
  /** Formatted countdown string for text rate limit (e.g., "45s") */
  textCountdown: string | null;
  /** Formatted countdown string for voice rate limit (e.g., "15m 30s") */
  voiceCountdown: string | null;
  /** Whether text messages are currently rate limited */
  isTextRateLimited: boolean;
  /** Whether voice messages are currently rate limited */
  isVoiceRateLimited: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format milliseconds into a human-readable countdown string.
 * @param ms - Time remaining in milliseconds
 * @returns Formatted string like "45s", "2m 30s", or "1h 15m"
 */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";

  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

// ============================================================================
// useRateLimitCheck Hook
// ============================================================================

/**
 * Hook for checking rate limit status for messaging.
 * Provides real-time rate limit information with countdown timers.
 *
 * FR-047: Rate limit exceeded user feedback
 *
 * Features:
 * - Real-time updates via Convex subscription
 * - Countdown timer that updates every second when rate limited
 * - Separate status for text (30/min) and voice (20/hr) messages
 *
 * @returns Rate limit status and countdown information
 *
 * @example
 * ```tsx
 * const {
 *   isTextRateLimited,
 *   textCountdown,
 *   isVoiceRateLimited,
 *   voiceCountdown,
 * } = useRateLimitCheck();
 *
 * if (isTextRateLimited) {
 *   toast.error(`Rate limit exceeded. Try again in ${textCountdown}`);
 * }
 * ```
 */
export function useRateLimitCheck(): UseRateLimitCheckReturn {
  // State for countdown timers (updated every second when rate limited)
  const [now, setNow] = useState(Date.now());

  // Subscribe to rate limit status from Convex
  const rateLimitData = useQuery(api.messages.getRateLimitStatus);

  // Update countdown timer every second when rate limited
  const isAnyRateLimited =
    rateLimitData?.textMessage?.isRateLimited ||
    rateLimitData?.voiceMessage?.isRateLimited;

  useEffect(() => {
    if (!isAnyRateLimited) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isAnyRateLimited]);

  // Calculate countdown strings
  const textCountdown = useMemo(() => {
    if (!rateLimitData?.textMessage?.isRateLimited) return null;
    const remaining = rateLimitData.textMessage.resetAt - now;
    if (remaining <= 0) return null;
    return formatCountdown(remaining);
  }, [rateLimitData?.textMessage, now]);

  const voiceCountdown = useMemo(() => {
    if (!rateLimitData?.voiceMessage?.isRateLimited) return null;
    const remaining = rateLimitData.voiceMessage.resetAt - now;
    if (remaining <= 0) return null;
    return formatCountdown(remaining);
  }, [rateLimitData?.voiceMessage, now]);

  // Memoize status objects
  const textStatus: RateLimitStatus | null = useMemo(() => {
    if (!rateLimitData?.textMessage) return null;
    return rateLimitData.textMessage;
  }, [rateLimitData?.textMessage]);

  const voiceStatus: RateLimitStatus | null = useMemo(() => {
    if (!rateLimitData?.voiceMessage) return null;
    return rateLimitData.voiceMessage;
  }, [rateLimitData?.voiceMessage]);

  return {
    textStatus,
    voiceStatus,
    isLoading: rateLimitData === undefined,
    textCountdown,
    voiceCountdown,
    isTextRateLimited: textStatus?.isRateLimited ?? false,
    isVoiceRateLimited: voiceStatus?.isRateLimited ?? false,
  };
}
