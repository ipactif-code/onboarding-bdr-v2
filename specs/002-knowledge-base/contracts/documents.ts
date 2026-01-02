/**
 * API Contracts: Documents
 *
 * Convex queries and mutations for document management.
 * Content is stored separately for performance.
 * All functions require authentication via requireAuth().
 */

import { v } from "convex/values";

// =============================================================================
// VALIDATORS
// =============================================================================

export const documentCreateInput = v.object({
  folderId: v.id("kbFolders"),
  title: v.string(),
  icon: v.optional(v.string()),
  content: v.optional(v.any()), // Initial Plate.js JSON content
});

export const documentUpdateInput = v.object({
  documentId: v.id("kbDocuments"),
  title: v.optional(v.string()),
  icon: v.optional(v.string()),
});

export const documentContentUpdateInput = v.object({
  documentId: v.id("kbDocuments"),
  content: v.any(), // Plate.js JSON content
});

// =============================================================================
// QUERIES
// =============================================================================

/**
 * List documents in a folder.
 *
 * @param folderId - Folder to list from
 * @param status - Filter by status (default: all non-archived)
 * @returns Array of document metadata (not content)
 *
 * @example
 * const documents = useQuery(api.knowledge.documents.list, { folderId });
 */
export const list = {
  args: {
    folderId: v.id("kbFolders"),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("published"), v.literal("all"))
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbDocuments"),
      title: v.string(),
      icon: v.optional(v.string()),
      coverImageUrl: v.optional(v.string()),
      status: v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      ),
      creator: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      lastEditedBy: v.optional(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        })
      ),
      wordCount: v.optional(v.number()),
      displayOrder: v.number(),
      publishedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
};

/**
 * Get document metadata (without content).
 *
 * @param documentId - Document to retrieve
 * @returns Document metadata or null if not accessible
 *
 * @example
 * const doc = useQuery(api.knowledge.documents.get, { documentId });
 */
export const get = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.union(
    v.object({
      _id: v.id("kbDocuments"),
      title: v.string(),
      icon: v.optional(v.string()),
      coverImageUrl: v.optional(v.string()),
      folderId: v.id("kbFolders"),
      status: v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      ),
      creator: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      lastEditedBy: v.optional(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        })
      ),
      userPermission: v.union(
        v.literal("none"),
        v.literal("read"),
        v.literal("write"),
        v.literal("admin")
      ),
      wordCount: v.optional(v.number()),
      publishedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
};

/**
 * Get document content (separate for performance).
 *
 * @param documentId - Document to get content for
 * @returns Plate.js JSON content or null
 *
 * @example
 * const content = useQuery(api.knowledge.documents.getContent, { documentId });
 */
export const getContent = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.union(
    v.object({
      documentId: v.id("kbDocuments"),
      content: v.any(), // Plate.js JSON
      contentSize: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
};

/**
 * Get breadcrumb path for a document.
 *
 * @param documentId - Document to get path for
 * @returns Array of ancestors from workspace to document
 *
 * @example
 * const path = useQuery(api.knowledge.documents.getBreadcrumbs, { documentId });
 */
export const getBreadcrumbs = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.array(
    v.object({
      _id: v.union(v.id("kbWorkspaces"), v.id("kbFolders"), v.id("kbDocuments")),
      type: v.union(
        v.literal("workspace"),
        v.literal("folder"),
        v.literal("document")
      ),
      name: v.string(),
      icon: v.optional(v.string()),
    })
  ),
};

/**
 * Get user's recently accessed documents.
 *
 * @param limit - Maximum number of documents (default: 10)
 * @returns Array of recently accessed documents
 *
 * @example
 * const recents = useQuery(api.knowledge.documents.getRecent, { limit: 5 });
 */
export const getRecent = {
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbDocuments"),
      title: v.string(),
      icon: v.optional(v.string()),
      folderName: v.string(),
      workspaceName: v.string(),
      accessedAt: v.number(),
    })
  ),
};

/**
 * Get user's favorite documents.
 *
 * @returns Array of favorited documents
 *
 * @example
 * const favorites = useQuery(api.knowledge.documents.getFavorites);
 */
