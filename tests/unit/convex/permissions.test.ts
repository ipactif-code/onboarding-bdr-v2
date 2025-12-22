import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../../convex/schema";
import {
  isChannelMember,
  canAccessChannel,
  hasChannelRole,
} from "../../../convex/lib/permissions";
import { Id } from "../../../convex/_generated/dataModel";

describe("Channel Permissions Library", () => {
  describe("isChannelMember", () => {
    it("should return true for active member", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange: Create user and channel
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

        // Create active membership (no leftAt, not banned)
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Act
        const result = await isChannelMember(ctx, channelId, userId);

        // Assert
        expect(result).toBe(true);
      });
    });

    it("should return false for member who left channel", async () => {
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
          memberCount: 0,
        });

        // Create membership with leftAt set
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now() - 1000,
          leftAt: Date.now(), // User left
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Act
        const result = await isChannelMember(ctx, channelId, userId);

        // Assert
        expect(result).toBe(false);
      });
    });

    it("should return false for banned member", async () => {
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
          memberCount: 0,
        });

        // Create banned membership
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: true, // User is banned
        });

        // Act
        const result = await isChannelMember(ctx, channelId, userId);

        // Assert
        expect(result).toBe(false);
      });
    });

    it("should return false for non-member", async () => {
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
          memberCount: 0,
        });

        // No membership created

        // Act
        const result = await isChannelMember(ctx, channelId, userId);

        // Assert
        expect(result).toBe(false);
      });
    });
  });

  describe("canAccessChannel", () => {
    it("should allow global admin to access any channel", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange: Create admin user
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk-123",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin", // Global admin
          status: "online",
        });

        const regularUserId = await ctx.db.insert("users", {
          clerkId: "regular-clerk-123",
          email: "regular@example.com",
          name: "Regular User",
          role: "user",
          status: "online",
        });

        // Create private channel owned by regular user
        const channelId = await ctx.db.insert("channels", {
          name: "private-channel",
          type: "private",
          creatorId: regularUserId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Regular user is member, admin is not
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: regularUserId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Act
        const result = await canAccessChannel(ctx, channelId, adminId);

        // Assert
        expect(result).toBe(true); // Admin can access even without membership
      });
    });

    it("should allow anyone to access public channel", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk-123",
          email: "creator@example.com",
          name: "Creator",
          role: "user",
          status: "online",
        });

        const visitorId = await ctx.db.insert("users", {
          clerkId: "visitor-clerk-123",
          email: "visitor@example.com",
          name: "Visitor",
          role: "user",
          status: "online",
        });

        // Create public channel
        const channelId = await ctx.db.insert("channels", {
          name: "public-channel",
          type: "public",
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        // Visitor is NOT a member

        // Act
        const result = await canAccessChannel(ctx, channelId, visitorId);

        // Assert
        expect(result).toBe(true); // Public channel accessible to all
      });
    });

    it("should allow active member to access private channel", async () => {
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
          name: "private-channel",
          type: "private",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // User is active member
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Act
        const result = await canAccessChannel(ctx, channelId, userId);

        // Assert
        expect(result).toBe(true);
      });
    });

    it("should deny non-member access to private channel", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-123",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const outsiderId = await ctx.db.insert("users", {
          clerkId: "outsider-clerk-123",
          email: "outsider@example.com",
          name: "Outsider",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "private-channel",
          type: "private",
          creatorId: ownerId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Only owner is member
        await ctx.db.insert("channelMembers", {
          channelId,
          userId: ownerId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Act
        const result = await canAccessChannel(ctx, channelId, outsiderId);

        // Assert
        expect(result).toBe(false);
      });
    });

    it("should allow user with channelAdmins entry to access private channel", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const instructorId = await ctx.db.insert("users", {
          clerkId: "instructor-clerk-123",
          email: "instructor@example.com",
          name: "Instructor",
          role: "user", // Not global admin
          status: "online",
        });

        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk-123",
          email: "creator@example.com",
          name: "Creator",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "course-channel",
          type: "private",
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Instructor is NOT a member but has admin access
        await ctx.db.insert("channelAdmins", {
          channelId,
          userId: instructorId,
          grantedAt: Date.now(),
          grantedBy: creatorId,
          reason: "course_instructor",
        });

        // Act
        const result = await canAccessChannel(ctx, channelId, instructorId);

        // Assert
        expect(result).toBe(true);
      });
    });

    it("should return false for non-existent channel", async () => {
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

        const fakeChannelId = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"channels">;

        // Act
        const result = await canAccessChannel(ctx, fakeChannelId, userId);

        // Assert
        expect(result).toBe(false);
      });
    });

    it("should return false for non-existent user", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk-123",
          email: "creator@example.com",
          name: "Creator",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        const fakeUserId = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"users">;

        // Act
        const result = await canAccessChannel(ctx, channelId, fakeUserId);

        // Assert
        expect(result).toBe(false);
      });
    });
  });

  describe("hasChannelRole", () => {
    it("should return true for global admin regardless of membership", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk-123",
          email: "admin@example.com",
          name: "Admin",
          role: "admin", // Global admin
          status: "online",
        });

        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk-123",
          email: "creator@example.com",
          name: "Creator",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "private",
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        // Admin is NOT a member

        // Act
        const result = await hasChannelRole(ctx, channelId, adminId, "owner");

        // Assert
        expect(result).toBe(true); // Global admin has all permissions
      });
    });

    it("should respect role hierarchy: owner >= owner", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-123",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
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

        // Act
        const result = await hasChannelRole(ctx, channelId, ownerId, "owner");

        // Assert
        expect(result).toBe(true);
      });
    });

    it("should respect role hierarchy: owner >= admin", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-123",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
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

        // Act
        const result = await hasChannelRole(ctx, channelId, ownerId, "admin");

        // Assert
        expect(result).toBe(true); // Owner has admin privileges
      });
    });

    it("should respect role hierarchy: admin < owner", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const adminUserId = await ctx.db.insert("users", {
          clerkId: "admin-user-clerk-123",
          email: "admin-user@example.com",
          name: "Admin User",
          role: "user", // Not global admin
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: adminUserId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: adminUserId,
          role: "admin", // Channel admin role
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Act
        const result = await hasChannelRole(ctx, channelId, adminUserId, "owner");

        // Assert
        expect(result).toBe(false); // Admin cannot act as owner
      });
    });

    it("should respect role hierarchy: moderator >= moderator", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const modId = await ctx.db.insert("users", {
          clerkId: "mod-clerk-123",
          email: "mod@example.com",
          name: "Moderator",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: modId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
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

        // Act
        const result = await hasChannelRole(ctx, channelId, modId, "moderator");

        // Assert
        expect(result).toBe(true);
      });
    });

    it("should respect role hierarchy: member < moderator", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const memberId = await ctx.db.insert("users", {
          clerkId: "member-clerk-123",
          email: "member@example.com",
          name: "Member",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: memberId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
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

        // Act
        const result = await hasChannelRole(ctx, channelId, memberId, "moderator");

        // Assert
        expect(result).toBe(false); // Member cannot act as moderator
      });
    });

    it("should grant admin-level access via channelAdmins table", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const instructorId = await ctx.db.insert("users", {
          clerkId: "instructor-clerk-123",
          email: "instructor@example.com",
          name: "Instructor",
          role: "user",
          status: "online",
        });

        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk-123",
          email: "creator@example.com",
          name: "Creator",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "course-channel",
          type: "private",
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Instructor has admin access via channelAdmins
        await ctx.db.insert("channelAdmins", {
          channelId,
          userId: instructorId,
          grantedAt: Date.now(),
          grantedBy: creatorId,
          reason: "course_instructor",
        });

        // Act
        const result = await hasChannelRole(ctx, channelId, instructorId, "admin");

        // Assert
        expect(result).toBe(true); // channelAdmins grants admin access
      });
    });

    it("should NOT grant owner role via channelAdmins", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const instructorId = await ctx.db.insert("users", {
          clerkId: "instructor-clerk-123",
          email: "instructor@example.com",
          name: "Instructor",
          role: "user",
          status: "online",
        });

        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk-123",
          email: "creator@example.com",
          name: "Creator",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "course-channel",
          type: "private",
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelAdmins", {
          channelId,
          userId: instructorId,
          grantedAt: Date.now(),
          grantedBy: creatorId,
          reason: "course_instructor",
        });

        // Act - requesting owner role
        const result = await hasChannelRole(ctx, channelId, instructorId, "owner");

        // Assert
        expect(result).toBe(false); // channelAdmins only grants admin-level, not owner
      });
    });

    it("should return false for left member", async () => {
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
          role: "admin",
          joinedAt: Date.now() - 1000,
          leftAt: Date.now(), // User left
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Act
        const result = await hasChannelRole(ctx, channelId, userId, "admin");

        // Assert
        expect(result).toBe(false); // Left members have no role
      });
    });

    it("should return false for banned member", async () => {
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
          role: "admin",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: true, // User banned
        });

        // Act
        const result = await hasChannelRole(ctx, channelId, userId, "admin");

        // Assert
        expect(result).toBe(false); // Banned members have no role
      });
    });

    it("should return false for non-existent user", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk-123",
          email: "creator@example.com",
          name: "Creator",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        const fakeUserId = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"users">;

        // Act
        const result = await hasChannelRole(ctx, channelId, fakeUserId, "member");

        // Assert
        expect(result).toBe(false);
      });
    });
  });
});
