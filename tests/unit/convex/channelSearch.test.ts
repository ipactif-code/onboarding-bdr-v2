import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import * as apiModule from "../../../convex/_generated/api";
// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

/**
 * Test suite for channels/search.ts
 *
 * Coverage:
 * - Input validation (search term length, special characters)
 * - Access control (public/private channels, membership)
 * - Search logic (name/description/topic matching)
 * - Edge cases (null values, empty results, sorting)
 */
describe("channels.search query", () => {
  describe("Input Validation", () => {
    it("should reject search terms < 2 characters (returns empty array)", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create a test channel
        await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Single character search should throw
      await expect(
        asUser.query(api.channels.search, { searchTerm: "g" })
      ).rejects.toThrow("at least 2 characters");
    });

    it("should accept search terms of 2 characters", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("channels", {
          name: "ab",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, { searchTerm: "ab" });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("should accept search terms of 100 characters", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const longSearch = "a".repeat(100);

      const result = await asUser.query(api.channels.search, { searchTerm: longSearch });
      expect(result).toBeDefined();
    });

    it("should reject search terms > 100 characters", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const tooLong = "a".repeat(101);

      await expect(
        asUser.query(api.channels.search, { searchTerm: tooLong })
      ).rejects.toThrow("100 characters or less");
    });

    it("should handle special regex characters safely (no regex injection)", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create channel with special characters
        await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Test with regex special characters - should treat as literal
      const specialChars = [".*", "[a-z]", "(test)", "^start", "end$", "\\d+"];

      for (const term of specialChars) {
        const result = await asUser.query(api.channels.search, { searchTerm: term });
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it("should handle empty string after trimming (< 2 chars)", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Empty string and whitespace should be rejected after trim
      await expect(
        asUser.query(api.channels.search, { searchTerm: "   " })
      ).rejects.toThrow("at least 2 characters");
    });
  });

  describe("Access Control", () => {
    it("should only return channels user has access to", async () => {
      const t = convexTest(schema);

      let publicChannelId!: Id<"channels">;
      let privateChannelId!: Id<"channels">;

      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        // Public channel - accessible to all
        publicChannelId = await ctx.db.insert("channels", {
          name: "public-test",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Private channel - only user1 is member
        privateChannelId = await ctx.db.insert("channels", {
          name: "private-test",
          type: "private",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId: privateChannelId,
          userId: user1Id,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser2 = t.withIdentity({ subject: "user2-clerk" });
      const result = await asUser2.query(api.channels.search, { searchTerm: "test" });

      // User 2 should only see public channel
      expect(result).toHaveLength(1);
      expect(result[0]!._id).toEqual(publicChannelId);
    });

    it("should exclude private channels user is not a member of", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        // Private channel - only user1 is member
        const privateId = await ctx.db.insert("channels", {
          name: "secret-project",
          type: "private",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId: privateId,
          userId: user1Id,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser2 = t.withIdentity({ subject: "user2-clerk" });
      const result = await asUser2.query(api.channels.search, { searchTerm: "secret" });

      // User 2 should not see private channel
      expect(result).toHaveLength(0);
    });

    it("should include public channels regardless of membership", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        // Public channel created by user1
        await ctx.db.insert("channels", {
          name: "open-discussion",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
      });

      const asUser2 = t.withIdentity({ subject: "user2-clerk" });
      const result = await asUser2.query(api.channels.search, { searchTerm: "open" });

      // User 2 should see public channel even without membership
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.name).toBe("open-discussion");
    });

    it("should respect archived channel filtering by default", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Archived channel
        await ctx.db.insert("channels", {
          name: "archived-test",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
          memberCount: 0,
        });

        // Active channel
        await ctx.db.insert("channels", {
          name: "active-test",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, { searchTerm: "test" });

      // Should only return active channel by default
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("active-test");
    });

    it("should include archived channels when includeArchived is true", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Archived channel
        await ctx.db.insert("channels", {
          name: "archived-test",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
          memberCount: 0,
        });

        // Active channel
        await ctx.db.insert("channels", {
          name: "active-test",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, {
        searchTerm: "test",
        includeArchived: true
      });

      // Should return both channels
      expect(result).toHaveLength(2);
    });

    it("should exclude channels where user has leftAt set", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "left-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        // User has left this channel
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now() - 10000,
          leftAt: Date.now() - 5000,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, { searchTerm: "left" });

      // Should not return channel user has left
      expect(result).toHaveLength(0);
    });

    it("should allow global admin to see all private channels", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        // Private channel created by regular user
        const privateId = await ctx.db.insert("channels", {
          name: "private-admin-test",
          type: "private",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId: privateId,
          userId: userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });
      const result = await asAdmin.query(api.channels.search, { searchTerm: "admin-test" });

      // Admin should see private channel even without membership
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.name).toBe("private-admin-test");
    });

    it("should exclude public channels where user is banned", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "banned-from-here",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // User is banned from this channel
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: true,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, { searchTerm: "banned" });

      // Should not return channel where user is banned
      expect(result).toHaveLength(0);
    });
  });

  describe("Search Logic", () => {
    it("should match channel name (case-insensitive)", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("channels", {
          name: "React-Discussion",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Lowercase search
      const result1 = await asUser.query(api.channels.search, { searchTerm: "react" });
      expect(result1).toHaveLength(1);
      expect(result1[0]!.name).toBe("React-Discussion");

      // Uppercase search
      const result2 = await asUser.query(api.channels.search, { searchTerm: "REACT" });
      expect(result2).toHaveLength(1);

      // Mixed case search
      const result3 = await asUser.query(api.channels.search, { searchTerm: "ReAcT" });
      expect(result3).toHaveLength(1);
    });

    it("should support partial matching (substring match)", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("channels", {
          name: "javascript-beginners",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Partial matches
      const result1 = await asUser.query(api.channels.search, { searchTerm: "java" });
      expect(result1.length).toBeGreaterThan(0);

      const result2 = await asUser.query(api.channels.search, { searchTerm: "begin" });
      expect(result2.length).toBeGreaterThan(0);

      const result3 = await asUser.query(api.channels.search, { searchTerm: "script-beg" });
      expect(result3.length).toBeGreaterThan(0);
    });

    it("should sort exact matches first, then alphabetically", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create channels in non-alphabetical order
        await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        await ctx.db.insert("channels", {
          name: "test",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        await ctx.db.insert("channels", {
          name: "another-test-room",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, { searchTerm: "test" });

      expect(result).toHaveLength(3);

      // Exact match should come first
      expect(result[0]!.name).toBe("test");

      // Partial matches sorted alphabetically
      expect(result[1]!.name).toBe("another-test-room");
      expect(result[2]!.name).toBe("test-channel");
    });

    it("should limit results to 20 channels", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create 25 matching channels
        for (let i = 0; i < 25; i++) {
          await ctx.db.insert("channels", {
            name: `channel-${i.toString().padStart(2, "0")}`,
            type: "public",
            creatorId: userId,
            createdAt: Date.now(),
            isArchived: false,
            memberCount: 0,
          });
        }
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, { searchTerm: "channel" });

      // Should limit to 20 results
      expect(result).toHaveLength(20);
    });
  });

  describe("Edge Cases", () => {
    it("should return empty array when no matches", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("channels", {
          name: "unrelated",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, { searchTerm: "nonexistent" });

      expect(result).toEqual([]);
    });

    it("should handle channels with null description gracefully", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("channels", {
          name: "no-description",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
          // description is undefined/null
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, { searchTerm: "no-desc" });

      expect(result).toHaveLength(1);
      expect(result[0]!.description).toBeUndefined();
    });

    it("should handle channels with null topic gracefully", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("channels", {
          name: "no-topic",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
          // topic is undefined/null
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, { searchTerm: "no-topic" });

      expect(result).toHaveLength(1);
      expect(result[0]!.topic).toBeUndefined();
    });

    it("should filter by channel type when type argument is provided", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Public channel
        await ctx.db.insert("channels", {
          name: "type-test-public",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        // Private channel with user as member
        const privateId = await ctx.db.insert("channels", {
          name: "type-test-private",
          type: "private",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId: privateId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Search only public channels
      const publicResult = await asUser.query(api.channels.search, {
        searchTerm: "type-test",
        type: "public"
      });
      expect(publicResult).toHaveLength(1);
      expect(publicResult[0]!.type).toBe("public");

      // Search only private channels
      const privateResult = await asUser.query(api.channels.search, {
        searchTerm: "type-test",
        type: "private"
      });
      expect(privateResult).toHaveLength(1);
      expect(privateResult[0]!.type).toBe("private");
    });

    it("should include unread count in membership data", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "unread-test",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
          lastMessageAt: Date.now(),
        });

        // Create membership (ID not needed after creation)
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          lastReadAt: Date.now() - 10000, // 10 seconds ago
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Create unread messages
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Unread message 1",
          createdAt: Date.now() - 5000,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Unread message 2",
          createdAt: Date.now() - 3000,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const result = await asUser.query(api.channels.search, { searchTerm: "unread" });

      expect(result).toHaveLength(1);
      expect(result[0]!.membership).toBeDefined();
      expect(result[0]!.membership!.unreadCount).toBe(2);
    });

    it("should handle trimming whitespace from search term", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("channels", {
          name: "trimtest",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Search with leading/trailing whitespace
      const result = await asUser.query(api.channels.search, { searchTerm: "  trimtest  " });

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("trimtest");
    });
  });
});
