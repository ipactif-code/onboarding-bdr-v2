import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("messages.ts - Channel Messaging", () => {
  describe("messages.listByChannel query", () => {
    it("should return empty array when channel has no messages", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange - Setup database
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
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
      });

      // Create authenticated identity
      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const result = await asUser.query(api.messages.listByChannel, { channelId: channelId! });

      // Assert
      expect(result.messages).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it("should return messages in reverse chronological order (newest first)", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let msg1Id!: Id<"messages">;
      let msg2Id!: Id<"messages">;
      let msg3Id!: Id<"messages">;

      // Arrange - Setup database
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
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

        // Create messages with different timestamps
        msg1Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "First message",
          createdAt: Date.now() - 3000,
        });

        msg2Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Second message",
          createdAt: Date.now() - 2000,
        });

        msg3Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Third message",
          createdAt: Date.now() - 1000,
        });
      });

      // Create authenticated identity
      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const result = await asUser.query(api.messages.listByChannel, { channelId: channelId! });

      // Assert
      expect(result.messages).toHaveLength(3);
      // Newest first (descending order)
      expect(result.messages[0]!._id).toEqual(msg3Id);
      expect(result.messages[1]!._id).toEqual(msg2Id);
      expect(result.messages[2]!._id).toEqual(msg1Id);
    });

    it("should include sender information with each message", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let channelId!: Id<"channels">;

      // Arrange - Setup database
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          avatarUrl: "https://example.com/avatar.jpg",
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

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
        });
      });

      // Create authenticated identity
      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const result = await asUser.query(api.messages.listByChannel, { channelId: channelId! });

      // Assert
      expect(result.messages[0]!.sender).toEqual({
        _id: userId,
        name: "Test User",
        avatarUrl: "https://example.com/avatar.jpg",
        status: "online",
      });
    });

    it("should respect limit parameter", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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

        // Create 5 messages
        for (let i = 0; i < 5; i++) {
          await ctx.db.insert("messages", {
            channelId,
            senderId: userId,
            content: `Message ${i}`,
            createdAt: Date.now() + i,
          });
        }
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const result = await asUser.query(api.messages.listByChannel, {
        channelId: channelId!,
        limit: 3,
      });

      // Assert
      expect(result.messages).toHaveLength(3);
      expect(result.hasMore).toBe(true);
    });

    it("should support pagination with before cursor", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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

        const baseTime = Date.now();

        // Create 5 messages
        for (let i = 0; i < 5; i++) {
          const timestamp = baseTime + i * 1000;
          await ctx.db.insert("messages", {
            channelId,
            senderId: userId,
            content: `Message ${i}`,
            createdAt: timestamp,
          });
        }
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - get first page
      const page1 = await asUser.query(api.messages.listByChannel, {
        channelId: channelId!,
        limit: 3,
      });

      // Get second page using cursor
      const cursorTime = page1.messages[2]!.createdAt;
      const page2 = await asUser.query(api.messages.listByChannel, {
        channelId: channelId!,
        limit: 3,
        before: cursorTime,
      });

      // Assert
      expect(page1.messages).toHaveLength(3);
      expect(page2.messages).toHaveLength(2); // Remaining messages
    });

    it("should throw error for non-member trying to access channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "private-channel",
          type: "private",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: adminId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.query(api.messages.listByChannel, { channelId: channelId! })
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("messages.sendToChannel mutation", () => {
    it("should send a text message to a channel", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
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
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const beforeTime = Date.now();

      // Act
      const messageId = await asUser.mutation(api.messages.sendToChannel, {
        channelId: channelId!,
        content: "Hello, world!",
      });

      // Assert
      await t.run(async (ctx) => {
        const message = await ctx.db.get(messageId);
        expect(message).toBeDefined();
        expect(message?.content).toBe("Hello, world!");
        expect(message?.senderId).toEqual(userId);
        expect(message?.channelId).toEqual(channelId);
        expect(message?.contentType).toBe("text");
        expect(message?.status).toBe("sent");
        expect(message?.createdAt).toBeGreaterThanOrEqual(beforeTime);

        // Verify channel lastMessageAt was updated
        const channel = await ctx.db.get(channelId);
        expect(channel?.lastMessageAt).toBeGreaterThanOrEqual(beforeTime);
      });
    });

    it("should enforce rate limit (30 messages per minute)", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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

        // Simulate hitting rate limit
        const now = Date.now();
        await ctx.db.insert("rateLimits", {
          userId,
          type: "text_message",
          windowStart: now,
          count: 30, // At the limit
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.sendToChannel, {
          channelId: channelId!,
          content: "This should fail",
        })
      ).rejects.toThrow("Rate limit exceeded");
    });

    it("should validate message content length (max 4000 chars)", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.sendToChannel, {
          channelId: channelId!,
          content: "a".repeat(4001), // Exceeds limit
        })
      ).rejects.toThrow("maximum length");
    });

    it("should prevent empty messages", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.sendToChannel, {
          channelId: channelId!,
          content: "",
        })
      ).rejects.toThrow("cannot be empty");
    });

    it("should prevent sending to archived channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "archived-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
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
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.sendToChannel, {
          channelId: channelId!,
          content: "This should fail",
        })
      ).rejects.toThrow("archived");
    });

    it("should prevent muted users from sending messages", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: true,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.sendToChannel, {
          channelId: channelId!,
          content: "This should fail",
        })
      ).rejects.toThrow("muted");
    });

    it("should update thread reply count when sending a reply", async () => {
      const t = convexTest(schema);

      let parentId: Id<"messages">;
      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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

        // Create parent message
        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          createdAt: Date.now(),
          threadReplyCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - send reply
      await asUser.mutation(api.messages.sendToChannel, {
        channelId: channelId!,
        content: "Reply message",
        parentId: parentId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const parent = await ctx.db.get(parentId);
        expect(parent?.threadReplyCount).toBe(1);
        expect(parent?.threadLastReplyAt).toBeDefined();
      });
    });
  });

  describe("messages.editChannelMessage mutation", () => {
    it("should allow sender to edit their own message", async () => {
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "Original content",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      await asUser.mutation(api.messages.editChannelMessage, {
        messageId: messageId!,
        content: "Edited content",
      });

      // Assert
      await t.run(async (ctx) => {
        const message = await ctx.db.get(messageId);
        expect(message?.content).toBe("Edited content");
        expect(message?.isEdited).toBe(true);
        expect(message?.updatedAt).toBeDefined();
      });
    });

    it("should store edit history", async () => {
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "Original content",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      await asUser.mutation(api.messages.editChannelMessage, {
        messageId: messageId!,
        content: "Edited content",
      });

      // Assert
      await t.run(async (ctx) => {
        const message = await ctx.db.get(messageId);
        expect(message?.editHistory).toHaveLength(1);
        expect(message?.editHistory?.[0]!.content).toBe("Original content");
        expect(message?.editHistory?.[0]!.editedAt).toBeDefined();
      });
    });

    it("should prevent editing other users' messages", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: user1Id,
          content: "User 1's message",
          createdAt: Date.now(),
        });
      });

      const asUser2 = t.withIdentity({ subject: "user2-clerk" });

      // Act & Assert - user2 trying to edit user1's message
      await expect(
        asUser2.mutation(api.messages.editChannelMessage, {
          messageId: messageId!,
          content: "Edited by user 2",
        })
      ).rejects.toThrow("your own messages");
    });

    it("should enforce edit time window (15 minutes)", async () => {
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "Old message",
          createdAt: Date.now() - 16 * 60 * 1000, // 16 minutes ago
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.editChannelMessage, {
          messageId: messageId!,
          content: "Trying to edit old message",
        })
      ).rejects.toThrow("Edit window has expired");
    });

    it("should prevent editing deleted messages", async () => {
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "Deleted message",
          createdAt: Date.now(),
          deletedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.editChannelMessage, {
          messageId: messageId!,
          content: "Trying to edit deleted message",
        })
      ).rejects.toThrow("deleted message");
    });
  });

  describe("messages.deleteChannelMessage mutation", () => {
    it("should allow sender to delete their own message", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "Message to delete",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      await asUser.mutation(api.messages.deleteChannelMessage, { messageId: messageId! });

      // Assert (soft delete)
      await t.run(async (ctx) => {
        const message = await ctx.db.get(messageId);
        expect(message?.deletedAt).toBeDefined();
        expect(message?.deletedBy).toEqual(userId);
      });
    });

    it("should allow global admin to delete any message", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "User's message",
          createdAt: Date.now(),
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act - admin deletes user's message
      await asAdmin.mutation(api.messages.deleteChannelMessage, { messageId: messageId! });

      // Assert
      await t.run(async (ctx) => {
        const message = await ctx.db.get(messageId);
        expect(message?.deletedAt).toBeDefined();
      });
    });

    it("should allow channel moderator to delete messages in their channel", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const modId = await ctx.db.insert("users", {
          clerkId: "mod-clerk",
          email: "mod@example.com",
          name: "Moderator",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: modId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        // Mod membership
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: modId,
          role: "moderator",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "User's message",
          createdAt: Date.now(),
        });
      });

      const asMod = t.withIdentity({ subject: "mod-clerk" });

      // Act - moderator deletes message
      await asMod.mutation(api.messages.deleteChannelMessage, { messageId: messageId! });

      // Assert
      await t.run(async (ctx) => {
        const message = await ctx.db.get(messageId);
        expect(message?.deletedAt).toBeDefined();
      });
    });

    it("should prevent already deleted message from being deleted again", async () => {
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "Already deleted",
          createdAt: Date.now(),
          deletedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.deleteChannelMessage, { messageId: messageId! })
      ).rejects.toThrow("already deleted");
    });

    it("should prevent non-authorized users from deleting messages", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: user1Id,
          content: "User 1's message",
          createdAt: Date.now(),
        });
      });

      const asUser2 = t.withIdentity({ subject: "user2-clerk" });

      // Act & Assert - user2 trying to delete user1's message
      await expect(
        asUser2.mutation(api.messages.deleteChannelMessage, { messageId: messageId! })
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("messages.markChannelAsRead mutation", () => {
    it("should mark channel as read for member", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let membershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const beforeTime = Date.now();

      // Act
      await asUser.mutation(api.messages.markChannelAsRead, { channelId: channelId! });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.lastReadAt).toBeGreaterThanOrEqual(beforeTime);
      });
    });

    it("should allow specifying custom readAt timestamp", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let membershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const customTime = Date.now() - 5000;

      // Act
      await asUser.mutation(api.messages.markChannelAsRead, {
        channelId: channelId!,
        readAt: customTime,
      });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.lastReadAt).toBe(customTime);
      });
    });

    it("should throw error for non-member", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.markChannelAsRead, { channelId: channelId! })
      ).rejects.toThrow("not a member");
    });

    it("should throw error for banned member", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: true,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.markChannelAsRead, { channelId: channelId! })
      ).rejects.toThrow("not an active member");
    });
  });
});
