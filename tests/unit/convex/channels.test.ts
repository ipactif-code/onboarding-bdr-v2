import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("channels.ts - Channel Management", () => {
  describe("channels.list query", () => {
    it("should return empty array when no channels exist", async () => {
      const t = convexTest(schema);

      // Arrange - Setup database ONLY
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      // Create authenticated identity (OUTSIDE t.run)
      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - Call query OUTSIDE t.run()
      const channels = await asUser.query(api.channels.list, {});

      // Assert
      expect(channels).toEqual([]);
    });

    it("should return public channels the user has access to", async () => {
      const t = convexTest(schema);

      // Arrange - Setup database ONLY
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
      });

      // Create authenticated identity (OUTSIDE t.run)
      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act - Call query OUTSIDE t.run()
      const channels = await asUser.query(api.channels.list, {});

      // Assert
      expect(channels).toHaveLength(1);
      expect(channels[0]!.name).toBe("general");
      expect(channels[0]!.type).toBe("public");
      expect(channels[0]!.membership).not.toBeNull();
      expect(channels[0]!.membership?.role).toBe("owner");
    });

    it("should filter channels by type when specified", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const publicChannelId = await ctx.db.insert("channels", {
          name: "public-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const privateChannelId = await ctx.db.insert("channels", {
          name: "private-channel",
          type: "private",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId: publicChannelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId: privateChannelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const publicChannels = await asUser.query(api.channels.list, { type: "public" });

      // Assert
      expect(publicChannels).toHaveLength(1);
      expect(publicChannels[0]!.type).toBe("public");
    });

    it("should exclude archived channels by default", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const archivedChannelId = await ctx.db.insert("channels", {
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
          channelId: archivedChannelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const channels = await asUser.query(api.channels.list, {});

      // Assert
      expect(channels).toHaveLength(0);
    });

    it("should include archived channels when requested", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const archivedChannelId = await ctx.db.insert("channels", {
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
          channelId: archivedChannelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const channels = await asUser.query(api.channels.list, { includeArchived: true });

      // Assert
      expect(channels).toHaveLength(1);
      expect(channels[0]!.isArchived).toBe(true);
    });

    it("should calculate unread count correctly", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        const lastReadAt = now - 10000; // 10 seconds ago

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: now,
          isArchived: false,
          memberCount: 1,
          lastMessageAt: now, // Must be set for unread calculation
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: now,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
          lastReadAt,
        });

        // Add messages after lastReadAt
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "New message 1",
          createdAt: now - 5000,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "New message 2",
          createdAt: now,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const channels = await asUser.query(api.channels.list, {});

      // Assert
      expect(channels).toHaveLength(1);
      expect(channels[0]!.membership?.unreadCount).toBe(2);
    });

    it("should not count deleted messages in unread count", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const now = Date.now();
        const lastReadAt = now - 10000;

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: now,
          isArchived: false,
          memberCount: 1,
          lastMessageAt: now, // Must be set for unread calculation
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: now,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
          lastReadAt,
        });

        // Add regular message
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Regular message",
          createdAt: now - 5000,
        });

        // Add deleted message
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted message",
          createdAt: now,
          deletedAt: now,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const channels = await asUser.query(api.channels.list, {});

      // Assert
      expect(channels[0]!.membership?.unreadCount).toBe(1); // Only the regular message
    });

    it("should sort channels by lastMessageAt descending", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channel1Id = await ctx.db.insert("channels", {
          name: "channel-1",
          type: "public",
          creatorId: userId,
          createdAt: Date.now() - 10000,
          isArchived: false,
          memberCount: 1,
          lastMessageAt: Date.now() - 5000,
        });

        const channel2Id = await ctx.db.insert("channels", {
          name: "channel-2",
          type: "public",
          creatorId: userId,
          createdAt: Date.now() - 8000,
          isArchived: false,
          memberCount: 1,
          lastMessageAt: Date.now(), // Most recent
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
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const channels = await asUser.query(api.channels.list, {});

      // Assert
      expect(channels).toHaveLength(2);
      expect(channels[0]!.name).toBe("channel-2"); // Most recent first
      expect(channels[1]!.name).toBe("channel-1");
    });
  });

  describe("channels.get query", () => {
    it("should return null for non-existent channel", async () => {
      const t = convexTest(schema);

      let nonExistentChannelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "test-clerk-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create a temporary channel to get a valid ID, then delete it
        const tempUserId = await ctx.db.insert("users", {
          clerkId: "temp-clerk",
          email: "temp@example.com",
          name: "Temp User",
          role: "user",
          status: "online",
        });

        nonExistentChannelId = await ctx.db.insert("channels", {
          name: "temp-channel",
          type: "public",
          creatorId: tempUserId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        // Delete it immediately
        await ctx.db.delete(nonExistentChannelId);
      });

      const asUser = t.withIdentity({ subject: "test-clerk-123" });

      // Act
      const channel = await asUser.query(api.channels.get, { channelId: nonExistentChannelId! });

      // Assert
      expect(channel).toBeNull();
    });

    it("should return channel with membership for member", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
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
          description: "General discussion",
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

      // Act
      const channel = await asUser.query(api.channels.get, { channelId: channelId! });

      // Assert
      expect(channel).not.toBeNull();
      expect(channel?.name).toBe("general");
      expect(channel?.description).toBe("General discussion");
      expect(channel?.membership).not.toBeNull();
      expect(channel?.membership?.role).toBe("owner");
    });

    it("should return null for private channel without access", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "Regular User",
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

      // Act as user (not a member)
      const asUser = t.withIdentity({ subject: "user-clerk" });
      const channel = await asUser.query(api.channels.get, { channelId: channelId! });

      // Assert
      expect(channel).toBeNull();
    });
  });

  describe("channels.create mutation", () => {
    it("should create a public channel as admin", async () => {
      const t = convexTest(schema);

      // Setup admin user
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          status: "online",
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act
      const channelId = await asAdmin.mutation(api.channels.create, {
        name: "new-channel",
        description: "A new channel",
        type: "public",
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel).toBeDefined();
        expect(channel?.name).toBe("new-channel");
        expect(channel?.type).toBe("public");
        expect(channel?.isArchived).toBe(false);
        expect(channel?.memberCount).toBe(1);

        // Check creator membership
        const membership = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel", (q) => q.eq("channelId", channelId))
          .first();

        expect(membership).toBeDefined();
        expect(membership?.role).toBe("owner");
      });
    });

    it("should throw error for non-admin user", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "Regular User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.channels.create, {
          name: "unauthorized-channel",
          type: "public",
        })
      ).rejects.toThrow();
    });

    it("should validate name length (min 2 chars)", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          status: "online",
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act & Assert
      await expect(
        asAdmin.mutation(api.channels.create, {
          name: "a", // Too short
          type: "public",
        })
      ).rejects.toThrow("at least 2 characters");
    });

    it("should validate name length (max 80 chars)", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          status: "online",
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act & Assert
      await expect(
        asAdmin.mutation(api.channels.create, {
          name: "a".repeat(81), // Too long
          type: "public",
        })
      ).rejects.toThrow("at most 80 characters");
    });

    it("should validate name format (alphanumeric, hyphens, underscores)", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          status: "online",
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act & Assert
      await expect(
        asAdmin.mutation(api.channels.create, {
          name: "invalid channel!", // Contains space and special char
          type: "public",
        })
      ).rejects.toThrow("only contain letters");
    });

    it("should prevent duplicate channel names", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          status: "online",
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Arrange
      await asAdmin.mutation(api.channels.create, {
        name: "duplicate-channel",
        type: "public",
      });

      // Act & Assert
      await expect(
        asAdmin.mutation(api.channels.create, {
          name: "duplicate-channel",
          type: "public",
        })
      ).rejects.toThrow("already exists");
    });
  });

  describe("channels.join mutation", () => {
    it("should allow joining a public channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let userId: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "public-channel",
          type: "public",
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

      // Act
      await asUser.mutation(api.channels.join, { channelId: channelId! });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) =>
            q.eq("channelId", channelId).eq("userId", userId)
          )
          .unique();

        expect(membership).toBeDefined();
        expect(membership?.role).toBe("member");
        expect(membership?.leftAt).toBeUndefined();

        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(2); // Admin + new user
      });
    });

    it("should prevent joining private channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
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
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(asUser.mutation(api.channels.join, { channelId: channelId! })).rejects.toThrow(
        "private channel"
      );
    });

    it("should prevent joining archived channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
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
          name: "archived-channel",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: adminId,
          memberCount: 1,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(asUser.mutation(api.channels.join, { channelId: channelId! })).rejects.toThrow(
        "archived"
      );
    });

    it("should prevent banned users from joining", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "public-channel",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Create banned membership
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: true,
          leftAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(asUser.mutation(api.channels.join, { channelId: channelId! })).rejects.toThrow(
        "banned"
      );
    });

    it("should allow rejoining after leaving", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let membershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "public-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        // Create left membership
        membershipId = await ctx.db.insert("channelMembers", {
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

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.channels.join, { channelId: channelId! });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.leftAt).toBeUndefined(); // Left timestamp cleared
        expect(membership?.joinedAt).toBeGreaterThan(Date.now() - 1000); // New join time
      });
    });
  });

  describe("channels.leave mutation", () => {
    it("should allow member to leave channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let membershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "public-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.channels.leave, { channelId: channelId! });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.leftAt).toBeDefined();
        expect(membership?.leftAt).toBeGreaterThan(0);

        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(0);
      });
    });

    it("should prevent owner from leaving without transferring ownership", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "public-channel",
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

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(asUser.mutation(api.channels.leave, { channelId: channelId! })).rejects.toThrow(
        "owner cannot leave"
      );
    });

    it("should throw error for non-member trying to leave", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
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
          name: "public-channel",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(asUser.mutation(api.channels.leave, { channelId: channelId! })).rejects.toThrow(
        "not a member"
      );
    });
  });

  describe("channels.markAllAsRead mutation", () => {
    it("should mark all channels as read", async () => {
      const t = convexTest(schema);

      let membership1Id: Id<"channelMembers">;
      let membership2Id: Id<"channelMembers">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const channel1Id = await ctx.db.insert("channels", {
          name: "channel-1",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const channel2Id = await ctx.db.insert("channels", {
          name: "channel-2",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        membership1Id = await ctx.db.insert("channelMembers", {
          channelId: channel1Id,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        membership2Id = await ctx.db.insert("channelMembers", {
          channelId: channel2Id,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });
      const beforeTime = Date.now();

      // Act
      await asUser.mutation(api.channels.markAllAsRead, {});

      // Assert
      await t.run(async (ctx) => {
        const membership1 = await ctx.db.get(membership1Id);
        const membership2 = await ctx.db.get(membership2Id);

        expect(membership1?.lastReadAt).toBeGreaterThanOrEqual(beforeTime);
        expect(membership2?.lastReadAt).toBeGreaterThanOrEqual(beforeTime);
      });
    });

    it("should not update banned or left memberships", async () => {
      const t = convexTest(schema);

      let bannedMembershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "channel-1",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        bannedMembershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: true,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.channels.markAllAsRead, {});

      // Assert
      await t.run(async (ctx) => {
        const bannedMembership = await ctx.db.get(bannedMembershipId);
        expect(bannedMembership?.lastReadAt).toBeUndefined();
      });
    });
  });

  describe("channels.toggleFavorite mutation", () => {
    it("should set isFavorite to true when false", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let membershipId: Id<"channelMembers">;

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
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
          isFavorite: false, // Initially not favorite
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      const newState = await asUser.mutation(api.channels.toggleFavorite, {
        channelId: channelId!,
      });

      // Assert
      expect(newState).toBe(true);

      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.isFavorite).toBe(true);
      });
    });

    it("should set isFavorite to false when true", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let membershipId: Id<"channelMembers">;

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
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
          isFavorite: true, // Initially favorite
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      const newState = await asUser.mutation(api.channels.toggleFavorite, {
        channelId: channelId!,
      });

      // Assert
      expect(newState).toBe(false);

      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.isFavorite).toBe(false);
      });
    });

    it("should throw error for non-members", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "non-member-clerk",
          email: "nonmember@example.com",
          name: "Non Member",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
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

      const asNonMember = t.withIdentity({ subject: "non-member-clerk" });

      // Act & Assert
      await expect(
        asNonMember.mutation(api.channels.toggleFavorite, {
          channelId: channelId!,
        })
      ).rejects.toThrow("not a member");
    });

    it("should throw error for banned users", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "banned-clerk",
          email: "banned@example.com",
          name: "Banned User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: true, // User is banned
        });
      });

      const asBannedUser = t.withIdentity({ subject: "banned-clerk" });

      // Act & Assert
      await expect(
        asBannedUser.mutation(api.channels.toggleFavorite, {
          channelId: channelId!,
        })
      ).rejects.toThrow("banned");
    });
  });
});
