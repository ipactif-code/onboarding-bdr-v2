import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import schema from "../../../../convex/schema";
import { checkRateLimit } from "../../../../convex/lib/rateLimit";
import { ConvexError } from "convex/values";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkRateLimit", () => {
    it("should allow actions under the limit", async () => {
      const t = convexTest(schema);
      const now = Date.now();
      vi.setSystemTime(now);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-id",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create 5 workspace creation events (limit is 10/hour)
        for (let i = 0; i < 5; i++) {
          await ctx.db.insert("kbAuditLogs", {
            eventType: "workspace_created",
            resourceType: "workspace",
            resourceId: `ws-${i}` as any,
            resourceName: `Workspace ${i}`,
            actorId: userId,
            timestamp: now - i * 1000,
          });
        }

        // Act & Assert: 6th action should be allowed
        await expect(
          checkRateLimit(ctx, userId, "kb.workspace.create")
        ).resolves.not.toThrow();
      });
    });

    it("should throw ConvexError when limit exceeded", async () => {
      const t = convexTest(schema);
      const now = Date.now();
      vi.setSystemTime(now);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-id",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create 10 workspace creation events (exactly at limit)
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("kbAuditLogs", {
            eventType: "workspace_created",
            resourceType: "workspace",
            resourceId: `ws-${i}` as any,
            resourceName: `Workspace ${i}`,
            actorId: userId,
            timestamp: now - i * 1000,
          });
        }

        // Act & Assert: 11th action should be rejected
        await expect(
          checkRateLimit(ctx, userId, "kb.workspace.create")
        ).rejects.toThrow(ConvexError);
      });
    });

    it("should include code, message, and retryAfter in error", async () => {
      const t = convexTest(schema);
      const now = Date.now();
      vi.setSystemTime(now);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-id",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create 10 workspace creation events
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("kbAuditLogs", {
            eventType: "workspace_created",
            resourceType: "workspace",
            resourceId: `ws-${i}` as any,
            resourceName: `Workspace ${i}`,
            actorId: userId,
            timestamp: now - i * 1000,
          });
        }

        // Act
        try {
          await checkRateLimit(ctx, userId, "kb.workspace.create");
          expect.fail("Should have thrown ConvexError");
        } catch (error) {
          // Assert
          expect(error).toBeInstanceOf(ConvexError);
          const convexError = error as ConvexError<{
            code: string;
            message: string;
            retryAfter: number;
          }>;
          expect(convexError.data.code).toBe("RATE_LIMIT_EXCEEDED");
          expect(convexError.data.message).toContain("Rate limit exceeded");
          expect(convexError.data.message).toContain("kb.workspace.create");
          expect(typeof convexError.data.retryAfter).toBe("number");
          expect(convexError.data.retryAfter).toBeGreaterThan(0);
        }
      });
    });

    it("should track actions per user independently", async () => {
      const t = convexTest(schema);
      const now = Date.now();
      vi.setSystemTime(now);

      await t.run(async (ctx) => {
        // Arrange: Create two users
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk-id",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        const user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk-id",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        // User 1 creates 10 workspaces (at limit)
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("kbAuditLogs", {
            eventType: "workspace_created",
            resourceType: "workspace",
            resourceId: `ws-u1-${i}` as any,
            resourceName: `Workspace ${i}`,
            actorId: user1Id,
            timestamp: now - i * 1000,
          });
        }

        // User 2 creates 5 workspaces (under limit)
        for (let i = 0; i < 5; i++) {
          await ctx.db.insert("kbAuditLogs", {
            eventType: "workspace_created",
            resourceType: "workspace",
            resourceId: `ws-u2-${i}` as any,
            resourceName: `Workspace ${i}`,
            actorId: user2Id,
            timestamp: now - i * 1000,
          });
        }

        // Act & Assert: User 1 should be blocked
        await expect(
          checkRateLimit(ctx, user1Id, "kb.workspace.create")
        ).rejects.toThrow(ConvexError);

        // User 2 should be allowed
        await expect(
          checkRateLimit(ctx, user2Id, "kb.workspace.create")
        ).resolves.not.toThrow();
      });
    });

    it("should reset count after window expires", async () => {
      const t = convexTest(schema);
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-id",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create 10 workspace creation events (at limit)
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("kbAuditLogs", {
            eventType: "workspace_created",
            resourceType: "workspace",
            resourceId: `ws-${i}` as any,
            resourceName: `Workspace ${i}`,
            actorId: userId,
            timestamp: startTime - i * 1000,
          });
        }

        // Verify limit is exceeded
        await expect(
          checkRateLimit(ctx, userId, "kb.workspace.create")
        ).rejects.toThrow(ConvexError);

        // Advance time by 1 hour + 1 second (window is 1 hour)
        const newTime = startTime + 60 * 60 * 1000 + 1000;
        vi.setSystemTime(newTime);

        // Act & Assert: Should be allowed after window expires
        await expect(
          checkRateLimit(ctx, userId, "kb.workspace.create")
        ).resolves.not.toThrow();
      });
    });

    it("should allow unknown action type (no rate limit)", async () => {
      const t = convexTest(schema);
      const now = Date.now();
      vi.setSystemTime(now);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-id",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Act & Assert: Unknown action should not throw
        // Note: TypeScript prevents this at compile time, but testing runtime behavior
        await expect(
          checkRateLimit(ctx, userId, "kb.unknown.action" as any)
        ).resolves.not.toThrow();
      });
    });

    it("should handle different rate limits for different actions", async () => {
      const t = convexTest(schema);
      const now = Date.now();
      vi.setSystemTime(now);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-id",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId: userId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        });

        const folderId = await ctx.db.insert("kbFolders", {
          name: "Test Folder",
          workspaceId,
          displayOrder: 1,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        });

        // Create 50 folder creation events (at folder limit)
        for (let i = 0; i < 50; i++) {
          await ctx.db.insert("kbAuditLogs", {
            eventType: "folder_created",
            resourceType: "folder",
            resourceId: folderId,
            resourceName: "Test Folder",
            actorId: userId,
            timestamp: now - i * 1000,
          });
        }

        // Create 5 workspace creation events (under workspace limit)
        for (let i = 0; i < 5; i++) {
          await ctx.db.insert("kbAuditLogs", {
            eventType: "workspace_created",
            resourceType: "workspace",
            resourceId: `ws-${i}` as any,
            resourceName: `Workspace ${i}`,
            actorId: userId,
            timestamp: now - i * 1000,
          });
        }

        // Act & Assert: Folder creation should be blocked (limit: 50)
        await expect(
          checkRateLimit(ctx, userId, "kb.folder.create")
        ).rejects.toThrow(ConvexError);

        // Workspace creation should be allowed (limit: 10)
        await expect(
          checkRateLimit(ctx, userId, "kb.workspace.create")
        ).resolves.not.toThrow();
      });
    });

    it("should handle document content update rate limit (300/hour)", async () => {
      const t = convexTest(schema);
      const now = Date.now();
      vi.setSystemTime(now);

      await t.run(async (ctx) => {
        // Arrange
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk-id",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const workspaceId = await ctx.db.insert("kbWorkspaces", {
          name: "Test Workspace",
          slug: "test-workspace",
          ownerId: userId,
          defaultPermission: "read",
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        });

        const folderId = await ctx.db.insert("kbFolders", {
          name: "Test Folder",
          workspaceId,
          displayOrder: 1,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        });

        const documentId = await ctx.db.insert("kbDocuments", {
          title: "Test Document",
          folderId,
          creatorId: userId,
          status: "draft",
          displayOrder: 1,
          wordCount: 0,
          createdAt: now,
          updatedAt: now,
        });

        // Create 299 document update events (under limit)
        for (let i = 0; i < 299; i++) {
          await ctx.db.insert("kbAuditLogs", {
            eventType: "document_content_updated",
            resourceType: "document",
            resourceId: documentId,
            resourceName: "Test Document",
            actorId: userId,
            timestamp: now - i * 100,
          });
        }

        // Act & Assert: 300th update should be allowed
        await expect(
          checkRateLimit(ctx, userId, "kb.document.updateContent")
        ).resolves.not.toThrow();

        // Add one more to reach limit
        await ctx.db.insert("kbAuditLogs", {
          eventType: "document_content_updated",
          resourceType: "document",
          resourceId: documentId,
          resourceName: "Test Document",
          actorId: userId,
          timestamp: now,
        });

        // 301st update should be blocked
        await expect(
          checkRateLimit(ctx, userId, "kb.document.updateContent")
        ).rejects.toThrow(ConvexError);
      });
    });
  });
});
