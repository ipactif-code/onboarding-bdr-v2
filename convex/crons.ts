import { cronJobs } from "convex/server";

// ============================================================================
// Cron Jobs Configuration
// ============================================================================

const crons = cronJobs();

// Note: We use a deferred import to avoid TS2589 "Type instantiation is
// excessively deep" error that occurs with complex Convex internal type
// inference in cron job definitions.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { internal } = require("./_generated/api");

// ============================================================================
// PRESENCE & STATUS
// ============================================================================

/**
 * Check for inactive users and set their status to "away".
 *
 * Runs every 1 minute to identify users who:
 * - Have status set to "online"
 * - Have been inactive for more than 5 minutes
 *
 * These users are automatically transitioned to "away" status.
 */
crons.interval(
  "check inactive users",
  { minutes: 1 },
  internal.presence.checkInactiveUsers
);

/**
 * Clean up expired typing indicators.
 *
 * Runs every 10 seconds to remove stale typing indicators from the
 * typingIndicators table. A typing indicator is considered expired
 * if its expiresAt timestamp (3 seconds) has passed.
 */
crons.interval(
  "cleanup typing indicators",
  { seconds: 10 },
  internal.presence.cleanupTypingIndicators
);

/**
 * Clean up expired custom statuses.
 *
 * Runs every 1 minute to clear custom status fields (text, emoji, expiresAt)
 * for users whose customStatusExpiresAt timestamp has passed.
 */
crons.interval(
  "cleanup expired statuses",
  { minutes: 1 },
  internal.presence.cleanupExpiredStatuses
);

// ============================================================================
// MESSAGE RETENTION & GDPR
// ============================================================================

/**
 * Anonymize messages that have passed their retention period.
 *
 * Runs daily at 2:00 AM UTC to process messages deleted more than 90 days ago.
 * Eligible messages are:
 * 1. Added to the AI training corpus (if from public/course channels)
 * 2. Content replaced with "[Message deleted]"
 * 3. Retention entry marked as anonymized
 *
 * Cron expression: minute=0, hour=2, day=*, month=*, weekday=*
 */
crons.cron(
  "anonymize expired messages",
  "0 2 * * *",
  internal.retention.anonymizeExpiredMessages
);

/**
 * Process pending GDPR data export and deletion requests.
 *
 * Runs every 15 minutes to handle:
 * - Export requests: Collect user data, create JSON file, store in Convex storage
 * - Deletion requests: Delete/anonymize all user data
 *
 * Processes up to 10 requests per invocation with retry logic.
 */
crons.interval(
  "process gdpr requests",
  { minutes: 15 },
  internal.gdprRequests.processGdprRequests
);

/**
 * Clean up expired GDPR export files.
 *
 * Runs daily at 3:00 AM UTC to delete export files that have passed their
 * 7-day expiration period from Convex storage.
 *
 * Cron expression: minute=0, hour=3, day=*, month=*, weekday=*
 */
crons.cron(
  "cleanup expired exports",
  "0 3 * * *",
  internal.gdprRequests.cleanupExpiredExports
);

// ============================================================================
// TRANSCRIPTION COST CONTROL
// ============================================================================

/**
 * Reset daily transcription limits for all users.
 *
 * Runs daily at midnight UTC to reset dailyMinutesUsed and
 * dailyTranscriptionCount to 0 for all transcriptionUsage records.
 *
 * Cron expression: minute=0, hour=0, day=*, month=*, weekday=*
 */
crons.cron(
  "reset daily transcription limits",
  "0 0 * * *",
  internal.transcriptionCrons.resetDailyTranscriptionLimits
);

/**
 * Check monthly transcription budget usage.
 *
 * Runs every hour to monitor budget thresholds:
 * - At 80%: Log warning (would trigger alert in production)
 * - At 100%: Disable transcription feature
 */
crons.interval(
  "check monthly budget",
  { hours: 1 },
  internal.transcriptionCrons.checkMonthlyBudget
);

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Process pending mention notifications.
 *
 * Runs every 1 minute to mark unnotified mentions as notified.
 * In a full implementation, this would also trigger push notifications,
 * emails, etc. via separate actions.
 */
crons.interval(
  "process pending mentions",
  { minutes: 1 },
  internal.mentions.processPendingMentions
);

export default crons;
