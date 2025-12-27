import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import * as apiModule from "../../../convex/_generated/api";
// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("reactions.ts - Message Reactions", () => {
  describe("reactions.addReaction mutation", () => {
    it("should allow user to add reaction to message", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let channelId: Id<"channels">;
      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - Create user, channel, membership, and message
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Hello, world!",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - Add reaction
      const reactionId = await asUser.mutation(api.reactions.addReaction, {
        messageId: messageId!,
        emoji: "👍",
      });

      // Assert - Verify reaction was created
      await t.run(async (ctx) => {
        const reaction = await ctx.db.get(reactionId);
        expect(reaction).toBeDefined();
        if (reaction && "userId" in reaction && "emoji" in reaction) {
          expect(reaction.messageId).toEqual(messageId);
          expect(reaction.userId).toEqual(userId);
          expect(reaction.emoji).toBe("👍");
          expect(reaction.createdAt).toBeDefined();
        }

        // Verify message reactionCount was incremented
        const message = await ctx.db.get(messageId);
        if (message && "reactionCount" in message) {
          expect(message.reactionCount).toBe(1);
        }
      });
    });

    it("should be idempotent - adding same emoji twice returns existing reaction", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - Add reaction twice
      const reactionId1 = await asUser.mutation(api.reactions.addReaction, {
        messageId: messageId!,
        emoji: "❤️",
      });

      const reactionId2 = await asUser.mutation(api.reactions.addReaction, {
        messageId: messageId!,
        emoji: "❤️",
      });

      // Assert - Should return the same reaction ID
      expect(reactionId1).toEqual(reactionId2);

      // Verify only one reaction exists
      await t.run(async (ctx) => {
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .collect();

        expect(reactions).toHaveLength(1);

        // Verify reactionCount is still 1 (not incremented twice)
        const message = await ctx.db.get(messageId);
        expect(message?.reactionCount).toBe(1);
      });
    });

    it("should allow multiple users to react with same emoji", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - Create two users
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

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        // Add both users as channel members
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: user1Id,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: user2Id,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "Great work!",
          createdAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });
      const asUser2 = t.withIdentity({ subject: "user2-clerk" });

      // Act - Both users react with same emoji
      await asUser1.mutation(api.reactions.addReaction, {
        messageId: messageId!,
        emoji: "🎉",
      });

      await asUser2.mutation(api.reactions.addReaction, {
        messageId: messageId!,
        emoji: "🎉",
      });

      // Assert
      await t.run(async (ctx) => {
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .collect();

        expect(reactions).toHaveLength(2);

        // Verify reactionCount incremented for both
        const message = await ctx.db.get(messageId);
        expect(message?.reactionCount).toBe(2);
      });
    });

    it("should allow user to add multiple different emoji reactions", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - Add multiple different reactions
      await asUser.mutation(api.reactions.addReaction, {
        messageId: messageId!,
        emoji: "👍",
      });

      await asUser.mutation(api.reactions.addReaction, {
        messageId: messageId!,
        emoji: "❤️",
      });

      await asUser.mutation(api.reactions.addReaction, {
        messageId: messageId!,
        emoji: "🎉",
      });

      // Assert
      await t.run(async (ctx) => {
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .collect();

        expect(reactions).toHaveLength(3);

        const emojis = reactions.map((r) => r.emoji).sort();
        expect(emojis).toEqual(["❤️", "👍", "🎉"].sort());

        // Verify reactionCount
        const message = await ctx.db.get(messageId);
        expect(message?.reactionCount).toBe(3);
      });
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
        });
      });

      // Act & Assert - No identity (unauthenticated)
      await expect(
        t.mutation(api.reactions.addReaction, {
          messageId: messageId!,
          emoji: "👍",
        })
      ).rejects.toThrow();
    });

    it("should reject invalid emoji format", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert - Test various invalid emoji formats
      await expect(
        asUser.mutation(api.reactions.addReaction, {
          messageId: messageId!,
          emoji: "abc", // Regular text
        })
      ).rejects.toThrow("Invalid emoji");

      await expect(
        asUser.mutation(api.reactions.addReaction, {
          messageId: messageId!,
          emoji: "123", // Numbers
        })
      ).rejects.toThrow("Invalid emoji");

      await expect(
        asUser.mutation(api.reactions.addReaction, {
          messageId: messageId!,
          emoji: "", // Empty string
        })
      ).rejects.toThrow("Invalid emoji");

      await expect(
        asUser.mutation(api.reactions.addReaction, {
          messageId: messageId!,
          emoji: "a".repeat(21), // Too long
        })
      ).rejects.toThrow("Invalid emoji");
    });

    it("should prevent reacting to deleted messages", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Create deleted message
        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted message",
          createdAt: Date.now(),
          deletedAt: Date.now(),
          deletedBy: userId,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.reactions.addReaction, {
          messageId: messageId!,
          emoji: "👍",
        })
      ).rejects.toThrow("deleted message");
    });

    it("should throw error for non-existent message", async () => {
      const t = convexTest(schema);

      let nonExistentMessageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - Create user and a message, then delete it to get a non-existent ID
        await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "temp-clerk",
          email: "temp@example.com",
          name: "Temp User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        nonExistentMessageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Temp message",
          createdAt: Date.now(),
        });

        // Delete the message to make it non-existent
        await ctx.db.delete(nonExistentMessageId);
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.reactions.addReaction, {
          messageId: nonExistentMessageId!,
          emoji: "👍",
        })
      ).rejects.toThrow("Message not found");
    });
  });

  describe("reactions.removeReaction mutation", () => {
    it("should allow user to remove their own reaction", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
          reactionCount: 1, // Pre-existing reaction count
        });

        // Add initial reaction
        await ctx.db.insert("reactions", {
          messageId,
          userId,
          emoji: "👍",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - Remove reaction
      await asUser.mutation(api.reactions.removeReaction, {
        messageId: messageId!,
        emoji: "👍",
      });

      // Assert - Verify reaction was deleted
      await t.run(async (ctx) => {
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .collect();

        expect(reactions).toHaveLength(0);

        // Verify reactionCount was decremented
        const message = await ctx.db.get(messageId);
        expect(message?.reactionCount).toBe(0);
      });
    });

    it("should decrement message reactionCount correctly", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - Create message with multiple reactions
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
          reactionCount: 3, // 3 reactions
        });

        // Add reactions
        await ctx.db.insert("reactions", {
          messageId,
          userId,
          emoji: "👍",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId,
          emoji: "❤️",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId,
          emoji: "🎉",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - Remove one reaction
      await asUser.mutation(api.reactions.removeReaction, {
        messageId: messageId!,
        emoji: "❤️",
      });

      // Assert
      await t.run(async (ctx) => {
        const message = await ctx.db.get(messageId);
        expect(message?.reactionCount).toBe(2); // Decremented from 3 to 2

        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .collect();

        expect(reactions).toHaveLength(2);
        expect(reactions.some((r) => r.emoji === "❤️")).toBe(false);
      });
    });

    it("should not allow reactionCount to go negative", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - Create message with incorrect reactionCount
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
          reactionCount: 0, // Already 0
        });

        // Add reaction
        await ctx.db.insert("reactions", {
          messageId,
          userId,
          emoji: "👍",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - Remove reaction
      await asUser.mutation(api.reactions.removeReaction, {
        messageId: messageId!,
        emoji: "👍",
      });

      // Assert - Count should not go negative
      await t.run(async (ctx) => {
        const message = await ctx.db.get(messageId);
        expect(message?.reactionCount).toBe(0); // Max(0, 0 - 1) = 0
      });
    });

    it("should throw error if reaction not found", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert - Try to remove non-existent reaction
      await expect(
        asUser.mutation(api.reactions.removeReaction, {
          messageId: messageId!,
          emoji: "👍",
        })
      ).rejects.toThrow("Reaction not found");
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
        });
      });

      // Act & Assert - No identity (unauthenticated)
      await expect(
        t.mutation(api.reactions.removeReaction, {
          messageId: messageId!,
          emoji: "👍",
        })
      ).rejects.toThrow();
    });
  });

  describe("reactions.getMessageReactions query", () => {
    it("should return empty array for message with no reactions", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const reactions = await asUser.query(api.reactions.getMessageReactions, {
        messageId: messageId!,
      });

      // Assert
      expect(reactions).toEqual([]);
    });

    it("should aggregate multiple users reacting with same emoji", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;
      let user1Id: Id<"users">;
      let user2Id: Id<"users">;
      let user3Id: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange - Create three users
        user1Id = await ctx.db.insert("users", {
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

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "Great work!",
          createdAt: Date.now(),
        });

        // All three users react with same emoji
        await ctx.db.insert("reactions", {
          messageId,
          userId: user1Id,
          emoji: "👍",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId: user2Id,
          emoji: "👍",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId: user3Id,
          emoji: "👍",
          createdAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const reactions = await asUser1.query(api.reactions.getMessageReactions, {
        messageId: messageId!,
      });

      // Assert
      expect(reactions).toHaveLength(1);
      expect(reactions[0]).toMatchObject({
        emoji: "👍",
        count: 3,
        currentUserReacted: true, // user1 is authenticated and reacted
      });
      expect(reactions[0]!.userIds).toHaveLength(3);
      expect(reactions[0]!.userIds).toContain(user1Id!);
      expect(reactions[0]!.userIds).toContain(user2Id!);
      expect(reactions[0]!.userIds).toContain(user3Id!);
    });

    it("should handle multiple different emojis on same message", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Amazing!",
          createdAt: Date.now(),
        });

        // Add different emoji reactions
        await ctx.db.insert("reactions", {
          messageId,
          userId,
          emoji: "👍",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId,
          emoji: "❤️",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId,
          emoji: "🎉",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const reactions = await asUser.query(api.reactions.getMessageReactions, {
        messageId: messageId!,
      });

      // Assert
      expect(reactions).toHaveLength(3);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emojis = reactions.map((r: any) => r.emoji).sort();
      expect(emojis).toEqual(["❤️", "👍", "🎉"].sort());

      // All should have count 1 and currentUserReacted true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reactions.forEach((reaction: any) => {
        expect(reaction.count).toBe(1);
        expect(reaction.currentUserReacted).toBe(true);
      });
    });

    it("should correctly set currentUserReacted flag", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;
      let user1Id: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange - Two users, only user1 reacts
        user1Id = await ctx.db.insert("users", {
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

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "Test message",
          createdAt: Date.now(),
        });

        // Only user1 reacts
        await ctx.db.insert("reactions", {
          messageId,
          userId: user1Id,
          emoji: "👍",
          createdAt: Date.now(),
        });
      });

      // Act & Assert - user1 sees currentUserReacted: true
      const asUser1 = t.withIdentity({ subject: "user1-clerk" });
      const reactionsAsUser1 = await asUser1.query(api.reactions.getMessageReactions, {
        messageId: messageId!,
      });

      expect(reactionsAsUser1[0]!.currentUserReacted).toBe(true);

      // Act & Assert - user2 sees currentUserReacted: false
      const asUser2 = t.withIdentity({ subject: "user2-clerk" });
      const reactionsAsUser2 = await asUser2.query(api.reactions.getMessageReactions, {
        messageId: messageId!,
      });

      expect(reactionsAsUser2[0]!.currentUserReacted).toBe(false);
    });

    it("should return empty array for non-existent message", async () => {
      const t = convexTest(schema);

      let nonExistentMessageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - Create user and a message, then delete it to get a non-existent ID
        await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "temp-clerk",
          email: "temp@example.com",
          name: "Temp User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        nonExistentMessageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Temp message",
          createdAt: Date.now(),
        });

        // Delete the message to make it non-existent
        await ctx.db.delete(nonExistentMessageId);
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const reactions = await asUser.query(api.reactions.getMessageReactions, {
        messageId: nonExistentMessageId!,
      });

      // Assert
      expect(reactions).toEqual([]);
    });

    it("should sort reactions by count descending", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - Create users and reactions with different counts
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

        const user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "Popular message",
          createdAt: Date.now(),
        });

        // 3x 👍, 2x ❤️, 1x 🎉
        await ctx.db.insert("reactions", {
          messageId,
          userId: user1Id,
          emoji: "👍",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId: user2Id,
          emoji: "👍",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId: user3Id,
          emoji: "👍",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId: user1Id,
          emoji: "❤️",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId: user2Id,
          emoji: "❤️",
          createdAt: Date.now(),
        });

        await ctx.db.insert("reactions", {
          messageId,
          userId: user1Id,
          emoji: "🎉",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const reactions = await asUser.query(api.reactions.getMessageReactions, {
        messageId: messageId!,
      });

      // Assert - Sorted by count descending
      expect(reactions).toHaveLength(3);
      expect(reactions[0]!.emoji).toBe("👍");
      expect(reactions[0]!.count).toBe(3);
      expect(reactions[1]!.emoji).toBe("❤️");
      expect(reactions[1]!.count).toBe(2);
      expect(reactions[2]!.emoji).toBe("🎉");
      expect(reactions[2]!.count).toBe(1);
    });
  });
});
