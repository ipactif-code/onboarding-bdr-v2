import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../../../convex/schema";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ConvexError } from "convex/values";

describe("knowledge/folders", () => {
  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Create a convexTest instance with proper module configuration
   */
  function createTestContext() {
    return convexTest(schema);
  }

  /**
   * Create a test user with specified role
   */
  async function createUser(
    ctx: any,
    clerkId: string,
    role: "user" | "admin" = "user"
  ): Promise<Id<"users">> {
    return await ctx.db.insert("users", {
      clerkId,
      email: `${clerkId}@example.com`,
      name: `User ${clerkId}`,
      role,
      status: "online" as const,
    });
  }

  /**
   * Create a test workspace with default permission
   */
  async function createWorkspace(
    ctx: any,
    ownerId: Id<"users">,
    name = "Test Workspace",
    defaultPermission: "none" | "read" | "write" | "admin" = "read"
  ): Promise<Id<"kbWorkspaces">> {
    return await ctx.db.insert("kbWorkspaces", {
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      ownerId,
      defaultPermission,
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  /**
   * Grant permission to a user on a resource
   */
  async function grantPermission(
    ctx: any,
    userId: Id<"users">,
    resourceType: "workspace" | "folder",
    resourceId: Id<"kbWorkspaces"> | Id<"kbFolders">,
    level: "none" | "read" | "write" | "admin",
    grantedBy: Id<"users">
  ): Promise<void> {
    const basePermission = {
      resourceType,
      userId,
      level,
      isInherited: false,
      grantedBy,
      grantedAt: Date.now(),
    };

    if (resourceType === "workspace") {
      await ctx.db.insert("kbResourcePermissions", {
        ...basePermission,
        workspaceId: resourceId as Id<"kbWorkspaces">,
      });
    } else {
      await ctx.db.insert("kbResourcePermissions", {
        ...basePermission,
        folderId: resourceId as Id<"kbFolders">,
      });
    }
  }

  /**
   * Create a test folder
   */
  async function createFolder(
    ctx: any,
    name: string,
    workspaceId: Id<"kbWorkspaces">,
    parentId?: Id<"kbFolders">,
    displayOrder = 1
  ): Promise<Id<"kbFolders">> {
    return await ctx.db.insert("kbFolders", {
      name,
      workspaceId,
      parentId,
      displayOrder,
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  // ============================================================================
  // QUERY: list
  // ============================================================================

  describe("list", () => {
    it("should require authentication", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);

        // Act & Assert - No auth
        await expect(
          t.query(api.knowledge.folders.list, { workspaceId })
        ).rejects.toThrow();
      });
    });

    it("should require read permission on workspace", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId, "Test", "none");

        // Act & Assert - No permission
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.query(api.knowledge.folders.list, { workspaceId })
        ).rejects.toThrow("You do not have permission to access this workspace");
      });
    });

    it("should return folders in workspace ordered by displayOrder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        // Create folders with different display orders
        await createFolder(ctx, "Folder C", workspaceId, undefined, 3);
        await createFolder(ctx, "Folder A", workspaceId, undefined, 1);
        await createFolder(ctx, "Folder B", workspaceId, undefined, 2);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const folders = await asUser.query(api.knowledge.folders.list, {
          workspaceId,
        });

        // Assert
        expect(folders).toHaveLength(3);
        expect(folders[0]!.name).toBe("Folder A");
        expect(folders[1]!.name).toBe("Folder B");
        expect(folders[2]!.name).toBe("Folder C");
      });
    });

    it("should filter by parentId when provided", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        // Create parent folder
        const parentId = await createFolder(ctx, "Parent", workspaceId);
        await grantPermission(ctx, userId, "folder", parentId, "read", userId);

        // Create child folders
        await createFolder(ctx, "Child A", workspaceId, parentId, 1);
        await createFolder(ctx, "Child B", workspaceId, parentId, 2);

        // Create root folder (should not be returned)
        await createFolder(ctx, "Root", workspaceId, undefined, 1);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const folders = await asUser.query(api.knowledge.folders.list, {
          workspaceId,
          parentId,
        });

        // Assert
        expect(folders).toHaveLength(2);
        expect(folders[0]!.name).toBe("Child A");
        expect(folders[1]!.name).toBe("Child B");
      });
    });

    it("should exclude archived folders by default", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        // Create active folder
        await createFolder(ctx, "Active", workspaceId);

        // Create archived folder
        const archivedId = await createFolder(ctx, "Archived", workspaceId);
        await ctx.db.patch(archivedId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const folders = await asUser.query(api.knowledge.folders.list, {
          workspaceId,
        });

        // Assert
        expect(folders).toHaveLength(1);
        expect(folders[0]!.name).toBe("Active");
      });
    });

    it("should include archived folders when includeArchived is true", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        // Create active folder
        await createFolder(ctx, "Active", workspaceId);

        // Create archived folder
        const archivedId = await createFolder(ctx, "Archived", workspaceId);
        await ctx.db.patch(archivedId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const folders = await asUser.query(api.knowledge.folders.list, {
          workspaceId,
          includeArchived: true,
        });

        // Assert
        expect(folders).toHaveLength(2);
      });
    });

    it("should require permission on parent folder when listing children", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId, "Test", "none");
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        const parentId = await createFolder(ctx, "Parent", workspaceId);
        // No permission granted on parent folder

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.query(api.knowledge.folders.list, {
            workspaceId,
            parentId,
          })
        ).rejects.toThrow("You do not have permission to access this folder");
      });
    });
  });

  // ============================================================================
  // QUERY: get
  // ============================================================================

  describe("get", () => {
    it("should require authentication", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert - No auth
        await expect(
          t.query(api.knowledge.folders.get, { id: folderId })
        ).rejects.toThrow();
      });
    });

    it("should return null if folder not found", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await createUser(ctx, "user1");

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const result = await asUser.query(api.knowledge.folders.get, {
          id: "jh7abcdefghijklmnopqrstuv" as Id<"kbFolders">,
        });

        // Assert
        expect(result).toBeNull();
      });
    });

    it("should return null if user lacks read permission", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId, "Test", "none");
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act
        const asUser = t.withIdentity({ subject: "user" });
        const result = await asUser.query(api.knowledge.folders.get, {
          id: folderId,
        });

        // Assert
        expect(result).toBeNull();
      });
    });

    it("should return folder when user has permission", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);
        const folderId = await createFolder(ctx, "Test Folder", workspaceId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const result = await asUser.query(api.knowledge.folders.get, {
          id: folderId,
        });

        // Assert
        expect(result).not.toBeNull();
        expect(result?.name).toBe("Test Folder");
        expect(result?._id).toBe(folderId);
      });
    });
  });

  // ============================================================================
  // QUERY: getTree
  // ============================================================================

  describe("getTree", () => {
    it("should require authentication", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);

        // Act & Assert
        await expect(
          t.query(api.knowledge.folders.getTree, { workspaceId })
        ).rejects.toThrow();
      });
    });

    it("should require read permission on workspace", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId, "Test", "none");

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.query(api.knowledge.folders.getTree, { workspaceId })
        ).rejects.toThrow("You do not have permission to access this workspace");
      });
    });

    it("should return hierarchical tree structure", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        // Create folder structure
        const root1 = await createFolder(ctx, "Root 1", workspaceId, undefined, 1);
        const root2 = await createFolder(ctx, "Root 2", workspaceId, undefined, 2);
        const child1 = await createFolder(ctx, "Child 1", workspaceId, root1, 1);
        const child2 = await createFolder(ctx, "Child 2", workspaceId, root1, 2);
        const grandchild = await createFolder(ctx, "Grandchild", workspaceId, child1, 1);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const tree = await asUser.query(api.knowledge.folders.getTree, {
          workspaceId,
        });

        // Assert
        expect(tree).toHaveLength(2);
        expect(tree[0]!.name).toBe("Root 1");
        expect(tree[0]!.children).toHaveLength(2);
        expect(tree[0]!.children[0]!.name).toBe("Child 1");
        expect(tree[0]!.children[0]!.children).toHaveLength(1);
        expect(tree[0]!.children[0]!.children[0]!.name).toBe("Grandchild");
        expect(tree[1]!.name).toBe("Root 2");
        expect(tree[1]!.children).toHaveLength(0);
      });
    });

    it("should exclude archived folders by default", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        // Create active folder
        await createFolder(ctx, "Active", workspaceId);

        // Create archived folder
        const archivedId = await createFolder(ctx, "Archived", workspaceId);
        await ctx.db.patch(archivedId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const tree = await asUser.query(api.knowledge.folders.getTree, {
          workspaceId,
        });

        // Assert
        expect(tree).toHaveLength(1);
        expect(tree[0]!.name).toBe("Active");
      });
    });

    it("should sort folders by displayOrder at each level", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        // Create out of order
        await createFolder(ctx, "Root C", workspaceId, undefined, 3);
        await createFolder(ctx, "Root A", workspaceId, undefined, 1);
        await createFolder(ctx, "Root B", workspaceId, undefined, 2);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const tree = await asUser.query(api.knowledge.folders.getTree, {
          workspaceId,
        });

        // Assert
        expect(tree[0]!.name).toBe("Root A");
        expect(tree[1]!.name).toBe("Root B");
        expect(tree[2]!.name).toBe("Root C");
      });
    });
  });

  // ============================================================================
  // QUERY: getBreadcrumbs
  // ============================================================================

  describe("getBreadcrumbs", () => {
    it("should require authentication", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        await expect(
          t.query(api.knowledge.folders.getBreadcrumbs, { folderId })
        ).rejects.toThrow();
      });
    });

    it("should throw error if folder not found", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await createUser(ctx, "user1");

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.query(api.knowledge.folders.getBreadcrumbs, {
            folderId: "jh7abcdefghijklmnopqrstuv" as Id<"kbFolders">,
          })
        ).rejects.toThrow("Folder not found");
      });
    });

    it("should require read permission on folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId, "Test", "none");
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.query(api.knowledge.folders.getBreadcrumbs, { folderId })
        ).rejects.toThrow("You do not have permission to access this folder");
      });
    });

    it("should return breadcrumb path from root to folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        // Create nested folder structure
        const root = await createFolder(ctx, "Root", workspaceId);
        const child = await createFolder(ctx, "Child", workspaceId, root);
        const grandchild = await createFolder(ctx, "Grandchild", workspaceId, child);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const breadcrumbs = await asUser.query(
          api.knowledge.folders.getBreadcrumbs,
          { folderId: grandchild }
        );

        // Assert
        expect(breadcrumbs).toHaveLength(3);
        expect(breadcrumbs[0]!.name).toBe("Root");
        expect(breadcrumbs[1]!.name).toBe("Child");
        expect(breadcrumbs[2]!.name).toBe("Grandchild");
      });
    });

    it("should return single item for root folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);
        const folderId = await createFolder(ctx, "Root Folder", workspaceId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const breadcrumbs = await asUser.query(
          api.knowledge.folders.getBreadcrumbs,
          { folderId }
        );

        // Assert
        expect(breadcrumbs).toHaveLength(1);
        expect(breadcrumbs[0]!.name).toBe("Root Folder");
      });
    });

    it("should include icon in breadcrumbs if present", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        const folderId = await ctx.db.insert("kbFolders", {
          name: "Icon Folder",
          workspaceId,
          icon: "📁",
          displayOrder: 1,
          isArchived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const breadcrumbs = await asUser.query(
          api.knowledge.folders.getBreadcrumbs,
          { folderId }
        );

        // Assert
        expect(breadcrumbs[0]!.icon).toBe("📁");
      });
    });
  });

  // ============================================================================
  // MUTATION: create
  // ============================================================================

  describe("create", () => {
    it("should require authentication", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.folders.create, {
            name: "Test",
            workspaceId,
          })
        ).rejects.toThrow();
      });
    });

    it("should require write permission on workspace", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId, "Test", "read");
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.mutation(api.knowledge.folders.create, {
            name: "Test Folder",
            workspaceId,
          })
        ).rejects.toThrow("You do not have permission to create folders in this workspace");
      });
    });

    it("should create folder with valid data", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const folderId = await asUser.mutation(api.knowledge.folders.create, {
          name: "New Folder",
          workspaceId,
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder).toBeDefined();
        expect(folder?.name).toBe("New Folder");
        expect(folder?.workspaceId).toBe(workspaceId);
        expect(folder?.isArchived).toBe(false);
        expect(folder?.displayOrder).toBe(1);
      });
    });

    it("should trim folder name", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const folderId = await asUser.mutation(api.knowledge.folders.create, {
          name: "  Trimmed Folder  ",
          workspaceId,
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.name).toBe("Trimmed Folder");
      });
    });

    it("should create folder in parent with correct displayOrder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        const parentId = await createFolder(ctx, "Parent", workspaceId);
        await grantPermission(ctx, userId, "folder", parentId, "write", userId);
        await createFolder(ctx, "Existing", workspaceId, parentId, 1);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const folderId = await asUser.mutation(api.knowledge.folders.create, {
          name: "New Child",
          workspaceId,
          parentId,
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.displayOrder).toBe(2); // After existing folder
      });
    });

    it("should throw error for archived workspace", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await ctx.db.patch(workspaceId, { isArchived: true });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.create, {
            name: "Test",
            workspaceId,
          })
        ).rejects.toThrow("Cannot create folder in an archived workspace");
      });
    });

    it("should throw error for archived parent folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const parentId = await createFolder(ctx, "Parent", workspaceId);
        await ctx.db.patch(parentId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.create, {
            name: "Test",
            workspaceId,
            parentId,
          })
        ).rejects.toThrow("Cannot create folder in an archived folder");
      });
    });

    it("should throw error if parent is in different workspace", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspace1 = await createWorkspace(ctx, userId, "Workspace 1");
        const workspace2 = await createWorkspace(ctx, userId, "Workspace 2");
        const parentId = await createFolder(ctx, "Parent", workspace1);

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.create, {
            name: "Test",
            workspaceId: workspace2,
            parentId,
          })
        ).rejects.toThrow("Parent folder is not in the specified workspace");
      });
    });

    it("should require write permission on parent folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        const parentId = await createFolder(ctx, "Parent", workspaceId);
        // No permission on parent folder

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.mutation(api.knowledge.folders.create, {
            name: "Test",
            workspaceId,
            parentId,
          })
        ).rejects.toThrow("You do not have permission to create folders here");
      });
    });

    it("should store icon when provided", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const folderId = await asUser.mutation(api.knowledge.folders.create, {
          name: "Icon Folder",
          workspaceId,
          icon: "📁",
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.icon).toBe("📁");
      });
    });

    it("should create audit log entry", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        const folderId = await asUser.mutation(api.knowledge.folders.create, {
          name: "Audited Folder",
          workspaceId,
        });

        // Assert - Check audit log
        const logs = await ctx.db
          .query("kbAuditLogs")
          .filter((q: any) => q.eq(q.field("resourceId"), folderId))
          .collect();

        expect(logs).toHaveLength(1);
        expect(logs[0]!.eventType).toBe("folder_created");
        expect(logs[0]!.resourceName).toBe("Audited Folder");
        expect(logs[0]!.actorId).toBe(userId);
      });
    });
  });

  // ============================================================================
  // MUTATION: update
  // ============================================================================

  describe("update", () => {
    it("should require authentication", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.folders.update, {
            id: folderId,
            name: "Updated",
          })
        ).rejects.toThrow();
      });
    });

    it("should require write permission", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.mutation(api.knowledge.folders.update, {
            id: folderId,
            name: "Updated",
          })
        ).rejects.toThrow("You do not have permission to update this folder");
      });
    });

    it("should update folder name", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);
        const folderId = await createFolder(ctx, "Old Name", workspaceId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        await asUser.mutation(api.knowledge.folders.update, {
          id: folderId,
          name: "New Name",
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.name).toBe("New Name");
      });
    });

    it("should update folder icon", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        await asUser.mutation(api.knowledge.folders.update, {
          id: folderId,
          icon: "📂",
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.icon).toBe("📂");
      });
    });

    it("should update updatedAt timestamp", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        const originalFolder = await ctx.db.get(folderId);
        const originalUpdatedAt = originalFolder?.updatedAt;

        // Wait a moment to ensure timestamp changes
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        await asUser.mutation(api.knowledge.folders.update, {
          id: folderId,
          name: "Updated",
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.updatedAt).toBeGreaterThan(originalUpdatedAt!);
      });
    });

    it("should throw error for archived folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);
        await ctx.db.patch(folderId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.update, {
            id: folderId,
            name: "Updated",
          })
        ).rejects.toThrow("Cannot update an archived folder");
      });
    });

    it("should throw error if folder not found", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        await createUser(ctx, "user1");

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.update, {
            id: "jh7abcdefghijklmnopqrstuv" as Id<"kbFolders">,
            name: "Updated",
          })
        ).rejects.toThrow("Folder not found");
      });
    });
  });

  // ============================================================================
  // MUTATION: move
  // ============================================================================

  describe("move", () => {
    it("should require authentication", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.folders.move, {
            id: folderId,
            newParentId: undefined,
          })
        ).rejects.toThrow();
      });
    });

    it("should move folder to new parent", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        const parent1 = await createFolder(ctx, "Parent 1", workspaceId);
        const parent2 = await createFolder(ctx, "Parent 2", workspaceId);
        await grantPermission(ctx, userId, "folder", parent1, "write", userId);
        await grantPermission(ctx, userId, "folder", parent2, "write", userId);

        const folderId = await createFolder(ctx, "Movable", workspaceId, parent1);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        await asUser.mutation(api.knowledge.folders.move, {
          id: folderId,
          newParentId: parent2,
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.parentId).toBe(parent2);
      });
    });

    it("should move folder to workspace root", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        const parentId = await createFolder(ctx, "Parent", workspaceId);
        await grantPermission(ctx, userId, "folder", parentId, "write", userId);
        const folderId = await createFolder(ctx, "Child", workspaceId, parentId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        await asUser.mutation(api.knowledge.folders.move, {
          id: folderId,
          newParentId: undefined,
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.parentId).toBeUndefined();
      });
    });

    it("should throw error when moving to different workspace", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspace1 = await createWorkspace(ctx, userId, "Workspace 1");
        const workspace2 = await createWorkspace(ctx, userId, "Workspace 2");
        await grantPermission(ctx, userId, "workspace", workspace1, "write", userId);
        await grantPermission(ctx, userId, "workspace", workspace2, "write", userId);

        const folderId = await createFolder(ctx, "Test", workspace1);
        const newParentId = await createFolder(ctx, "Parent", workspace2);

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.move, {
            id: folderId,
            newParentId,
          })
        ).rejects.toThrow("Cannot move folder to a different workspace");
      });
    });

    it("should throw error when moving to archived folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        const folderId = await createFolder(ctx, "Test", workspaceId);
        const newParentId = await createFolder(ctx, "Archived Parent", workspaceId);
        await ctx.db.patch(newParentId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.move, {
            id: folderId,
            newParentId,
          })
        ).rejects.toThrow("Cannot move folder to an archived folder");
      });
    });

    it("should throw error when moving archived folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);
        await ctx.db.patch(folderId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.move, {
            id: folderId,
            newParentId: undefined,
          })
        ).rejects.toThrow("Cannot move an archived folder");
      });
    });

    it("should require write permission on source folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);

        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.mutation(api.knowledge.folders.move, {
            id: folderId,
            newParentId: undefined,
          })
        ).rejects.toThrow("You do not have permission to move this folder");
      });
    });

    it("should require write permission on destination folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        const folderId = await createFolder(ctx, "Test", workspaceId);
        const newParentId = await createFolder(ctx, "New Parent", workspaceId);
        // No permission on newParentId

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.mutation(api.knowledge.folders.move, {
            id: folderId,
            newParentId,
          })
        ).rejects.toThrow("You do not have permission to move folders here");
      });
    });

    it("should update displayOrder to be last in new parent", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        const parentId = await createFolder(ctx, "Parent", workspaceId);
        await grantPermission(ctx, userId, "folder", parentId, "write", userId);
        await createFolder(ctx, "Existing 1", workspaceId, parentId, 1);
        await createFolder(ctx, "Existing 2", workspaceId, parentId, 2);

        const folderId = await createFolder(ctx, "Movable", workspaceId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        await asUser.mutation(api.knowledge.folders.move, {
          id: folderId,
          newParentId: parentId,
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.displayOrder).toBe(3); // After Existing 1 and 2
      });
    });
  });

  // ============================================================================
  // MUTATION: reorder
  // ============================================================================

  describe("reorder", () => {
    it("should require authentication", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.folders.reorder, {
            id: folderId,
            newOrder: 5,
          })
        ).rejects.toThrow();
      });
    });

    it("should update displayOrder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        await asUser.mutation(api.knowledge.folders.reorder, {
          id: folderId,
          newOrder: 5,
        });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.displayOrder).toBe(5);
      });
    });

    it("should throw error for negative displayOrder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.reorder, {
            id: folderId,
            newOrder: -1,
          })
        ).rejects.toThrow("Display order must be a positive number");
      });
    });

    it("should throw error for archived folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);
        await ctx.db.patch(folderId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.reorder, {
            id: folderId,
            newOrder: 5,
          })
        ).rejects.toThrow("Cannot reorder an archived folder");
      });
    });

    it("should require write permission", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.mutation(api.knowledge.folders.reorder, {
            id: folderId,
            newOrder: 5,
          })
        ).rejects.toThrow("You do not have permission to reorder this folder");
      });
    });
  });

  // ============================================================================
  // MUTATION: archive
  // ============================================================================

  describe("archive", () => {
    it("should require authentication", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.folders.archive, { id: folderId })
        ).rejects.toThrow();
      });
    });

    it("should archive folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        await asUser.mutation(api.knowledge.folders.archive, { id: folderId });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.isArchived).toBe(true);
        expect(folder?.archivedAt).toBeDefined();
        expect(folder?.archivedBy).toBe(userId);
      });
    });

    it("should throw error if already archived", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);
        await ctx.db.patch(folderId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.archive, { id: folderId })
        ).rejects.toThrow("Folder is already archived");
      });
    });

    it("should require write permission", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.mutation(api.knowledge.folders.archive, { id: folderId })
        ).rejects.toThrow("You do not have permission to archive this folder");
      });
    });

    it("should create audit log entry", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);
        const folderId = await createFolder(ctx, "Test Folder", workspaceId);

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        await asUser.mutation(api.knowledge.folders.archive, { id: folderId });

        // Assert
        const logs = await ctx.db
          .query("kbAuditLogs")
          .filter((q: any) =>
            q.and(
              q.eq(q.field("resourceId"), folderId),
              q.eq(q.field("eventType"), "folder_archived")
            )
          )
          .collect();

        expect(logs).toHaveLength(1);
        expect(logs[0]!.resourceName).toBe("Test Folder");
        expect(logs[0]!.actorId).toBe(userId);
      });
    });
  });

  // ============================================================================
  // MUTATION: restore
  // ============================================================================

  describe("restore", () => {
    it("should require authentication", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.folders.restore, { id: folderId })
        ).rejects.toThrow();
      });
    });

    it("should restore archived folder", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);
        await ctx.db.patch(folderId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act
        const asUser = t.withIdentity({ subject: "user1" });
        await asUser.mutation(api.knowledge.folders.restore, { id: folderId });

        // Assert
        const folder = await ctx.db.get(folderId);
        expect(folder?.isArchived).toBe(false);
        expect(folder?.archivedAt).toBeUndefined();
        expect(folder?.archivedBy).toBeUndefined();
      });
    });

    it("should throw error if not archived", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.restore, { id: folderId })
        ).rejects.toThrow("Folder is not archived");
      });
    });

    it("should throw error if parent folder is archived", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "write", userId);

        const parentId = await createFolder(ctx, "Parent", workspaceId);
        const folderId = await createFolder(ctx, "Child", workspaceId, parentId);

        // Archive both
        await ctx.db.patch(parentId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });
        await ctx.db.patch(folderId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.restore, { id: folderId })
        ).rejects.toThrow("Cannot restore folder: parent folder is archived");
      });
    });

    it("should throw error if workspace is archived", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const userId = await createUser(ctx, "user1");
        const workspaceId = await createWorkspace(ctx, userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);

        // Archive workspace and folder
        await ctx.db.patch(workspaceId, { isArchived: true });
        await ctx.db.patch(folderId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: userId,
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user1" });
        await expect(
          asUser.mutation(api.knowledge.folders.restore, { id: folderId })
        ).rejects.toThrow("Cannot restore folder: workspace is archived");
      });
    });

    it("should require write permission", async () => {
      const t = createTestContext();

      await t.run(async (ctx) => {
        const ownerId = await createUser(ctx, "owner");
        const userId = await createUser(ctx, "user");
        const workspaceId = await createWorkspace(ctx, ownerId);
        await grantPermission(ctx, userId, "workspace", workspaceId, "read", userId);
        const folderId = await createFolder(ctx, "Test", workspaceId);
        await ctx.db.patch(folderId, {
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: ownerId,
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user" });
        await expect(
          asUser.mutation(api.knowledge.folders.restore, { id: folderId })
        ).rejects.toThrow("You do not have permission to restore this folder");
      });
    });
  });
});
