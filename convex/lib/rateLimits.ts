import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Rate limit configuration for different message types.
 */
const RATE_LIMIT_CONFIG = {
  text_message: {
    limit: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  voice_message: {
    limit: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
} as const;

/**
 * Rate limit type for messaging.
 */
export type RateLimitType = keyof typeof RATE_LIMIT_CONFIG;

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the action is allowed under the current rate limit. */
  allowed: boolean;
  /** Number of remaining actions allowed in the current window. */
  remaining: number;
  /** Timestamp (ms) when the rate limit window resets. */
  resetAt: number;
}

/**
 * Check if a user has exceeded rate limits for a message type.
 * Updates the rate limit counter if within limits.
 *
 * This function uses the `rateLimits` table with `by_user_type` index
 * for efficient lookups. If the window has expired, it resets the counter.
 * If within the window, it increments the count and checks against the limit.
 *
 * **Note**: This function has a minor race condition window between read and write.
 * In rare cases of concurrent requests, the limit may be slightly exceeded (by 1-2 requests).
 * This is acceptable for application-level rate limiting where strict enforcement is not required.
 * For strict enforcement, consider using Convex's rate-limiter component.
 *
 * @param ctx - The mutation context for database access.
 * @param userId - The ID of the user to check rate limits for.
 * @param type - The type of rate limit to check ("text_message" or "voice_message").
 * @returns An object containing:
 *   - `allowed`: Whether the action is permitted.
 *   - `remaining`: How many more actions are allowed in the current window.
 *   - `resetAt`: Timestamp when the window resets.
 *
 * @example
 * ```typescript
 * const result = await checkRateLimit(ctx, userId, "text_message");
 * if (!result.allowed) {
 *   throw new Error(`Rate limit exceeded. Try again after ${new Date(result.resetAt).toISOString()}`);
 * }
 * ```
 */
export async function checkRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
  type: RateLimitType
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIG[type];
  const now = Date.now();

  // Look up existing rate limit record using the index
  const existingRecord = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", type))
    .unique();

  if (existingRecord) {
    const windowEnd = existingRecord.windowStart + config.windowMs;

    // Check if window has expired
    if (now >= windowEnd) {
      // Window expired - reset counter to 1 (for this request)
      await ctx.db.patch(existingRecord._id, {
        windowStart: now,
        count: 1,
      });

      return {
        allowed: true,
        remaining: config.limit - 1,
        resetAt: now + config.windowMs,
      };
    }

    // Window still active - check if limit exceeded
    const newCount = existingRecord.count + 1;

    if (newCount > config.limit) {
      // Rate limit exceeded - do not update counter
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowEnd,
      };
    }

    // Within limit - increment counter
    await ctx.db.patch(existingRecord._id, {
      count: newCount,
    });

    return {
      allowed: true,
      remaining: config.limit - newCount,
      resetAt: windowEnd,
    };
  }

  // No existing record - create new one with count of 1
  await ctx.db.insert("rateLimits", {
    userId,
    type,
    windowStart: now,
    count: 1,
  });

  return {
    allowed: true,
    remaining: config.limit - 1,
    resetAt: now + config.windowMs,
  };
}

/**
 * Get the current rate limit status for a user without consuming a request.
 * This is useful for displaying remaining limits in the UI.
 *
 * @param ctx - The mutation context for database access.
 * @param userId - The ID of the user to check rate limits for.
 * @param type - The type of rate limit to check.
 * @returns The current rate limit status, or null if no record exists.
 *
 * @example
 * ```typescript
 * const status = await getRateLimitStatus(ctx, userId, "voice_message");
 * if (status && status.remaining < 5) {
 *   // Warn user about low remaining quota
 * }
 * ```
 */
export async function getRateLimitStatus(
  ctx: MutationCtx,
  userId: Id<"users">,
  type: RateLimitType
): Promise<RateLimitResult | null> {
  const config = RATE_LIMIT_CONFIG[type];
  const now = Date.now();

  const existingRecord = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", type))
    .unique();

  if (!existingRecord) {
    // No record means user has full quota available
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: now + config.windowMs,
    };
  }

  const windowEnd = existingRecord.windowStart + config.windowMs;

  // Check if window has expired
  if (now >= windowEnd) {
    // Window expired - user has full quota available
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: now + config.windowMs,
    };
  }

  // Window active - calculate remaining
  const remaining = Math.max(0, config.limit - existingRecord.count);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt: windowEnd,
  };
}

/**
 * Get the rate limit configuration for a specific type.
 * Useful for displaying limits in the UI.
 *
 * @param type - The type of rate limit.
 * @returns The configuration object with limit and window duration.
 */
export function getRateLimitConfig(type: RateLimitType): {
  limit: number;
  windowMs: number;
} {
  return { ...RATE_LIMIT_CONFIG[type] };
}
