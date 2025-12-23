import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("favorites.ts - Unified Favorites List", () => {
  describe("favorites.list query", () => {
    it("should return empty array when no favorites exist", async () => {
      const t = convexTest(schema);

      // Arrange - Setup user with no favorites
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

      // Act
      const favorites = await asUser.query(api.favorites.list, {});

      // Assert
      expect(favorites).toEqual([]);
    });

    it("should return only user's own favorites (not others')", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;

      // Arrange - Create two users with different favorites
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

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        // User 1 favorite
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: user1Id,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
          isFavorite: true,
        });

        // User 2 NOT favorite
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: user2Id,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
          isFavorite: false,
        });
      });

      // Act - Query as User 1
      const asUser1 = t.withIdentity({ subject: "user1-clerk" });
      const user1Favorites = await asUser1.query(api.favorites.list, {});

      // Assert - User 1 sees 1 favorite
      expect(user1Favorites).toHaveLength(1);
      expect(user1Favorites[0]!.type).toBe("channel");
      expect(user1Favorites[0]!.id).toBe(channelId);

      // Act - Query as User 2
      const asUser2 = t.withIdentity({ subject: "user2-clerk" });
      const user2Favorites = await asUser2.query(api.favorites.list, {});

      // Assert - User 2 sees 0 favorites
      expect(user2Favorites).toEqual([]);
    });

    it("should include channels marked as favorite", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "favorite-channel",
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
          isFavorite: true,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      const favorites = await asUser.query(api.favorites.list, {});

      // Assert
      expect(favorites).toHaveLength(1);
      expect(favorites[0]).toMatchObject({
        type: "channel",
        id: channelId,
        name: "favorite-channel",
        isPrivate: false,
      });
    });

    it("should include DMs marked as favorite", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;

      // Arrange
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
          avatarUrl: "https://example.com/avatar.jpg",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        // User 1 participation (favorite)
        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
          isFavorite: true,
        });

        // User 2 participation
        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const favorites = await asUser1.query(api.favorites.list, {});

      // Assert
      expect(favorites).toHaveLength(1);
      expect(favorites[0]).toMatchObject({
        type: "dm",
        id: conversationId,
        name: "User 2", // The other participant's name
        avatarUrl: "https://example.com/avatar.jpg",
      });
    });

    it("should exclude channels user has left", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "left-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        // Membership marked as favorite but user has left
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now() - 10000,
          leftAt: Date.now() - 5000,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
          isFavorite: true, // Still marked favorite
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      const favorites = await asUser.query(api.favorites.list, {});

      // Assert - Should not include left channels
      expect(favorites).toEqual([]);
    });

    it("should calculate unread counts correctly", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let conversationId!: Id<"conversations">;

      // Arrange
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

        const now = Date.now();
        const lastReadAt = now - 10000;

        // Create channel with unread messages
        channelId = await ctx.db.insert("channels", {
          name: "channel-with-unreads",
          type: "public",
          creatorId: user1Id,
          createdAt: now,
          isArchived: false,
          memberCount: 1,
          lastMessageAt: now, // Recent message
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: user1Id,
          role: "owner",
          joinedAt: now,
          lastReadAt, // Read 10 seconds ago
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
          isFavorite: true,
        });

        // Add unread messages
        await ctx.db.insert("messages", {
          channelId,
          senderId: user2Id,
          content: "Unread message 1",
          createdAt: now - 5000,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: user2Id,
          content: "Unread message 2",
          createdAt: now,
        });

        // Create DM with unread messages
        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: now,
          updatedAt: now,
          lastMessageAt: now,
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: now,
          lastReadAt,
          isFavorite: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: now,
        });

        // Add unread DM messages
        await ctx.db.insert("messages", {
          conversationId,
          senderId: user2Id,
          content: "Unread DM 1",
          createdAt: now - 3000,
        });

        await ctx.db.insert("messages", {
          conversationId,
          senderId: user2Id,
          content: "Unread DM 2",
          createdAt: now - 1000,
        });

        await ctx.db.insert("messages", {
          conversationId,
          senderId: user2Id,
          content: "Unread DM 3",
          createdAt: now,
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const favorites = await asUser1.query(api.favorites.list, {});

      // Assert
      expect(favorites).toHaveLength(2);

      const channelFavorite = favorites.find((f) => f.type === "channel");
      const dmFavorite = favorites.find((f) => f.type === "dm");

      expect(channelFavorite?.unreadCount).toBe(2);
      expect(dmFavorite?.unreadCount).toBe(3);
    });
  });
});
