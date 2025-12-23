import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import type { Id } from "../../../convex/_generated/dataModel";

describe("typing.ts - Typing Indicators", () => {
  describe("setTyping mutation", () => {
    it("should create typing indicator", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let conversationId!: Id<"conversations">;

      // Setup database
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      // Create authenticated identity
      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.typing.setTyping, { conversationId });

      // Assert
      await t.run(async (ctx) => {
        const indicator = await ctx.db
          .query("typingIndicators")
          .withIndex("by_conversation_user", (q) =>
            q.eq("conversationId", conversationId).eq("userId", userId)
          )
          .unique();

        expect(indicator).toBeDefined();
        expect(indicator?.userId).toEqual(userId);
        expect(indicator?.conversationId).toEqual(conversationId);
        expect(indicator?.expiresAt).toBeGreaterThan(Date.now());
      });
    });

    it("should update existing typing indicator", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let conversationId!: Id<"conversations">;

      // Setup database
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });

        // Create initial indicator
        const oldExpiresAt = Date.now() + 1000;
        await ctx.db.insert("typingIndicators", {
          conversationId,
          userId,
          expiresAt: oldExpiresAt,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act - update indicator
      await asUser.mutation(api.typing.setTyping, { conversationId });

      // Assert
      await t.run(async (ctx) => {
        const indicators = await ctx.db
          .query("typingIndicators")
          .withIndex("by_conversation_user", (q) =>
            q.eq("conversationId", conversationId).eq("userId", userId)
          )
          .collect();

        expect(indicators).toHaveLength(1);
        expect(indicators[0]!.expiresAt).toBeGreaterThan(Date.now() + 1000);
      });
    });

    it("should fail if not a participant", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.typing.setTyping, { conversationId })
      ).rejects.toThrow("must be a participant");
    });

    it("should fail if participant has left", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
          leftAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.typing.setTyping, { conversationId })
      ).rejects.toThrow("you have left");
    });

    it("should set expiry time 3 seconds in the future", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const beforeTime = Date.now();
      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.typing.setTyping, { conversationId });

      // Assert
      await t.run(async (ctx) => {
        const indicator = await ctx.db
          .query("typingIndicators")
          .withIndex("by_conversation_user", (q) =>
            q.eq("conversationId", conversationId).eq("userId", userId)
          )
          .unique();

        const expectedExpiry = beforeTime + 3000;
        expect(indicator?.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 100);
        expect(indicator?.expiresAt).toBeLessThanOrEqual(expectedExpiry + 100);
      });
    });
  });

  describe("clearTyping mutation", () => {
    it("should remove typing indicator", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("typingIndicators", {
          conversationId,
          userId,
          expiresAt: Date.now() + 3000,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.typing.clearTyping, { conversationId });

      // Assert
      await t.run(async (ctx) => {
        const indicator = await ctx.db
          .query("typingIndicators")
          .withIndex("by_conversation_user", (q) =>
            q.eq("conversationId", conversationId).eq("userId", userId)
          )
          .unique();

        expect(indicator).toBeNull();
      });
    });

    it("should be idempotent if no indicator exists", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert - should not throw
      await expect(
        asUser.mutation(api.typing.clearTyping, { conversationId })
      ).resolves.not.toThrow();
    });

    it("should only delete current user indicator", async () => {
      const t = convexTest(schema);

      let user1Id: Id<"users">;
      let conversationId!: Id<"conversations">;
      let indicator2Id: Id<"typingIndicators">;

      await t.run(async (ctx) => {
        user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        const user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("typingIndicators", {
          conversationId,
          userId: user1Id,
          expiresAt: Date.now() + 3000,
        });

        indicator2Id = await ctx.db.insert("typingIndicators", {
          conversationId,
          userId: user2Id,
          expiresAt: Date.now() + 3000,
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act - user1 clears typing
      await asUser1.mutation(api.typing.clearTyping, { conversationId });

      // Assert - user2's indicator remains
      await t.run(async (ctx) => {
        const indicator2 = await ctx.db.get(indicator2Id);
        expect(indicator2).toBeDefined();

        const indicator1 = await ctx.db
          .query("typingIndicators")
          .withIndex("by_conversation_user", (q) =>
            q.eq("conversationId", conversationId).eq("userId", user1Id)
          )
          .unique();
        expect(indicator1).toBeNull();
      });
    });
  });

  describe("getTypingIndicators query", () => {
    it("should return active typing users", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          avatarUrl: "https://example.com/avatar1.jpg",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });

        // User2 is typing
        await ctx.db.insert("typingIndicators", {
          conversationId,
          userId: user2Id,
          expiresAt: Date.now() + 3000,
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.typing.getTypingIndicators, {
        conversationId,
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userId: user2Id,
        userName: "User 2",
      });
    });

    it("should exclude current user from results", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });

        // Both users typing
        await ctx.db.insert("typingIndicators", {
          conversationId,
          userId: user1Id,
          expiresAt: Date.now() + 3000,
        });

        await ctx.db.insert("typingIndicators", {
          conversationId,
          userId: user2Id,
          expiresAt: Date.now() + 3000,
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.typing.getTypingIndicators, {
        conversationId,
      });

      // Assert - should only see user2 (not self)
      expect(result).toHaveLength(1);
      expect(result[0]!.userId).toEqual(user2Id);
    });

    it("should not return expired indicators", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        const user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });

        // User2 has expired indicator
        await ctx.db.insert("typingIndicators", {
          conversationId,
          userId: user2Id,
          expiresAt: Date.now() - 1000, // Expired 1 second ago
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.typing.getTypingIndicators, {
        conversationId,
      });

      // Assert
      expect(result).toEqual([]);
    });

    it("should return empty array if not a participant", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.typing.getTypingIndicators, {
        conversationId,
      });

      // Assert
      expect(result).toEqual([]);
    });

    it("should include user avatar URL if present", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          avatarUrl: "https://example.com/avatar2.jpg",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });

        // User2 is typing
        await ctx.db.insert("typingIndicators", {
          conversationId,
          userId: user2Id,
          expiresAt: Date.now() + 3000,
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.typing.getTypingIndicators, {
        conversationId,
      });

      // Assert
      expect(result[0]!.userAvatarUrl).toBe("https://example.com/avatar2.jpg");
    });

    it("should return multiple typing users", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let user3Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user3Id,
          joinedAt: Date.now(),
        });

        // User2 and User3 typing
        await ctx.db.insert("typingIndicators", {
          conversationId,
          userId: user2Id,
          expiresAt: Date.now() + 3000,
        });

        await ctx.db.insert("typingIndicators", {
          conversationId,
          userId: user3Id,
          expiresAt: Date.now() + 3000,
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.typing.getTypingIndicators, {
        conversationId,
      });

      // Assert
      expect(result).toHaveLength(2);
      const userIds = result.map((r) => r.userId);
      expect(userIds).toContain(user2Id);
      expect(userIds).toContain(user3Id);
    });
  });
});
