import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { requireKBAuth, checkPermission } from "../lib/kbAuth";
import { batchFilterAccessibleDocuments } from "./permissionHelpers";
import { checkRateLimit } from "../lib/rateLimit";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum document content size in bytes (10MB) */
const MAX_CONTENT_SIZE_BYTES = 10 * 1024 * 1024; // 10,485,760 bytes

/** Maximum documents per folder */
const MAX_DOCUMENTS_PER_FOLDER = 1000;

/** Retention period for archived documents (90 days in milliseconds) */
const ARCHIVE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// ============================================================================
// VALIDATORS
// ============================================================================

const documentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived")
);

const documentMetadataValidator = v.object({
  _id: v.id("kbDocuments"),
  _creationTime: v.number(),
  title: v.string(),
  folderId: v.id("kbFolders"),
  icon: v.optional(v.string()),
  coverImageId: v.optional(v.id("_storage")),
  creatorId: v.id("users"),
  status: documentStatusValidator,
  publishedAt: v.optional(v.number()),
  displayOrder: v.number(),
  wordCount: v.optional(v.number()),
  lastEditedBy: v.optional(v.id("users")),
  archivedAt: v.optional(v.number()),
  archivedBy: v.optional(v.id("users")),
  permanentDeleteAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const breadcrumbItemValidator = v.object({
  type: v.union(v.literal("workspace"), v.literal("folder"), v.literal("document")),
  id: v.string(),
  name: v.string(),
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List documents in a folder with permission filtering.
 * Returns documents the user has read access to, paginated.
 *
 * @param folderId - The folder to list documents from
 * @param status - Optional status filter (draft, published, archived)
 * @param limit - Maximum number of documents to return (default: 50, max: 100)
 * @param cursor - Cursor for pagination (optional)
 * @returns Paginated list of documents with metadata
 */
export const list = query({
  args: {
    folderId: v.id("kbFolders"),
    status: v.optional(documentStatusValidator),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    documents: v.array(documentMetadataValidator),
    nextCursor: v.union(v.string(), v.null()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify read access to the folder
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "folder",
      args.folderId,
      "read"
    );

    if (!hasAccess) {
      throw new ConvexError("Forbidden: You do not have access to this folder");
    }

    const limit = Math.min(args.limit ?? 50, 100);

    // Use appropriate index based on whether status filter is provided
    let documentsQuery;
    if (args.status) {
      documentsQuery = ctx.db
        .query("kbDocuments")
        .withIndex("by_folder_status", (q) =>
          q.eq("folderId", args.folderId).eq("status", args.status!)
        );
    } else {
      documentsQuery = ctx.db
        .query("kbDocuments")
        .withIndex("by_folder_order", (q) => q.eq("folderId", args.folderId));
    }

    // Collect and paginate manually (Convex pagination requires order)
    const allDocuments = await documentsQuery.order("asc").collect();

    // Apply cursor-based pagination
    let startIndex = 0;
    if (args.cursor) {
      const cursorIndex = allDocuments.findIndex(
        (doc) => doc._id === args.cursor
      );
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedDocs = allDocuments.slice(startIndex, startIndex + limit + 1);
    const hasMore = paginatedDocs.length > limit;
    const documents = paginatedDocs.slice(0, limit);

    const lastDoc = documents[documents.length - 1];
    const nextCursor = hasMore && lastDoc ? lastDoc._id : null;

    return {
      documents,
      nextCursor,
      hasMore,
    };
  },
});

/**
 * Get document metadata by ID with permission check.
 * Returns null if document not found or user lacks access.
 *
 * @param id - The document ID
 * @returns Document metadata or null
 */
export const get = query({
  args: {
    id: v.id("kbDocuments"),
  },
  returns: v.union(documentMetadataValidator, v.null()),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const document = await ctx.db.get(args.id);
    if (!document) {
      return null;
    }

    // Check read permission on the document
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.id,
      "read"
    );

    if (!hasAccess) {
      return null;
    }

    return document;
  },
});

/**
 * Get document content (separate from metadata for performance).
 * Returns the Plate.js JSON content and size.
 *
 * @param documentId - The document ID
 * @returns Document content or null if not found/no access
 */
export const getContent = query({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.union(
    v.object({
      documentId: v.id("kbDocuments"),
      content: v.any(),
      contentText: v.optional(v.string()),
      contentSize: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return null;
    }

    // Check read permission
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "read"
    );

    if (!hasAccess) {
      return null;
    }

    // Get content from separate table
    const content = await ctx.db
      .query("kbDocumentContent")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();

    if (!content) {
      return null;
    }

    return {
      documentId: content.documentId,
      content: content.content,
      contentText: content.contentText,
      contentSize: content.contentSize,
      updatedAt: content.updatedAt,
    };
  },
});

/**
 * Get document path from workspace to document (breadcrumbs).
 * Returns the full path for navigation purposes.
 *
 * @param documentId - The document ID
 * @returns Array of breadcrumb items from workspace to document
 */
export const getBreadcrumbs = query({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.union(v.array(breadcrumbItemValidator), v.null()),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return null;
    }

    // Check read permission
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "read"
    );

    if (!hasAccess) {
      return null;
    }

    const breadcrumbs: Array<{
      type: "workspace" | "folder" | "document";
      id: string;
      name: string;
    }> = [];

    // Add document as last item
    breadcrumbs.push({
      type: "document",
      id: document._id,
      name: document.title,
    });

    // Traverse up through folders and collect workspace info
    let currentFolderId: Id<"kbFolders"> | undefined = document.folderId;
    let workspaceId: Id<"kbWorkspaces"> | undefined;

    while (currentFolderId) {
      const folderDoc: Doc<"kbFolders"> | null = await ctx.db.get(currentFolderId);
      if (!folderDoc) break;

      // Capture workspace ID from the first folder
      if (!workspaceId) {
        workspaceId = folderDoc.workspaceId;
      }

      breadcrumbs.unshift({
        type: "folder",
        id: folderDoc._id,
        name: folderDoc.name,
      });

      currentFolderId = folderDoc.parentId;
    }

    // Add workspace at the beginning
    if (workspaceId) {
      const workspace = await ctx.db.get(workspaceId);
      if (workspace) {
        breadcrumbs.unshift({
          type: "workspace",
          id: workspace._id,
          name: workspace.name,
        });
      }
    }

    return breadcrumbs;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new document in a folder.
 * Creates document metadata and empty content.
 *
 * @param title - Document title
 * @param folderId - Parent folder ID
 * @param icon - Optional icon (emoji or icon name)
 * @returns The new document ID
 */
export const create = mutation({
  args: {
    title: v.string(),
    folderId: v.id("kbFolders"),
    icon: v.optional(v.string()),
  },
  returns: v.id("kbDocuments"),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Check rate limit (100 document creations per hour)
    await checkRateLimit(ctx, userId, "kb.document.create");

    // Verify folder exists
    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new ConvexError("Folder not found");
    }

    // Check write permission on folder
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "folder",
      args.folderId,
      "write"
    );

    if (!hasAccess) {
      throw new ConvexError("Forbidden: You do not have write access to this folder");
    }

    // Check container limit (max 1000 documents per folder)
    const existingDocuments = await ctx.db
      .query("kbDocuments")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    if (existingDocuments.length >= MAX_DOCUMENTS_PER_FOLDER) {
      throw new ConvexError(
        `Folder limit reached: Maximum ${MAX_DOCUMENTS_PER_FOLDER} documents per folder`
      );
    }

    // Calculate next display order
    const maxOrder = existingDocuments.reduce(
      (max, doc) => Math.max(max, doc.displayOrder),
      -1
    );
    const nextOrder = maxOrder + 1;

    const now = Date.now();

    // Create document metadata
    const documentId = await ctx.db.insert("kbDocuments", {
      title: args.title || "Untitled",
      folderId: args.folderId,
      icon: args.icon,
      creatorId: userId,
      status: "draft",
      displayOrder: nextOrder,
      wordCount: 0,
      lastEditedBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    // Create empty content record
    const emptyContent: unknown[] = [];
    await ctx.db.insert("kbDocumentContent", {
      documentId,
      content: emptyContent,
      contentText: "",
      contentSize: 2, // Empty array "[]" is 2 bytes
      updatedAt: now,
    });

    // Log audit event
    await ctx.db.insert("kbAuditLogs", {
      eventType: "document_created",
      resourceType: "document",
      resourceId: documentId,
      resourceName: args.title || "Untitled",
      actorId: userId,
      timestamp: now,
    });

    return documentId;
  },
});

/**
 * Update document metadata (title, icon, coverImageId).
 * Does not update content - use updateContent for that.
 *
 * @param id - Document ID
 * @param title - Optional new title
 * @param icon - Optional new icon
 * @param coverImageId - Optional new cover image
 * @returns null
 */
export const update = mutation({
  args: {
    id: v.id("kbDocuments"),
    title: v.optional(v.string()),
    icon: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Check write permission
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.id,
      "write"
    );

    if (!hasAccess) {
      throw new ConvexError("Forbidden: You do not have write access to this document");
    }

    // Build update object with only defined fields
    const updates: Partial<{
      title: string;
      icon: string;
      coverImageId: Id<"_storage">;
      lastEditedBy: Id<"users">;
      updatedAt: number;
    }> = {
      lastEditedBy: userId,
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      updates.title = args.title;
    }
    if (args.icon !== undefined) {
      updates.icon = args.icon;
    }
    if (args.coverImageId !== undefined) {
      updates.coverImageId = args.coverImageId;
    }

    await ctx.db.patch(args.id, updates);

    return null;
  },
});

/**
 * Update document content (Plate.js JSON).
 * Validates content size (max 10MB).
 *
 * @param documentId - Document ID
 * @param content - Plate.js JSON content
 * @param contentText - Optional extracted plain text for search
 * @param wordCount - Optional word count
 * @returns null
 */
export const updateContent = mutation({
  args: {
    documentId: v.id("kbDocuments"),
    content: v.any(),
    contentText: v.optional(v.string()),
    wordCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Check rate limit (300 content updates per hour)
    await checkRateLimit(ctx, userId, "kb.document.updateContent");

    // Verify document exists
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Check write permission
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "write"
    );

    if (!hasAccess) {
      throw new ConvexError("Forbidden: You do not have write access to this document");
    }

    // Validate content size (10MB max)
    const contentString = JSON.stringify(args.content);
    const contentSize = contentString.length;

    if (contentSize > MAX_CONTENT_SIZE_BYTES) {
      throw new ConvexError("Document exceeds maximum size of 10MB");
    }

    const now = Date.now();

    // Get existing content record
    const existingContent = await ctx.db
      .query("kbDocumentContent")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();

    if (existingContent) {
      // Update existing content
      await ctx.db.patch(existingContent._id, {
        content: args.content,
        contentText: args.contentText,
        contentSize,
        updatedAt: now,
      });
    } else {
      // Create new content record if missing
      await ctx.db.insert("kbDocumentContent", {
        documentId: args.documentId,
        content: args.content,
        contentText: args.contentText,
        contentSize,
        updatedAt: now,
      });
    }

    // Update document metadata
    const documentUpdates: Partial<{
      wordCount: number;
      lastEditedBy: Id<"users">;
      updatedAt: number;
    }> = {
      lastEditedBy: userId,
      updatedAt: now,
    };

    if (args.wordCount !== undefined) {
      documentUpdates.wordCount = args.wordCount;
    }

    await ctx.db.patch(args.documentId, documentUpdates);

    // Log audit event for rate limiting tracking
    await ctx.db.insert("kbAuditLogs", {
      eventType: "document_content_updated",
      resourceType: "document",
      resourceId: args.documentId,
      resourceName: document.title,
      actorId: userId,
      details: {
        contentSize,
        wordCount: args.wordCount,
      },
      timestamp: now,
    });

    return null;
  },
});

