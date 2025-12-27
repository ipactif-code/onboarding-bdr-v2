import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../../convex/schema";
import * as apiModule from "../../../convex/_generated/api";
// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internal = (apiModule as any).internal;
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Link Preview Rate Limits Tests
 *
 * Tests the rate limiting functionality for link preview requests to prevent DoS attacks.
 * Rate limit: 10 requests per minute per user.
 */
describe("Link Preview Rate Limits", () => {
  describe("consumeLinkPreviewRateLimit", () => {
    it("should allow first request and create new record", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      // Act
      const result = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId }
      );

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1 = 9
      expect(result.resetAt).toBeGreaterThan(Date.now());

      // Verify record was created with correct type
      const record = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "link_preview")
          )
          .unique();
      });

      expect(record).toBeDefined();
      expect(record?.count).toBe(1);
      expect(record?.type).toBe("link_preview");
    });

    it("should track remaining requests correctly", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);

      // Act - consume 5 requests
      for (let i = 0; i < 5; i++) {
        await t.mutation(internal.rateLimits.consumeLinkPreviewRateLimit, {
          userId,
        });
      }

      // Check remaining on 6th request
      const result = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId }
      );

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 6 = 4

      // Verify count in database
      const record = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "link_preview")
          )
          .unique();
      });

      expect(record?.count).toBe(6);
    });

    it("should reject when limit exceeded (10 requests/minute)", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);

      // Exhaust limit (10 requests)
      for (let i = 0; i < 10; i++) {
        await t.mutation(internal.rateLimits.consumeLinkPreviewRateLimit, {
          userId,
        });
      }

      // Act - 11th request should be rejected
      const result = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId }
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);

      // Verify count was NOT incremented beyond limit
      const record = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "link_preview")
          )
          .unique();
      });

      expect(record?.count).toBe(10); // Still 10, not 11
    });

    it("should reset after window expires (60 seconds)", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);
      const now = Date.now();
      const expiredWindowStart = now - 2 * 60 * 1000; // 2 minutes ago (window expired)

      // Create expired rate limit record at limit
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId,
          type: "link_preview",
          windowStart: expiredWindowStart,
          count: 10, // Was at limit
        });
      });

      // Act - request after window expired
      const result = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId }
      );

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // Fresh window: 10 - 1 = 9
      expect(result.resetAt).toBeGreaterThanOrEqual(now + 60 * 1000);

      // Verify window was reset
      const record = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "link_preview")
          )
          .unique();
      });

      expect(record?.count).toBe(1); // Reset to 1 (for this request)
      expect(record?.windowStart).toBeGreaterThanOrEqual(now);
    });

    it("should track limits per user separately", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId1 = await createTestUser(t, "user1@example.com");
      const userId2 = await createTestUser(t, "user2@example.com");

      // User 1 exhausts limit
      for (let i = 0; i < 10; i++) {
        await t.mutation(internal.rateLimits.consumeLinkPreviewRateLimit, {
          userId: userId1,
        });
      }

      // Act - User 2 should still have full quota
      const result = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId: userId2 }
      );

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // User 2 has full quota

      // Verify user 1 is still blocked
      const user1Result = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId: userId1 }
      );
      expect(user1Result.allowed).toBe(false);
    });

    it("should use link_preview type, not text_message type", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);

      // Act - consume a link preview request
      await t.mutation(internal.rateLimits.consumeLinkPreviewRateLimit, {
        userId,
      });

      // Assert - verify rate limit type is link_preview
      const linkPreviewRecord = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "link_preview")
          )
          .unique();
      });

      const textMessageRecord = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "text_message")
          )
          .unique();
      });

      expect(linkPreviewRecord).toBeDefined();
      expect(linkPreviewRecord?.type).toBe("link_preview");
      expect(textMessageRecord).toBeNull(); // No text_message record
    });

    it("should return correct resetAt timestamp", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);
      const before = Date.now();

      // Act
      const result = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId }
      );

      const after = Date.now();

      // Assert - resetAt should be ~60 seconds from now (1 minute window)
      expect(result.resetAt).toBeGreaterThanOrEqual(before + 60 * 1000);
      expect(result.resetAt).toBeLessThanOrEqual(after + 60 * 1000);
    });

    it("should handle multiple consecutive requests correctly", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);

      // Act - consume 3 requests in sequence
      const result1 = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId }
      );
      const result2 = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId }
      );
      const result3 = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId }
      );

      // Assert - remaining should decrease correctly
      expect(result1.remaining).toBe(9); // 10 - 1
      expect(result2.remaining).toBe(8); // 10 - 2
      expect(result3.remaining).toBe(7); // 10 - 3

      // All should have same resetAt (same window)
      expect(result1.resetAt).toBe(result2.resetAt);
      expect(result2.resetAt).toBe(result3.resetAt);
    });
  });

  describe("checkLinkPreviewRateLimit", () => {
    it("should return status without consuming quota", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);

      // Act - check multiple times without consuming
      const check1 = await t.query(
        internal.rateLimits.checkLinkPreviewRateLimit,
        { userId }
      );
      const check2 = await t.query(
        internal.rateLimits.checkLinkPreviewRateLimit,
        { userId }
      );

      // Assert - both checks should show same remaining (not consumed)
      expect(check1.remaining).toBe(check2.remaining);
      expect(check1.remaining).toBe(10); // Full quota

      // Verify no database record was created
      const record = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "link_preview")
          )
          .unique();
      });

      expect(record).toBeNull();
    });

    it("should return correct remaining count for active window", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId,
          type: "link_preview",
          windowStart: now,
          count: 6,
        });
      });

      // Act
      const result = await t.query(
        internal.rateLimits.checkLinkPreviewRateLimit,
        { userId }
      );

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 6 = 4
      expect(result.resetAt).toBe(now + 60 * 1000);

      // Verify count was NOT incremented
      const record = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "link_preview")
          )
          .unique();
      });

      expect(record?.count).toBe(6); // Still 6, not incremented
    });

    it("should show zero remaining when at limit", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId,
          type: "link_preview",
          windowStart: now,
          count: 10, // At limit
        });
      });

      // Act
      const result = await t.query(
        internal.rateLimits.checkLinkPreviewRateLimit,
        { userId }
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should indicate window reset when expired", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);
      const now = Date.now();
      const expiredWindowStart = now - 2 * 60 * 1000; // 2 minutes ago

      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId,
          type: "link_preview",
          windowStart: expiredWindowStart,
          count: 10, // Was at limit
        });
      });

      // Act
      const result = await t.query(
        internal.rateLimits.checkLinkPreviewRateLimit,
        { userId }
      );

      // Assert - should show fresh quota (window expired)
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10); // Full quota available
      expect(result.resetAt).toBeGreaterThanOrEqual(now + 60 * 1000);
    });

    it("should not modify database (read-only)", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId,
          type: "link_preview",
          windowStart: now,
          count: 5,
        });
      });

      // Act - check status
      await t.query(internal.rateLimits.checkLinkPreviewRateLimit, { userId });

      // Assert - verify database was not modified
      const record = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", userId).eq("type", "link_preview")
          )
          .unique();
      });

      expect(record?.count).toBe(5); // Still 5, not incremented
      expect(record?.windowStart).toBe(now); // Not reset
    });
  });

  describe("Rate Limit Configuration", () => {
    it("should enforce 10 requests per minute limit", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);

      // Act - consume exactly 10 requests
      let lastResult;
      for (let i = 0; i < 10; i++) {
        lastResult = await t.mutation(
          internal.rateLimits.consumeLinkPreviewRateLimit,
          { userId }
        );
      }

      // Assert - 10th request should succeed with 0 remaining
      expect(lastResult?.allowed).toBe(true);
      expect(lastResult?.remaining).toBe(0);

      // 11th request should fail
      const failedResult = await t.mutation(
        internal.rateLimits.consumeLinkPreviewRateLimit,
        { userId }
      );
      expect(failedResult.allowed).toBe(false);
    });

    it("should use 60 second (1 minute) window", async () => {
      const t = convexTest(schema);

      // Arrange
      const userId = await createTestUser(t);
      const now = Date.now();

      // Create rate limit with specific windowStart
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId,
          type: "link_preview",
          windowStart: now,
          count: 5,
        });
      });

      // Act
      const result = await t.query(
        internal.rateLimits.checkLinkPreviewRateLimit,
        { userId }
      );

      // Assert - window should expire at windowStart + 60000ms
      expect(result.resetAt).toBe(now + 60 * 1000);
    });
  });
});

/**
 * Helper function to create a test user
 */
async function createTestUser(
  t: ReturnType<typeof convexTest>,
  email = "test@example.com"
): Promise<Id<"users">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: `clerk_${email}`,
      name: "Test User",
      email,
      role: "user",
      status: "online",
    });
  });
}
