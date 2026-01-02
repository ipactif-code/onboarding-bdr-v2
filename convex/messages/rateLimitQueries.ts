/**
 * Rate Limit Queries
 *
 * Public queries for checking rate limit status from the frontend.
 * These queries are read-only and do NOT consume rate limit slots.
 *
 * FR-047: Rate limit exceeded user feedback
 *
 * T200: Fixed to count actual messages instead of relying on rateLimits table
 * which may be out of sync due to race conditions or missing updates.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../lib/auth";

/**
 * Rate limit configuration - must match convex/lib/rateLimits.ts
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
 * Get the current rate limit status for the authenticated user.
 * This is a read-only check that does NOT consume a rate limit slot.
 *
 * FR-047: Enables proactive UI feedback before sending messages.
 *
 * T200: This query now counts actual messages sent by the user instead of
 * relying on the rateLimits tracking table. This provides more accurate
 * rate limit status even if the tracking table is out of sync.
 *
 * @returns Rate limit status for both text and voice messages
 */
export const getRateLimitStatus = query({
  args: {},
  returns: v.object({
    textMessage: v.object({
      isRateLimited: v.boolean(),
      remaining: v.number(),
      resetAt: v.number(),
      limit: v.number(),
      windowMs: v.number(),
    }),
    voiceMessage: v.object({
      isRateLimited: v.boolean(),
      remaining: v.number(),
      resetAt: v.number(),
      limit: v.number(),
      windowMs: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    /**
     * Count text messages sent by the user in the rate limit window.
     * Uses the by_sender_time index for efficient querying.
     */
    const getTextMessageStatus = async (): Promise<{
      isRateLimited: boolean;
      remaining: number;
      resetAt: number;
      limit: number;
      windowMs: number;
    }> => {
      const config = RATE_LIMIT_CONFIG.text_message;
      const windowStart = now - config.windowMs;

      // Count messages sent in the current window using the by_sender_time index
      // We filter by createdAt >= windowStart to get only messages in the window
      const recentMessages = await ctx.db
        .query("messages")
        .withIndex("by_sender_time", (q) =>
          q.eq("senderId", user._id).gte("createdAt", windowStart)
        )
        .filter((q) =>
          // Only count text messages (exclude voice, file, system messages)
          q.or(
            q.eq(q.field("contentType"), "text"),
            q.eq(q.field("contentType"), undefined) // Legacy messages without contentType
          )
        )
        .collect();

      const count = recentMessages.length;
      const isRateLimited = count >= config.limit;
      const remaining = Math.max(0, config.limit - count);

      return {
        isRateLimited,
        remaining,
        resetAt: windowStart + config.windowMs,
        limit: config.limit,
        windowMs: config.windowMs,
      };
    };

    /**
     * Get voice message status from the rateLimits table.
     * Voice messages are tracked in voiceMessages table which requires
     * joining with messages, so we continue to use the counter approach
     * for voice messages.
     */
    const getVoiceMessageStatus = async (): Promise<{
      isRateLimited: boolean;
      remaining: number;
      resetAt: number;
      limit: number;
      windowMs: number;
    }> => {
      const config = RATE_LIMIT_CONFIG.voice_message;

      const existingRecord = await ctx.db
        .query("rateLimits")
        .withIndex("by_user_type", (q) =>
          q.eq("userId", user._id).eq("type", "voice_message")
        )
        .unique();

      if (!existingRecord) {
        // No record means user has full quota available
        return {
          isRateLimited: false,
          remaining: config.limit,
          resetAt: now + config.windowMs,
          limit: config.limit,
          windowMs: config.windowMs,
        };
      }

      const windowEnd = existingRecord.windowStart + config.windowMs;

      // Check if window has expired
      if (now >= windowEnd) {
        // Window expired - user has full quota available
        return {
          isRateLimited: false,
          remaining: config.limit,
          resetAt: now + config.windowMs,
          limit: config.limit,
          windowMs: config.windowMs,
        };
      }

      // Window active - calculate remaining
      const remaining = Math.max(0, config.limit - existingRecord.count);

      return {
        isRateLimited: remaining === 0,
        remaining,
        resetAt: windowEnd,
        limit: config.limit,
        windowMs: config.windowMs,
      };
    };

    const [textMessage, voiceMessage] = await Promise.all([
      getTextMessageStatus(),
      getVoiceMessageStatus(),
    ]);

    return { textMessage, voiceMessage };
  },
});