/**
 * Publish a document (change status from draft to published).
 * Requires admin permission on the document.
 *
 * @param id - Document ID
 * @returns null
 */
export const publish = mutation({
  args: {
    id: v.id("kbDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Require admin permission to publish
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.id,
      "admin"
    );

    if (!hasAccess) {
      throw new ConvexError("Forbidden: Admin permission required to publish");
    }

    // Verify document is in draft status
    if (document.status !== "draft") {
      throw new ConvexError(
        `Cannot publish: Document is currently ${document.status}`
      );
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: now,
      lastEditedBy: userId,
      updatedAt: now,
    });

    // Log audit event
    await ctx.db.insert("kbAuditLogs", {
      eventType: "document_published",
      resourceType: "document",
      resourceId: args.id,
      resourceName: document.title,
      actorId: userId,
      timestamp: now,
    });

    return null;
  },
});

/**
 * Unpublish a document (change status from published to draft).
 * Requires admin permission on the document.
 *
 * @param id - Document ID
 * @returns null
 */
export const unpublish = mutation({
  args: {
    id: v.id("kbDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Require admin permission to unpublish
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.id,
      "admin"
    );

    if (!hasAccess) {
      throw new ConvexError("Forbidden: Admin permission required to unpublish");
    }

    // Verify document is in published status
    if (document.status !== "published") {
      throw new ConvexError(
        `Cannot unpublish: Document is currently ${document.status}`
      );
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: "draft",
      publishedAt: undefined,
      lastEditedBy: userId,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Move a document to a different folder.
 * Requires write permission on both source and destination folders.
 *
 * @param id - Document ID
 * @param newFolderId - Destination folder ID
 * @returns null
 */
export const move = mutation({
  args: {
    id: v.id("kbDocuments"),
    newFolderId: v.id("kbFolders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Verify destination folder exists
    const newFolder = await ctx.db.get(args.newFolderId);
    if (!newFolder) {
      throw new ConvexError("Destination folder not found");
    }

    // Check write permission on document (current location)
    const hasSourceAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.id,
      "write"
    );

    if (!hasSourceAccess) {
      throw new ConvexError("Forbidden: You do not have write access to this document");
    }

    // Check write permission on destination folder
    const hasDestAccess = await checkPermission(
      ctx,
      userId,
      "folder",
      args.newFolderId,
      "write"
    );

    if (!hasDestAccess) {
      throw new ConvexError("Forbidden: You do not have write access to the destination folder");
    }

    // Check container limit on destination folder
    const existingDocuments = await ctx.db
      .query("kbDocuments")
      .withIndex("by_folder", (q) => q.eq("folderId", args.newFolderId))
      .collect();

    if (existingDocuments.length >= MAX_DOCUMENTS_PER_FOLDER) {
      throw new ConvexError(
        `Destination folder limit reached: Maximum ${MAX_DOCUMENTS_PER_FOLDER} documents per folder`
      );
    }

    // Calculate new display order for destination folder
    const maxOrder = existingDocuments.reduce(
      (max, doc) => Math.max(max, doc.displayOrder),
      -1
    );
    const nextOrder = maxOrder + 1;

    const now = Date.now();

    await ctx.db.patch(args.id, {
      folderId: args.newFolderId,
      displayOrder: nextOrder,
      lastEditedBy: userId,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Archive a document (soft delete).
 * Sets status to archived and schedules permanent deletion in 90 days.
 * Requires admin permission on the document.
 *
 * @param id - Document ID
 * @returns null
 */
export const archive = mutation({
  args: {
    id: v.id("kbDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Require admin permission to archive
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.id,
      "admin"
    );

    if (!hasAccess) {
      throw new ConvexError("Forbidden: Admin permission required to archive");
    }

    // Verify document is not already archived
    if (document.status === "archived") {
      throw new ConvexError("Document is already archived");
    }

    const now = Date.now();
    const permanentDeleteAt = now + ARCHIVE_RETENTION_MS;

    await ctx.db.patch(args.id, {
      status: "archived",
      archivedAt: now,
      archivedBy: userId,
      permanentDeleteAt,
      lastEditedBy: userId,
      updatedAt: now,
    });

    // Log audit event
    await ctx.db.insert("kbAuditLogs", {
      eventType: "document_archived",
      resourceType: "document",
      resourceId: args.id,
      resourceName: document.title,
      actorId: userId,
      details: {
        previousStatus: document.status,
        permanentDeleteAt,
      },
      timestamp: now,
    });

    return null;
  },
});

/**
 * Restore an archived document (unarchive).
 * Changes status back to draft and clears archive metadata.
 * Requires admin permission on the document.
 *
 * @param id - Document ID
 * @returns null
 */
export const restore = mutation({
  args: {
    id: v.id("kbDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Require admin permission to restore
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.id,
      "admin"
    );

    if (!hasAccess) {
      throw new ConvexError("Forbidden: Admin permission required to restore");
    }

    // Verify document is archived
    if (document.status !== "archived") {
      throw new ConvexError("Document is not archived");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: "draft",
      archivedAt: undefined,
      archivedBy: undefined,
      permanentDeleteAt: undefined,
      lastEditedBy: userId,
      updatedAt: now,
    });

    // Log audit event
    await ctx.db.insert("kbAuditLogs", {
      eventType: "document_restored",
      resourceType: "document",
      resourceId: args.id,
      resourceName: document.title,
      actorId: userId,
      timestamp: now,
    });

    return null;
  },
});

// ============================================================================
// FAVORITES MUTATIONS (T032)
// ============================================================================

/**
 * Add a document to user's favorites.
 * Creates a kbUserFavorites record for quick access.
 *
 * @param documentId - The document ID to favorite
 * @returns null
 */
export const addFavorite = mutation({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Check document exists
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Check read access on document
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "read"
    );
    if (!hasAccess) {
      throw new ConvexError("Forbidden: You do not have access to this document");
    }

    // Check if already favorited
    const existing = await ctx.db
      .query("kbUserFavorites")
      .withIndex("by_user_document", (q) =>
        q.eq("userId", userId).eq("documentId", args.documentId)
      )
      .unique();

    if (existing) {
      // Already favorited, no-op
      return null;
    }

    await ctx.db.insert("kbUserFavorites", {
      userId,
      documentId: args.documentId,
      createdAt: Date.now(),
    });

    return null;
  },
});

/**
 * Remove a document from user's favorites.
 *
 * @param documentId - The document ID to unfavorite
 * @returns null
 */
export const removeFavorite = mutation({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const existing = await ctx.db
      .query("kbUserFavorites")
      .withIndex("by_user_document", (q) =>
        q.eq("userId", userId).eq("documentId", args.documentId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});

/**
 * Record document access for recents tracking.
 * Upserts - creates if not exists, updates accessedAt if exists.
 *
 * @param documentId - The document ID being accessed
 * @returns null
 */
export const recordAccess = mutation({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Check document exists
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Check read access on document
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "read"
    );
    if (!hasAccess) {
      throw new ConvexError("Forbidden: You do not have access to this document");
    }

    // Upsert recent record
    const existing = await ctx.db
      .query("kbUserRecents")
      .withIndex("by_user_document", (q) =>
        q.eq("userId", userId).eq("documentId", args.documentId)
      )
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, { accessedAt: now });
    } else {
      await ctx.db.insert("kbUserRecents", {
        userId,
        documentId: args.documentId,
        accessedAt: now,
      });
    }

    return null;
  },
});

// ============================================================================
// FAVORITES & RECENTS QUERIES (T033)
// ============================================================================

/**
 * Get user's favorited documents.
 * Returns documents the user has favorited and still has read access to.
 *
 * OPTIMIZED: Uses batch permission checking to avoid N+1 queries.
 *
 * @returns Array of document metadata
 */
export const getFavorites = query({
  args: {},
  returns: v.array(documentMetadataValidator),
  handler: async (ctx) => {
    const { userId } = await requireKBAuth(ctx);

    // Get all favorites for user, ordered by creation time
    const favorites = await ctx.db
      .query("kbUserFavorites")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    if (favorites.length === 0) {
      return [];
    }

    // Batch fetch all documents at once
    const documentIds = favorites.map((fav) => fav.documentId);
    const documents = await Promise.all(
      documentIds.map((id) => ctx.db.get(id))
    );

    // Create a map of valid (non-null, non-archived) documents
    const validDocs = new Map<string, Doc<"kbDocuments">>();
    const validDocIds: Id<"kbDocuments">[] = [];

    for (const doc of documents) {
      if (doc && doc.status !== "archived") {
        validDocs.set(doc._id, doc);
        validDocIds.push(doc._id);
      }
    }

    // Batch check permissions for all valid documents at once
    const accessibleIds = await batchFilterAccessibleDocuments(
      ctx,
      userId,
      validDocIds,
      "read"
    );

    // Filter to only accessible documents, maintaining favorites order
    const result: Doc<"kbDocuments">[] = [];
    for (const fav of favorites) {
      if (accessibleIds.has(fav.documentId)) {
        const doc = validDocs.get(fav.documentId);
        if (doc) {
          result.push(doc);
        }
      }
    }

    return result;
  },
});

/**
 * Check if a document is favorited by the current user.
 *
 * @param documentId - The document ID to check
 * @returns True if favorited, false otherwise
 */
export const isFavorite = query({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const existing = await ctx.db
      .query("kbUserFavorites")
      .withIndex("by_user_document", (q) =>
        q.eq("userId", userId).eq("documentId", args.documentId)
      )
      .unique();

    return existing !== null;
  },
});

/**
 * Get user's recently accessed documents.
 * Returns documents ordered by most recent access first.
 *
 * OPTIMIZED: Uses batch permission checking to avoid N+1 queries.
 *
 * @param limit - Maximum number of documents to return (default: 10)
 * @returns Array of document metadata
 */
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(documentMetadataValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);
    const limit = args.limit ?? 10;

    // Get recent accesses ordered by time (newest first)
    // Get extra to account for inaccessible/archived docs
    const recents = await ctx.db
      .query("kbUserRecents")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit * 2);

    if (recents.length === 0) {
      return [];
    }

    // Batch fetch all documents at once
    const documentIds = recents.map((recent) => recent.documentId);
    const documents = await Promise.all(
      documentIds.map((id) => ctx.db.get(id))
    );

    // Create a map of valid (non-null, non-archived) documents
    const validDocs = new Map<string, Doc<"kbDocuments">>();
    const validDocIds: Id<"kbDocuments">[] = [];

    for (const doc of documents) {
      if (doc && doc.status !== "archived") {
        validDocs.set(doc._id, doc);
        validDocIds.push(doc._id);
      }
    }

    // Batch check permissions for all valid documents at once
    const accessibleIds = await batchFilterAccessibleDocuments(
      ctx,
      userId,
      validDocIds,
      "read"
    );

    // Filter to only accessible documents, maintaining recents order
    const result: Doc<"kbDocuments">[] = [];
    for (const recent of recents) {
      if (result.length >= limit) break;
      if (accessibleIds.has(recent.documentId)) {
        const doc = validDocs.get(recent.documentId);
        if (doc) {
          result.push(doc);
        }
      }
    }

    return result;
  },
});

// ============================================================================
// REORDER MUTATION (T034)
// ============================================================================

/**
 * Reorder a document within its folder.
 * Updates the displayOrder field for drag-and-drop reordering.
 *
 * @param id - Document ID
 * @param newOrder - New display order value
 * @returns null
 */
export const reorder = mutation({
  args: {
    id: v.id("kbDocuments"),
    newOrder: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Check write permission on document
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.id,
      "write"
    );
    if (!hasAccess) {
      throw new ConvexError("Forbidden: You do not have permission to reorder this document");
    }

    // Validate order value
    if (args.newOrder < 0) {
      throw new ConvexError("Display order must be non-negative");
    }

    await ctx.db.patch(args.id, {
      displayOrder: args.newOrder,
      updatedAt: Date.now(),
    });

    return null;
  },
});
