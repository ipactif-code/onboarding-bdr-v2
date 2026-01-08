import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
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

describe("collaboration.joinSession", () => {
  it("should allow join when count < 25", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, userId } = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, userId);

      // Grant write permission
      await grantPermission(ctx, "document", documentId, userId, "write");

      return { documentId, userId };
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}` });

    // Act
    const result = await asUser.mutation(api.knowledge.collaboration.joinSession, {
      documentId,
      connectionId: "test-connection-1",
    });

    // Assert
    expect(result.success).toBe(true);
    expect(result.cursorColor).toBeDefined();
    expect(result.collaboratorId).toBeDefined();
    expect(result.message).toBeUndefined();
  });

  it("should reject join when count = 25 (MAX_EDITORS)", async () => {
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

    const asNewUser = t.withIdentity({ subject: `user-clerk-id-${newUserId}-new` });

    // Act
    const result = await asNewUser.mutation(api.knowledge.collaboration.joinSession, {
      documentId,
      connectionId: "test-connection-26",
    });

    // Assert - CRITICAL TEST for 25-editor limit
    expect(result.success).toBe(false);
    expect(result.message).toContain("25");
    expect(result.message).toContain("maximum");
    expect(result.collaboratorId).toBeUndefined();
    expect(result.cursorColor).toBeUndefined();
  });

  it("should return existing session if user already joined", async () => {
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

    // Act - join first time
    const result1 = await asUser.mutation(api.knowledge.collaboration.joinSession, {
      documentId,
      connectionId: "test-connection-1",
    });

    // Act - join second time (rejoin)
    const result2 = await asUser.mutation(api.knowledge.collaboration.joinSession, {
      documentId,
      connectionId: "test-connection-2",
    });

    // Assert - same cursor color and collaborator ID
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result2.cursorColor).toBe(result1.cursorColor);
    expect(result2.collaboratorId).toBe(result1.collaboratorId);
  });

  it("should assign unique cursor color", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, user1Id, user2Id } = await t.run(async (ctx) => {
      const user1Id = await createTestUser(ctx, "user", "-1");
      const user2Id = await createTestUser(ctx, "user", "-2");
      const workspaceId = await createTestWorkspace(ctx, user1Id);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, user1Id);

      await grantPermission(ctx, "document", documentId, user1Id, "write");
      await grantPermission(ctx, "document", documentId, user2Id, "write");

      return { documentId, user1Id, user2Id };
    });

    const asUser1 = t.withIdentity({ subject: `user-clerk-id-${user1Id}-1` });
    const asUser2 = t.withIdentity({ subject: `user-clerk-id-${user2Id}-2` });

    // Act
    const result1 = await asUser1.mutation(api.knowledge.collaboration.joinSession, {
      documentId,
      connectionId: "connection-1",
    });

    const result2 = await asUser2.mutation(api.knowledge.collaboration.joinSession, {
      documentId,
      connectionId: "connection-2",
    });

    // Assert - different colors
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.cursorColor).not.toBe(result2.cursorColor);
  });

  it("should reject when document not found", async () => {
    // Arrange
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await createTestUser(ctx);
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}` });

    // Use a fake document ID
    const fakeDocumentId = "k175xp9v5vkmxekqnjspm53jz574r9r1" as Id<"kbDocuments">;

    // Act
    const result = await asUser.mutation(api.knowledge.collaboration.joinSession, {
      documentId: fakeDocumentId,
      connectionId: "test-connection-1",
    });

    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("should reject when not authenticated", async () => {
    // Arrange
    const t = convexTest(schema);

    const documentId = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      return await createTestDocument(ctx, folderId, userId);
    });

    // Act & Assert - no auth identity
    await expect(
      t.mutation(api.knowledge.collaboration.joinSession, {
        documentId,
        connectionId: "test-connection-1",
      })
    ).rejects.toThrow();
  });
});

