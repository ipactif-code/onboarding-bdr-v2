/**
 * Cost control module for transcription services.
 *
 * T174: Budget tracking and enforcement for OpenAI Whisper transcription.
 *
 * This module provides:
 * - Daily per-user transcription limits (30 minutes)
 * - Monthly global budget tracking ($2000)
 * - Pre-transcription budget checks to prevent overages
 *
 * Usage:
 * ```typescript
 * const result = await checkTranscriptionBudget(ctx, userId, estimatedDurationSeconds);
 * if (!result.allowed) {
 *   throw new Error(result.reason);
 * }
 * // Proceed with transcription
 * ```
 */

import { QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// ============================================================================
// Constants
// ============================================================================

/** Daily limit per user in seconds (30 minutes = 1800 seconds). */
export const DAILY_LIMIT_SECONDS = 1800;

/** Monthly global budget in cents ($2000 = 200000 cents). */
export const MONTHLY_BUDGET_CENTS = 200000;

/** OpenAI Whisper API cost per minute in cents ($0.006 = 0.6 cents). */
export const COST_PER_MINUTE_CENTS = 0.6;

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Get today's date as a "YYYY-MM-DD" string.
 *
 * @returns Today's date formatted as "YYYY-MM-DD".
 *
 * @example
 * ```typescript
 * const today = getTodayDate();
 * // "2024-01-15"
 * ```
 */
export function getTodayDate(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get the current month as a "YYYY-MM" string.
 *
 * @returns Current month formatted as "YYYY-MM".
 *
 * @example
 * ```typescript
 * const month = getCurrentMonth();
 * // "2024-01"
 * ```
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// ============================================================================
// Cost Calculation
// ============================================================================

/**
 * Calculate the cost in cents for a given audio duration.
 *
 * Uses OpenAI Whisper pricing: $0.006 per minute (0.6 cents).
 * Result is rounded up to ensure we never underestimate costs.
 *
 * @param durationSeconds - The duration of the audio in seconds.
 * @returns The estimated cost in cents (rounded up).
 *
 * @example
 * ```typescript
 * const cost = calculateCost(120); // 2 minutes
 * // Returns: 2 (1.2 cents rounded up)
 * ```
 */
export function calculateCost(durationSeconds: number): number {
  const durationMinutes = durationSeconds / 60;
  return Math.ceil(durationMinutes * COST_PER_MINUTE_CENTS);
}

// ============================================================================
// Budget Check Types
// ============================================================================

/**
 * Result of a budget check operation.
 */
export type BudgetCheckResult = {
  /** Whether the transcription is allowed to proceed. */
  allowed: boolean;
  /** Reason for denial (if not allowed). */
  reason?: string;
  /** Remaining seconds available for today (user's daily limit). */
  remainingDailySeconds?: number;
  /** Remaining budget in cents for this month. */
  remainingMonthlyBudgetCents?: number;
};

// ============================================================================
// Budget Check Function
// ============================================================================

/**
 * Check if a transcription can proceed based on budget constraints.
 *
 * This function performs three checks in order:
 * 1. **Global disable**: Is transcription globally disabled for this month?
 * 2. **Daily limit**: Has the user exceeded their 30-minute daily limit?
 * 3. **Monthly budget**: Would this transcription exceed the monthly budget?
 *
 * **Important**: This is a read-only check. It does NOT update usage counters.
 * Usage should be recorded AFTER successful transcription via a separate mutation.
 *
 * @param ctx - The query context for database access.
 * @param userId - The ID of the user requesting transcription.
 * @param estimatedDurationSeconds - Estimated duration of the audio in seconds.
 * @returns A BudgetCheckResult indicating if transcription is allowed.
 *
 * @example
 * ```typescript
 * const result = await checkTranscriptionBudget(ctx, userId, 60);
 * if (!result.allowed) {
 *   throw new Error(result.reason);
 * }
 * console.log(`Remaining today: ${result.remainingDailySeconds}s`);
 * ```
 */
export async function checkTranscriptionBudget(
  ctx: QueryCtx,
  userId: Id<"users">,
  estimatedDurationSeconds: number
): Promise<BudgetCheckResult> {
  const today = getTodayDate();
  const currentMonth = getCurrentMonth();

  // -------------------------------------------------------------------------
  // Step 1: Check monthly budget status and global disable flag
  // -------------------------------------------------------------------------
  const monthlyBudget = await ctx.db
    .query("transcriptionBudget")
    .withIndex("by_month", (q) => q.eq("month", currentMonth))
    .unique();

  // If no budget record exists, assume fresh month with full budget available
  const budgetCents = monthlyBudget?.budgetCents ?? MONTHLY_BUDGET_CENTS;
  const totalCostCents = monthlyBudget?.totalCostCents ?? 0;
  const isDisabled = monthlyBudget?.isDisabled ?? false;

  // Check if transcription is globally disabled
  if (isDisabled) {
    return {
      allowed: false,
      reason:
        "Transcription is temporarily disabled. Monthly budget has been exceeded.",
      remainingDailySeconds: 0,
      remainingMonthlyBudgetCents: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Step 2: Check user's daily usage
  // -------------------------------------------------------------------------
  const dailyUsage = await ctx.db
    .query("transcriptionUsage")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
    .unique();

  // Calculate current daily usage in seconds
  const dailyMinutesUsed = dailyUsage?.dailyMinutesUsed ?? 0;
  const dailySecondsUsed = dailyMinutesUsed * 60;

  // Check if user would exceed daily limit
  const projectedDailySeconds = dailySecondsUsed + estimatedDurationSeconds;
  if (projectedDailySeconds > DAILY_LIMIT_SECONDS) {
    const remainingDailySeconds = Math.max(0, DAILY_LIMIT_SECONDS - dailySecondsUsed);
    return {
      allowed: false,
      reason: `Daily transcription limit reached. You have ${Math.floor(remainingDailySeconds / 60)} minutes ${remainingDailySeconds % 60} seconds remaining today.`,
      remainingDailySeconds,
      remainingMonthlyBudgetCents: budgetCents - totalCostCents,
    };
  }

  // -------------------------------------------------------------------------
  // Step 3: Check monthly budget
  // -------------------------------------------------------------------------
  const estimatedCost = calculateCost(estimatedDurationSeconds);
  const projectedTotalCost = totalCostCents + estimatedCost;

  if (projectedTotalCost > budgetCents) {
    const remainingBudgetCents = Math.max(0, budgetCents - totalCostCents);
    return {
      allowed: false,
      reason:
        "Monthly transcription budget has been reached. Please try again next month.",
      remainingDailySeconds: DAILY_LIMIT_SECONDS - dailySecondsUsed,
      remainingMonthlyBudgetCents: remainingBudgetCents,
    };
  }

  // -------------------------------------------------------------------------
  // All checks passed - transcription is allowed
  // -------------------------------------------------------------------------
  return {
    allowed: true,
    remainingDailySeconds: DAILY_LIMIT_SECONDS - projectedDailySeconds,
    remainingMonthlyBudgetCents: budgetCents - projectedTotalCost,
  };
}
