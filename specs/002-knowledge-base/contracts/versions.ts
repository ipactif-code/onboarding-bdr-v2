/**
 * API Contracts: Version History
 *
 * Convex queries and mutations for document version management.
 * Supports auto-versioning (every 5 min) and manual versions.
 * All functions require authentication via requireAuth().
 */

import { v } from "convex/values";

// =============================================================================
// VALIDATORS
// =============================================================================

export const versionType = v.union(
  v.literal("auto"),    // Auto-saved every 5 minutes
  v.literal("manual"),  // User-triggered save
  v.literal("restore")  // Restored from previous version
);

export const manualVersionInput = v.object({
  documentId: v.id("kbDocuments"),
  description: v.optional(v.string()),
});

// =============================================================================
// QUERIES
// =============================================================================

/**
 * List version history for a document.
 *
 * Returns versions in reverse chronological order.
 * Auto-versions older than 7 days are not included (cleaned up).
 *
 * @param documentId - Document to get history for
 * @param limit - Maximum versions to return (default: 50)
 * @param cursor - Pagination cursor
 * @returns Array of versions with author details
 *
 * @example
 * const versions = useQuery(api.knowledge.versions.list, { documentId });
 */
export const list = {
  args: {
    documentId: v.id("kbDocuments"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    versions: v.array(
      v.object({
        _id: v.id("kbDocumentVersions"),
        versionNumber: v.number(),
        versionType: versionType,
        description: v.optional(v.string()),
        contentSize: v.number(),
        author: v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        }),
        createdAt: v.number(),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
  }),
};

/**
 * Get a specific version's content.
 *
 * @param versionId - Version to retrieve
 * @returns Version with full content
 *
 * @example
 * const version = useQuery(api.knowledge.versions.get, { versionId });
 */
export const get = {
  args: {
    versionId: v.id("kbDocumentVersions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("kbDocumentVersions"),
      documentId: v.id("kbDocuments"),
      versionNumber: v.number(),
      versionType: versionType,
      description: v.optional(v.string()),
      content: v.any(), // Plate.js JSON content
      contentSize: v.number(),
      author: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      createdAt: v.number(),
    }),
    v.null()
  ),
};

/**
 * Compare two versions.
 *
 * Returns content of both versions for diff display.
 *
 * @param versionIdA - First version (older)
 * @param versionIdB - Second version (newer)
 * @returns Both versions' content for comparison
 *
 * @example
 * const diff = useQuery(api.knowledge.versions.compare, { versionIdA, versionIdB });
 */
export const compare = {
  args: {
    versionIdA: v.id("kbDocumentVersions"),
    versionIdB: v.id("kbDocumentVersions"),
  },
  returns: v.union(
    v.object({
      versionA: v.object({
        versionNumber: v.number(),
        content: v.any(),
        createdAt: v.number(),
      }),
      versionB: v.object({
        versionNumber: v.number(),
        content: v.any(),
        createdAt: v.number(),
      }),
    }),
    v.null()
  ),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create a manual version snapshot.
 *
 * Manual versions are never auto-deleted (no expiration).
 *
 * @param input - Version creation data
 * @returns Created version ID
 * @throws Error if user lacks write permission
 *
 * @example
 * const versionId = await createVersion({
 *   documentId,
 *   description: "Before major restructure",
 * });
 */
export const create = {
  args: manualVersionInput,
  returns: v.id("kbDocumentVersions"),
};

/**
 * Restore a previous version.
 *
 * Creates a new version with the previous content (non-destructive).
 * The restored version is marked with type "restore".
 *
 * @param versionId - Version to restore from
 * @returns ID of the new version created
 * @throws Error if user lacks write permission
 *
 * @example
 * const newVersionId = await restoreVersion({ versionId });
 */
export const restore = {
  args: {
    versionId: v.id("kbDocumentVersions"),
  },
  returns: v.id("kbDocumentVersions"),
};

/**
 * Update version description.
 *
 * Only manual versions can have their description updated.
 *
 * @param versionId - Version to update
 * @param description - New description
 * @throws Error if user lacks write permission or version is not manual
 *
 * @example
 * await updateVersionDescription({
 *   versionId,
 *   description: "Updated description",
 * });
 */
export const updateDescription = {
  args: {
    versionId: v.id("kbDocumentVersions"),
    description: v.string(),
  },
  returns: v.null(),
};

/**
 * Protect a version from auto-cleanup.
 *
 * Converts an auto-version to a manual version so it won't be deleted.
 *
 * @param versionId - Version to protect
 * @param description - Optional description for the protected version
 * @throws Error if user lacks write permission
 *
 * @example
 * await protectVersion({
 *   versionId,
 *   description: "Important milestone",
 * });
 */
export const protect = {
  args: {
    versionId: v.id("kbDocumentVersions"),
    description: v.optional(v.string()),
  },
  returns: v.null(),
};

// =============================================================================
// INTERNAL (called by scheduler)
// =============================================================================

/**
 * Create an auto-version snapshot.
 *
 * Called internally by the auto-save system every 5 minutes
 * when changes are detected.
 *
 * @internal
 */
export const createAutoVersion = {
  args: {
    documentId: v.id("kbDocuments"),
    content: v.any(),
    authorId: v.id("users"),
  },
  returns: v.id("kbDocumentVersions"),
};

/**
 * Clean up expired auto-versions.
 *
 * Called by scheduled job to delete auto-versions older than 7 days.
 * Manual versions are never deleted.
 *
 * @internal
 */
export const cleanupExpiredVersions = {
  args: {},
  returns: v.object({
    deletedCount: v.number(),
  }),
};
