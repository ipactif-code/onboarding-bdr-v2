import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../../../../convex/_generated/api";
import schema from "../../../../convex/schema";
import type { Id } from "../../../../convex/_generated/dataModel";

describe("dm/conversationQueries.ts - Conversation Queries", () => {
  describe("findWithUser query", () => {
    it("should find existing 1:1 conversation", async () => {
      const t = convexTest(schema);

      let user2Id: Id<"users">;
      let conversationId: Id<"conversations">;

      // Setup database
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
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

        const user1 = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("clerkId"), "user1-clerk"))
          .first();

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1!._id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });
      });

      // Create authenticated identity
      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.directMessages.findWithUser, {
        userId: user2Id!,
      });

      // Assert
      expect(result).toEqual(conversationId!);
    });

    it("should return null if no conversation exists", async () => {
      const t = convexTest(schema);

      let user2Id: Id<"users">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
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
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.directMessages.findWithUser, {
        userId: user2Id!,
      });

      // Assert
      expect(result).toBeNull();
    });

    it("should not return group conversations", async () => {
      const t = convexTest(schema);

      let user2Id: Id<"users">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Group Chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        const user1 = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("clerkId"), "user1-clerk"))
          .first();

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1!._id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.directMessages.findWithUser, {
        userId: user2Id!,
      });

      // Assert
      expect(result).toBeNull();
    });

    it("should respect hidden conversations (leftAt set)", async () => {
      const t = convexTest(schema);

      let user2Id: Id<"users">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
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

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        const user1 = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("clerkId"), "user1-clerk"))
          .first();

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1!._id,
          joinedAt: Date.now(),
          leftAt: Date.now(), // User has left/hidden
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.directMessages.findWithUser, {
        userId: user2Id!,
      });

      // Assert
      expect(result).toBeNull();
    });

    it("should work bidirectionally", async () => {
      const t = convexTest(schema);

      let user2Id: Id<"users">;
      let conversationId: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
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

        const user1 = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("clerkId"), "user1-clerk"))
          .first();

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1!._id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act - query from user1 perspective
      const result = await asUser1.query(api.directMessages.findWithUser, {
        userId: user2Id!,
      });

      // Assert
      expect(result).toEqual(conversationId!);
    });

    it("should throw error when searching for conversation with yourself", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.query(api.directMessages.findWithUser, { userId: userId! })
      ).rejects.toThrow("Cannot find conversation with yourself");
    });
  });

  describe("getParticipants query", () => {
    it("should return all active participants", async () => {
      const t = convexTest(schema);

      let conversationId: Id<"conversations">;
      let user1Id: Id<"users">;
      let user2Id: Id<"users">;
      let joinedAt1: number;
      let joinedAt2: number;

      await t.run(async (ctx) => {
        user1Id = await ctx.db.insert("users", {
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
          status: "away",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        joinedAt1 = Date.now();
        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: joinedAt1,
        });

        joinedAt2 = Date.now() + 1000;
        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: joinedAt2,
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.directMessages.getParticipants, {
        conversationId: conversationId!,
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        _id: user1Id!,
        name: "User 1",
        email: "user1@example.com",
        avatarUrl: "https://example.com/avatar1.jpg",
        status: "online",
        joinedAt: joinedAt1!,
        isCurrentUser: true,
      });
      expect(result).toContainEqual({
        _id: user2Id!,
        name: "User 2",
        email: "user2@example.com",
        status: "away",
        joinedAt: joinedAt2!,
        isCurrentUser: false,
      });
    });

    it("should include online status for each participant", async () => {
      const t = convexTest(schema);

      let conversationId: Id<"conversations">;

      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "dnd",
        });

        const user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "offline",
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
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.directMessages.getParticipants, {
        conversationId: conversationId!,
      });

      // Assert
      expect(result[0]!.status).toBe("dnd");
      expect(result[1]!.status).toBe("offline");
    });

    it("should throw error if not a participant", async () => {
      const t = convexTest(schema);

      let conversationId: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
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

        // Only user2 is participant
        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act & Assert - user1 tries to get participants
      await expect(
        asUser1.query(api.directMessages.getParticipants, {
          conversationId: conversationId!,
        })
      ).rejects.toThrow("not a participant");
    });

    it("should exclude participants who have left", async () => {
      const t = convexTest(schema);

      let conversationId: Id<"conversations">;
      let user3Id: Id<"users">;

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
          leftAt: Date.now(), // User 3 has left
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.directMessages.getParticipants, {
        conversationId: conversationId!,
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result.some((p) => p._id === user3Id!)).toBe(false);
    });

    it("should throw error if conversation not found", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      const fakeId = "k12345678901234567890123456789ab" as Id<"conversations">;

      // Act & Assert
      await expect(
        asUser.query(api.directMessages.getParticipants, {
          conversationId: fakeId,
        })
      ).rejects.toThrow();
    });
  });

  describe("getGroupDetails query", () => {
    it("should return group conversation info", async () => {
      const t = convexTest(schema);

      let conversationId: Id<"conversations">;
      let createdAt: number;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        createdAt = Date.now();
        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Test Group",
          createdAt,
          updatedAt: createdAt,
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.directMessages.getGroupDetails, {
        conversationId: conversationId!,
      });

      // Assert
      expect(result).toEqual({
        _id: conversationId!,
        type: "group",
        name: "Test Group",
        createdAt: createdAt!,
        participantCount: 1,
        isActive: true,
      });
    });

    it("should return null if not a participant", async () => {
      const t = convexTest(schema);

      let conversationId: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Private Group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.directMessages.getGroupDetails, {
        conversationId: conversationId!,
      });

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for direct conversations", async () => {
      const t = convexTest(schema);

      let conversationId: Id<"conversations">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
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

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.directMessages.getGroupDetails, {
        conversationId: conversationId!,
      });

      // Assert
      expect(result).toBeNull();
    });

    it("should count only active participants", async () => {
      const t = convexTest(schema);

      let conversationId: Id<"conversations">;

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

        const user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Test Group",
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
          leftAt: Date.now(), // User 3 has left
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const result = await asUser1.query(api.directMessages.getGroupDetails, {
        conversationId: conversationId!,
      });

      // Assert
      expect(result?.participantCount).toBe(2);
    });
  });
});
