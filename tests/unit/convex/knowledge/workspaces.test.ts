import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import schema from "../../../../convex/schema";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ConvexError } from "convex/values";
// Helper to create test context
const createTestContext = () => {
  return convexTest(schema);
};

describe("knowledge/workspaces", () => {
  describe("Queries", () => {
    describe("list", () => {
      it("should require authentication", async () => {
        const t = createTestContext();

        // Act & Assert - No auth
        await expect(t.query(api.knowledge.workspaces.list, {})).rejects.toThrow();
      });

      it("should return empty array when user has no workspaces", async () => {
        const t = createTestContext();

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
        const workspaces = await asUser.query(api.knowledge.workspaces.list, {});

        // Assert
        expect(workspaces).toEqual([]);
      });

      it("should return workspaces owned by user", async () => {
        const t = createTestContext();

        // Arrange
        const userId = await t.run(async (ctx) => {
          const uid = await ctx.db.insert("users", {
            clerkId: "owner-clerk-id",
            email: "owner@example.com",
            name: "Owner",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId1 = await ctx.db.insert("kbWorkspaces", {
            name: "Workspace 1",
            slug: "workspace-1",
            ownerId: uid,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          const wsId2 = await ctx.db.insert("kbWorkspaces", {
            name: "Workspace 2",
            slug: "workspace-2",
            ownerId: uid,
            defaultPermission: "write",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          // Create admin permissions for owner
          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId1,
            userId: uid,
            level: "admin",
            isInherited: false,
            grantedBy: uid,
            grantedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId2,
            userId: uid,
            level: "admin",
            isInherited: false,
            grantedBy: uid,
            grantedAt: now,
          });

          return uid;
        });

        // Act
        const asUser = t.withIdentity({ subject: "owner-clerk-id" });
        const workspaces = await asUser.query(api.knowledge.workspaces.list, {});

        // Assert
        expect(workspaces).toHaveLength(2);
        expect(workspaces[0]?.name).toBe("Workspace 1");
        expect(workspaces[1]?.name).toBe("Workspace 2");
        expect(workspaces[0]?.userPermission).toBe("admin");
      });

      it("should exclude archived workspaces by default", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();

          // Active workspace
          const activeWsId = await ctx.db.insert("kbWorkspaces", {
            name: "Active Workspace",
            slug: "active-workspace",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          // Archived workspace
          await ctx.db.insert("kbWorkspaces", {
            name: "Archived Workspace",
            slug: "archived-workspace",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: true,
            archivedAt: now,
            archivedBy: userId,
            createdAt: now,
            updatedAt: now,
          });

          // Create permissions
          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: activeWsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspaces = await asUser.query(api.knowledge.workspaces.list, {});

        // Assert
        expect(workspaces).toHaveLength(1);
        expect(workspaces[0]?.name).toBe("Active Workspace");
      });

      it("should include archived workspaces when requested", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();

          const activeWsId = await ctx.db.insert("kbWorkspaces", {
            name: "Active Workspace",
            slug: "active-workspace",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          const archivedWsId = await ctx.db.insert("kbWorkspaces", {
            name: "Archived Workspace",
            slug: "archived-workspace",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: true,
            archivedAt: now,
            archivedBy: userId,
            createdAt: now,
            updatedAt: now,
          });

          // Create permissions
          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: activeWsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: archivedWsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspaces = await asUser.query(api.knowledge.workspaces.list, {
          includeArchived: true,
        });

        // Assert
        expect(workspaces).toHaveLength(2);
      });

      it("should return workspaces with explicit permissions", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
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

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Shared Workspace",
            slug: "shared-workspace",
            ownerId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          // Grant write permission to user
          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId,
            level: "write",
            isInherited: false,
            grantedBy: ownerId,
            grantedAt: now,
          });
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspaces = await asUser.query(api.knowledge.workspaces.list, {});

        // Assert
        expect(workspaces).toHaveLength(1);
        expect(workspaces[0]?.name).toBe("Shared Workspace");
        expect(workspaces[0]?.userPermission).toBe("write");
      });

      it("should sort workspaces by name", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();

          // Create workspaces in non-alphabetical order
          for (const name of ["Zebra", "Alpha", "Mike"]) {
            const wsId = await ctx.db.insert("kbWorkspaces", {
              name,
              slug: name.toLowerCase(),
              ownerId: userId,
              defaultPermission: "read",
              isArchived: false,
              createdAt: now,
              updatedAt: now,
            });

            await ctx.db.insert("kbResourcePermissions", {
              resourceType: "workspace",
              workspaceId: wsId,
              userId,
              level: "admin",
              isInherited: false,
              grantedBy: userId,
              grantedAt: now,
            });
          }
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspaces = await asUser.query(api.knowledge.workspaces.list, {});

        // Assert
        expect(workspaces).toHaveLength(3);
        expect(workspaces.map((w) => w.name)).toEqual(["Alpha", "Mike", "Zebra"]);
      });
    });

    describe("get", () => {
      it("should require authentication", async () => {
        const t = createTestContext();
        const fakeId = "k175xp9v5vkmxekqnjspm53jz574r9r1" as Id<"kbWorkspaces">;

        // Act & Assert
        await expect(t.query(api.knowledge.workspaces.get, { id: fakeId })).rejects.toThrow();
      });

      it("should return null for non-existent workspace", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });
        });

        const fakeId = "k175xp9v5vkmxekqnjspm53jz574r9r1" as Id<"kbWorkspaces">;

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspace = await asUser.query(api.knowledge.workspaces.get, { id: fakeId });

        // Assert
        expect(workspace).toBeNull();
      });

      it("should return null when user has no access", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const ownerId = await ctx.db.insert("users", {
            clerkId: "owner-clerk-id",
            email: "owner@example.com",
            name: "Owner",
            role: "user",
            status: "online",
          });

          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          return await ctx.db.insert("kbWorkspaces", {
            name: "Private Workspace",
            slug: "private-workspace",
            ownerId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        });

        // Act - different user
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspace = await asUser.query(api.knowledge.workspaces.get, { id: workspaceId });

        // Assert
        expect(workspace).toBeNull();
      });

      it("should return workspace when user has access", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test Workspace",
            slug: "test-workspace",
            description: "Test description",
            icon: "📚",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });

          return wsId;
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspace = await asUser.query(api.knowledge.workspaces.get, { id: workspaceId });

        // Assert
        expect(workspace).toBeDefined();
        expect(workspace?.name).toBe("Test Workspace");
        expect(workspace?.slug).toBe("test-workspace");
        expect(workspace?.description).toBe("Test description");
        expect(workspace?.icon).toBe("📚");
        expect(workspace?.userPermission).toBe("admin");
      });
    });

    describe("getBySlug", () => {
      it("should require authentication", async () => {
        const t = createTestContext();

        // Act & Assert
        await expect(
          t.query(api.knowledge.workspaces.getBySlug, { slug: "test-slug" })
        ).rejects.toThrow();
      });

      it("should return null for non-existent slug", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspace = await asUser.query(api.knowledge.workspaces.getBySlug, {
          slug: "non-existent",
        });

        // Assert
        expect(workspace).toBeNull();
      });

      it("should return workspace by slug", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Slug Test",
            slug: "slug-test",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspace = await asUser.query(api.knowledge.workspaces.getBySlug, {
          slug: "slug-test",
        });

        // Assert
        expect(workspace).toBeDefined();
        expect(workspace?.name).toBe("Slug Test");
        expect(workspace?.slug).toBe("slug-test");
      });
    });
  });

  describe("Mutations", () => {
    describe("create", () => {
      it("should require authentication", async () => {
        const t = createTestContext();

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.workspaces.create, {
            name: "Test",
            slug: "test",
          })
        ).rejects.toThrow();
      });

      it("should create workspace with valid data", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspaceId = await asUser.mutation(api.knowledge.workspaces.create, {
          name: "New Workspace",
          slug: "new-workspace",
          description: "Test description",
          icon: "📚",
          defaultPermission: "write",
        });

        // Assert
        const workspace = await t.run(async (ctx) => ctx.db.get(workspaceId));
        expect(workspace).toBeDefined();
        expect(workspace?.name).toBe("New Workspace");
        expect(workspace?.slug).toBe("new-workspace");
        expect(workspace?.description).toBe("Test description");
        expect(workspace?.icon).toBe("📚");
        expect(workspace?.defaultPermission).toBe("write");
        expect(workspace?.isArchived).toBe(false);

        // Check that admin permission was created
        const permission = await t.run(async (ctx) => {
          return await ctx.db
            .query("kbResourcePermissions")
            .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
            .first();
        });
        expect(permission?.level).toBe("admin");

        // Check audit log
        const auditLog = await t.run(async (ctx) => {
          return await ctx.db
            .query("kbAuditLogs")
            .filter((q) => q.eq(q.field("resourceId"), workspaceId))
            .first();
        });
        expect(auditLog?.eventType).toBe("workspace_created");
      });

      it("should validate name length (min 3 chars)", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.create, {
            name: "Ab",
            slug: "test",
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should validate name length (max 100 chars)", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.create, {
            name: "a".repeat(101),
            slug: "test",
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should validate slug format (lowercase alphanumeric + hyphens)", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });
        });

        const asUser = t.withIdentity({ subject: "user-clerk-id" });

        // Invalid: uppercase
        await expect(
          asUser.mutation(api.knowledge.workspaces.create, {
            name: "Test",
            slug: "Test-Workspace",
          })
        ).rejects.toThrow(ConvexError);

        // Invalid: special characters
        await expect(
          asUser.mutation(api.knowledge.workspaces.create, {
            name: "Test",
            slug: "test_workspace",
          })
        ).rejects.toThrow(ConvexError);

        // Invalid: starts with hyphen
        await expect(
          asUser.mutation(api.knowledge.workspaces.create, {
            name: "Test",
            slug: "-test",
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should validate slug length (min 3 chars)", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.create, {
            name: "Test",
            slug: "ab",
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should validate slug length (max 50 chars)", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.create, {
            name: "Test",
            slug: "a".repeat(51),
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should enforce slug uniqueness", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          // Create existing workspace
          await ctx.db.insert("kbWorkspaces", {
            name: "Existing",
            slug: "existing-slug",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.create, {
            name: "New Workspace",
            slug: "existing-slug",
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should validate description length (max 1000 chars)", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.create, {
            name: "Test",
            slug: "test",
            description: "a".repeat(1001),
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should use default permission level when not specified", async () => {
        const t = createTestContext();

        await t.run(async (ctx) => {
          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        const workspaceId = await asUser.mutation(api.knowledge.workspaces.create, {
          name: "Test",
          slug: "test",
        });

        // Assert
        const workspace = await t.run(async (ctx) => ctx.db.get(workspaceId));
        expect(workspace?.defaultPermission).toBe("read");
      });
    });

    describe("update", () => {
      it("should require authentication", async () => {
        const t = createTestContext();
        const fakeId = "k175xp9v5vkmxekqnjspm53jz574r9r1" as Id<"kbWorkspaces">;

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.workspaces.update, {
            id: fakeId,
            name: "Updated",
          })
        ).rejects.toThrow();
      });

      it("should require admin permission", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const ownerId = await ctx.db.insert("users", {
            clerkId: "owner-clerk-id",
            email: "owner@example.com",
            name: "Owner",
            role: "user",
            status: "online",
          });

          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          return await ctx.db.insert("kbWorkspaces", {
            name: "Test Workspace",
            slug: "test-workspace",
            ownerId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        });

        // Act & Assert - user without permission
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.update, {
            id: workspaceId,
            name: "Updated",
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should update workspace metadata", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Original Name",
            slug: "original-slug",
            description: "Original description",
            icon: "📚",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });

          return wsId;
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await asUser.mutation(api.knowledge.workspaces.update, {
          id: workspaceId,
          name: "Updated Name",
          description: "Updated description",
          icon: "📖",
          defaultPermission: "write",
        });

        // Assert
        const workspace = await t.run(async (ctx) => ctx.db.get(workspaceId));
        expect(workspace?.name).toBe("Updated Name");
        expect(workspace?.description).toBe("Updated description");
        expect(workspace?.icon).toBe("📖");
        expect(workspace?.defaultPermission).toBe("write");
        expect(workspace?.slug).toBe("original-slug"); // Slug not updated
      });

      it("should validate updated name length", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });

          return wsId;
        });

        // Act & Assert - too short
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.update, {
            id: workspaceId,
            name: "Ab",
          })
        ).rejects.toThrow(ConvexError);

        // Too long
        await expect(
          asUser.mutation(api.knowledge.workspaces.update, {
            id: workspaceId,
            name: "a".repeat(101),
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should validate updated description length", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });

          return wsId;
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.update, {
            id: workspaceId,
            description: "a".repeat(1001),
          })
        ).rejects.toThrow(ConvexError);
      });
    });

    describe("archive", () => {
      it("should require authentication", async () => {
        const t = createTestContext();
        const fakeId = "k175xp9v5vkmxekqnjspm53jz574r9r1" as Id<"kbWorkspaces">;

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.workspaces.archive, { id: fakeId })
        ).rejects.toThrow();
      });

      it("should require admin permission", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const ownerId = await ctx.db.insert("users", {
            clerkId: "owner-clerk-id",
            email: "owner@example.com",
            name: "Owner",
            role: "user",
            status: "online",
          });

          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          return await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.archive, { id: workspaceId })
        ).rejects.toThrow(ConvexError);
      });

      it("should archive workspace", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });

          return wsId;
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await asUser.mutation(api.knowledge.workspaces.archive, { id: workspaceId });

        // Assert
        const workspace = await t.run(async (ctx) => ctx.db.get(workspaceId));
        expect(workspace?.isArchived).toBe(true);
        expect(workspace?.archivedAt).toBeDefined();
        expect(workspace?.archivedBy).toBeDefined();

        // Check audit log
        const auditLog = await t.run(async (ctx) => {
          return await ctx.db
            .query("kbAuditLogs")
            .filter((q) =>
              q.and(
                q.eq(q.field("resourceId"), workspaceId),
                q.eq(q.field("eventType"), "workspace_archived")
              )
            )
            .first();
        });
        expect(auditLog).toBeDefined();
      });

      it("should throw error if already archived", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: true,
            archivedAt: now,
            archivedBy: userId,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });

          return wsId;
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.archive, { id: workspaceId })
        ).rejects.toThrow(ConvexError);
      });
    });

    describe("restore", () => {
      it("should require authentication", async () => {
        const t = createTestContext();
        const fakeId = "k175xp9v5vkmxekqnjspm53jz574r9r1" as Id<"kbWorkspaces">;

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.workspaces.restore, { id: fakeId })
        ).rejects.toThrow();
      });

      it("should require admin permission", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const ownerId = await ctx.db.insert("users", {
            clerkId: "owner-clerk-id",
            email: "owner@example.com",
            name: "Owner",
            role: "user",
            status: "online",
          });

          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          return await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId,
            defaultPermission: "read",
            isArchived: true,
            archivedAt: now,
            archivedBy: ownerId,
            createdAt: now,
            updatedAt: now,
          });
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.restore, { id: workspaceId })
        ).rejects.toThrow(ConvexError);
      });

      it("should restore archived workspace", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: true,
            archivedAt: now,
            archivedBy: userId,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });

          return wsId;
        });

        // Act
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await asUser.mutation(api.knowledge.workspaces.restore, { id: workspaceId });

        // Assert
        const workspace = await t.run(async (ctx) => ctx.db.get(workspaceId));
        expect(workspace?.isArchived).toBe(false);
        expect(workspace?.archivedAt).toBeUndefined();
        expect(workspace?.archivedBy).toBeUndefined();
      });

      it("should throw error if not archived", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId: userId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId,
            level: "admin",
            isInherited: false,
            grantedBy: userId,
            grantedAt: now,
          });

          return wsId;
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.restore, { id: workspaceId })
        ).rejects.toThrow(ConvexError);
      });
    });

    describe("transferOwnership", () => {
      it("should require authentication", async () => {
        const t = createTestContext();
        const fakeWsId = "k175xp9v5vkmxekqnjspm53jz574r9r1" as Id<"kbWorkspaces">;
        const fakeUserId = "k175xp9v5vkmxekqnjspm53jz574r9r2" as Id<"users">;

        // Act & Assert
        await expect(
          t.mutation(api.knowledge.workspaces.transferOwnership, {
            id: fakeWsId,
            newOwnerId: fakeUserId,
          })
        ).rejects.toThrow();
      });

      it("should require admin permission", async () => {
        const t = createTestContext();

        const { workspaceId, newOwnerId } = await t.run(async (ctx) => {
          const ownerId = await ctx.db.insert("users", {
            clerkId: "owner-clerk-id",
            email: "owner@example.com",
            name: "Owner",
            role: "user",
            status: "online",
          });

          await ctx.db.insert("users", {
            clerkId: "user-clerk-id",
            email: "user@example.com",
            name: "User",
            role: "user",
            status: "online",
          });

          const newOwner = await ctx.db.insert("users", {
            clerkId: "new-owner-clerk-id",
            email: "newowner@example.com",
            name: "New Owner",
            role: "user",
            status: "online",
          });

          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          return { workspaceId: wsId, newOwnerId: newOwner };
        });

        // Act & Assert
        const asUser = t.withIdentity({ subject: "user-clerk-id" });
        await expect(
          asUser.mutation(api.knowledge.workspaces.transferOwnership, {
            id: workspaceId,
            newOwnerId,
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should transfer ownership to new user", async () => {
        const t = createTestContext();

        const { workspaceId, originalOwnerId, newOwnerId } = await t.run(async (ctx) => {
          const ownerId = await ctx.db.insert("users", {
            clerkId: "owner-clerk-id",
            email: "owner@example.com",
            name: "Owner",
            role: "user",
            status: "online",
          });

          const newOwner = await ctx.db.insert("users", {
            clerkId: "new-owner-clerk-id",
            email: "newowner@example.com",
            name: "New Owner",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId: ownerId,
            level: "admin",
            isInherited: false,
            grantedBy: ownerId,
            grantedAt: now,
          });

          return { workspaceId: wsId, originalOwnerId: ownerId, newOwnerId: newOwner };
        });

        // Act
        const asOwner = t.withIdentity({ subject: "owner-clerk-id" });
        await asOwner.mutation(api.knowledge.workspaces.transferOwnership, {
          id: workspaceId,
          newOwnerId,
        });

        // Assert
        const workspace = await t.run(async (ctx) => ctx.db.get(workspaceId));
        expect(workspace?.ownerId).toEqual(newOwnerId);

        // Check that new owner has admin permission
        const newOwnerPermission = await t.run(async (ctx) => {
          return await ctx.db
            .query("kbResourcePermissions")
            .filter((q) =>
              q.and(
                q.eq(q.field("workspaceId"), workspaceId),
                q.eq(q.field("userId"), newOwnerId)
              )
            )
            .first();
        });
        expect(newOwnerPermission?.level).toBe("admin");

        // Check audit log
        const auditLog = await t.run(async (ctx) => {
          return await ctx.db
            .query("kbAuditLogs")
            .filter((q) => q.eq(q.field("resourceId"), workspaceId))
            .order("desc")
            .first();
        });
        expect(auditLog?.eventType).toBe("permission_changed");
      });

      it("should prevent transfer to current owner", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const ownerId = await ctx.db.insert("users", {
            clerkId: "owner-clerk-id",
            email: "owner@example.com",
            name: "Owner",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId: ownerId,
            level: "admin",
            isInherited: false,
            grantedBy: ownerId,
            grantedAt: now,
          });

          return wsId;
        });

        const ownerId = await t.run(async (ctx) => {
          const workspace = await ctx.db.get(workspaceId);
          return workspace!.ownerId;
        });

        // Act & Assert
        const asOwner = t.withIdentity({ subject: "owner-clerk-id" });
        await expect(
          asOwner.mutation(api.knowledge.workspaces.transferOwnership, {
            id: workspaceId,
            newOwnerId: ownerId,
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should throw error if new owner does not exist", async () => {
        const t = createTestContext();

        const workspaceId = await t.run(async (ctx) => {
          const ownerId = await ctx.db.insert("users", {
            clerkId: "owner-clerk-id",
            email: "owner@example.com",
            name: "Owner",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId: ownerId,
            level: "admin",
            isInherited: false,
            grantedBy: ownerId,
            grantedAt: now,
          });

          return wsId;
        });

        const fakeUserId = "k175xp9v5vkmxekqnjspm53jz574r9r2" as Id<"users">;

        // Act & Assert
        const asOwner = t.withIdentity({ subject: "owner-clerk-id" });
        await expect(
          asOwner.mutation(api.knowledge.workspaces.transferOwnership, {
            id: workspaceId,
            newOwnerId: fakeUserId,
          })
        ).rejects.toThrow(ConvexError);
      });

      it("should update existing permission to admin when transferring", async () => {
        const t = createTestContext();

        const { workspaceId, newOwnerId } = await t.run(async (ctx) => {
          const ownerId = await ctx.db.insert("users", {
            clerkId: "owner-clerk-id",
            email: "owner@example.com",
            name: "Owner",
            role: "user",
            status: "online",
          });

          const newOwner = await ctx.db.insert("users", {
            clerkId: "new-owner-clerk-id",
            email: "newowner@example.com",
            name: "New Owner",
            role: "user",
            status: "online",
          });

          const now = Date.now();
          const wsId = await ctx.db.insert("kbWorkspaces", {
            name: "Test",
            slug: "test",
            ownerId,
            defaultPermission: "read",
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });

          // Owner admin permission
          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId: ownerId,
            level: "admin",
            isInherited: false,
            grantedBy: ownerId,
            grantedAt: now,
          });

          // New owner has only read permission
          await ctx.db.insert("kbResourcePermissions", {
            resourceType: "workspace",
            workspaceId: wsId,
            userId: newOwner,
            level: "read",
            isInherited: false,
            grantedBy: ownerId,
            grantedAt: now,
          });

          return { workspaceId: wsId, newOwnerId: newOwner };
        });

        // Act
        const asOwner = t.withIdentity({ subject: "owner-clerk-id" });
        await asOwner.mutation(api.knowledge.workspaces.transferOwnership, {
          id: workspaceId,
          newOwnerId,
        });

        // Assert - permission should be updated to admin
        const newOwnerPermission = await t.run(async (ctx) => {
          return await ctx.db
            .query("kbResourcePermissions")
            .filter((q) =>
              q.and(
                q.eq(q.field("workspaceId"), workspaceId),
                q.eq(q.field("userId"), newOwnerId)
              )
            )
            .first();
        });
        expect(newOwnerPermission?.level).toBe("admin");
      });
    });
  });
});
