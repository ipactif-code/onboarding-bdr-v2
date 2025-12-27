import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import * as apiModule from "../../../convex/_generated/api";
// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internal = (apiModule as any).internal;
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("threads.ts - Threaded Replies (Phase 7)", () => {
  describe("getThread query", () => {
    it("returns parent message with all replies sorted by createdAt ASC", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let channelId!: Id<"channels">;
      let parentId!: Id<"messages">;
      let reply1Id!: Id<"messages">;
      let reply2Id!: Id<"messages">;
      let reply3Id!: Id<"messages">;

      // Arrange - Setup database
      await t.run(async (ctx) => {
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

        // Create parent message
        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now() - 5000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 3,
          threadLastReplyAt: Date.now(),
        });

        // Create replies in specific order
        reply1Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "First reply",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 3000,
          status: "sent",
          reactionCount: 0,
        });

        reply2Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Second reply",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 2000,
          status: "sent",
          reactionCount: 0,
        });

        reply3Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Third reply",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 1000,
          status: "sent",
          reactionCount: 0,
        });
      });

      // Create authenticated identity
      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const result = await asUser.query(api.messages.getThread, {
        parentMessageId: parentId,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.parent._id).toEqual(parentId);
      expect(result?.parent.content).toBe("Parent message");
      expect(result?.replies).toHaveLength(3);

      // Verify chronological order (ASC) - oldest first
      expect(result?.replies[0]!._id).toEqual(reply1Id);
      expect(result?.replies[0]!.content).toBe("First reply");
      expect(result?.replies[1]!._id).toEqual(reply2Id);
      expect(result?.replies[1]!.content).toBe("Second reply");
      expect(result?.replies[2]!._id).toEqual(reply3Id);
      expect(result?.replies[2]!.content).toBe("Third reply");
    });

    it("requires authentication - throws when not authenticated", async () => {
      const t = convexTest(schema);

      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });
      });

      // Act & Assert - no identity provided
      await expect(
        t.query(api.messages.getThread, { parentMessageId: parentId })
      ).rejects.toThrow("Unauthorized");
    });

    it("returns null when parent message not found", async () => {
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

      // Create and then delete a message to get a valid but non-existent ID
      let deletedId!: Id<"messages">;
      await t.run(async (ctx) => {
        const userId = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", "test-clerk-123"))
          .unique();

        const tempChannelId = await ctx.db.insert("channels", {
          name: "temp",
          type: "public",
          creatorId: userId!._id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        deletedId = await ctx.db.insert("messages", {
          channelId: tempChannelId,
          senderId: userId!._id,
          content: "temp",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
        });

        await ctx.db.delete(deletedId);
      });

      // Act
      const result = await asUser.query(api.messages.getThread, {
        parentMessageId: deletedId,
      });

      // Assert
      expect(result).toBeNull();
    });

    it("throws when user lacks channel access", async () => {
      const t = convexTest(schema);

      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "user",
          status: "online",
        });

        // Create another user who won't have access
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        // Create private channel
        const channelId = await ctx.db.insert("channels", {
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: adminId,
          content: "Private message",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.query(api.messages.getThread, { parentMessageId: parentId })
      ).rejects.toThrow("Forbidden");
    });

    it("throws when parent is a reply (nested threading forbidden)", async () => {
      const t = convexTest(schema);

      let replyId!: Id<"messages">;

      await t.run(async (ctx) => {
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

        const parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now() - 2000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 1,
        });

        // This reply itself has a parentId - it's a thread reply
        replyId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Reply message",
          contentType: "text",
          parentId,
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert - trying to get thread from a reply
      await expect(
        asUser.query(api.messages.getThread, { parentMessageId: replyId })
      ).rejects.toThrow("Cannot get thread from a reply message");
    });

    it("throws when parent is a conversation message (channels only)", async () => {
      const t = convexTest(schema);

      let dmMessageId!: Id<"messages">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });

        // Create a DM message (conversationId, not channelId)
        dmMessageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "DM message",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.query(api.messages.getThread, { parentMessageId: dmMessageId })
      ).rejects.toThrow("Parent message must be a channel message");
    });

    it("excludes deleted replies from results", async () => {
      const t = convexTest(schema);

      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now() - 4000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 2,
        });

        // Active reply
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Active reply",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 3000,
          status: "sent",
          reactionCount: 0,
        });

        // Deleted reply (should be excluded)
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted reply",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 2000,
          status: "sent",
          reactionCount: 0,
          deletedAt: Date.now() - 1000,
          deletedBy: userId,
        });

        // Another active reply
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Another active reply",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 1000,
          status: "sent",
          reactionCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const result = await asUser.query(api.messages.getThread, {
        parentMessageId: parentId,
      });

      // Assert - deleted replies should be excluded from results
      expect(result).toBeDefined();
      expect(result?.replies).toHaveLength(2); // Only non-deleted replies
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(result?.replies.every((r: any) => r.deletedAt === undefined)).toBe(true);
      // Verify the active replies are returned
      expect(result?.replies[0]!.content).toBe("Active reply");
      expect(result?.replies[1]!.content).toBe("Another active reply");
    });

    it("returns empty replies array when no replies exist", async () => {
      const t = convexTest(schema);

      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message with no replies",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const result = await asUser.query(api.messages.getThread, {
        parentMessageId: parentId,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.parent._id).toEqual(parentId);
      expect(result?.replies).toEqual([]);
    });

    it("hydrates sender info for parent and all replies", async () => {
      const t = convexTest(schema);

      let user1Id!: Id<"users">;
      let user2Id!: Id<"users">;
      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
        user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User One",
          avatarUrl: "https://example.com/user1.jpg",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User Two",
          avatarUrl: "https://example.com/user2.jpg",
          role: "user",
          status: "away",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
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

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: user2Id,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "Parent by user1",
          contentType: "text",
          createdAt: Date.now() - 2000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 1,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: user2Id,
          content: "Reply by user2",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 1000,
          status: "sent",
          reactionCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser.query(api.messages.getThread, {
        parentMessageId: parentId,
      });

      // Assert - parent sender info
      expect(result?.parent.sender).toEqual({
        _id: user1Id,
        name: "User One",
        avatarUrl: "https://example.com/user1.jpg",
        status: "online",
      });

      // Assert - reply sender info
      expect(result?.replies).toHaveLength(1);
      expect(result?.replies[0]!.sender).toEqual({
        _id: user2Id,
        name: "User Two",
        avatarUrl: "https://example.com/user2.jpg",
        status: "away",
      });
    });

    it("hydrates lesson info when lessonId exists", async () => {
      const t = convexTest(schema);

      let lessonId!: Id<"lessons">;
      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          creatorId: userId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Test Section",
          displayOrder: 0,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Test Lesson",
          displayOrder: 0,
        });

        const channelId = await ctx.db.insert("channels", {
          name: "course-channel",
          type: "course",
          courseId,
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Question about lesson",
          contentType: "text",
          lessonId,
          createdAt: Date.now() - 2000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 1,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Reply with lesson context",
          contentType: "text",
          parentId,
          lessonId,
          createdAt: Date.now() - 1000,
          status: "sent",
          reactionCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const result = await asUser.query(api.messages.getThread, {
        parentMessageId: parentId,
      });

      // Assert - parent has lesson info
      expect(result?.parent.lessonId).toEqual(lessonId);
      expect(result?.parent.lesson).toEqual({
        _id: lessonId,
        title: "Test Lesson",
      });

      // Assert - reply has lesson info
      expect(result?.replies).toHaveLength(1);
      expect(result?.replies[0]!.lessonId).toEqual(lessonId);
      expect(result?.replies[0]!.lesson).toEqual({
        _id: lessonId,
        title: "Test Lesson",
      });
    });
  });

  describe("updateThreadMetadata internal mutation", () => {
    it("updates threadReplyCount to correct value", async () => {
      const t = convexTest(schema);

      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now() - 4000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });

        // Create 3 active replies
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert("messages", {
            channelId,
            senderId: userId,
            content: `Reply ${i + 1}`,
            contentType: "text",
            parentId,
            createdAt: Date.now() - (3000 - i * 1000),
            status: "sent",
            reactionCount: 0,
          });
        }
      });

      // Act
      await t.mutation(internal.messages.threadInternals.updateThreadMetadata, {
        parentId,
      });

      // Assert
      await t.run(async (ctx) => {
        const parent = await ctx.db.get(parentId);
        expect(parent?.threadReplyCount).toBe(3);
      });
    });

    it("updates threadLastReplyAt to most recent reply timestamp", async () => {
      const t = convexTest(schema);

      let parentId!: Id<"messages">;
      const now = Date.now();
      const mostRecentReplyTime = now - 1000;

      await t.run(async (ctx) => {
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: now - 5000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });

        // Create replies with specific timestamps
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Oldest reply",
          contentType: "text",
          parentId,
          createdAt: now - 4000,
          status: "sent",
          reactionCount: 0,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Middle reply",
          contentType: "text",
          parentId,
          createdAt: now - 2000,
          status: "sent",
          reactionCount: 0,
        });

        // Most recent reply
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Most recent reply",
          contentType: "text",
          parentId,
          createdAt: mostRecentReplyTime,
          status: "sent",
          reactionCount: 0,
        });
      });

      // Act
      await t.mutation(internal.messages.threadInternals.updateThreadMetadata, {
        parentId,
      });

      // Assert
      await t.run(async (ctx) => {
        const parent = await ctx.db.get(parentId);
        expect(parent?.threadLastReplyAt).toBe(mostRecentReplyTime);
      });
    });

    it("sets threadLastReplyAt to undefined when no replies", async () => {
      const t = convexTest(schema);

      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 5, // Stale data
          threadLastReplyAt: Date.now(), // Stale data
        });

        // No replies created
      });

      // Act
      await t.mutation(internal.messages.threadInternals.updateThreadMetadata, {
        parentId,
      });

      // Assert
      await t.run(async (ctx) => {
        const parent = await ctx.db.get(parentId);
        expect(parent?.threadReplyCount).toBe(0);
        expect(parent?.threadLastReplyAt).toBeUndefined();
      });
    });

    it("excludes deleted replies from count", async () => {
      const t = convexTest(schema);

      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now() - 5000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });

        // 2 active replies
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Active reply 1",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 4000,
          status: "sent",
          reactionCount: 0,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Active reply 2",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 3000,
          status: "sent",
          reactionCount: 0,
        });

        // 2 deleted replies (should not be counted)
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted reply 1",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 2000,
          status: "sent",
          reactionCount: 0,
          deletedAt: Date.now() - 1000,
          deletedBy: userId,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted reply 2",
          contentType: "text",
          parentId,
          createdAt: Date.now() - 1500,
          status: "sent",
          reactionCount: 0,
          deletedAt: Date.now() - 500,
          deletedBy: userId,
        });
      });

      // Act
      await t.mutation(internal.messages.threadInternals.updateThreadMetadata, {
        parentId,
      });

      // Assert
      await t.run(async (ctx) => {
        const parent = await ctx.db.get(parentId);
        expect(parent?.threadReplyCount).toBe(2); // Only non-deleted replies
      });
    });

    it("does nothing when parent is deleted (no-op)", async () => {
      const t = convexTest(schema);

      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted parent",
          contentType: "text",
          createdAt: Date.now() - 2000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
          deletedAt: Date.now() - 1000,
          deletedBy: userId,
        });
      });

      // Delete the parent to simulate it not existing
      await t.run(async (ctx) => {
        await ctx.db.delete(parentId);
      });

      // Act - should not throw
      const result = await t.mutation(
        internal.messages.threadInternals.updateThreadMetadata,
        { parentId }
      );

      // Assert
      expect(result).toBeNull();
    });

    it("uses by_parent index for efficient lookup", async () => {
      const t = convexTest(schema);

      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now() - 3000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });

        // Create multiple messages to ensure index is used
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("messages", {
            channelId,
            senderId: userId,
            content: `Reply ${i}`,
            contentType: "text",
            parentId,
            createdAt: Date.now() - (2000 - i * 100),
            status: "sent",
            reactionCount: 0,
          });
        }
      });

      // Act - this should use the by_parent index
      await t.mutation(internal.messages.threadInternals.updateThreadMetadata, {
        parentId,
      });

      // Assert
      await t.run(async (ctx) => {
        const parent = await ctx.db.get(parentId);
        expect(parent?.threadReplyCount).toBe(10);
        expect(parent?.threadLastReplyAt).toBeDefined();
      });
    });
  });

  describe("sendToChannel with parentId (thread replies)", () => {
    it("throws when parentId points to non-existent message", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;

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

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Create and then delete a message to get a valid but non-existent ID
      let deletedId!: Id<"messages">;
      await t.run(async (ctx) => {
        const userId = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", "test-clerk-123"))
          .unique();

        deletedId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId!._id,
          content: "temp",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
        });

        await ctx.db.delete(deletedId);
      });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.sendToChannel, {
          channelId,
          content: "Reply to non-existent message",
          parentId: deletedId,
        })
      ).rejects.toThrow("Parent message not found");
    });

    it("throws when parentId points to message in different channel", async () => {
      const t = convexTest(schema);

      let channel1Id!: Id<"channels">;
      let channel2Id!: Id<"channels">;
      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        channel1Id = await ctx.db.insert("channels", {
          name: "channel-1",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        channel2Id = await ctx.db.insert("channels", {
          name: "channel-2",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId: channel1Id,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId: channel2Id,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Parent message in channel1
        parentId = await ctx.db.insert("messages", {
          channelId: channel1Id,
          senderId: userId,
          content: "Message in channel 1",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert - trying to reply in channel2 to message from channel1
      await expect(
        asUser.mutation(api.messages.sendToChannel, {
          channelId: channel2Id,
          content: "Reply in wrong channel",
          parentId,
        })
      ).rejects.toThrow("Parent message must be in the same channel");
    });

    it("throws when parentId points to deleted message", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let parentId!: Id<"messages">;

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

        // Deleted parent message
        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted message",
          contentType: "text",
          createdAt: Date.now() - 2000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
          deletedAt: Date.now() - 1000,
          deletedBy: userId,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.messages.sendToChannel, {
          channelId,
          content: "Reply to deleted message",
          parentId,
        })
      ).rejects.toThrow("Cannot reply to a deleted message");
    });

    it("successfully creates reply when parentId is valid", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let parentId!: Id<"messages">;

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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const replyId = await asUser.mutation(api.messages.sendToChannel, {
        channelId,
        content: "This is a reply",
        parentId,
      });

      // Assert
      await t.run(async (ctx) => {
        const reply = await ctx.db.get(replyId);
        expect(reply).toBeDefined();
        if (reply && "content" in reply && "parentId" in reply && "channelId" in reply) {
          expect(reply.content).toBe("This is a reply");
          expect(reply.parentId).toEqual(parentId);
          expect(reply.channelId).toEqual(channelId);
        }
      });
    });

    it("increments parent threadReplyCount after creating reply", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let parentId!: Id<"messages">;

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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - send first reply
      await asUser.mutation(api.messages.sendToChannel, {
        channelId,
        content: "First reply",
        parentId,
      });

      // Assert - count incremented
      await t.run(async (ctx) => {
        const parent = await ctx.db.get(parentId);
        expect(parent?.threadReplyCount).toBe(1);
      });

      // Act - send second reply
      await asUser.mutation(api.messages.sendToChannel, {
        channelId,
        content: "Second reply",
        parentId,
      });

      // Assert - count incremented again
      await t.run(async (ctx) => {
        const parent = await ctx.db.get(parentId);
        expect(parent?.threadReplyCount).toBe(2);
      });
    });

    it("updates parent threadLastReplyAt after creating reply", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let parentId!: Id<"messages">;

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

        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Parent message",
          contentType: "text",
          createdAt: Date.now() - 5000,
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });
      const beforeReply = Date.now();

      // Act
      await asUser.mutation(api.messages.sendToChannel, {
        channelId,
        content: "Reply message",
        parentId,
      });

      // Assert
      await t.run(async (ctx) => {
        const parent = await ctx.db.get(parentId);
        expect(parent?.threadLastReplyAt).toBeDefined();
        expect(parent?.threadLastReplyAt).toBeGreaterThanOrEqual(beforeReply);
      });
    });

    it("inherits lessonId from parent when not explicitly provided", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let lessonId!: Id<"lessons">;
      let parentId!: Id<"messages">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          creatorId: userId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Test Section",
          displayOrder: 0,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Test Lesson",
          displayOrder: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "course-channel",
          type: "course",
          courseId,
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

        // Parent message with lessonId
        parentId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Question about lesson",
          contentType: "text",
          lessonId,
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - send reply WITHOUT explicit lessonId
      const replyId = await asUser.mutation(api.messages.sendToChannel, {
        channelId,
        content: "Reply to lesson question",
        parentId,
        // lessonId NOT provided - should inherit from parent
      });

      // Assert
      await t.run(async (ctx) => {
        const reply = await ctx.db.get(replyId);
        if (reply && "lessonId" in reply) {
          expect(reply.lessonId).toEqual(lessonId);
        }
      });
    });
  });
});
