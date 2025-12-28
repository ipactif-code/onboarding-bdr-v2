/**
 * Voice Messages - Helper Functions
 *
 * Internal helper functions for voice message processing.
 */

import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { estimateTranscriptionCostCents } from "../lib/transcription";

// ============================================================================
// Transcription Usage Tracking (Cost Control)
// ============================================================================

/**
 * Track transcription usage for cost control.
 *
 * Updates the daily usage record for the user and the monthly budget.
 *
 * @param ctx - Mutation context.
 * @param userId - The user who used transcription.
 * @param durationSeconds - The duration of the transcribed audio.
 */
export async function trackTranscriptionUsage(
  ctx: MutationCtx,
  userId: Id<"users">,
  durationSeconds: number
): Promise<void> {
  const now = Date.now();
  const isoDate = new Date(now).toISOString();
  const today = isoDate.split("T")[0] ?? isoDate.substring(0, 10); // "YYYY-MM-DD"
  const month = today.substring(0, 7); // "YYYY-MM"
  const durationMinutes = durationSeconds / 60;
  const costCents = estimateTranscriptionCostCents(durationSeconds);

  // Update or create daily usage record
  const existingUsage = await ctx.db
    .query("transcriptionUsage")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
    .unique();

  if (existingUsage) {
    await ctx.db.patch(existingUsage._id, {
      dailyMinutesUsed: existingUsage.dailyMinutesUsed + durationMinutes,
      dailyTranscriptionCount: existingUsage.dailyTranscriptionCount + 1,
      estimatedCostCents: existingUsage.estimatedCostCents + costCents,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("transcriptionUsage", {
      userId,
      date: today,
      dailyMinutesUsed: durationMinutes,
      dailyTranscriptionCount: 1,
      estimatedCostCents: costCents,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Update or create monthly budget record
  const existingBudget = await ctx.db
    .query("transcriptionBudget")
    .withIndex("by_month", (q) => q.eq("month", month))
    .unique();

  if (existingBudget) {
    await ctx.db.patch(existingBudget._id, {
      totalMinutesUsed: existingBudget.totalMinutesUsed + durationMinutes,
      totalTranscriptionCount: existingBudget.totalTranscriptionCount + 1,
      totalCostCents: existingBudget.totalCostCents + costCents,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("transcriptionBudget", {
      month,
      totalMinutesUsed: durationMinutes,
      totalTranscriptionCount: 1,
      totalCostCents: costCents,
      budgetCents: 200000, // $2000 default budget
      isDisabled: false,
      createdAt: now,
      updatedAt: now,
    });
  }
}
