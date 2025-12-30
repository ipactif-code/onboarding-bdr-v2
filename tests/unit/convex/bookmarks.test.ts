import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import * as apiModule from "../../../convex/_generated/api";
// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;
import schema from "../../../convex/schema";
import { Id, Doc } from "../../../convex/_generated/dataModel";

describe("bookmarks.ts - Personal Bookmarks (FR-019)", () => {
  describe("bookmarks.addBookmark mutation", () => {
    it("should allow user to bookmark a message in their channel", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let channelId: Id<"channels">;
      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
          email: "user@example.com",
          name: "User",
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
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Important message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const bookmarkId = await asUser.mutation(api.bookmarks.addBookmark, {
        messageId: messageId!,
        note: "Remember this",
      });

      // Assert
      await t.run(async (ctx) => {
        const bookmark = await ctx.db.get(bookmarkId) as Doc<"bookmarks"> | null;
        expect(bookmark).toBeDefined();
        expect(bookmark?.userId).toEqual(userId);
        expect(bookmark?.messageId).toEqual(messageId);
        expect(bookmark?.note).toBe("Remember this");
        expect(bookmark?.createdAt).toBeDefined();
      });
    });

    it("should allow bookmarking without a note", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const bookmarkId = await asUser.mutation(api.bookmarks.addBookmark, {
        messageId: messageId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const bookmark = await ctx.db.get(bookmarkId) as Doc<"bookmarks"> | null;
        expect(bookmark?.note).toBeUndefined();
      });
    });

    it("should allow user to bookmark DM message", async () => {
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

        const user2Id = await ctx.db.insert("users", {
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

        // Add participants
        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
          notificationLevel: "all",
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
          notificationLevel: "all",
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: user2Id,
          content: "DM message",
          createdAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const bookmarkId = await asUser1.mutation(api.bookmarks.addBookmark, {
        messageId: messageId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const bookmark = await ctx.db.get(bookmarkId) as Doc<"bookmarks"> | null;
        expect(bookmark).toBeDefined();
        expect(bookmark?.messageId).toEqual(messageId);
      });
    });

    it("should be idempotent - returns existing bookmark if already bookmarked", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act - Bookmark twice
      const bookmarkId1 = await asUser.mutation(api.bookmarks.addBookmark, {
        messageId: messageId!,
        note: "First note",
      });

      const bookmarkId2 = await asUser.mutation(api.bookmarks.addBookmark, {
        messageId: messageId!,
        note: "Second note",
      });

      // Assert - Same bookmark ID, note updated
      expect(bookmarkId1).toEqual(bookmarkId2);

      await t.run(async (ctx) => {
        const bookmarks = await ctx.db
          .query("bookmarks")
          .withIndex("by_user_message", (q) =>
            q.eq("userId", userId).eq("messageId", messageId)
          )
          .collect();

        expect(bookmarks).toHaveLength(1);
        expect(bookmarks[0]!.note).toBe("Second note");
      });
    });

    it("should prevent bookmarking in channel user is not member of", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - User1 creates channel, User2 tries to bookmark
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

        const channelId = await ctx.db.insert("channels", {
          name: "private",
          type: "private",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: user1Id,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "Private message",
          createdAt: Date.now(),
        });
      });

      const asUser2 = t.withIdentity({ subject: "user2-clerk" });

      // Act & Assert
      await expect(
        asUser2.mutation(api.bookmarks.addBookmark, {
          messageId: messageId!,
        })
      ).rejects.toThrow("Not authorized");
    });

    it("should prevent bookmarking if user left channel", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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
          memberCount: 0,
        });

        // User left channel
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now() - 10000,
          leftAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Old message",
          createdAt: Date.now() - 5000,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.bookmarks.addBookmark, {
          messageId: messageId!,
        })
      ).rejects.toThrow("Not authorized");
    });

    it("should prevent bookmarking if user is banned", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        // User is banned
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: true,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.bookmarks.addBookmark, {
          messageId: messageId!,
        })
      ).rejects.toThrow("Not authorized");
    });

    it("should prevent bookmarking in DM user is not participant of", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - DM between user1 and user2, user3 tries to bookmark
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

        await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        // Only user1 and user2 are participants
        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
          notificationLevel: "all",
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
          notificationLevel: "all",
        });

        messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: user1Id,
          content: "Private DM",
          createdAt: Date.now(),
        });
      });

      const asUser3 = t.withIdentity({ subject: "user3-clerk" });

      // Act & Assert
      await expect(
        asUser3.mutation(api.bookmarks.addBookmark, {
          messageId: messageId!,
        })
      ).rejects.toThrow("Not authorized");
    });

    it("should prevent bookmarking deleted message", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted message",
          createdAt: Date.now(),
          deletedAt: Date.now(),
          deletedBy: userId,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.bookmarks.addBookmark, {
          messageId: messageId!,
        })
      ).rejects.toThrow("deleted message");
    });

    it("should throw error for non-existent message", async () => {
      const t = convexTest(schema);

      let fakeMessageId: Id<"messages">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        fakeMessageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Temp",
          createdAt: Date.now(),
        });
        await ctx.db.delete(fakeMessageId);
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.bookmarks.addBookmark, {
          messageId: fakeMessageId!,
        })
      ).rejects.toThrow("Message not found");
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Message",
          createdAt: Date.now(),
        });
      });

      // Act & Assert - No identity
      await expect(
        t.mutation(api.bookmarks.addBookmark, {
          messageId: messageId!,
        })
      ).rejects.toThrow();
    });
  });

  describe("bookmarks.removeBookmark mutation", () => {
    it("should allow user to remove their own bookmark", async () => {
      const t = convexTest(schema);

      let bookmarkId: Id<"bookmarks">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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
          content: "Bookmarked message",
          createdAt: Date.now(),
        });

        bookmarkId = await ctx.db.insert("bookmarks", {
          userId,
          messageId,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      await asUser.mutation(api.bookmarks.removeBookmark, {
        bookmarkId: bookmarkId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const bookmark = await ctx.db.get(bookmarkId);
        expect(bookmark).toBeNull();
      });
    });

    it("should prevent removing other user's bookmark", async () => {
      const t = convexTest(schema);

      let bookmarkId: Id<"bookmarks">;

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

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "Message",
          createdAt: Date.now(),
        });

        // User1's bookmark
        bookmarkId = await ctx.db.insert("bookmarks", {
          userId: user1Id,
          messageId,
          createdAt: Date.now(),
        });
      });

      const asUser2 = t.withIdentity({ subject: "user2-clerk" });

      // Act & Assert - User2 tries to remove User1's bookmark
      await expect(
        asUser2.mutation(api.bookmarks.removeBookmark, {
          bookmarkId: bookmarkId!,
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should throw error for non-existent bookmark", async () => {
      const t = convexTest(schema);

      let fakeBookmarkId: Id<"bookmarks">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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
          content: "Message",
          createdAt: Date.now(),
        });

        fakeBookmarkId = await ctx.db.insert("bookmarks", {
          userId,
          messageId,
          createdAt: Date.now(),
        });
        await ctx.db.delete(fakeBookmarkId);
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.bookmarks.removeBookmark, {
          bookmarkId: fakeBookmarkId!,
        })
      ).rejects.toThrow("Bookmark not found");
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      let bookmarkId: Id<"bookmarks">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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
          content: "Message",
          createdAt: Date.now(),
        });

        bookmarkId = await ctx.db.insert("bookmarks", {
          userId,
          messageId,
          createdAt: Date.now(),
        });
      });

      // Act & Assert - No identity
      await expect(
        t.mutation(api.bookmarks.removeBookmark, {
          bookmarkId: bookmarkId!,
        })
      ).rejects.toThrow();
    });
  });

  describe("bookmarks.listBookmarks query", () => {
    it("should return empty array for user with no bookmarks", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const bookmarks = await asUser.query(api.bookmarks.listBookmarks);

      // Assert
      expect(bookmarks).toEqual([]);
    });

    it("should return bookmarks sorted by createdAt descending (newest first)", async () => {
      const t = convexTest(schema);

      let bookmark1Id!: Id<"bookmarks">;
      let bookmark2Id!: Id<"bookmarks">;
      let bookmark3Id!: Id<"bookmarks">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        const msg1 = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "First",
          createdAt: Date.now() - 3000,
        });

        const msg2 = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Second",
          createdAt: Date.now() - 2000,
        });

        const msg3 = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Third",
          createdAt: Date.now() - 1000,
        });

        bookmark1Id = await ctx.db.insert("bookmarks", {
          userId,
          messageId: msg1,
          createdAt: Date.now() - 3000,
        });

        bookmark2Id = await ctx.db.insert("bookmarks", {
          userId,
          messageId: msg2,
          createdAt: Date.now() - 2000,
        });

        bookmark3Id = await ctx.db.insert("bookmarks", {
          userId,
          messageId: msg3,
          createdAt: Date.now() - 1000,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const bookmarks = await asUser.query(api.bookmarks.listBookmarks);

      // Assert - Newest first
      expect(bookmarks).toHaveLength(3);
      expect(bookmarks[0]!._id).toEqual(bookmark3Id);
      expect(bookmarks[1]!._id).toEqual(bookmark2Id);
      expect(bookmarks[2]!._id).toEqual(bookmark1Id);
    });

    it("should enrich bookmarks with message and sender details", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
          email: "user@example.com",
          name: "Test User",
          avatarUrl: "https://example.com/avatar.jpg",
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
          content: "Important message",
          contentType: "text",
          createdAt: Date.now(),
        });

        await ctx.db.insert("bookmarks", {
          userId,
          messageId,
          note: "My note",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const bookmarks = await asUser.query(api.bookmarks.listBookmarks);

      // Assert
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]!.note).toBe("My note");
      expect(bookmarks[0]!.message).toBeDefined();
      expect(bookmarks[0]!.message?.content).toBe("Important message");
      expect(bookmarks[0]!.message?.sender).toBeDefined();
      expect(bookmarks[0]!.message?.sender?.name).toBe("Test User");
      expect(bookmarks[0]!.context).toBeDefined();
      expect(bookmarks[0]!.context?.type).toBe("channel");
      expect(bookmarks[0]!.context?.name).toBe("general");
    });

    it("should include context for DM bookmarks", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          name: "DM with User 2",
          updatedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
          notificationLevel: "all",
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
          notificationLevel: "all",
        });

        const messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: user2Id,
          content: "DM message",
          createdAt: Date.now(),
        });

        await ctx.db.insert("bookmarks", {
          userId: user1Id,
          messageId,
          createdAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const bookmarks = await asUser1.query(api.bookmarks.listBookmarks);

      // Assert
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]!.context?.type).toBe("conversation");
      expect(bookmarks[0]!.context?.name).toBe("DM with User 2");
    });

    it("should filter out deleted messages from bookmark list", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        // Active message
        const activeMsg = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Active",
          createdAt: Date.now(),
        });

        // Deleted message
        const deletedMsg = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted",
          createdAt: Date.now(),
          deletedAt: Date.now(),
          deletedBy: userId,
        });

        await ctx.db.insert("bookmarks", {
          userId,
          messageId: activeMsg,
          createdAt: Date.now() - 1000,
        });

        await ctx.db.insert("bookmarks", {
          userId,
          messageId: deletedMsg,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const bookmarks = await asUser.query(api.bookmarks.listBookmarks);

      // Assert - Bookmark for deleted message has null message
      expect(bookmarks).toHaveLength(2);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deletedBookmark = bookmarks.find((b: any) => b.message === null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeBookmark = bookmarks.find((b: any) => b.message !== null);
      expect(deletedBookmark).toBeDefined();
      expect(activeBookmark).toBeDefined();
      expect(activeBookmark?.message?.content).toBe("Active");
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      // Act & Assert
      await expect(t.query(api.bookmarks.listBookmarks)).rejects.toThrow();
    });
  });

  describe("bookmarks.getByMessage query", () => {
    it("should return bookmark if user has bookmarked the message", async () => {
      const t = convexTest(schema);

      let messageId!: Id<"messages">;
      let bookmarkId!: Id<"bookmarks">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Bookmarked",
          createdAt: Date.now(),
        });

        bookmarkId = await ctx.db.insert("bookmarks", {
          userId,
          messageId,
          note: "My note",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const bookmark = await asUser.query(api.bookmarks.getByMessage, {
        messageId,
      });

      // Assert
      expect(bookmark).toBeDefined();
      expect(bookmark?._id).toEqual(bookmarkId);
      expect(bookmark?.note).toBe("My note");
    });

    it("should return null if user has not bookmarked the message", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Not bookmarked",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const bookmark = await asUser.query(api.bookmarks.getByMessage, {
        messageId: messageId!,
      });

      // Assert
      expect(bookmark).toBeNull();
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Message",
          createdAt: Date.now(),
        });
      });

      // Act & Assert
      await expect(
        t.query(api.bookmarks.getByMessage, { messageId: messageId! })
      ).rejects.toThrow();
    });
  });

  describe("bookmarks.updateNote mutation", () => {
    it("should allow user to update note on their bookmark", async () => {
      const t = convexTest(schema);

      let bookmarkId: Id<"bookmarks">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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
          content: "Message",
          createdAt: Date.now(),
        });

        bookmarkId = await ctx.db.insert("bookmarks", {
          userId,
          messageId,
          note: "Original note",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      await asUser.mutation(api.bookmarks.updateNote, {
        bookmarkId: bookmarkId!,
        note: "Updated note",
      });

      // Assert
      await t.run(async (ctx) => {
        const bookmark = await ctx.db.get(bookmarkId);
        expect(bookmark?.note).toBe("Updated note");
      });
    });

    it("should allow clearing note by setting to undefined", async () => {
      const t = convexTest(schema);

      let bookmarkId: Id<"bookmarks">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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
          content: "Message",
          createdAt: Date.now(),
        });

        bookmarkId = await ctx.db.insert("bookmarks", {
          userId,
          messageId,
          note: "Note to remove",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      await asUser.mutation(api.bookmarks.updateNote, {
        bookmarkId: bookmarkId!,
        note: undefined,
      });

      // Assert
      await t.run(async (ctx) => {
        const bookmark = await ctx.db.get(bookmarkId);
        expect(bookmark?.note).toBeUndefined();
      });
    });

    it("should prevent updating other user's bookmark", async () => {
      const t = convexTest(schema);

      let bookmarkId: Id<"bookmarks">;

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

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "Message",
          createdAt: Date.now(),
        });

        // User1's bookmark
        bookmarkId = await ctx.db.insert("bookmarks", {
          userId: user1Id,
          messageId,
          note: "User 1's note",
          createdAt: Date.now(),
        });
      });

      const asUser2 = t.withIdentity({ subject: "user2-clerk" });

      // Act & Assert
      await expect(
        asUser2.mutation(api.bookmarks.updateNote, {
          bookmarkId: bookmarkId!,
          note: "Hacked note",
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should throw error for non-existent bookmark", async () => {
      const t = convexTest(schema);

      let fakeBookmarkId: Id<"bookmarks">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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
          content: "Message",
          createdAt: Date.now(),
        });

        fakeBookmarkId = await ctx.db.insert("bookmarks", {
          userId,
          messageId,
          createdAt: Date.now(),
        });
        await ctx.db.delete(fakeBookmarkId);
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.bookmarks.updateNote, {
          bookmarkId: fakeBookmarkId!,
          note: "New note",
        })
      ).rejects.toThrow("Bookmark not found");
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      let bookmarkId: Id<"bookmarks">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
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
          content: "Message",
          createdAt: Date.now(),
        });

        bookmarkId = await ctx.db.insert("bookmarks", {
          userId,
          messageId,
          createdAt: Date.now(),
        });
      });

      // Act & Assert
      await expect(
        t.mutation(api.bookmarks.updateNote, {
          bookmarkId: bookmarkId!,
          note: "Note",
        })
      ).rejects.toThrow();
    });
  });
});
