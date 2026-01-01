/**
 * Voice Messages - Budget Queries
 *
 * T174: Pre-recording budget validation queries.
 *
 * These queries allow the frontend to check budget availability
 * BEFORE starting a voice recording, providing a better UX by
 * preventing users from recording when they can't transcribe.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";
import { checkTranscriptionBudget } from "../lib/costControl";
import { MAX_VOICE_DURATION_SECONDS } from "./types";

// ============================================================================
// Validators
// ============================================================================

/**
 * Validator for the budget check result.
 * Mirrors the BudgetCheckResult type from costControl.ts.
 */
const budgetCheckResultValidator = v.object({
  allowed: v.boolean(),
  reason: v.optional(v.string()),
  remainingDailySeconds: v.optional(v.number()),
  remainingMonthlyBudgetCents: v.optional(v.number()),
});

// ============================================================================
// T174: Check Budget Query
// ============================================================================

/** Default estimated duration in seconds (2 minutes). */
const DEFAULT_ESTIMATED_DURATION_SECONDS = 120;

/**
 * Check if the current user can record a voice message for transcription.
 *
 * T174: Pre-recording budget check for frontend validation.
 *
 * This query should be called BEFORE the user starts recording to:
 * 1. Prevent recording when daily limit is reached
 * 2. Prevent recording when monthly budget is exhausted
 * 3. Show remaining quota to the user
 *
 * @param estimatedDurationSeconds - Expected recording duration in seconds (default: 120).
 * @returns Budget check result with allowed status and remaining quotas.
 *
 * @example
 * ```typescript
 * // Frontend usage before recording
 * const budget = useQuery(api.voiceMessages.checkBudget, {
 *   estimatedDurationSeconds: 60, // 1 minute recording
 * });
 *
 * if (budget && !budget.allowed) {
 *   toast.error(budget.reason);
 *   return;
 * }
 * ```
 */
export const checkBudget = query({
  args: {
    estimatedDurationSeconds: v.optional(v.number()),
  },
  returns: budgetCheckResultValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const estimatedDuration =
      args.estimatedDurationSeconds ?? DEFAULT_ESTIMATED_DURATION_SECONDS;

    // Validate duration is positive
    if (estimatedDuration <= 0) {
      return {
        allowed: false,
        reason: "Estimated duration must be a positive number.",
        remainingDailySeconds: 0,
        remainingMonthlyBudgetCents: 0,
      };
    }

    // Validate duration does not exceed maximum
    if (estimatedDuration > MAX_VOICE_DURATION_SECONDS) {
      return {
        allowed: false,
        reason: `Duration cannot exceed ${MAX_VOICE_DURATION_SECONDS} seconds`,
        remainingDailySeconds: 0,
        remainingMonthlyBudgetCents: 0,
      };
    }

    const result = await checkTranscriptionBudget(
      ctx,
      user._id,
      estimatedDuration
    );

    return result;
  },
});
