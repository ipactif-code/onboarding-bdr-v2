import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import * as apiModule from "../../../convex/_generated/api";
// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;
import schema from "../../../convex/schema";
import { Id, Doc } from "../../../convex/_generated/dataModel";

describe("pins.ts - Message Pins (FR-018)", () => {
  describe("pins.pinMessage mutation", () => {
    it("should allow channel admin to pin any message", async () => {
      const t = convexTest(schema);

      let adminId: Id<"users">;
      let channelId: Id<"channels">;
      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - Create admin user
        adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk-123",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          status: "online",
        });

        // Create channel
        channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Add admin as channel admin
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: adminId,
          role: "admin",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Create message
        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: adminId,
          content: "Important message",
          createdAt: Date.now(),
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk-123" });

      // Act - Admin pins message
      const pinId = await asAdmin.mutation(api.pins.pinMessage, {
        channelId: channelId!,
        messageId: messageId!,
      });

      // Assert - Verify pin was created
      await t.run(async (ctx) => {
        const pin = await ctx.db.get(pinId) as Doc<"pins"> | null;
        expect(pin).toBeDefined();
        expect(pin?.messageId).toEqual(messageId);
        expect(pin?.channelId).toEqual(channelId);
        expect(pin?.pinnedBy).toEqual(adminId);
        expect(pin?.pinnedAt).toBeDefined();
      });
    });

    it("should allow message creator to pin their own message", async () => {
      const t = convexTest(schema);

      let userId: Id<"users">;
      let channelId: Id<"channels">;
      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange - Create regular user
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
          email: "user@example.com",
          name: "Regular User",
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

        // Create message by this user
        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "My message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act - User pins their own message
      const pinId = await asUser.mutation(api.pins.pinMessage, {
        channelId: channelId!,
        messageId: messageId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const pin = await ctx.db.get(pinId) as Doc<"pins"> | null;
        expect(pin).toBeDefined();
        expect(pin?.pinnedBy).toEqual(userId);
      });
    });

    it("should prevent regular member from pinning other's messages", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
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

        await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        // Both are regular members
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: user1Id,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const user2MemberId = await ctx.db.insert("channelMembers", {
          channelId,
          userId: user1Id,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Patch to use user2's ID
        await ctx.db.patch(user2MemberId, {
          userId: await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("clerkId"), "user2-clerk"))
            .first()
            .then((u) => u!._id),
        });

        // User1 creates a message
        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: user1Id,
          content: "User 1's message",
          createdAt: Date.now(),
        });
      });

      const asUser2 = t.withIdentity({ subject: "user2-clerk" });

      // Act & Assert - User2 tries to pin User1's message
      await expect(
        asUser2.mutation(api.pins.pinMessage, {
          channelId: channelId!,
          messageId: messageId!,
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should be idempotent - returns existing pin ID if already pinned", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
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
          content: "Message to pin",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act - Pin twice
      const pinId1 = await asUser.mutation(api.pins.pinMessage, {
        channelId: channelId!,
        messageId: messageId!,
      });

      const pinId2 = await asUser.mutation(api.pins.pinMessage, {
        channelId: channelId!,
        messageId: messageId!,
      });

      // Assert - Same pin ID returned
      expect(pinId1).toEqual(pinId2);

      // Verify only one pin exists
      await t.run(async (ctx) => {
        const pins = await ctx.db
          .query("pins")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .collect();
        expect(pins).toHaveLength(1);
      });
    });

    it("should prevent pinning in archived channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
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

        channelId = await ctx.db.insert("channels", {
          name: "archived",
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

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Message in archived channel",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.pins.pinMessage, {
          channelId: channelId!,
          messageId: messageId!,
        })
      ).rejects.toThrow("archived channel");
    });

    it("should prevent pinning deleted message", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
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
          content: "Deleted message",
          createdAt: Date.now(),
          deletedAt: Date.now(),
          deletedBy: userId,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.pins.pinMessage, {
          channelId: channelId!,
          messageId: messageId!,
        })
      ).rejects.toThrow("deleted message");
    });

    it("should throw error for non-existent channel", async () => {
      const t = convexTest(schema);

      let messageId: Id<"messages">;
      let fakeChannelId: Id<"channels">;

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
          name: "temp",
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

        // Store channel ID then delete it
        fakeChannelId = channelId;
        await ctx.db.delete(channelId);
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.pins.pinMessage, {
          channelId: fakeChannelId!,
          messageId: messageId!,
        })
      ).rejects.toThrow("Channel not found");
    });

    it("should throw error for non-existent message", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let fakeMessageId: Id<"messages">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Create and delete message to get non-existent ID
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
        asUser.mutation(api.pins.pinMessage, {
          channelId: channelId!,
          messageId: fakeMessageId!,
        })
      ).rejects.toThrow("Message not found");
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let messageId: Id<"messages">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
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

        messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Message",
          createdAt: Date.now(),
        });
      });

      // Act & Assert - No identity (unauthenticated)
      await expect(
        t.mutation(api.pins.pinMessage, {
          channelId: channelId!,
          messageId: messageId!,
        })
      ).rejects.toThrow();
    });
  });

  describe("pins.unpinMessage mutation", () => {
    it("should allow pin creator to unpin message", async () => {
      const t = convexTest(schema);

      let pinId: Id<"pins">;

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
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Pinned message",
          createdAt: Date.now(),
        });

        // Create pin
        pinId = await ctx.db.insert("pins", {
          channelId,
          messageId,
          pinnedBy: userId,
          pinnedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act - Unpin
      await asUser.mutation(api.pins.unpinMessage, { pinId: pinId! });

      // Assert - Pin deleted
      await t.run(async (ctx) => {
        const pin = await ctx.db.get(pinId);
        expect(pin).toBeNull();
      });
    });

    it("should allow channel admin to unpin any message", async () => {
      const t = convexTest(schema);

      let pinId: Id<"pins">;
      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange - Two users: regular user pins, admin unpins
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        // Admin is channel admin
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: adminId,
          role: "admin",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // User is regular member
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "User's pinned message",
          createdAt: Date.now(),
        });

        // User creates pin
        pinId = await ctx.db.insert("pins", {
          channelId,
          messageId,
          pinnedBy: userId,
          pinnedAt: Date.now(),
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act - Admin unpins user's pin
      await asAdmin.mutation(api.pins.unpinMessage, { pinId: pinId! });

      // Assert
      await t.run(async (ctx) => {
        const pin = await ctx.db.get(pinId);
        expect(pin).toBeNull();
      });
    });

    it("should prevent non-authorized user from unpinning", async () => {
      const t = convexTest(schema);

      let pinId: Id<"pins">;

      await t.run(async (ctx) => {
        // Arrange - User1 pins, User2 tries to unpin
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
          content: "Pinned by user1",
          createdAt: Date.now(),
        });

        pinId = await ctx.db.insert("pins", {
          channelId,
          messageId,
          pinnedBy: user1Id,
          pinnedAt: Date.now(),
        });
      });

      const asUser2 = t.withIdentity({ subject: "user2-clerk" });

      // Act & Assert
      await expect(
        asUser2.mutation(api.pins.unpinMessage, { pinId: pinId! })
      ).rejects.toThrow("Forbidden");
    });

    it("should throw error for non-existent pin", async () => {
      const t = convexTest(schema);

      let fakePinId: Id<"pins">;

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

        // Create and delete pin
        fakePinId = await ctx.db.insert("pins", {
          channelId,
          messageId,
          pinnedBy: userId,
          pinnedAt: Date.now(),
        });
        await ctx.db.delete(fakePinId);
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.mutation(api.pins.unpinMessage, { pinId: fakePinId! })
      ).rejects.toThrow("Pin not found");
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      let pinId: Id<"pins">;

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

        pinId = await ctx.db.insert("pins", {
          channelId,
          messageId,
          pinnedBy: userId,
          pinnedAt: Date.now(),
        });
      });

      // Act & Assert - No identity
      await expect(
        t.mutation(api.pins.unpinMessage, { pinId: pinId! })
      ).rejects.toThrow();
    });
  });

  describe("pins.listByChannel query", () => {
    it("should return empty array for channel with no pins", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const pins = await asUser.query(api.pins.listByChannel, {
        channelId: channelId!,
      });

      // Assert
      expect(pins).toEqual([]);
    });

    it("should return pins sorted by pinnedAt descending (newest first)", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let pin1Id!: Id<"pins">;
      let pin2Id!: Id<"pins">;
      let pin3Id!: Id<"pins">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Create 3 messages and pin them at different times
        const msg1Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "First pin",
          createdAt: Date.now() - 3000,
        });

        const msg2Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Second pin",
          createdAt: Date.now() - 2000,
        });

        const msg3Id = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Third pin",
          createdAt: Date.now() - 1000,
        });

        pin1Id = await ctx.db.insert("pins", {
          channelId,
          messageId: msg1Id,
          pinnedBy: userId,
          pinnedAt: Date.now() - 3000,
        });

        pin2Id = await ctx.db.insert("pins", {
          channelId,
          messageId: msg2Id,
          pinnedBy: userId,
          pinnedAt: Date.now() - 2000,
        });

        pin3Id = await ctx.db.insert("pins", {
          channelId,
          messageId: msg3Id,
          pinnedBy: userId,
          pinnedAt: Date.now() - 1000,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const pins = await asUser.query(api.pins.listByChannel, {
        channelId: channelId!,
      });

      // Assert - Newest first
      expect(pins).toHaveLength(3);
      expect(pins[0]!._id).toEqual(pin3Id);
      expect(pins[1]!._id).toEqual(pin2Id);
      expect(pins[2]!._id).toEqual(pin1Id);
    });

    it("should enrich pins with message and sender details", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        // Arrange
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
          email: "user@example.com",
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

        const messageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Important announcement",
          contentType: "text",
          createdAt: Date.now(),
        });

        await ctx.db.insert("pins", {
          channelId,
          messageId,
          pinnedBy: userId,
          pinnedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const pins = await asUser.query(api.pins.listByChannel, {
        channelId: channelId!,
      });

      // Assert
      expect(pins).toHaveLength(1);
      expect(pins[0]!.message).toBeDefined();
      expect(pins[0]!.message?.content).toBe("Important announcement");
      expect(pins[0]!.message?.sender).toBeDefined();
      expect(pins[0]!.message?.sender?.name).toBe("Test User");
      expect(pins[0]!.pinnedByUser).toBeDefined();
      expect(pins[0]!.pinnedByUser?.name).toBe("Test User");
    });

    it("should filter out deleted messages from pin list", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
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
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Create active message
        const activeMessageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Active message",
          createdAt: Date.now(),
        });

        // Create deleted message
        const deletedMessageId = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Deleted message",
          createdAt: Date.now(),
          deletedAt: Date.now(),
          deletedBy: userId,
        });

        // Pin both
        await ctx.db.insert("pins", {
          channelId,
          messageId: activeMessageId,
          pinnedBy: userId,
          pinnedAt: Date.now() - 1000,
        });

        await ctx.db.insert("pins", {
          channelId,
          messageId: deletedMessageId,
          pinnedBy: userId,
          pinnedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const pins = await asUser.query(api.pins.listByChannel, {
        channelId: channelId!,
      });

      // Assert - Pin for deleted message should have null message
      expect(pins).toHaveLength(2);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deletedPin = pins.find((p: any) => p.message === null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activePin = pins.find((p: any) => p.message !== null);
      expect(deletedPin).toBeDefined();
      expect(activePin).toBeDefined();
      expect(activePin?.message?.content).toBe("Active message");
    });

    it("should throw error for non-existent channel", async () => {
      const t = convexTest(schema);

      let fakeChannelId: Id<"channels">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-123",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        fakeChannelId = await ctx.db.insert("channels", {
          name: "temp",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });
        await ctx.db.delete(fakeChannelId);
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act & Assert
      await expect(
        asUser.query(api.pins.listByChannel, { channelId: fakeChannelId! })
      ).rejects.toThrow("Channel not found");
    });

    it("should require authentication", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
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
      });

      // Act & Assert
      await expect(
        t.query(api.pins.listByChannel, { channelId: channelId! })
      ).rejects.toThrow();
    });
  });

  describe("pins.getByMessage query", () => {
    it("should return pin if message is pinned", async () => {
      const t = convexTest(schema);

      let messageId!: Id<"messages">;
      let pinId!: Id<"pins">;

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
          content: "Pinned message",
          createdAt: Date.now(),
        });

        pinId = await ctx.db.insert("pins", {
          channelId,
          messageId,
          pinnedBy: userId,
          pinnedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const pin = await asUser.query(api.pins.getByMessage, {
        messageId,
      });

      // Assert
      expect(pin).toBeDefined();
      expect(pin?._id).toEqual(pinId);
      expect(pin?.messageId).toEqual(messageId);
    });

    it("should return null if message is not pinned", async () => {
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
          content: "Not pinned",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk-123" });

      // Act
      const pin = await asUser.query(api.pins.getByMessage, {
        messageId: messageId!,
      });

      // Assert
      expect(pin).toBeNull();
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
        t.query(api.pins.getByMessage, { messageId: messageId! })
      ).rejects.toThrow();
    });
  });
});
