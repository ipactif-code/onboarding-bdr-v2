import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../../convex/schema";
import {
  checkRateLimit,
  getRateLimitStatus,
  getRateLimitConfig,
} from "../../../convex/lib/rateLimits";

describe("Rate Limits Library", () => {
  describe("checkRateLimit", () => {
    it("should allow first request and create new record", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Act
        const result = await checkRateLimit(ctx, userId, "text_message");

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(29); // 30 limit - 1 used
        expect(result.resetAt).toBeGreaterThan(Date.now());

        // Verify record was created
        const record = await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "text_message")
          )
          .unique();
        expect(record).toBeDefined();
        expect(record?.count).toBe(1);
      });
    });

    it("should allow requests within limit", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        await ctx.db.insert("rateLimits", {
          userId,
          type: "text_message",
          windowStart: now,
          count: 5, // 5 out of 30
        });

        // Act
        const result = await checkRateLimit(ctx, userId, "text_message");

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(24); // 30 - 6
        expect(result.resetAt).toBe(now + 60 * 1000); // 1 minute window

        // Verify count incremented
        const record = await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "text_message")
          )
          .unique();
        expect(record?.count).toBe(6);
      });
    });

    it("should deny request when limit exceeded", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        await ctx.db.insert("rateLimits", {
          userId,
          type: "text_message",
          windowStart: now,
          count: 30, // At limit (30/30)
        });

        // Act
        const result = await checkRateLimit(ctx, userId, "text_message");

        // Assert
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.resetAt).toBe(now + 60 * 1000);

        // Verify count was NOT incremented
        const record = await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "text_message")
          )
          .unique();
        expect(record?.count).toBe(30); // Still 30, not 31
      });
    });

    it("should reset window when expired", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        const oldWindowStart = now - 2 * 60 * 1000; // 2 minutes ago (window expired)

        await ctx.db.insert("rateLimits", {
          userId,
          type: "text_message",
          windowStart: oldWindowStart,
          count: 30, // Was at limit
        });

        // Act
        const result = await checkRateLimit(ctx, userId, "text_message");

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(29); // Fresh window, 30 - 1
        expect(result.resetAt).toBeGreaterThanOrEqual(now + 60 * 1000);

        // Verify window was reset
        const record = await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "text_message")
          )
          .unique();
        expect(record?.count).toBe(1); // Reset to 1
        expect(record?.windowStart).toBeGreaterThanOrEqual(now);
      });
    });

    it("should enforce different limits for voice_message type", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Act - first voice message
        const result = await checkRateLimit(ctx, userId, "voice_message");

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(19); // 20 limit - 1 used (different from text)
        expect(result.resetAt).toBeGreaterThan(Date.now());
        // Voice message window is 1 hour, not 1 minute
        expect(result.resetAt).toBeGreaterThan(Date.now() + 55 * 60 * 1000);

        // Verify record was created with correct type
        const record = await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "voice_message")
          )
          .unique();
        expect(record).toBeDefined();
        expect(record?.count).toBe(1);
        expect(record?.type).toBe("voice_message");
      });
    });

    it("should track text_message and voice_message separately", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Act - send both types
        const textResult = await checkRateLimit(ctx, userId, "text_message");
        const voiceResult = await checkRateLimit(ctx, userId, "voice_message");

        // Assert - both allowed independently
        expect(textResult.allowed).toBe(true);
        expect(textResult.remaining).toBe(29); // 30 - 1

        expect(voiceResult.allowed).toBe(true);
        expect(voiceResult.remaining).toBe(19); // 20 - 1

        // Verify separate records
        const textRecord = await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "text_message")
          )
          .unique();
        expect(textRecord?.count).toBe(1);

        const voiceRecord = await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "voice_message")
          )
          .unique();
        expect(voiceRecord?.count).toBe(1);
      });
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return full quota when no record exists", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Act
        const result = await getRateLimitStatus(ctx, userId, "text_message");

        // Assert
        expect(result).not.toBeNull();
        expect(result?.allowed).toBe(true);
        expect(result?.remaining).toBe(30); // Full quota
        expect(result?.resetAt).toBeGreaterThan(Date.now());
      });
    });

    it("should return correct remaining count for active window", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        await ctx.db.insert("rateLimits", {
          userId,
          type: "text_message",
          windowStart: now,
          count: 10,
        });

        // Act
        const result = await getRateLimitStatus(ctx, userId, "text_message");

        // Assert
        expect(result).not.toBeNull();
        expect(result?.allowed).toBe(true);
        expect(result?.remaining).toBe(20); // 30 - 10
        expect(result?.resetAt).toBe(now + 60 * 1000);
      });
    });

    it("should show zero remaining when limit reached", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        await ctx.db.insert("rateLimits", {
          userId,
          type: "text_message",
          windowStart: now,
          count: 30, // At limit
        });

        // Act
        const result = await getRateLimitStatus(ctx, userId, "text_message");

        // Assert
        expect(result).not.toBeNull();
        expect(result?.allowed).toBe(false);
        expect(result?.remaining).toBe(0);
      });
    });

    it("should handle over-limit count gracefully", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        await ctx.db.insert("rateLimits", {
          userId,
          type: "text_message",
          windowStart: now,
          count: 35, // Over limit (edge case)
        });

        // Act
        const result = await getRateLimitStatus(ctx, userId, "text_message");

        // Assert
        expect(result).not.toBeNull();
        expect(result?.remaining).toBe(0); // Math.max ensures no negative
      });
    });

    it("should return full quota when window expired", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        const oldWindowStart = now - 2 * 60 * 1000; // 2 minutes ago (expired)

        await ctx.db.insert("rateLimits", {
          userId,
          type: "text_message",
          windowStart: oldWindowStart,
          count: 30, // Was at limit
        });

        // Act
        const result = await getRateLimitStatus(ctx, userId, "text_message");

        // Assert
        expect(result).not.toBeNull();
        expect(result?.allowed).toBe(true);
        expect(result?.remaining).toBe(30); // Full quota after reset
        expect(result?.resetAt).toBeGreaterThanOrEqual(now + 60 * 1000);
      });
    });

    it("should not modify the database (read-only)", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        await ctx.db.insert("rateLimits", {
          userId,
          type: "text_message",
          windowStart: now,
          count: 10,
        });

        // Act
        await getRateLimitStatus(ctx, userId, "text_message");

        // Assert - count should not change
        const record = await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "text_message")
          )
          .unique();
        expect(record?.count).toBe(10); // Still 10, not incremented
      });
    });

    it("should handle voice_message type correctly", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        await ctx.db.insert("rateLimits", {
          userId,
          type: "voice_message",
          windowStart: now,
          count: 5,
        });

        // Act
        const result = await getRateLimitStatus(ctx, userId, "voice_message");

        // Assert
        expect(result).not.toBeNull();
        expect(result?.allowed).toBe(true);
        expect(result?.remaining).toBe(15); // 20 - 5 (voice has different limit)
        expect(result?.resetAt).toBeGreaterThan(now + 59 * 60 * 1000); // 1 hour window
      });
    });
  });

  describe("getRateLimitConfig", () => {
    it("should return correct config for text_message", () => {
      // Act
      const config = getRateLimitConfig("text_message");

      // Assert
      expect(config.limit).toBe(30);
      expect(config.windowMs).toBe(60 * 1000); // 1 minute
    });

    it("should return correct config for voice_message", () => {
      // Act
      const config = getRateLimitConfig("voice_message");

      // Assert
      expect(config.limit).toBe(20);
      expect(config.windowMs).toBe(60 * 60 * 1000); // 1 hour
    });

    it("should return a copy not reference", () => {
      // Act
      const config1 = getRateLimitConfig("text_message");
      const config2 = getRateLimitConfig("text_message");

      // Assert - modifying one should not affect the other
      config1.limit = 999;
      expect(config2.limit).toBe(30); // Original value
    });
  });
});