describe("collaboration.leaveSession", () => {
  it("should mark session with leftAt and duration", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, userId, connectionId } = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, userId);

      await grantPermission(ctx, "document", documentId, userId, "write");

      const connectionId = "test-connection-1";

      // Create session
      const now = Date.now();
      await ctx.db.insert("kbCollaborationSessions", {
        documentId,
        userId,
        connectionId,
        joinedAt: now,
        leftAt: undefined,
        duration: undefined,
      });

      // Create collaborator
      await ctx.db.insert("kbDocumentCollaborators", {
        documentId,
        userId,
        cursorColor: "#FF5733",
        cursorPosition: undefined,
        selectionRange: undefined,
        isTyping: false,
        lastActiveAt: now,
      });

      return { documentId, userId, connectionId };
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}` });

    // Act
    await asUser.mutation(api.knowledge.collaboration.leaveSession, {
      documentId,
      connectionId,
    });

    // Assert - session updated
    const session = await t.run(async (ctx) => {
      return await ctx.db
        .query("kbCollaborationSessions")
        .withIndex("by_connection", (q) => q.eq("connectionId", connectionId))
        .first();
    });

    expect(session).toBeDefined();
    expect(session!.leftAt).toBeDefined();
    expect(session!.duration).toBeDefined();
    expect(session!.duration).toBeGreaterThan(0);
  });

  it("should delete collaborator record", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, userId, connectionId } = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, userId);

      await grantPermission(ctx, "document", documentId, userId, "write");

      const connectionId = "test-connection-1";

      // Create session and collaborator
      const now = Date.now();
      await ctx.db.insert("kbCollaborationSessions", {
        documentId,
        userId,
        connectionId,
        joinedAt: now,
        leftAt: undefined,
        duration: undefined,
      });

      await ctx.db.insert("kbDocumentCollaborators", {
        documentId,
        userId,
        cursorColor: "#FF5733",
        cursorPosition: undefined,
        selectionRange: undefined,
        isTyping: false,
        lastActiveAt: now,
      });

      return { documentId, userId, connectionId };
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}` });

    // Act
    await asUser.mutation(api.knowledge.collaboration.leaveSession, {
      documentId,
      connectionId,
    });

    // Assert - collaborator deleted
    const collaborator = await t.run(async (ctx) => {
      return await ctx.db
        .query("kbDocumentCollaborators")
        .withIndex("by_document_user", (q) =>
          q.eq("documentId", documentId).eq("userId", userId)
        )
        .first();
    });

    expect(collaborator).toBeNull();
  });

  it("should only affect user's own session", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, user1Id, user2Id, connection1Id, connection2Id } =
      await t.run(async (ctx) => {
        const user1Id = await createTestUser(ctx, "user", "-1");
        const user2Id = await createTestUser(ctx, "user", "-2");
        const workspaceId = await createTestWorkspace(ctx, user1Id);
        const folderId = await createTestFolder(ctx, workspaceId);
        const documentId = await createTestDocument(ctx, folderId, user1Id);

        await grantPermission(ctx, "document", documentId, user1Id, "write");
        await grantPermission(ctx, "document", documentId, user2Id, "write");

        const connection1Id = "connection-1";
        const connection2Id = "connection-2";

        const now = Date.now();

        // Create sessions for both users
        await ctx.db.insert("kbCollaborationSessions", {
          documentId,
          userId: user1Id,
          connectionId: connection1Id,
          joinedAt: now,
          leftAt: undefined,
          duration: undefined,
        });

        await ctx.db.insert("kbCollaborationSessions", {
          documentId,
          userId: user2Id,
          connectionId: connection2Id,
          joinedAt: now,
          leftAt: undefined,
          duration: undefined,
        });

        // Create collaborators
        await ctx.db.insert("kbDocumentCollaborators", {
          documentId,
          userId: user1Id,
          cursorColor: "#FF5733",
          cursorPosition: undefined,
          selectionRange: undefined,
          isTyping: false,
          lastActiveAt: now,
        });

        await ctx.db.insert("kbDocumentCollaborators", {
          documentId,
          userId: user2Id,
          cursorColor: "#33FF57",
          cursorPosition: undefined,
          selectionRange: undefined,
          isTyping: false,
          lastActiveAt: now,
        });

        return { documentId, user1Id, user2Id, connection1Id, connection2Id };
      });

    const asUser1 = t.withIdentity({ subject: `user-clerk-id-${user1Id}-1` });

    // Act - user1 leaves
    await asUser1.mutation(api.knowledge.collaboration.leaveSession, {
      documentId,
      connectionId: connection1Id,
    });

    // Assert - user2 session still active
    const user2Session = await t.run(async (ctx) => {
      return await ctx.db
        .query("kbCollaborationSessions")
        .withIndex("by_connection", (q) => q.eq("connectionId", connection2Id))
        .first();
    });

    const user2Collaborator = await t.run(async (ctx) => {
      return await ctx.db
        .query("kbDocumentCollaborators")
        .withIndex("by_document_user", (q) =>
          q.eq("documentId", documentId).eq("userId", user2Id)
        )
        .first();
    });

    expect(user2Session).toBeDefined();
    expect(user2Session!.leftAt).toBeUndefined(); // Still active
    expect(user2Collaborator).toBeDefined(); // Still exists
  });
});

