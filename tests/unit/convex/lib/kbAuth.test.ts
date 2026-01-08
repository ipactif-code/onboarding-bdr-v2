import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../../../convex/schema";
import {
  requireKBAuth,
  checkPermission,
  getEffectivePermission,
} from "../../../../convex/lib/kbAuth";
import { Id } from "../../../../convex/_generated/dataModel";
import { ConvexError } from "convex/values";

describe("kbAuth", () => {
  describe("requireKBAuth", () => {
    it("should throw ConvexError when not authenticated", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Act & Assert
        await expect(requireKBAuth(ctx)).rejects.toThrow(ConvexError);
      });
    });

    it("should return userId when authenticated", async () => {
      const t = convexTest(schema);

      // Arrange: Create authenticated user
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "test-clerk-id",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      // Act with auth identity
      const asUser = t.withIdentity({ subject: "test-clerk-id" });
      const result = await asUser.run(async (ctx) => {
        return await requireKBAuth(ctx);
      });

      // Assert
      expect(result.userId).toEqual(userId);
      expect(result.user).toBeDefined();
      expect(result.user._id).toEqual(userId);
    });

    it("should return user object with correct fields", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "test-clerk-id",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      // Act
      const asUser = t.withIdentity({ subject: "test-clerk-id" });
      const result = await asUser.run(async (ctx) => {
        return await requireKBAuth(ctx);
      });

      // Assert
      expect(result.user.email).toBe("test@example.com");
      expect(result.user.name).toBe("Test User");
      expect(result.user.role).toBe("user");
    });
  });

  describe("checkPermission", () => {
    it("should return true when owner has all permission levels", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange: Create user as workspace owner
        const userId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-id",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId: userId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Create admin permission for owner
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "workspace",
          workspaceId,
          userId,
          level: "admin",
          isInherited: false,
          grantedBy: userId,
          grantedAt: Date.now(),
        });

        // Act & Assert: Admin level permission
        const hasAdmin = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "admin"
        );
        expect(hasAdmin).toBe(true);

        // Write level permission
        const hasWrite = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "write"
        );
        expect(hasWrite).toBe(true);

        // Read level permission
        const hasRead = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "read"
        );
        expect(hasRead).toBe(true);
      });
    });

    it("should return true when write has write and read permissions", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-id",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant write permission
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "workspace",
          workspaceId,
          userId,
          level: "write",
          isInherited: false,
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });

        // Act & Assert: Write level permission
        const hasWrite = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "write"
        );
        expect(hasWrite).toBe(true);

        // Read level permission
        const hasRead = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "read"
        );
        expect(hasRead).toBe(true);

        // Should NOT have admin
        const hasAdmin = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "admin"
        );
        expect(hasAdmin).toBe(false);
      });
    });

    it("should return true when read has only read permission", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-id",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant read permission
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "workspace",
          workspaceId,
          userId,
          level: "read",
          isInherited: false,
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });

        // Act & Assert: Read level permission
        const hasRead = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "read"
        );
        expect(hasRead).toBe(true);

        // Should NOT have write
        const hasWrite = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "write"
        );
        expect(hasWrite).toBe(false);

        // Should NOT have admin
        const hasAdmin = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "admin"
        );
        expect(hasAdmin).toBe(false);
      });
    });

    it("should return false when none level denies all permissions", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-id",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // No permission granted (none level)

        // Act & Assert: All permissions should be false
        const hasRead = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "read"
        );
        expect(hasRead).toBe(false);

        const hasWrite = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "write"
        );
        expect(hasWrite).toBe(false);

        const hasAdmin = await checkPermission(
          ctx,
          userId,
          "workspace",
          workspaceId,
          "admin"
        );
        expect(hasAdmin).toBe(false);
      });
    });
  });

  describe("getEffectivePermission", () => {
    it("should return admin for global admin user", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange: Create admin user
        const adminId = await ctx.db.insert("users", {
          clerkId: "admin-clerk-id",
          email: "admin@example.com",
          name: "Admin",
          role: "admin", // Global admin
          status: "online",
        });

        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-id",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Act: Admin should have admin access to any workspace
        const permission = await getEffectivePermission(
          ctx,
          adminId,
          "workspace",
          workspaceId
        );

        // Assert
        expect(permission).toBe("admin");
      });
    });

    it("should return direct permission when set", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-id",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const folderId = await ctx.db.insert("kbFolders", {
          name: "Test Folder",
          workspaceId,
          displayOrder: 1,
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant direct write permission on folder
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "folder",
          folderId,
          userId,
          level: "write",
          isInherited: false,
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });

        // Act
        const permission = await getEffectivePermission(
          ctx,
          userId,
          "folder",
          folderId
        );

        // Assert
        expect(permission).toBe("write");
      });
    });

    it("should inherit permission from parent folder", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-id",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const parentFolderId = await ctx.db.insert("kbFolders", {
          name: "Parent Folder",
          workspaceId,
          displayOrder: 1,
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const childFolderId = await ctx.db.insert("kbFolders", {
          name: "Child Folder",
          workspaceId,
          parentId: parentFolderId,
          displayOrder: 1,
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant write permission on parent folder
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "folder",
          folderId: parentFolderId,
          userId,
          level: "write",
          isInherited: false,
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });

        // Act: Check child folder permission (should inherit from parent)
        const permission = await getEffectivePermission(
          ctx,
          userId,
          "folder",
          childFolderId
        );

        // Assert
        expect(permission).toBe("write");
      });
    });

    it("should inherit permission from workspace", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-id",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const folderId = await ctx.db.insert("kbFolders", {
          name: "Root Folder",
          workspaceId,
          displayOrder: 1,
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant read permission on workspace
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "workspace",
          workspaceId,
          userId,
          level: "read",
          isInherited: false,
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });

        // Act: Check folder permission (should inherit from workspace)
        const permission = await getEffectivePermission(
          ctx,
          userId,
          "folder",
          folderId
        );

        // Assert
        expect(permission).toBe("read");
      });
    });

    it("should grant access through team permission", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-id",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const teamId = await ctx.db.insert("teams", {
          name: "Test Team",
          description: "Test team",
        });

        // Add user to team
        await ctx.db.insert("teamMembers", {
          teamId,
          userId,
          joinedAt: Date.now(),
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant write permission to team
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "workspace",
          workspaceId,
          teamId,
          level: "write",
          isInherited: false,
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });

        // Act
        const permission = await getEffectivePermission(
          ctx,
          userId,
          "workspace",
          workspaceId
        );

        // Assert
        expect(permission).toBe("write");
      });
    });

    it("should return null when no permission exists", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const ownerId = await ctx.db.insert("users", {
          clerkId: "owner-clerk-id",
          email: "owner@example.com",
          name: "Owner",
          role: "user",
          status: "online",
        });

        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // No permission granted

        // Act
        const permission = await getEffectivePermission(
          ctx,
          userId,
          "workspace",
          workspaceId
        );

        // Assert
        expect(permission).toBeNull();
      });
    });
  });
});
