import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Rate limit configuration for link preview requests.
 * 10 requests per minute per user.
 */
export const LINK_PREVIEW_RATE_LIMIT = {
  limit: 10,
  windowMs: 60 * 1000, // 1 minute
};

/**
 * Internal query to check rate limit status without consuming a request.
 */
export const checkLinkPreviewRateLimit = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({
    allowed: v.boolean(),
    remaining: v.number(),
    resetAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const config = LINK_PREVIEW_RATE_LIMIT;

    // Look for existing rate limit record using the index
    const existingRecord = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", args.userId).eq("type", "link_preview")
      )
      .unique();

    if (!existingRecord) {
      return {
        allowed: true,
        remaining: config.limit,
        resetAt: now + config.windowMs,
      };
    }

    const windowEnd = existingRecord.windowStart + config.windowMs;

    // Check if window has expired
    if (now >= windowEnd) {
      return {
        allowed: true,
        remaining: config.limit,
        resetAt: now + config.windowMs,
      };
    }

    const remaining = Math.max(0, config.limit - existingRecord.count);

    return {
      allowed: remaining > 0,
      remaining,
      resetAt: windowEnd,
    };
  },
});

/**
 * Internal mutation to consume a rate limit request.
 * Returns whether the request is allowed.
 */
export const consumeLinkPreviewRateLimit = internalMutation({
  args: { userId: v.id("users") },
  returns: v.object({
    allowed: v.boolean(),
    remaining: v.number(),
    resetAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const config = LINK_PREVIEW_RATE_LIMIT;

    // Look for existing rate limit record using the index
    const existingRecord = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", args.userId).eq("type", "link_preview")
      )
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
      await ctx.db.patch(existingRecord._id, { count: newCount });

      return {
        allowed: true,
        remaining: config.limit - newCount,
        resetAt: windowEnd,
      };
    }

    // No existing record - create new one with count of 1
    await ctx.db.insert("rateLimits", {
      userId: args.userId,
      type: "link_preview",
      windowStart: now,
      count: 1,
    });

    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: now + config.windowMs,
    };
  },
});
