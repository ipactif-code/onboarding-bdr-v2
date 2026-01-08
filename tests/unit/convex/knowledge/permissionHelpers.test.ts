import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../../../convex/schema";
import {
  batchCheckDocumentPermissions,
  batchFilterAccessibleDocuments,
  batchGetWorkspacePermissions,
} from "../../../../convex/knowledge/permissionHelpers";

describe("permissionHelpers", () => {
  describe("batchCheckDocumentPermissions", () => {
    it("should return permissions for multiple documents efficiently", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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
          ownerId: userId,
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

        // Create 3 documents
        const doc1Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 1",
          folderId,
          creatorId: userId,
          status: "draft",
          displayOrder: 1,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const doc2Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 2",
          folderId,
          creatorId: userId,
          status: "draft",
          displayOrder: 2,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const doc3Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 3",
          folderId,
          creatorId: userId,
          status: "draft",
          displayOrder: 3,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant workspace read permission
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "workspace",
          workspaceId,
          userId,
          level: "read",
          isInherited: false,
          grantedBy: userId,
          grantedAt: Date.now(),
        });

        // Act
        const permissions = await batchCheckDocumentPermissions(
          ctx,
          userId,
          [doc1Id, doc2Id, doc3Id]
        );

        // Assert
        expect(permissions.size).toBe(3);
        expect(permissions.get(doc1Id)).toBe("read");
        expect(permissions.get(doc2Id)).toBe("read");
        expect(permissions.get(doc3Id)).toBe("read");
      });
    });

    it("should handle documents with mixed permission levels", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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
          ownerId: userId,
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

        // Create 2 documents
        const doc1Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 1",
          folderId,
          creatorId: userId,
          status: "draft",
          displayOrder: 1,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const doc2Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 2",
          folderId,
          creatorId: userId,
          status: "draft",
          displayOrder: 2,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant workspace read permission (applies to both docs)
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "workspace",
          workspaceId,
          userId,
          level: "read",
          isInherited: false,
          grantedBy: userId,
          grantedAt: Date.now(),
        });

        // Grant write permission on doc2 specifically
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "document",
          documentId: doc2Id,
          userId,
          level: "write",
          isInherited: false,
          grantedBy: userId,
          grantedAt: Date.now(),
        });

        // Act
        const permissions = await batchCheckDocumentPermissions(
          ctx,
          userId,
          [doc1Id, doc2Id]
        );

        // Assert
        expect(permissions.get(doc1Id)).toBe("read");
        expect(permissions.get(doc2Id)).toBe("write"); // Higher permission wins
      });
    });

    it("should return empty map for empty input", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        // Act
        const permissions = await batchCheckDocumentPermissions(
          ctx,
          userId,
          []
        );

        // Assert
        expect(permissions.size).toBe(0);
      });
    });

    it("should return admin for global admin on all documents", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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

        const folderId = await ctx.db.insert("kbFolders", {
          name: "Test Folder",
          workspaceId,
          displayOrder: 1,
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const doc1Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 1",
          folderId,
          creatorId: ownerId,
          status: "draft",
          displayOrder: 1,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const doc2Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 2",
          folderId,
          creatorId: ownerId,
          status: "draft",
          displayOrder: 2,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Act
        const permissions = await batchCheckDocumentPermissions(
          ctx,
          adminId,
          [doc1Id, doc2Id]
        );

        // Assert
        expect(permissions.get(doc1Id)).toBe("admin");
        expect(permissions.get(doc2Id)).toBe("admin");
      });
    });
  });

  describe("batchFilterAccessibleDocuments", () => {
    it("should return set of accessible document IDs", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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
          ownerId: userId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const folder1Id = await ctx.db.insert("kbFolders", {
          name: "Folder 1",
          workspaceId,
          displayOrder: 1,
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const folder2Id = await ctx.db.insert("kbFolders", {
          name: "Folder 2",
          workspaceId,
          displayOrder: 2,
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Doc 1 - user has access
        const doc1Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 1",
          folderId: folder1Id,
          creatorId: userId,
          status: "draft",
          displayOrder: 1,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Doc 2 - user has access
        const doc2Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 2",
          folderId: folder1Id,
          creatorId: userId,
          status: "draft",
          displayOrder: 2,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Doc 3 - user has NO access (different folder)
        const doc3Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 3",
          folderId: folder2Id,
          creatorId: userId,
          status: "draft",
          displayOrder: 1,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant read permission on folder1 only
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "folder",
          folderId: folder1Id,
          userId,
          level: "read",
          isInherited: false,
          grantedBy: userId,
          grantedAt: Date.now(),
        });

        // Act
        const accessible = await batchFilterAccessibleDocuments(
          ctx,
          userId,
          [doc1Id, doc2Id, doc3Id],
          "read"
        );

        // Assert
        expect(accessible.size).toBe(2);
        expect(accessible.has(doc1Id)).toBe(true);
        expect(accessible.has(doc2Id)).toBe(true);
        expect(accessible.has(doc3Id)).toBe(false);
      });
    });

    it("should filter by permission level", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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
          ownerId: userId,
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

        // Doc 1 - read permission
        const doc1Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 1",
          folderId,
          creatorId: userId,
          status: "draft",
          displayOrder: 1,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Doc 2 - write permission
        const doc2Id = await ctx.db.insert("kbDocuments", {
          title: "Doc 2",
          folderId,
          creatorId: userId,
          status: "draft",
          displayOrder: 2,
          wordCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant workspace read (applies to both)
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "workspace",
          workspaceId,
          userId,
          level: "read",
          isInherited: false,
          grantedBy: userId,
          grantedAt: Date.now(),
        });

        // Grant write on doc2
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "document",
          documentId: doc2Id,
          userId,
          level: "write",
          isInherited: false,
          grantedBy: userId,
          grantedAt: Date.now(),
        });

        // Act: Filter for write permission
        const writeable = await batchFilterAccessibleDocuments(
          ctx,
          userId,
          [doc1Id, doc2Id],
          "write"
        );

        // Assert
        expect(writeable.size).toBe(1);
        expect(writeable.has(doc1Id)).toBe(false); // Only read
        expect(writeable.has(doc2Id)).toBe(true); // Has write
      });
    });
  });

  describe("batchGetWorkspacePermissions", () => {
    it("should return permissions for multiple workspaces", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        const ws1Id = await ctx.db.insert("kbWorkspaces", {
          name: "Workspace 1",
          slug: "workspace-1",
          ownerId: userId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const ws2Id = await ctx.db.insert("kbWorkspaces", {
          name: "Workspace 2",
          slug: "workspace-2",
          ownerId: userId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Grant admin on ws1
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "workspace",
          workspaceId: ws1Id,
          userId,
          level: "admin",
          isInherited: false,
          grantedBy: userId,
          grantedAt: Date.now(),
        });

        // Grant read on ws2
        await ctx.db.insert("kbResourcePermissions", {
          resourceType: "workspace",
          workspaceId: ws2Id,
          userId,
          level: "read",
          isInherited: false,
          grantedBy: userId,
          grantedAt: Date.now(),
        });

        // Act
        const permissions = await batchGetWorkspacePermissions(
          ctx,
          userId,
          [ws1Id, ws2Id]
        );

        // Assert
        expect(permissions.size).toBe(2);
        expect(permissions.get(ws1Id)).toBe("admin");
        expect(permissions.get(ws2Id)).toBe("read");
      });
    });

    it("should return admin for global admin on all workspaces", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
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

        const ws1Id = await ctx.db.insert("kbWorkspaces", {
          name: "Workspace 1",
          slug: "workspace-1",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const ws2Id = await ctx.db.insert("kbWorkspaces", {
          name: "Workspace 2",
          slug: "workspace-2",
          ownerId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Act
        const permissions = await batchGetWorkspacePermissions(
          ctx,
          adminId,
          [ws1Id, ws2Id]
        );

        // Assert
        expect(permissions.get(ws1Id)).toBe("admin");
        expect(permissions.get(ws2Id)).toBe("admin");
      });
    });

    it("should return empty map for empty input", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk-id",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        // Act
        const permissions = await batchGetWorkspacePermissions(
          ctx,
          userId,
          []
        );

        // Assert
        expect(permissions.size).toBe(0);
      });
    });

    it("should handle team permissions correctly", async () => {
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
        const permissions = await batchGetWorkspacePermissions(
          ctx,
          userId,
          [workspaceId]
        );

        // Assert
        expect(permissions.get(workspaceId)).toBe("write");
      });
    });
  });
});