export const getFavorites = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("kbDocuments"),
      title: v.string(),
      icon: v.optional(v.string()),
      folderName: v.string(),
      workspaceName: v.string(),
      favoritedAt: v.number(),
    })
  ),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create a new document.
 *
 * Document is created in draft status, visible only to creator.
 *
 * @param input - Document creation data
 * @returns Created document ID
 * @throws Error if user lacks write permission or folder limit exceeded (1000)
 *
 * @example
 * const documentId = await createDocument({
 *   folderId,
 *   title: "Getting Started Guide",
 * });
 */
export const create = {
  args: documentCreateInput,
  returns: v.id("kbDocuments"),
};

/**
 * Update document metadata.
 *
 * @param input - Fields to update
 * @throws Error if user lacks write permission
 *
 * @example
 * await updateDocument({
 *   documentId,
 *   title: "Updated Title",
 * });
 */
export const update = {
  args: documentUpdateInput,
  returns: v.null(),
};

/**
 * Update document content (auto-save).
 *
 * Validates content size (max 10MB).
 *
 * @param input - Content update data
 * @throws Error if user lacks write permission or size limit exceeded
 *
 * @example
 * await updateContent({
 *   documentId,
 *   content: plateEditorValue,
 * });
 */
export const updateContent = {
  args: documentContentUpdateInput,
  returns: v.null(),
};

/**
 * Upload a cover image for a document.
 *
 * @param documentId - Target document
 * @returns Upload URL for file storage
 *
 * @example
 * const { uploadUrl } = await generateCoverUploadUrl({ documentId });
 */
export const generateCoverUploadUrl = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.object({
    uploadUrl: v.string(),
  }),
};

/**
 * Publish a draft document.
 *
 * Makes document visible according to folder/workspace permissions.
 *
 * @param documentId - Document to publish
 * @throws Error if user lacks write permission or document not in draft status
 *
 * @example
 * await publishDocument({ documentId });
 */
export const publish = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
};

/**
 * Unpublish a document (return to draft).
 *
 * @param documentId - Document to unpublish
 * @throws Error if user lacks write permission
 *
 * @example
 * await unpublishDocument({ documentId });
 */
export const unpublish = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
};

/**
 * Move a document to a different folder.
 *
 * @param documentId - Document to move
 * @param newFolderId - Destination folder
 * @throws Error if user lacks write permission on both source and destination
 *
 * @example
 * await moveDocument({ documentId, newFolderId });
 */
export const move = {
  args: {
    documentId: v.id("kbDocuments"),
    newFolderId: v.id("kbFolders"),
  },
  returns: v.null(),
};

/**
 * Reorder documents within a folder.
 *
 * @param documentId - Document to reorder
 * @param newOrder - New display order index
 * @throws Error if user lacks write permission
 *
 * @example
 * await reorderDocument({ documentId, newOrder: 2 });
 */
export const reorder = {
  args: {
    documentId: v.id("kbDocuments"),
    newOrder: v.number(),
  },
  returns: v.null(),
};

/**
 * Archive a document (soft delete).
 *
 * Archived documents are permanently deleted after 90 days.
 *
 * @param documentId - Document to archive
 * @throws Error if user lacks admin permission
 *
 * @example
 * await archiveDocument({ documentId });
 */
export const archive = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
};

/**
 * Restore an archived document.
 *
 * @param documentId - Document to restore
 * @throws Error if user lacks admin permission
 *
 * @example
 * await restoreDocument({ documentId });
 */
export const restore = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
};

/**
 * Add document to user's favorites.
 *
 * @param documentId - Document to favorite
 *
 * @example
 * await addFavorite({ documentId });
 */
export const addFavorite = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
};

/**
 * Remove document from user's favorites.
 *
 * @param documentId - Document to unfavorite
 *
 * @example
 * await removeFavorite({ documentId });
 */
export const removeFavorite = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
};

/**
 * Record document access for recent history.
 *
 * Called when user opens a document.
 *
 * @param documentId - Document accessed
 *
 * @example
 * await recordAccess({ documentId });
 */
export const recordAccess = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
};

/**
 * Duplicate a document.
 *
 * Creates a copy in the same folder with "(Copy)" suffix.
 *
 * @param documentId - Document to duplicate
 * @returns New document ID
 * @throws Error if user lacks write permission
 *
 * @example
 * const newDocId = await duplicateDocument({ documentId });
 */
export const duplicate = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.id("kbDocuments"),
};
