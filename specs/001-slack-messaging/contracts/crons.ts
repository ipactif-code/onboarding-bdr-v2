/**
 * Cron Jobs Configuration
 *
 * Documents all scheduled functions for the messaging system.
 * Implementation in convex/crons.ts using Convex's crons API.
 */

// ============================================================================
// Cron Job Definitions
// ============================================================================

export interface CronJobDefinition {
  name: string;
  schedule: string;
  function: string;
  description: string;
}

export const CRON_JOBS: CronJobDefinition[] = [
  // ============================================================================
  // PRESENCE & STATUS
  // ============================================================================
  {
    name: "check inactive users",
    schedule: "every 1 minute",
    function: "internal.presence.checkInactiveUsers",
    description: "Set users inactive for 5+ minutes to 'away' status",
  },
  {
    name: "cleanup typing indicators",
    schedule: "every 10 seconds",
    function: "internal.presence.cleanupTypingIndicators",
    description: "Remove typing indicators older than 3 seconds",
  },
  {
    name: "cleanup expired statuses",
    schedule: "every 1 minute",
    function: "internal.presence.cleanupExpiredStatuses",
    description: "Clear custom statuses past their expiration time",
  },

  // ============================================================================
  // MESSAGE RETENTION & GDPR
  // ============================================================================
  {
    name: "anonymize expired messages",
    schedule: "daily at 2:00 AM UTC",
    function: "internal.retention.anonymizeExpiredMessages",
    description: "Anonymize messages deleted 90+ days ago, add to AI corpus",
  },
  {
    name: "process gdpr requests",
    schedule: "every 15 minutes",
    function: "internal.retention.processGdprRequests",
    description: "Process pending data export and deletion requests",
  },
  {
    name: "cleanup expired exports",
    schedule: "daily at 3:00 AM UTC",
    function: "internal.retention.cleanupExpiredExports",
    description: "Delete GDPR export files older than 7 days",
  },
  {
    name: "cleanup expired backups",
    schedule: "daily at 4:00 AM UTC",
    function: "internal.retention.cleanupExpiredBackups",
    description: "Delete message content backups older than 90 days",
  },

  // ============================================================================
  // TRANSCRIPTION COST CONTROL
  // ============================================================================
  {
    name: "reset daily transcription limits",
    schedule: "daily at midnight UTC",
    function: "internal.voice.resetDailyLimits",
    description: "Reset all users' daily transcription minute counters",
  },
  {
    name: "check transcription budget",
    schedule: "every 1 hour",
    function: "internal.voice.checkMonthlyBudget",
    description: "Check monthly budget usage, send alerts at 80% and 100%",
  },
  {
    name: "initialize monthly budget",
    schedule: "1st of each month at midnight UTC",
    function: "internal.voice.initializeMonthlyBudget",
    description: "Create new month's budget record with default limits",
  },

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  {
    name: "process mention notifications",
    schedule: "every 1 minute",
    function: "internal.notifications.processPendingMentions",
    description: "Send batched notifications for @mentions",
  },
  {
    name: "cleanup old notifications",
    schedule: "daily at 5:00 AM UTC",
    function: "internal.notifications.cleanupOldNotifications",
    description: "Delete notification records older than 30 days",
  },

  // ============================================================================
  // SEARCH & AI
  // ============================================================================
  {
    name: "reindex failed messages",
    schedule: "daily at 6:00 AM UTC",
    function: "internal.search.reindexFailedMessages",
    description: "Retry indexing for messages that failed to index",
  },
  {
    name: "categorize corpus entries",
    schedule: "daily at 7:00 AM UTC",
    function: "internal.retention.categorizeCorpusEntries",
    description: "Auto-categorize uncategorized corpus entries",
  },
];

// ============================================================================
// Convex Crons Implementation Reference
// ============================================================================

/**
 * convex/crons.ts implementation:
 *
 * ```typescript
 * import { cronJobs } from "convex/server";
 * import { internal } from "./_generated/api";
 *
 * const crons = cronJobs();
 *
 * // Presence
 * crons.interval("check inactive users", { minutes: 1 }, internal.presence.checkInactiveUsers);
 * crons.interval("cleanup typing indicators", { seconds: 10 }, internal.presence.cleanupTypingIndicators);
 * crons.interval("cleanup expired statuses", { minutes: 1 }, internal.presence.cleanupExpiredStatuses);
 *
 * // Retention
 * crons.daily("anonymize expired messages", { hourUTC: 2, minuteUTC: 0 }, internal.retention.anonymizeExpiredMessages);
 * crons.interval("process gdpr requests", { minutes: 15 }, internal.retention.processGdprRequests);
 * crons.daily("cleanup expired exports", { hourUTC: 3, minuteUTC: 0 }, internal.retention.cleanupExpiredExports);
 * crons.daily("cleanup expired backups", { hourUTC: 4, minuteUTC: 0 }, internal.retention.cleanupExpiredBackups);
 *
 * // Cost Control
 * crons.daily("reset daily transcription limits", { hourUTC: 0, minuteUTC: 0 }, internal.voice.resetDailyLimits);
 * crons.interval("check transcription budget", { hours: 1 }, internal.voice.checkMonthlyBudget);
 * crons.monthly("initialize monthly budget", { day: 1, hourUTC: 0, minuteUTC: 0 }, internal.voice.initializeMonthlyBudget);
 *
 * // Notifications
 * crons.interval("process mention notifications", { minutes: 1 }, internal.notifications.processPendingMentions);
 * crons.daily("cleanup old notifications", { hourUTC: 5, minuteUTC: 0 }, internal.notifications.cleanupOldNotifications);
 *
 * // Search & AI
 * crons.daily("reindex failed messages", { hourUTC: 6, minuteUTC: 0 }, internal.search.reindexFailedMessages);
 * crons.daily("categorize corpus entries", { hourUTC: 7, minuteUTC: 0 }, internal.retention.categorizeCorpusEntries);
 *
 * export default crons;
 * ```
 */
