import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("mentions.ts - Message Mentions", () => {
  describe("mentions.getMentionsForUser query", () => {
    it("should return empty array for user with no mentions", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange - Create user only
        await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const mentions = await asUser.query(api.mentions.getMentionsForUser, {});

      // Assert
      expect(mentions).toEqual([]);
    });

    it("should return user mentions with message context", async () => {
      const t = convexTest(schema);

      let mentionedUserId: Id<"users">;
      let senderId: Id<"users">;
      let messageId: Id<"messages">;
      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange - Create users
        mentionedUserId = await ctx.db.insert("users", {
          clerkId: "mentioned-clerk",
          email: "mentioned@example.com",
          name: "Mentioned User",
          role: "user",
          status: "online",
        });

        senderId = await ctx.db.insert("users", {
          clerkId: "sender-clerk",
          email: "sender@example.com",
          name: "Sender User",
          avatarUrl: "https://example.com/avatar.jpg",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: senderId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        // Create message
        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId,
          content: "@mentioned Hey there!",
          createdAt: Date.now(),
        });

        // Create user mention
        await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId,
          channelId,
          createdAt: Date.now(),
          // notifiedAt is undefined (unread)
        });
      });

      const asMentionedUser = t.withIdentity({ subject: "mentioned-clerk" });

      // Act
      const mentions = await asMentionedUser.query(api.mentions.getMentionsForUser, {});

      // Assert
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        messageId: messageId!,
        type: "user",
        channelId: channelId!,
      });

      // Verify message context
      expect(mentions[0]!.message).toBeDefined();
      expect(mentions[0]!.message?.content).toBe("@mentioned Hey there!");
      expect(mentions[0]!.message?.sender.name).toBe("Sender User");
      expect(mentions[0]!.message?.sender.avatarUrl).toBe("https://example.com/avatar.jpg");

      // Verify channel context
      expect(mentions[0]!.channel).toBeDefined();
      expect(mentions[0]!.channel?.name).toBe("general");
    });

    it("should return @everyone mentions", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        userId = await ctx.db.insert("users", {
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
          content: "@everyone Important announcement!",
          createdAt: Date.now(),
        });

        // Create @everyone mention
        await ctx.db.insert("mentions", {
          messageId,
          type: "everyone",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const mentions = await asUser.query(api.mentions.getMentionsForUser, {});

      // Assert
      expect(mentions).toHaveLength(1);
      expect(mentions[0]!.type).toBe("everyone");
    });

    it("should return @here mentions", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        userId = await ctx.db.insert("users", {
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
          content: "@here Quick question for online members",
          createdAt: Date.now(),
        });

        // Create @here mention
        await ctx.db.insert("mentions", {
          messageId,
          type: "here",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const mentions = await asUser.query(api.mentions.getMentionsForUser, {});

      // Assert
      expect(mentions).toHaveLength(1);
      expect(mentions[0]!.type).toBe("here");
    });

    it("should handle multiple mentions in one message", async () => {
      const t = convexTest(schema);

      let user1Id: Id<"users">;
      let user2Id: Id<"users">;
      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - Create two users
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

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "@user1 @user2 check this out!",
          createdAt: Date.now(),
        });

        // Create mentions for both users
        await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId: user1Id,
          channelId,
          createdAt: Date.now(),
        });

        await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId: user2Id,
          channelId,
          createdAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const mentions = await asUser1.query(api.mentions.getMentionsForUser, {});

      // Assert - User 1 sees their mention
      expect(mentions).toHaveLength(1);
      expect(mentions[0]!.messageId).toEqual(messageId!);
    });

    it("should only return unread mentions (notifiedAt is undefined)", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange
        userId = await ctx.db.insert("users", {
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

        const message1Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "@test Unread mention",
          createdAt: Date.now(),
        });

        const message2Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "@test Read mention",
          createdAt: Date.now() - 1000,
        });

        // Unread mention (notifiedAt is undefined)
        await ctx.db.insert("mentions", {
          messageId: message1Id,
          type: "user",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now(),
        });

        // Read mention (notifiedAt is set)
        await ctx.db.insert("mentions", {
          messageId: message2Id,
          type: "user",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now() - 1000,
          notifiedAt: Date.now() - 500,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const mentions = await asUser.query(api.mentions.getMentionsForUser, {});

      // Assert - Only unread mention returned
      expect(mentions).toHaveLength(1);
      expect(mentions[0]!.message?.content).toBe("@test Unread mention");
    });

    it("should respect limit parameter", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange - Create 5 mentions
        userId = await ctx.db.insert("users", {
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

        for (let i = 0; i < 5; i++) {
          const messageId = await ctx.db.insert("messages", {
            channelId,
            senderId: userId,
            content: `@test Mention ${i}`,
            createdAt: Date.now() + i,
          });

          await ctx.db.insert("mentions", {
            messageId,
            type: "user",
            mentionedUserId: userId,
            channelId,
            createdAt: Date.now() + i,
          });
        }
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const mentions = await asUser.query(api.mentions.getMentionsForUser, {
        limit: 3,
      });

      // Assert
      expect(mentions).toHaveLength(3);
    });

    it("should return null message for deleted messages", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange
        userId = await ctx.db.insert("users", {
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

        // Deleted message
        const deletedMessageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "@test Deleted message",
          createdAt: Date.now(),
          deletedAt: Date.now(),
          deletedBy: userId,
        });

        // Active message
        const activeMessageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "@test Active message",
          createdAt: Date.now(),
        });

        // Mention on deleted message
        await ctx.db.insert("mentions", {
          messageId: deletedMessageId,
          type: "user",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now(),
        });

        // Mention on active message
        await ctx.db.insert("mentions", {
          messageId: activeMessageId,
          type: "user",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const mentions = await asUser.query(api.mentions.getMentionsForUser, {});

      // Assert - Both mentions returned, but deleted message has null messageData
      expect(mentions).toHaveLength(2);

      const deletedMention = mentions.find((m) => m.message === null);
      const activeMention = mentions.find((m) => m.message?.content === "@test Active message");

      expect(deletedMention).toBeDefined();
      expect(activeMention).toBeDefined();
      expect(activeMention!.message?.content).toBe("@test Active message");
    });

    it("should include conversation context for DM mentions", async () => {
      const t = convexTest(schema);

      let mentionedUserId: Id<"users">;
      let senderId: Id<"users">;
      let conversationId: Id<"conversations">;

      await t.run(async (ctx) => {
        // Arrange
        mentionedUserId = await ctx.db.insert("users", {
          clerkId: "mentioned-clerk",
          email: "mentioned@example.com",
          name: "Mentioned User",
          role: "user",
          status: "online",
        });

        senderId = await ctx.db.insert("users", {
          clerkId: "sender-clerk",
          email: "sender@example.com",
          name: "Sender User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        // Add participants
        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: mentionedUserId,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: senderId,
          joinedAt: Date.now(),
        });

        const messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId,
          content: "@mentioned Private message",
          createdAt: Date.now(),
        });

        await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId,
          conversationId,
          createdAt: Date.now(),
        });
      });

      const asMentionedUser = t.withIdentity({ subject: "mentioned-clerk" });

      // Act
      const mentions = await asMentionedUser.query(api.mentions.getMentionsForUser, {});

      // Assert
      expect(mentions).toHaveLength(1);
      expect(mentions[0]!.conversationId).toEqual(conversationId!);
      expect(mentions[0]!.conversation).toBeDefined();
      expect(mentions[0]!.conversation?.type).toBe("direct");
    });

    it("should allow querying mentions for a specific user (admin use case)", async () => {
      const t = convexTest(schema);

      let targetUserId: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange - Create admin and target user
        await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          status: "online",
        });

        targetUserId = await ctx.db.insert("users", {
          clerkId: "target-clerk",
          email: "target@example.com",
          name: "Target User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: targetUserId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: targetUserId,
          content: "@target Test mention",
          createdAt: Date.now(),
        });

        await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId: targetUserId,
          channelId,
          createdAt: Date.now(),
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act - Admin queries mentions for target user
      const mentions = await asAdmin.query(api.mentions.getMentionsForUser, {
        userId: targetUserId!,
      });

      // Assert
      expect(mentions).toHaveLength(1);
    });

    it("should reject non-admin users querying other users' mentions", async () => {
      const t = convexTest(schema);

      let targetUserId: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange - Create two non-admin users
        await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        targetUserId = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: targetUserId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: targetUserId,
          content: "@user2 Test mention",
          createdAt: Date.now(),
        });

        await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId: targetUserId,
          channelId,
          createdAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act & Assert - Non-admin user1 tries to query user2's mentions
      await expect(
        asUser1.query(api.mentions.getMentionsForUser, {
          userId: targetUserId!,
        })
      ).rejects.toThrow("Not authorized to view other users' mentions");
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      // Act & Assert - No identity (unauthenticated)
      await expect(t.query(api.mentions.getMentionsForUser, {})).rejects.toThrow();
    });
  });

  describe("mentions.getUnreadMentionCount query", () => {
    it("should return 0 for user with no mentions", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const count = await asUser.query(api.mentions.getUnreadMentionCount, {});

      // Assert
      expect(count).toBe(0);
    });

    it("should return correct count of unread mentions", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange
        userId = await ctx.db.insert("users", {
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

        // Create 3 unread mentions
        for (let i = 0; i < 3; i++) {
          const messageId = await ctx.db.insert("messages", {
            channelId,
            senderId: userId,
            content: `@test Mention ${i}`,
            createdAt: Date.now() + i,
          });

          await ctx.db.insert("mentions", {
            messageId,
            type: "user",
            mentionedUserId: userId,
            channelId,
            createdAt: Date.now() + i,
            // notifiedAt is undefined (unread)
          });
        }

        // Create 1 read mention
        const readMessageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "@test Read mention",
          createdAt: Date.now(),
        });

        await ctx.db.insert("mentions", {
          messageId: readMessageId,
          type: "user",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now(),
          notifiedAt: Date.now(), // Read
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const count = await asUser.query(api.mentions.getUnreadMentionCount, {});

      // Assert
      expect(count).toBe(3); // Only unread mentions counted
    });

    it("should only count mentions for current user", async () => {
      const t = convexTest(schema);

      let user1Id: Id<"users">;
      let user2Id: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange - Create two users with mentions
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

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        // 2 mentions for user1
        for (let i = 0; i < 2; i++) {
          const messageId = await ctx.db.insert("messages", {
            channelId,
            senderId: user2Id,
            content: `@user1 Mention ${i}`,
            createdAt: Date.now() + i,
          });

          await ctx.db.insert("mentions", {
            messageId,
            type: "user",
            mentionedUserId: user1Id,
            channelId,
            createdAt: Date.now() + i,
          });
        }

        // 1 mention for user2
        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "@user2 Mention",
          createdAt: Date.now(),
        });

        await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId: user2Id,
          channelId,
          createdAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const count = await asUser1.query(api.mentions.getUnreadMentionCount, {});

      // Assert - User 1 sees only their 2 mentions
      expect(count).toBe(2);
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      // Act & Assert - No identity (unauthenticated)
      await expect(t.query(api.mentions.getUnreadMentionCount, {})).rejects.toThrow();
    });
  });

  describe("mentions.markMentionAsRead mutation", () => {
    it("should mark user's own mention as read and set notifiedAt timestamp", async () => {
      const t = convexTest(schema);

      let mentionId: Id<"mentions">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
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

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "@user Test mention",
          createdAt: Date.now(),
        });

        mentionId = await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now(),
          // notifiedAt is undefined (unread)
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.mentions.markMentionAsRead, {
        mentionId: mentionId!,
      });

      // Assert - Verify mention is now read
      const updatedMention = await t.run(async (ctx) => {
        return await ctx.db.get(mentionId!);
      });

      expect(updatedMention).toBeDefined();
      expect(updatedMention!.notifiedAt).toBeDefined();
      expect(typeof updatedMention!.notifiedAt).toBe("number");
      expect(updatedMention!.notifiedAt).toBeGreaterThan(0);
    });

    it("should throw error when user tries to mark another user's mention as read", async () => {
      const t = convexTest(schema);

      let mentionId: Id<"mentions">;
      let user1Id: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange - Create two users
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

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "@user2 Mention for user2",
          createdAt: Date.now(),
        });

        // Create mention for user2
        mentionId = await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId: user2Id,
          channelId,
          createdAt: Date.now(),
        });
      });

      // Act & Assert - User1 tries to mark user2's mention as read
      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      await expect(
        asUser1.mutation(api.mentions.markMentionAsRead, {
          mentionId: mentionId!,
        })
      ).rejects.toThrow("Forbidden: You can only mark your own mentions as read");
    });

    it("should set notifiedAt to current timestamp", async () => {
      const t = convexTest(schema);

      let mentionId: Id<"mentions">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
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

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "@user Test mention",
          createdAt: Date.now(),
        });

        mentionId = await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const beforeTimestamp = Date.now();
      await asUser.mutation(api.mentions.markMentionAsRead, {
        mentionId: mentionId!,
      });
      const afterTimestamp = Date.now();

      // Assert - notifiedAt should be between before and after timestamps
      const updatedMention = await t.run(async (ctx) => {
        return await ctx.db.get(mentionId!);
      });

      expect(updatedMention!.notifiedAt).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(updatedMention!.notifiedAt).toBeLessThanOrEqual(afterTimestamp);
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      let mentionId: Id<"mentions">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
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

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "@user Test mention",
          createdAt: Date.now(),
        });

        mentionId = await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now(),
        });
      });

      // Act & Assert - No identity (unauthenticated)
      await expect(
        t.mutation(api.mentions.markMentionAsRead, {
          mentionId: mentionId!,
        })
      ).rejects.toThrow();
    });

    it("should throw error when mention does not exist", async () => {
      const t = convexTest(schema);

      let validButNonExistentMentionId: Id<"mentions">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
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

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
        });

        // Create a mention and immediately delete it to get a valid ID that doesn't exist
        validButNonExistentMentionId = await ctx.db.insert("mentions", {
          messageId,
          type: "user",
          mentionedUserId: userId,
          channelId,
          createdAt: Date.now(),
        });

        await ctx.db.delete(validButNonExistentMentionId);
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert - Try to mark non-existent mention
      await expect(
        asUser.mutation(api.mentions.markMentionAsRead, {
          mentionId: validButNonExistentMentionId!,
        })
      ).rejects.toThrow("Mention not found");
    });
  });
});