describe("collaboration.getCollaboratorCount", () => {
  it("should count only active sessions", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, userId } = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, userId);

      await grantPermission(ctx, "document", documentId, userId, "write");

      // Create 3 active sessions
      await createActiveSessions(ctx, documentId, 3);

      // Create 2 ended sessions
      for (let i = 0; i < 2; i++) {
        const endedUserId = await createTestUser(ctx, "user", `-ended-${i}`);
        const now = Date.now();
        await ctx.db.insert("kbCollaborationSessions", {
          documentId,
          userId: endedUserId,
          connectionId: `ended-connection-${i}`,
          joinedAt: now - 60000,
          leftAt: now, // Session ended
          duration: 60000,
        });
      }

      return { documentId, userId };
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}` });

    // Act
    const count = await asUser.query(
      api.knowledge.collaboration.getCollaboratorCount,
      { documentId }
    );

    // Assert - only active sessions counted
    expect(count).toBe(3);
  });

  it("should ignore ended sessions", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, userId } = await t.run(async (ctx) => {
      const userId = await createTestUser(ctx);
      const workspaceId = await createTestWorkspace(ctx, userId);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, userId);

      await grantPermission(ctx, "document", documentId, userId, "write");

      // Create only ended sessions
      for (let i = 0; i < 5; i++) {
        const endedUserId = await createTestUser(ctx, "user", `-ended-${i}`);
        const now = Date.now();
        await ctx.db.insert("kbCollaborationSessions", {
          documentId,
          userId: endedUserId,
          connectionId: `ended-connection-${i}`,
          joinedAt: now - 60000,
          leftAt: now,
          duration: 60000,
        });
      }

      return { documentId, userId };
    });

    const asUser = t.withIdentity({ subject: `user-clerk-id-${userId}` });

    // Act
    const count = await asUser.query(
      api.knowledge.collaboration.getCollaboratorCount,
      { documentId }
    );

    // Assert - count is 0
    expect(count).toBe(0);
  });

  it("should return 0 for document with no sessions", async () => {
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
    const count = await asUser.query(
      api.knowledge.collaboration.getCollaboratorCount,
      { documentId }
    );

    // Assert
    expect(count).toBe(0);
  });
});

describe("collaboration.getActiveCollaborators", () => {
  it("should return all active collaborators with user details", async () => {
    // Arrange
    const t = convexTest(schema);

    const { documentId, user1Id, user2Id } = await t.run(async (ctx) => {
      const user1Id = await createTestUser(ctx, "user", "-1");
      const user2Id = await createTestUser(ctx, "user", "-2");
      const workspaceId = await createTestWorkspace(ctx, user1Id);
      const folderId = await createTestFolder(ctx, workspaceId);
      const documentId = await createTestDocument(ctx, folderId, user1Id);

      await grantPermission(ctx, "document", documentId, user1Id, "write");
      await grantPermission(ctx, "document", documentId, user2Id, "write");

      const now = Date.now();

      // Create collaborators
      await ctx.db.insert("kbDocumentCollaborators", {
        documentId,
        userId: user1Id,
        cursorColor: "#FF5733",
        cursorPosition: undefined,
        selectionRange: undefined,
        isTyping: false,
        lastActiveAt: now,
      });

      await ctx.db.insert("kbDocumentCollaborators", {
        documentId,
        userId: user2Id,
        cursorColor: "#33FF57",
        cursorPosition: undefined,
        selectionRange: undefined,
        isTyping: true,
        lastActiveAt: now,
      });

      return { documentId, user1Id, user2Id };
    });

    const asUser1 = t.withIdentity({ subject: `user-clerk-id-${user1Id}-1` });

    // Act
    const collaborators = await asUser1.query(
      api.knowledge.collaboration.getActiveCollaborators,
      { documentId }
    );

    // Assert
    expect(collaborators).toHaveLength(2);
    expect(collaborators[0].user).toBeDefined();
    expect(collaborators[1].user).toBeDefined();
    expect(collaborators[0].cursorColor).toBeDefined();
    expect(collaborators[1].cursorColor).toBeDefined();
  });
});
