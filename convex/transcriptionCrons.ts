import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// ============================================================================
// Transcription Cost Control Cron Jobs
// ============================================================================

/**
 * Reset daily transcription limits for all users.
 *
 * This internal mutation is called by a cron job at midnight UTC each day.
 * It resets the dailyMinutesUsed and dailyTranscriptionCount to 0 for ALL
 * transcriptionUsage records across all dates.
 *
 * RATIONALE:
 * At midnight UTC, we want all users to start fresh with their daily quota.
 * Rather than querying by a specific date (which would miss records or require
 * complex date logic), we simply reset ALL records. This ensures:
 * 1. Clean slate for everyone at midnight
 * 2. No edge cases with timezone or date boundary issues
 * 3. Historical cost data (estimatedCostCents) is preserved
 *
 * The dailyMinutesUsed and dailyTranscriptionCount fields track "today's" usage.
 * The date field in each record indicates when the record was created/last used,
 * which is useful for auditing but not for daily limit enforcement.
 *
 * @returns Number of records reset
 */
export const resetDailyTranscriptionLimits = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();

    // Query ALL transcription usage records.
    // At midnight, we reset daily counters for everyone, regardless of the
    // date field. This ensures a clean slate for all users.
    const usageRecords = await ctx.db.query("transcriptionUsage").collect();

    let resetCount = 0;

    for (const record of usageRecords) {
      // Only reset if there's usage to reset (avoid unnecessary writes)
      if (record.dailyMinutesUsed > 0 || record.dailyTranscriptionCount > 0) {
        await ctx.db.patch(record._id, {
          dailyMinutesUsed: 0,
          dailyTranscriptionCount: 0,
          updatedAt: now,
        });
        resetCount++;
      }
    }

    return resetCount;
  },
});

/**
 * Check monthly transcription budget and alert/disable if thresholds exceeded.
 *
 * This internal mutation is called by a cron job every hour.
 * It checks the current month's transcription budget usage and:
 * - Logs a warning if usage exceeds 80% (and no prior 80% alert)
 * - Disables transcription if usage reaches 100% (and not already disabled)
 *
 * @returns Object with current usage statistics and any actions taken
 */
export const checkMonthlyBudget = internalMutation({
  args: {},
  returns: v.object({
    currentUsageCents: v.number(),
    limitCents: v.number(),
    percentUsed: v.number(),
    alertSent80: v.boolean(),
    disabledAt100: v.boolean(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // Get current month in YYYY-MM format
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Get or create budget record for current month
    let budget = await ctx.db
      .query("transcriptionBudget")
      .withIndex("by_month", (q) => q.eq("month", currentMonth))
      .first();

    // If no budget record exists, create one with defaults
    if (!budget) {
      const budgetId = await ctx.db.insert("transcriptionBudget", {
        month: currentMonth,
        totalMinutesUsed: 0,
        totalTranscriptionCount: 0,
        totalCostCents: 0,
        budgetCents: 200000, // $2000 default
        isDisabled: false,
        createdAt: now,
        updatedAt: now,
      });
      budget = await ctx.db.get(budgetId);
      if (!budget) {
        throw new Error("Failed to create budget record");
      }
    }

    const currentUsageCents = budget.totalCostCents;
    const limitCents = budget.budgetCents;
    const percentUsed =
      limitCents > 0 ? Math.round((currentUsageCents / limitCents) * 100) : 0;

    let alertSent80 = false;
    let disabledAt100 = false;

    // Check 80% threshold
    if (percentUsed >= 80 && !budget.alertSentAt80Percent) {
      // Log warning (in production, this would trigger an email/notification)
      console.warn(
        `[TRANSCRIPTION BUDGET WARNING] Month ${currentMonth}: Usage at ${percentUsed}% ($${(currentUsageCents / 100).toFixed(2)} of $${(limitCents / 100).toFixed(2)})`
      );

      await ctx.db.patch(budget._id, {
        alertSentAt80Percent: now,
        updatedAt: now,
      });
      alertSent80 = true;
    }

    // Check 100% threshold
    if (percentUsed >= 100 && !budget.isDisabled) {
      // Log critical warning
      console.error(
        `[TRANSCRIPTION BUDGET EXCEEDED] Month ${currentMonth}: Usage at ${percentUsed}% - Disabling transcription`
      );

      await ctx.db.patch(budget._id, {
        isDisabled: true,
        alertSentAt100Percent: now,
        updatedAt: now,
      });
      disabledAt100 = true;
    }

    return {
      currentUsageCents,
      limitCents,
      percentUsed,
      alertSent80,
      disabledAt100,
    };
  },
});
