import { cronJobs } from "convex/server";

// ============================================================================
// Cron Jobs Configuration
// ============================================================================

const crons = cronJobs();

// ============================================================================
// PRESENCE & STATUS
// ============================================================================

// Note: We use a deferred import to avoid TS2589 "Type instantiation is
// excessively deep" error that occurs with complex Convex internal type
// inference in cron job definitions.

/**
 * Check for inactive users and set their status to "away".
 *
 * Runs every 1 minute to identify users who:
 * - Have status set to "online"
 * - Have been inactive for more than 5 minutes
 *
 * These users are automatically transitioned to "away" status.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { internal } = require("./_generated/api");
crons.interval("check inactive users", { minutes: 1 }, internal.presence.checkInactiveUsers);

export default crons;
