import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("channels/mutations.ts - Channel Mutations", () => {
  describe("channels.update mutation", () => {
    it("should allow owner to update channel name", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange - Setup database
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "original-name",
          description: "Original description",
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

      const asOwner = t.withIdentity({ subject: "owner-clerk" });

      // Act
      await asOwner.mutation(api.channels.update, {
        channelId: channelId!,
        name: "updated-name",
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.name).toBe("updated-name");
        expect(channel?.description).toBe("Original description"); // Unchanged
      });
    });

    it("should allow admin to update channel description", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "user",
          status: "online",
        });

        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Channel Admin",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          description: "Original description",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: adminId,
          role: "admin",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act
      await asAdmin.mutation(api.channels.update, {
        channelId: channelId!,
        description: "Updated description by admin",
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.description).toBe("Updated description by admin");
      });
    });

    it("should allow channel admin to update channel topic", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "user",
          status: "online",
        });

        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Channel Admin",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: adminId,
          role: "admin",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act
      await asAdmin.mutation(api.channels.update, {
        channelId: channelId!,
        topic: "New topic by channel admin",
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.topic).toBe("New topic by channel admin");
      });
    });

    it("should prevent regular member from updating channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "user",
          status: "online",
        });

        const memberId = await ctx.db.insert("users", {
          clerkId: "member-clerk",
          email: "member@example.com",
          name: "Regular Member",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: memberId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asMember = t.withIdentity({ subject: "member-clerk" });

      // Act & Assert
      await expect(
        asMember.mutation(api.channels.update, {
          channelId: channelId!,
          name: "unauthorized-update",
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should prevent non-member from updating channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "outsider-clerk",
          email: "outsider@example.com",
          name: "Outsider",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asOutsider = t.withIdentity({ subject: "outsider-clerk" });

      // Act & Assert
      await expect(
        asOutsider.mutation(api.channels.update, {
          channelId: channelId!,
          name: "unauthorized-update",
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should enforce name validation with alphanumeric regex", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
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

      const asOwner = t.withIdentity({ subject: "owner-clerk" });

      // Act & Assert - invalid characters (spaces, special chars)
      await expect(
        asOwner.mutation(api.channels.update, {
          channelId: channelId!,
          name: "invalid name with spaces",
        })
      ).rejects.toThrow("can only contain letters, numbers, hyphens, and underscores");

      await expect(
        asOwner.mutation(api.channels.update, {
          channelId: channelId!,
          name: "invalid@channel!",
        })
      ).rejects.toThrow("can only contain letters, numbers, hyphens, and underscores");

      // Valid names should work
      await asOwner.mutation(api.channels.update, {
        channelId: channelId!,
        name: "valid-channel_name123",
      });

      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.name).toBe("valid-channel_name123");
      });
    });

    it("should enforce name length limits (2-80 chars)", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
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

      const asOwner = t.withIdentity({ subject: "owner-clerk" });

      // Act & Assert - too short
      await expect(
        asOwner.mutation(api.channels.update, {
          channelId: channelId!,
          name: "a",
        })
      ).rejects.toThrow("at least 2 characters");

      // Act & Assert - too long
      await expect(
        asOwner.mutation(api.channels.update, {
          channelId: channelId!,
          name: "a".repeat(81),
        })
      ).rejects.toThrow("at most 80 characters");
    });

    it("should allow global admin to update any channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "global-admin-clerk",
          email: "admin@example.com",
          name: "Global Admin",
          role: "admin",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
        // Note: global admin is NOT a member
      });

      const asGlobalAdmin = t.withIdentity({ subject: "global-admin-clerk" });

      // Act
      await asGlobalAdmin.mutation(api.channels.update, {
        channelId: channelId!,
        name: "updated-by-global-admin",
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.name).toBe("updated-by-global-admin");
      });
    });
  });

  describe("channels.archive mutation", () => {
    it("should allow owner to archive channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;
      let userId: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
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

      const asOwner = t.withIdentity({ subject: "owner-clerk" });
      const beforeTime = Date.now();

      // Act
      await asOwner.mutation(api.channels.archive, {
        channelId: channelId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.isArchived).toBe(true);
        expect(channel?.archivedAt).toBeGreaterThanOrEqual(beforeTime);
        expect(channel?.archivedBy).toEqual(userId);
      });
    });

    it("should allow global admin to archive channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Global Admin",
          role: "admin", // Must be global admin
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asGlobalAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act - Global admin (not channel member) can archive
      await asGlobalAdmin.mutation(api.channels.archive, {
        channelId: channelId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.isArchived).toBe(true);
      });
    });

    it("should prevent moderator from archiving channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
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

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: modId,
          role: "moderator",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asMod = t.withIdentity({ subject: "mod-clerk" });

      // Act & Assert
      await expect(
        asMod.mutation(api.channels.archive, {
          channelId: channelId!,
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should prevent regular member from archiving channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "user",
          status: "online",
        });

        const memberId = await ctx.db.insert("users", {
          clerkId: "member-clerk",
          email: "member@example.com",
          name: "Regular Member",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: memberId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asMember = t.withIdentity({ subject: "member-clerk" });

      // Act & Assert
      await expect(
        asMember.mutation(api.channels.archive, {
          channelId: channelId!,
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should handle already archived channel gracefully", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange - Channel already archived
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
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

      const asOwner = t.withIdentity({ subject: "owner-clerk" });

      // Act & Assert
      await expect(
        asOwner.mutation(api.channels.archive, {
          channelId: channelId!,
        })
      ).rejects.toThrow("already archived");
    });
  });

  describe("channels.unarchive mutation", () => {
    it("should allow owner to unarchive channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange - Archived channel
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "admin", // Note: unarchive requires global admin
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
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

      const asAdmin = t.withIdentity({ subject: "owner-clerk" });

      // Act
      await asAdmin.mutation(api.channels.unarchive, {
        channelId: channelId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.isArchived).toBe(false);
        expect(channel?.archivedAt).toBeUndefined();
        expect(channel?.archivedBy).toBeUndefined();
      });
    });

    it("should allow admin to unarchive channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Global Admin",
          role: "admin",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: ownerId,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asGlobalAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act
      await asGlobalAdmin.mutation(api.channels.unarchive, {
        channelId: channelId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.isArchived).toBe(false);
      });
    });

    it("should prevent moderator from unarchiving channel", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Channel Owner",
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

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: ownerId,
          memberCount: 2,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: modId,
          role: "moderator",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asMod = t.withIdentity({ subject: "mod-clerk" });

      // Act & Assert
      await expect(
        asMod.mutation(api.channels.unarchive, {
          channelId: channelId!,
        })
      ).rejects.toThrow();
    });

    it("should handle non-archived channel gracefully", async () => {
      const t = convexTest(schema);

      let channelId: Id<"channels">;

      // Arrange - Non-archived channel
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Global Admin",
          role: "admin",
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

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act & Assert
      await expect(
        asAdmin.mutation(api.channels.unarchive, {
          channelId: channelId!,
        })
      ).rejects.toThrow("not archived");
    });
  });
});
