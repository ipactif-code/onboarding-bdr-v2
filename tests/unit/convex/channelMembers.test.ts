import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

// Workaround for TS2589: Type instantiation is excessively deep and possibly infinite
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;

describe("channels.ts - Member Management", () => {
  describe("getMembers query", () => {
    it("should return all active members of a channel", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let user1Id!: Id<"users">;
      let user2Id!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "Alice",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "Bob",
          role: "user",
          status: "offline",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: user1Id,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        // Add both as active members
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
      });

      const asUser = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const members = await asUser.query(api.channels.getMembers, {
        channelId: channelId!,
      });

      // Assert
      expect(members).toHaveLength(2);
      expect(members[0]!.userName).toBe("Alice");
      expect(members[0]!.role).toBe("owner");
      expect(members[1]!.userName).toBe("Bob");
      expect(members[1]!.role).toBe("member");
    });

    it("should exclude members who have left (leftAt set)", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "Alice",
          role: "user",
          status: "online",
        });

        const user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "Bob (Left)",
          role: "user",
          status: "offline",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
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

        // User2 has left
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: user2Id,
          role: "member",
          joinedAt: Date.now() - 10000,
          leftAt: Date.now() - 5000,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asUser = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const members = await asUser.query(api.channels.getMembers, {
        channelId: channelId!,
      });

      // Assert - Only active members returned
      expect(members).toHaveLength(1);
      expect(members[0]!.userName).toBe("Alice");
    });

    it("should exclude banned members (isBanned=true)", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "Alice",
          role: "user",
          status: "online",
        });

        const user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "Banned User",
          role: "user",
          status: "offline",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
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

        // User2 is banned
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: user2Id,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: true,
        });
      });

      const asUser = t.withIdentity({ subject: "user1-clerk" });

      // Act
      const members = await asUser.query(api.channels.getMembers, {
        channelId: channelId!,
      });

      // Assert
      expect(members).toHaveLength(1);
      expect(members[0]!.userName).toBe("Alice");
    });

    it("should return empty array for non-existent channel", async () => {
      const t = convexTest(schema);

      let nonExistentChannelId!: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        // Create and delete channel to get valid ID
        nonExistentChannelId = await ctx.db.insert("channels", {
          name: "temp-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        await ctx.db.delete(nonExistentChannelId);
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.query(api.channels.getMembers, {
          channelId: nonExistentChannelId!,
        })
      ).rejects.toThrow();
    });

    it("should throw error for user without channel access (private channel)", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;

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
          clerkId: "outsider-clerk",
          email: "outsider@example.com",
          name: "Outsider",
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

      const asOutsider = t.withIdentity({ subject: "outsider-clerk" });

      // Act & Assert
      await expect(
        asOutsider.query(api.channels.getMembers, { channelId: channelId! })
      ).rejects.toThrow("Forbidden");
    });

    it("should include user info (name, email, avatar, status)", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "Test User",
          avatarUrl: "https://example.com/avatar.jpg",
          role: "user",
          status: "away",
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

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const members = await asUser.query(api.channels.getMembers, {
        channelId: channelId!,
      });

      // Assert
      expect(members).toHaveLength(1);
      expect(members[0]!.userName).toBe("Test User");
      expect(members[0]!.userEmail).toBe("user@example.com");
      expect(members[0]!.userAvatarUrl).toBe("https://example.com/avatar.jpg");
      expect(members[0]!.userStatus).toBe("away");
    });

    it("should sort by role hierarchy then name", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Zoe (Owner)",
          role: "user",
          status: "online",
        });

        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Bob (Admin)",
          role: "user",
          status: "online",
        });

        const modId = await ctx.db.insert("users", {
          clerkId: "mod-clerk",
          email: "mod@example.com",
          name: "Alice (Mod)",
          role: "user",
          status: "online",
        });

        const memberId = await ctx.db.insert("users", {
          clerkId: "member-clerk",
          email: "member@example.com",
          name: "Charlie (Member)",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 4,
        });

        // Insert in random order
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: memberId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
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

      const asOwner = t.withIdentity({ subject: "owner-clerk" });

      // Act
      const members = await asOwner.query(api.channels.getMembers, {
        channelId: channelId!,
      });

      // Assert - Sorted by role (owner, admin, moderator, member), then name
      expect(members).toHaveLength(4);
      expect(members[0]!.role).toBe("owner");
      expect(members[0]!.userName).toBe("Zoe (Owner)");
      expect(members[1]!.role).toBe("admin");
      expect(members[1]!.userName).toBe("Bob (Admin)");
      expect(members[2]!.role).toBe("moderator");
      expect(members[2]!.userName).toBe("Alice (Mod)");
      expect(members[3]!.role).toBe("member");
      expect(members[3]!.userName).toBe("Charlie (Member)");
    });
  });

  describe("addMembers mutation", () => {
    it("should add new users as members with 'member' role", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let newUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        newUserId = await ctx.db.insert("users", {
          clerkId: "newuser-clerk",
          email: "newuser@example.com",
          name: "New User",
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

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act
      const result = await asAdmin.mutation(api.channels.addMembers, {
        channelId: channelId!,
        userIds: [newUserId!],
      });

      // Assert
      expect(result.added).toBe(1);
      expect(result.alreadyMembers).toBe(0);

      await t.run(async (ctx) => {
        const membership = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) =>
            q.eq("channelId", channelId).eq("userId", newUserId)
          )
          .unique();

        expect(membership).toBeDefined();
        expect(membership?.role).toBe("member");
        expect(membership?.leftAt).toBeUndefined();
      });
    });

    it("should return correct counts { added, alreadyMembers }", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let existingMemberId!: Id<"users">;
      let newUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        existingMemberId = await ctx.db.insert("users", {
          clerkId: "existing-clerk",
          email: "existing@example.com",
          name: "Existing Member",
          role: "user",
          status: "online",
        });

        newUserId = await ctx.db.insert("users", {
          clerkId: "new-clerk",
          email: "new@example.com",
          name: "New User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
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

        // Existing member
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: existingMemberId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act - Try to add 1 existing and 1 new user
      const result = await asAdmin.mutation(api.channels.addMembers, {
        channelId: channelId!,
        userIds: [existingMemberId!, newUserId!],
      });

      // Assert
      expect(result.added).toBe(1); // Only new user
      expect(result.alreadyMembers).toBe(1); // Existing member
    });

    it("should rejoin users who previously left (clear leftAt, update joinedAt)", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let userId!: Id<"users">;
      let membershipId!: Id<"channelMembers">;

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

        // User previously left
        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now() - 20000,
          leftAt: Date.now() - 10000,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });
      const beforeRejoin = Date.now();

      // Act
      const result = await asAdmin.mutation(api.channels.addMembers, {
        channelId: channelId!,
        userIds: [userId!],
      });

      // Assert
      expect(result.added).toBe(1);
      expect(result.alreadyMembers).toBe(0);

      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.leftAt).toBeUndefined(); // Cleared
        expect(membership?.joinedAt).toBeGreaterThanOrEqual(beforeRejoin); // Updated
      });
    });

    it("should skip users who are already active members", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let memberId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        memberId = await ctx.db.insert("users", {
          clerkId: "member-clerk",
          email: "member@example.com",
          name: "Member",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
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

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act
      const result = await asAdmin.mutation(api.channels.addMembers, {
        channelId: channelId!,
        userIds: [memberId!],
      });

      // Assert
      expect(result.added).toBe(0);
      expect(result.alreadyMembers).toBe(1);
    });

    it("should skip banned users (cannot re-add)", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let bannedUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        bannedUserId = await ctx.db.insert("users", {
          clerkId: "banned-clerk",
          email: "banned@example.com",
          name: "Banned User",
          role: "user",
          status: "offline",
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

        // Banned user
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: bannedUserId,
          role: "member",
          joinedAt: Date.now() - 10000,
          leftAt: Date.now() - 5000,
          notificationLevel: "all",
          isMuted: false,
          isBanned: true,
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act
      const result = await asAdmin.mutation(api.channels.addMembers, {
        channelId: channelId!,
        userIds: [bannedUserId!],
      });

      // Assert - Banned user not added
      expect(result.added).toBe(0);
      expect(result.alreadyMembers).toBe(0);
    });

    it("should update channel memberCount", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let newUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        newUserId = await ctx.db.insert("users", {
          clerkId: "new-clerk",
          email: "new@example.com",
          name: "New User",
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

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act
      await asAdmin.mutation(api.channels.addMembers, {
        channelId: channelId!,
        userIds: [newUserId!],
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(2);
      });
    });

    it("should throw error if caller is not admin/owner", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let newUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        const regularUserId = await ctx.db.insert("users", {
          clerkId: "regular-clerk",
          email: "regular@example.com",
          name: "Regular User",
          role: "user",
          status: "online",
        });

        newUserId = await ctx.db.insert("users", {
          clerkId: "new-clerk",
          email: "new@example.com",
          name: "New User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
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

        // Regular member (not admin)
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: regularUserId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asRegularUser = t.withIdentity({ subject: "regular-clerk" });

      // Act & Assert
      await expect(
        asRegularUser.mutation(api.channels.addMembers, {
          channelId: channelId!,
          userIds: [newUserId!],
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should throw error for archived channel", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let newUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        newUserId = await ctx.db.insert("users", {
          clerkId: "new-clerk",
          email: "new@example.com",
          name: "New User",
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

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act & Assert
      await expect(
        asAdmin.mutation(api.channels.addMembers, {
          channelId: channelId!,
          userIds: [newUserId!],
        })
      ).rejects.toThrow("archived");
    });

    it("should allow global admin to add members", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let newUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        // Create global admin user (used for identity, not by ID reference)
        await ctx.db.insert("users", {
          clerkId: "globaladmin-clerk",
          email: "globaladmin@example.com",
          name: "Global Admin",
          role: "admin",
          status: "online",
        });

        newUserId = await ctx.db.insert("users", {
          clerkId: "new-clerk",
          email: "new@example.com",
          name: "New User",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "private",
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

      const asGlobalAdmin = t.withIdentity({ subject: "globaladmin-clerk" });

      // Act
      const result = await asGlobalAdmin.mutation(api.channels.addMembers, {
        channelId: channelId!,
        userIds: [newUserId!],
      });

      // Assert
      expect(result.added).toBe(1);
    });

    it("should handle empty userIds array", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
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

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act
      const result = await asAdmin.mutation(api.channels.addMembers, {
        channelId: channelId!,
        userIds: [],
      });

      // Assert
      expect(result.added).toBe(0);
      expect(result.alreadyMembers).toBe(0);
    });
  });

  describe("removeMember mutation", () => {
    it("should soft-remove member (set leftAt)", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let memberId!: Id<"users">;
      let membershipId!: Id<"channelMembers">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        memberId = await ctx.db.insert("users", {
          clerkId: "member-clerk",
          email: "member@example.com",
          name: "Member",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
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

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId: memberId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });
      const beforeRemove = Date.now();

      // Act
      await asAdmin.mutation(api.channels.removeMember, {
        channelId: channelId!,
        userId: memberId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.leftAt).toBeDefined();
        expect(membership?.leftAt).toBeGreaterThanOrEqual(beforeRemove);
      });
    });

    it("should decrement channel memberCount", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let memberId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        memberId = await ctx.db.insert("users", {
          clerkId: "member-clerk",
          email: "member@example.com",
          name: "Member",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: adminId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
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

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act
      await asAdmin.mutation(api.channels.removeMember, {
        channelId: channelId!,
        userId: memberId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(1);
      });
    });

    it("should throw error if trying to remove self", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let adminId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
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

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act & Assert
      await expect(
        asAdmin.mutation(api.channels.removeMember, {
          channelId: channelId!,
          userId: adminId!,
        })
      ).rejects.toThrow("Cannot remove yourself");
    });

    it("should throw error if trying to remove owner", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let ownerId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
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

      // Act & Assert
      await expect(
        asAdmin.mutation(api.channels.removeMember, {
          channelId: channelId!,
          userId: ownerId!,
        })
      ).rejects.toThrow("Cannot remove channel owner");
    });

    it("should throw error if caller is regular member", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let targetMemberId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const regularMemberId = await ctx.db.insert("users", {
          clerkId: "regular-clerk",
          email: "regular@example.com",
          name: "Regular Member",
          role: "user",
          status: "online",
        });

        targetMemberId = await ctx.db.insert("users", {
          clerkId: "target-clerk",
          email: "target@example.com",
          name: "Target Member",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 3,
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
          userId: regularMemberId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: targetMemberId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asRegularMember = t.withIdentity({ subject: "regular-clerk" });

      // Act & Assert
      await expect(
        asRegularMember.mutation(api.channels.removeMember, {
          channelId: channelId!,
          userId: targetMemberId!,
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should allow channel admin to remove regular members", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let memberId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
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

        memberId = await ctx.db.insert("users", {
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
          memberCount: 3,
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

      const asChannelAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act - Should succeed
      await asChannelAdmin.mutation(api.channels.removeMember, {
        channelId: channelId!,
        userId: memberId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(2);
      });
    });

    it("should throw error if admin tries to remove other admin", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let admin2Id!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const admin1Id = await ctx.db.insert("users", {
          clerkId: "admin1-clerk",
          email: "admin1@example.com",
          name: "Admin 1",
          role: "user",
          status: "online",
        });

        admin2Id = await ctx.db.insert("users", {
          clerkId: "admin2-clerk",
          email: "admin2@example.com",
          name: "Admin 2",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 3,
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
          userId: admin1Id,
          role: "admin",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: admin2Id,
          role: "admin",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asAdmin1 = t.withIdentity({ subject: "admin1-clerk" });

      // Act & Assert
      await expect(
        asAdmin1.mutation(api.channels.removeMember, {
          channelId: channelId!,
          userId: admin2Id!,
        })
      ).rejects.toThrow("Only channel owner or global admin can remove other admins");
    });

    it("should allow owner to remove admins", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let adminId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
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

      const asOwner = t.withIdentity({ subject: "owner-clerk" });

      // Act - Should succeed
      await asOwner.mutation(api.channels.removeMember, {
        channelId: channelId!,
        userId: adminId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(1);
      });
    });

    it("should allow global admin to remove anyone except owner", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let channelAdminId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        // Create global admin user (used for identity, not by ID reference)
        await ctx.db.insert("users", {
          clerkId: "globaladmin-clerk",
          email: "globaladmin@example.com",
          name: "Global Admin",
          role: "admin",
          status: "online",
        });

        channelAdminId = await ctx.db.insert("users", {
          clerkId: "channeladmin-clerk",
          email: "channeladmin@example.com",
          name: "Channel Admin",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "private",
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
          userId: channelAdminId,
          role: "admin",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asGlobalAdmin = t.withIdentity({ subject: "globaladmin-clerk" });

      // Act - Should succeed
      await asGlobalAdmin.mutation(api.channels.removeMember, {
        channelId: channelId!,
        userId: channelAdminId!,
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(1);
      });
    });

    it("should throw error for non-existent membership", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let nonMemberId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "online",
        });

        nonMemberId = await ctx.db.insert("users", {
          clerkId: "nonmember-clerk",
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

      const asAdmin = t.withIdentity({ subject: "admin-clerk" });

      // Act & Assert
      await expect(
        asAdmin.mutation(api.channels.removeMember, {
          channelId: channelId!,
          userId: nonMemberId!,
        })
      ).rejects.toThrow("not a member");
    });
  });

  describe("updateMemberRole mutation", () => {
    it("should update role from member to admin", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let memberId!: Id<"users">;
      let membershipId!: Id<"channelMembers">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        memberId = await ctx.db.insert("users", {
          clerkId: "member-clerk",
          email: "member@example.com",
          name: "Member",
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

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId: memberId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asOwner = t.withIdentity({ subject: "owner-clerk" });

      // Act
      await asOwner.mutation(api.channels.updateMemberRole, {
        channelId: channelId!,
        userId: memberId!,
        newRole: "admin",
      });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.role).toBe("admin");
      });
    });

    it("should update role from admin to moderator", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let adminId!: Id<"users">;
      let membershipId!: Id<"channelMembers">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk",
          email: "admin@example.com",
          name: "Admin",
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

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId: adminId,
          role: "admin",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asOwner = t.withIdentity({ subject: "owner-clerk" });

      // Act
      await asOwner.mutation(api.channels.updateMemberRole, {
        channelId: channelId!,
        userId: adminId!,
        newRole: "moderator",
      });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.role).toBe("moderator");
      });
    });

    it("should throw error if caller is not owner or global admin", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let memberId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const channelAdminId = await ctx.db.insert("users", {
          clerkId: "channeladmin-clerk",
          email: "channeladmin@example.com",
          name: "Channel Admin",
          role: "user",
          status: "online",
        });

        memberId = await ctx.db.insert("users", {
          clerkId: "member-clerk",
          email: "member@example.com",
          name: "Member",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 3,
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
          userId: channelAdminId,
          role: "admin",
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

      const asChannelAdmin = t.withIdentity({ subject: "channeladmin-clerk" });

      // Act & Assert
      await expect(
        asChannelAdmin.mutation(api.channels.updateMemberRole, {
          channelId: channelId!,
          userId: memberId!,
          newRole: "admin",
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should throw error if trying to change owner role", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let ownerId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        // Create global admin user (used for identity, not by ID reference)
        await ctx.db.insert("users", {
          clerkId: "globaladmin-clerk",
          email: "globaladmin@example.com",
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
      });

      const asGlobalAdmin = t.withIdentity({ subject: "globaladmin-clerk" });

      // Act & Assert
      await expect(
        asGlobalAdmin.mutation(api.channels.updateMemberRole, {
          channelId: channelId!,
          userId: ownerId!,
          newRole: "admin",
        })
      ).rejects.toThrow("Cannot change owner role");
    });

    it("should throw error if trying to change own role", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let ownerId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
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

      const asOwner = t.withIdentity({ subject: "owner-clerk" });

      // Act & Assert
      await expect(
        asOwner.mutation(api.channels.updateMemberRole, {
          channelId: channelId!,
          userId: ownerId!,
          newRole: "admin",
        })
      ).rejects.toThrow("Cannot change owner role");
    });

    it("should throw error for non-existent membership", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let nonMemberId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        nonMemberId = await ctx.db.insert("users", {
          clerkId: "nonmember-clerk",
          email: "nonmember@example.com",
          name: "Non Member",
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

      const asOwner = t.withIdentity({ subject: "owner-clerk" });

      // Act & Assert
      await expect(
        asOwner.mutation(api.channels.updateMemberRole, {
          channelId: channelId!,
          userId: nonMemberId!,
          newRole: "admin",
        })
      ).rejects.toThrow("not a member");
    });

    it("should allow global admin to change roles", async () => {
      const t = convexTest(schema);

      let channelId!: Id<"channels">;
      let memberId!: Id<"users">;
      let membershipId!: Id<"channelMembers">;

      // Arrange
      await t.run(async (ctx) => {
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        // Create global admin user (used for identity, not by ID reference)
        await ctx.db.insert("users", {
          clerkId: "globaladmin-clerk",
          email: "globaladmin@example.com",
          name: "Global Admin",
          role: "admin",
          status: "online",
        });

        memberId = await ctx.db.insert("users", {
          clerkId: "member-clerk",
          email: "member@example.com",
          name: "Member",
          role: "user",
          status: "online",
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "private",
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

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId: memberId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      const asGlobalAdmin = t.withIdentity({ subject: "globaladmin-clerk" });

      // Act
      await asGlobalAdmin.mutation(api.channels.updateMemberRole, {
        channelId: channelId!,
        userId: memberId!,
        newRole: "admin",
      });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.role).toBe("admin");
      });
    });
  });
});
