import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import schema from "../../../../convex/schema";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

/**
 * Test helper: Create a test user in the database.
 */
const createTestUser = async (
  ctx: any,
  role: "admin" | "user" = "user",
  suffix = ""
): Promise<Id<"users">> => {
  return await ctx.db.insert("users", {
    clerkId: `${role}-clerk-id-${Date.now()}${suffix}`,
    email: `${role}${suffix}@example.com`,
    name: `Test ${role} ${suffix}`,
    role,
    status: "online" as const,
  });
};

/**
 * Test helper: Create a test workspace.
 */
const createTestWorkspace = async (
  ctx: any,
  ownerId: Id<"users">
): Promise<Id<"kbWorkspaces">> => {
  return await ctx.db.insert("kbWorkspaces", {
    name: `Test Workspace ${Date.now()}`,
    slug: `test-workspace-${Date.now()}`,
    ownerId,
    defaultPermission: "read",
    isArchived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
};

/**
 * Test helper: Create a test folder.
 */
const createTestFolder = async (
  ctx: any,
  workspaceId: Id<"kbWorkspaces">,
  parentId?: Id<"kbFolders">
): Promise<Id<"kbFolders">> => {
  return await ctx.db.insert("kbFolders", {
    name: `Test Folder ${Date.now()}`,
    workspaceId,
    parentId,
    displayOrder: 1,
    isArchived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
};

/**
 * Test helper: Create a test document.
 */
const createTestDocument = async (
  ctx: any,
  folderId: Id<"kbFolders">,
  creatorId: Id<"users">,
  status: "draft" | "published" | "archived" = "draft"
): Promise<Id<"kbDocuments">> => {
  const now = Date.now();
  return await ctx.db.insert("kbDocuments", {
    title: `Test Document ${now}`,
    folderId,
    creatorId,
    status,
    displayOrder: 1,
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  });
};

/**
 * Test helper: Grant permission to a user for a resource.
 */
const grantPermission = async (
  ctx: any,
  resourceType: "workspace" | "folder" | "document",
  resourceId: Id<"kbWorkspaces"> | Id<"kbFolders"> | Id<"kbDocuments">,
  userId: Id<"users">,
  level: "read" | "write" | "admin"
): Promise<void> => {
  const permissionDoc: any = {
    resourceType,
    userId,
    level,
    isInherited: false,
    grantedBy: userId,
    grantedAt: Date.now(),
  };

  if (resourceType === "workspace") {
    permissionDoc.workspaceId = resourceId as Id<"kbWorkspaces">;
  } else if (resourceType === "folder") {
    permissionDoc.folderId = resourceId as Id<"kbFolders">;
  } else if (resourceType === "document") {
    permissionDoc.documentId = resourceId as Id<"kbDocuments">;
  }

  await ctx.db.insert("kbResourcePermissions", permissionDoc);
};

/**
 * Test helper: Create N active collaboration sessions for a document.
 * Used for load testing the 25-editor limit.
 */
const createActiveSessions = async (
  ctx: any,
  documentId: Id<"kbDocuments">,
  count: number
): Promise<void> => {
  for (let i = 0; i < count; i++) {
    const userId = await createTestUser(ctx, "user", `-${i}`);

    // Create session (without leftAt = active)
    await ctx.db.insert("kbCollaborationSessions", {
      documentId,
      userId,
      connectionId: `test-connection-${i}`,
      joinedAt: Date.now(),
      leftAt: undefined,
      duration: undefined,
    });

    // Create collaborator
    await ctx.db.insert("kbDocumentCollaborators", {
      documentId,
      userId,
      cursorColor: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      cursorPosition: undefined,
      selectionRange: undefined,
      isTyping: false,
      lastActiveAt: Date.now(),
    });
  }
};

describe("actions.getHocuspocusToken", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Set test environment variable
    process.env.HOCUSPOCUS_URL = "ws://localhost:1234";
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it("should reject unauthenticated users", async () => {
    // Arrange
    const t = convexTest(schema);

    const documentId = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      return await createTestDocument(ctx, folderId, userId);
    });

    // Act - no auth identity
    const result = await t.action(api.actions.hocuspocus.getHocuspocusToken, {
      documentId,
    });

    // Assert
    expect(result.canJoin).toBe(false);
    expect(result.reason).toContain("Authentication");
    expect(result.url).toBeUndefined();
    expect(result.roomName).toBeUndefined();
  });

  it("should reject when document not found", async () => {
    // Arrange
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await createTestUser(ctx);
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${Date.now()}` });

    // Use a fake document ID
    const fakeDocumentId = "k175xp9v5vkmxekqnjspm53jz574r9r1" as Id<"kbDocuments">;

    // Act
    const result = await asUser.action(api.actions.hocuspocus.getHocuspocusToken, {
      documentId: fakeDocumentId,
    });

    // Assert
    expect(result.canJoin).toBe(false);
    expect(result.reason).toContain("not found");
    expect(result.url).toBeUndefined();
    expect(result.roomName).toBeUndefined();
  });

  it("should reject when document access denied", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, unauthorizedUserId } = await t.run(async (ctx) => {
      const ownerId = await createTestUser(ctx, "admin", "-owner");
      const workspaceId = await createTestWorkspace(ctx, ownerId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, ownerId);

      // Create unauthorized user (no permission granted)
      const unauthorizedUserId = await createTestUser(ctx, "user", "-unauthorized");

      return { documentId, unauthorizedUserId };
    });

    const asUnauthorized = t.withIdentity({
      subject: `user-clerk-id-${unauthorizedUserId}-unauthorized`,
    });

    // Act
    const result = await asUnauthorized.action(
      api.actions.hocuspocus.getHocuspocusToken,
      {
        documentId,
      }
    );

    // Assert
    expect(result.canJoin).toBe(false);
    expect(result.reason).toContain("not found");
    expect(result.url).toBeUndefined();
  });

  it("should reject when 25-editor limit reached", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, newUserId } = await t.run(async (ctx) => {
      const ownerId = await createTestUser(ctx, "admin");
      const workspaceId = await createTestWorkspace(ctx, ownerId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, ownerId);

      // Create 25 active sessions (MAX_EDITORS)
      await createActiveSessions(ctx, documentId, 25);

      // Create new user who will try to join (26th user)
      const newUserId = await createTestUser(ctx, "user", "-new");
      await grantPermission(ctx, "document", documentId, newUserId, "write");

      return { documentId, newUserId };
    });

    const asNewUser = t.withIdentity({
      subject: `user-clerk-id-${newUserId}-new`,
    });

    // Act - CRITICAL TEST for 25-editor limit in action
    const result = await asNewUser.action(
      api.actions.hocuspocus.getHocuspocusToken,
      {
        documentId,
      }
    );

    // Assert
    expect(result.canJoin).toBe(false);
    expect(result.reason).toContain("25");
    expect(result.reason).toContain("maximum");
    expect(result.activeEditors).toBe(25);
    expect(result.maxEditors).toBe(25);
    expect(result.url).toBeUndefined();
    expect(result.roomName).toBeUndefined();
  });

  it("should return connection details when all checks pass", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, userId } = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, userId);

      await grantPermission(ctx, "document", documentId, userId, "write");

      return { documentId, userId };
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}` });

    // Act
    const result = await asUser.action(api.actions.hocuspocus.getHocuspocusToken, {
      documentId,
    });

    // Assert
    expect(result.canJoin).toBe(true);
    expect(result.url).toBe("ws://localhost:1234");
    expect(result.roomName).toBe(`kb-doc-${documentId}`);
    expect(result.activeEditors).toBe(0);
    expect(result.maxEditors).toBe(25);
    expect(result.reason).toBeUndefined();
  });

  it("should return correct active editor count", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, userId } = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, userId);

      await grantPermission(ctx, "document", documentId, userId, "write");

      // Create 5 active sessions
      await createActiveSessions(ctx, documentId, 5);

      return { documentId, userId };
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}` });

    // Act
    const result = await asUser.action(api.actions.hocuspocus.getHocuspocusToken, {
      documentId,
    });

    // Assert
    expect(result.canJoin).toBe(true);
    expect(result.activeEditors).toBe(5);
    expect(result.maxEditors).toBe(25);
  });

  it("should fail gracefully when HOCUSPOCUS_URL not configured", async () => {
    // Arrange
    const t = convexTest(schema);

    // Remove environment variable
    delete process.env.HOCUSPOCUS_URL;

    const { documentId, userId } = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, userId);

      await grantPermission(ctx, "document", documentId, userId, "write");

      return { documentId, userId };
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}` });

    // Act
    const result = await asUser.action(api.actions.hocuspocus.getHocuspocusToken, {
      documentId,
    });

    // Assert
    expect(result.canJoin).toBe(false);
    expect(result.reason).toContain("not configured");
  });

  it("should allow 24th editor to join (one slot remaining)", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, userId } = await t.run(async (ctx) => {
      const ownerId = await createTestUser(ctx, "admin");
      const workspaceId = await createTestWorkspace(ctx, ownerId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, ownerId);

      // Create 24 active sessions (one slot remaining)
      await createActiveSessions(ctx, documentId, 24);

      // Create new user who will try to join (25th user - should succeed)
      const userId = await createTestUser(ctx, "user", "-25th");
      await grantPermission(ctx, "document", documentId, userId, "write");

      return { documentId, userId };
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}-25th` });

    // Act
    const result = await asUser.action(api.actions.hocuspocus.getHocuspocusToken, {
      documentId,
    });

    // Assert - 25th user should be allowed
    expect(result.canJoin).toBe(true);
    expect(result.url).toBeDefined();
    expect(result.roomName).toBe(`kb-doc-${documentId}`);
    expect(result.activeEditors).toBe(24);
    expect(result.maxEditors).toBe(25);
  });

  it("should generate correct room name format", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, userId } = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, userId);

      await grantPermission(ctx, "document", documentId, userId, "write");

      return { documentId, userId };
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}` });

    // Act
    const result = await asUser.action(api.actions.hocuspocus.getHocuspocusToken, {
      documentId,
    });

    // Assert - room name format
    expect(result.canJoin).toBe(true);
    expect(result.roomName).toMatch(/^kb-doc-/);
    expect(result.roomName).toContain(documentId);
  });
});
