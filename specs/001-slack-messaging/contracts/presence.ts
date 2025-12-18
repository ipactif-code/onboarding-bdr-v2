/**
 * Presence & Status API Contracts
 *
 * This file defines the TypeScript signatures for user presence,
 * status, and notification preference functionality.
 */

import { Id } from "convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type PresenceStatus = "online" | "offline" | "away" | "dnd";

export interface UserPresence {
  _id: Id<"users">;
  name: string;
  avatarUrl?: string;
  status: PresenceStatus;
  customStatus?: string;
  customStatusEmoji?: string;
  customStatusExpiresAt?: number;
  lastActiveAt?: number;
}

export interface NotificationPreferences {
  _id: Id<"notificationPreferences">;
  userId: Id<"users">;
  enablePush: boolean;
  enableSound: boolean;
  enableDesktop: boolean;
  dndEnabled: boolean;
  dndStart?: string;
  dndEnd?: string;
  defaultChannelLevel: "all" | "mentions" | "none";
  defaultDmLevel: "all" | "none";
  keywords: string[];
}

// ============================================================================
// Presence Queries
// ============================================================================

/**
 * Get presence status for multiple users
 *
 * Used to display status indicators in user lists.
 */
export interface GetPresenceArgs {
  userIds: Id<"users">[];
}

export interface GetPresenceResult {
  users: UserPresence[];
}

// Query: api.presence.getMultiple

/**
 * Get current user's full presence info
 */
export interface GetMyPresenceResult {
  presence: UserPresence;
}

// Query: api.presence.getMine

/**
 * Get online users count and list
 *
 * Used for @here mention and presence overview.
 */
export interface GetOnlineUsersArgs {
  channelId?: Id<"channels">; // If provided, only channel members
  limit?: number;
}

export interface GetOnlineUsersResult {
  onlineCount: number;
  totalCount: number;
  users: UserPresence[];
}

// Query: api.presence.getOnlineUsers

// ============================================================================
// Presence Mutations
// ============================================================================

/**
 * Send heartbeat to maintain online status
 *
 * Called every 30 seconds while user is active.
 * Resets auto-away timer.
 */
export interface HeartbeatResult {
  success: boolean;
}

// Mutation: api.presence.heartbeat

/**
 * Set user status manually
 */
export interface SetStatusArgs {
  status: PresenceStatus;
}

export interface SetStatusResult {
  success: boolean;
}

// Mutation: api.presence.setStatus

/**
 * Set custom status message and emoji
 */
export interface SetCustomStatusArgs {
  message?: string;
  emoji?: string;
  expiresAt?: number; // Optional expiration timestamp
}

export interface SetCustomStatusResult {
  success: boolean;
}

// Mutation: api.presence.setCustomStatus

/**
 * Clear custom status
 */
export interface ClearCustomStatusResult {
  success: boolean;
}

// Mutation: api.presence.clearCustomStatus

/**
 * Go offline (called on page unload)
 */
export interface GoOfflineResult {
  success: boolean;
}

// Mutation: api.presence.goOffline

// ============================================================================
// Notification Preference Queries
// ============================================================================

/**
 * Get current user's notification preferences
 */
export interface GetNotificationPreferencesResult {
  preferences: NotificationPreferences;
}

// Query: api.presence.getNotificationPreferences

// ============================================================================
// Notification Preference Mutations
// ============================================================================

/**
 * Update global notification preferences
 */
export interface UpdateNotificationPreferencesArgs {
  enablePush?: boolean;
  enableSound?: boolean;
  enableDesktop?: boolean;
  defaultChannelLevel?: "all" | "mentions" | "none";
  defaultDmLevel?: "all" | "none";
}

export interface UpdateNotificationPreferencesResult {
  success: boolean;
}

// Mutation: api.presence.updateNotificationPreferences

/**
 * Enable/disable Do Not Disturb
 */
export interface SetDndArgs {
  enabled: boolean;
  start?: string; // "HH:MM" format
  end?: string; // "HH:MM" format
}

export interface SetDndResult {
  success: boolean;
}

// Mutation: api.presence.setDnd

/**
 * Add keyword alert
 *
 * User will be notified when these words appear in messages.
 */
export interface AddKeywordAlertArgs {
  keyword: string;
}

export interface AddKeywordAlertResult {
  success: boolean;
}

// Mutation: api.presence.addKeywordAlert

/**
 * Remove keyword alert
 */
export interface RemoveKeywordAlertArgs {
  keyword: string;
}

export interface RemoveKeywordAlertResult {
  success: boolean;
}

// Mutation: api.presence.removeKeywordAlert

// ============================================================================
// Internal Scheduled Functions
// ============================================================================

/**
 * Check for inactive users and set to away
 *
 * Runs every minute via Convex cron.
 * Sets users to "away" after 5 minutes of inactivity (FR-035).
 */
// Scheduled: api.presence.checkInactiveUsers

/**
 * Clean up expired typing indicators
 *
 * Runs every 10 seconds via Convex cron.
 */
// Scheduled: api.presence.cleanupTypingIndicators

/**
 * Clean up expired custom statuses
 *
 * Runs every minute via Convex cron.
 */
// Scheduled: api.presence.cleanupExpiredStatuses

// ============================================================================
// Client-Side Hooks (Reference)
// ============================================================================

/**
 * usePresence hook behavior:
 *
 * 1. On mount: Call heartbeat, set status to "online"
 * 2. Every 30s: Call heartbeat while window is focused
 * 3. On visibility change to hidden: Set status to "away"
 * 4. On visibility change to visible: Call heartbeat, set "online"
 * 5. On beforeunload: Call goOffline
 *
 * Example:
 * ```typescript
 * function usePresence() {
 *   const heartbeat = useMutation(api.presence.heartbeat);
 *   const goOffline = useMutation(api.presence.goOffline);
 *
 *   useEffect(() => {
 *     heartbeat();
 *     const interval = setInterval(heartbeat, 30000);
 *
 *     const handleVisibility = () => {
 *       if (document.hidden) {
 *         // Don't call goOffline, just stop heartbeat
 *       } else {
 *         heartbeat();
 *       }
 *     };
 *
 *     const handleUnload = () => {
 *       navigator.sendBeacon('/api/offline', JSON.stringify({ userId }));
 *     };
 *
 *     document.addEventListener('visibilitychange', handleVisibility);
 *     window.addEventListener('beforeunload', handleUnload);
 *
 *     return () => {
 *       clearInterval(interval);
 *       document.removeEventListener('visibilitychange', handleVisibility);
 *       window.removeEventListener('beforeunload', handleUnload);
 *     };
 *   }, []);
 * }
 * ```
 */

/**
 * Presence status display rules:
 *
 * - online (green dot): lastActiveAt within 5 minutes
 * - away (yellow dot): lastActiveAt 5-30 minutes ago OR manual "away"
 * - offline (gray dot): lastActiveAt > 30 minutes ago OR manual "offline"
 * - dnd (red dot with minus): manual "dnd" status
 */
