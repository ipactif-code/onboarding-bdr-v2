import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("channels.ts - Channel Management", () => {
  describe("channels.list query", () => {
    it("should return empty array when no channels exist", async () => {
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

        // Act
        const channels = await t.query(api.channels.list, {});

        // Assert
        expect(channels).toEqual([]);
      });
    });

    it("should return public channels the user has access to", async () => {
      const t = convexTest(schema);

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

        // Act
        const channels = await t.query(api.channels.list, {});

        // Assert
        expect(channels).toHaveLength(1);
        expect(channels[0].name).toBe("general");
        expect(channels[0].type).toBe("public");
        expect(channels[0].membership).not.toBeNull();
        expect(channels[0].membership?.role).toBe("owner");
      });
    });

    it("should filter channels by type when specified", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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

        // Act
        const publicChannels = await t.query(api.channels.list, { type: "public" });

        // Assert
        expect(publicChannels).toHaveLength(1);
        expect(publicChannels[0].type).toBe("public");
      });
    });

    it("should exclude archived channels by default", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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

        // Act
        const channels = await t.query(api.channels.list, {});

        // Assert
        expect(channels).toHaveLength(0);
      });
    });

    it("should include archived channels when requested", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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

        // Act
        const channels = await t.query(api.channels.list, { includeArchived: true });

        // Assert
        expect(channels).toHaveLength(1);
        expect(channels[0].isArchived).toBe(true);
      });
    });

    it("should calculate unread count correctly", async () => {
      const t = convexTest(schema);

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

        const lastReadAt = Date.now() - 10000; // 10 seconds ago
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
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
          createdAt: Date.now() - 5000,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "New message 2",
          createdAt: Date.now(),
        });

        // Act
        const channels = await t.query(api.channels.list, {});

        // Assert
        expect(channels).toHaveLength(1);
        expect(channels[0].membership?.unreadCount).toBe(2);
      });
    });

    it("should not count deleted messages in unread count", async () => {
      const t = convexTest(schema);

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

        const lastReadAt = Date.now() - 10000;
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
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
          createdAt: Date.now() - 5000,
        });

        // Add deleted message
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted message",
          createdAt: Date.now(),
          deletedAt: Date.now(),
        });

        // Act
        const channels = await t.query(api.channels.list, {});

        // Assert
        expect(channels[0].membership?.unreadCount).toBe(1); // Only the regular message
      });
    });

    it("should sort channels by lastMessageAt descending", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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

        // Act
        const channels = await t.query(api.channels.list, {});

        // Assert
        expect(channels).toHaveLength(2);
        expect(channels[0].name).toBe("channel-2"); // Most recent first
        expect(channels[1].name).toBe("channel-1");
      });
    });
  });

  describe("channels.get query", () => {
    it("should return null for non-existent channel", async () => {
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

        const fakeChannelId = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"channels">;

        // Act
        const channel = await t.query(api.channels.get, { channelId: fakeChannelId });

        // Assert
        expect(channel).toBeNull();
      });
    });

    it("should return channel with membership for member", async () => {
      const t = convexTest(schema);

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

        // Act
        const channel = await t.query(api.channels.get, { channelId });

        // Assert
        expect(channel).not.toBeNull();
        expect(channel?.name).toBe("general");
        expect(channel?.description).toBe("General discussion");
        expect(channel?.membership).not.toBeNull();
        expect(channel?.membership?.role).toBe("owner");
      });
    });

    it("should return null for private channel without access", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "Regular User",
          role: "user",
          status: "online",
        });

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

        // Act - query as user (not a member)
        const channel = await t.query(api.channels.get, { channelId });

        // Assert
        expect(channel).toBeNull();
      });
    });
  });

  describe("channels.create mutation", () => {
    it("should create a public channel as admin", async () => {
      const t = convexTest(schema);

      // Act & Assert
      const channelId = await t.mutation(api.channels.create, {
        name: "new-channel",
        description: "A new channel",
        type: "public",
      });

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
        // Override auth to return regular user
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "Regular User",
          role: "user",
          status: "online",
        });
      });

      // Act & Assert
      await expect(
        t.mutation(api.channels.create, {
          name: "unauthorized-channel",
          type: "public",
        })
      ).rejects.toThrow();
    });

    it("should validate name length (min 2 chars)", async () => {
      const t = convexTest(schema);

      // Act & Assert
      await expect(
        t.mutation(api.channels.create, {
          name: "a", // Too short
          type: "public",
        })
      ).rejects.toThrow("at least 2 characters");
    });

    it("should validate name length (max 80 chars)", async () => {
      const t = convexTest(schema);

      // Act & Assert
      await expect(
        t.mutation(api.channels.create, {
          name: "a".repeat(81), // Too long
          type: "public",
        })
      ).rejects.toThrow("at most 80 characters");
    });

    it("should validate name format (alphanumeric, hyphens, underscores)", async () => {
      const t = convexTest(schema);

      // Act & Assert
      await expect(
        t.mutation(api.channels.create, {
          name: "invalid channel!", // Contains space and special char
          type: "public",
        })
      ).rejects.toThrow("only contain letters");
    });

    it("should prevent duplicate channel names", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.mutation(api.channels.create, {
        name: "duplicate-channel",
        type: "public",
      });

      // Act & Assert
      await expect(
        t.mutation(api.channels.create, {
          name: "duplicate-channel",
          type: "public",
        })
      ).rejects.toThrow("already exists");
    });
  });

  describe("channels.join mutation", () => {
    it("should allow joining a public channel", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
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

        // Act
        await t.mutation(api.channels.join, { channelId });

        // Assert
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

      await t.run(async (ctx) => {
        // Arrange
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "private-channel",
          type: "private",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Act & Assert
        await expect(t.mutation(api.channels.join, { channelId })).rejects.toThrow(
          "private channel"
        );
      });
    });

    it("should prevent joining archived channel", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "archived-channel",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: adminId,
          memberCount: 1,
        });

        // Act & Assert
        await expect(t.mutation(api.channels.join, { channelId })).rejects.toThrow(
          "archived"
        );
      });
    });

    it("should prevent banned users from joining", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
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

        // Act & Assert
        await expect(t.mutation(api.channels.join, { channelId })).rejects.toThrow(
          "banned"
        );
      });
    });

    it("should allow rejoining after leaving", async () => {
      const t = convexTest(schema);

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
          name: "public-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        // Create left membership
        const membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now() - 10000,
          leftAt: Date.now() - 5000,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Act
        await t.mutation(api.channels.join, { channelId });

        // Assert
        const membership = await ctx.db.get(membershipId);
        expect(membership?.leftAt).toBeUndefined(); // Left timestamp cleared
        expect(membership?.joinedAt).toBeGreaterThan(Date.now() - 1000); // New join time
      });
    });
  });

  describe("channels.leave mutation", () => {
    it("should allow member to leave channel", async () => {
      const t = convexTest(schema);

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
          name: "public-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Act
        await t.mutation(api.channels.leave, { channelId });

        // Assert
        const membership = await ctx.db.get(membershipId);
        expect(membership?.leftAt).toBeDefined();
        expect(membership?.leftAt).toBeGreaterThan(0);

        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(0);
      });
    });

    it("should prevent owner from leaving without transferring ownership", async () => {
      const t = convexTest(schema);

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

        // Act & Assert
        await expect(t.mutation(api.channels.leave, { channelId })).rejects.toThrow(
          "owner cannot leave"
        );
      });
    });

    it("should throw error for non-member trying to leave", async () => {
      const t = convexTest(schema);

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

        const channelId = await ctx.db.insert("channels", {
          name: "public-channel",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Act & Assert
        await expect(t.mutation(api.channels.leave, { channelId })).rejects.toThrow(
          "not a member"
        );
      });
    });
  });

  describe("channels.markAllAsRead mutation", () => {
    it("should mark all channels as read", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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

        const membership1Id = await ctx.db.insert("channelMembers", {
          channelId: channel1Id,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const membership2Id = await ctx.db.insert("channelMembers", {
          channelId: channel2Id,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const beforeTime = Date.now();

        // Act
        await t.mutation(api.channels.markAllAsRead, {});

        // Assert
        const membership1 = await ctx.db.get(membership1Id);
        const membership2 = await ctx.db.get(membership2Id);

        expect(membership1?.lastReadAt).toBeGreaterThanOrEqual(beforeTime);
        expect(membership2?.lastReadAt).toBeGreaterThanOrEqual(beforeTime);
      });
    });

    it("should not update banned or left memberships", async () => {
      const t = convexTest(schema);

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
          name: "channel-1",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const bannedMembershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: true,
        });

        // Act
        await t.mutation(api.channels.markAllAsRead, {});

        // Assert
        const bannedMembership = await ctx.db.get(bannedMembershipId);
        expect(bannedMembership?.lastReadAt).toBeUndefined();
      });
    });
  });
});
