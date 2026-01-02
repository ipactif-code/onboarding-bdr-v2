/**
 * API Contracts: Folders
 *
 * Convex queries and mutations for folder management within workspaces.
 * All functions require authentication via requireAuth().
 */

import { v } from "convex/values";

// =============================================================================
// VALIDATORS
// =============================================================================

export const folderCreateInput = v.object({
  workspaceId: v.id("kbWorkspaces"),
  parentId: v.optional(v.id("kbFolders")), // null = root level
  name: v.string(),
  icon: v.optional(v.string()),
});

export const folderUpdateInput = v.object({
  folderId: v.id("kbFolders"),
  name: v.optional(v.string()),
  icon: v.optional(v.string()),
});

export const folderMoveInput = v.object({
  folderId: v.id("kbFolders"),
  newParentId: v.optional(v.id("kbFolders")), // null = move to root
  newWorkspaceId: v.optional(v.id("kbWorkspaces")), // For cross-workspace moves
});

// =============================================================================
// QUERIES
// =============================================================================

/**
 * List folders at a specific level in the hierarchy.
 *
 * @param workspaceId - Workspace to list from
 * @param parentId - Parent folder (null for root level)
 * @returns Array of folders with document counts
 *
 * @example
 * // Get root folders
 * const folders = useQuery(api.knowledge.folders.list, { workspaceId });
 *
 * // Get subfolders
 * const subfolders = useQuery(api.knowledge.folders.list, { workspaceId, parentId });
 */
export const list = {
  args: {
    workspaceId: v.id("kbWorkspaces"),
    parentId: v.optional(v.id("kbFolders")),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbFolders"),
      name: v.string(),
      icon: v.optional(v.string()),
      displayOrder: v.number(),
      documentCount: v.number(),
      subfolderCount: v.number(),
      hasChildren: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
};

/**
 * Get a single folder by ID.
 *
 * @param folderId - Folder to retrieve
 * @returns Folder with full details or null if not accessible
 *
 * @example
 * const folder = useQuery(api.knowledge.folders.get, { folderId });
 */
export const get = {
  args: {
    folderId: v.id("kbFolders"),
  },
  returns: v.union(
    v.object({
      _id: v.id("kbFolders"),
      name: v.string(),
      icon: v.optional(v.string()),
      workspaceId: v.id("kbWorkspaces"),
      parentId: v.optional(v.id("kbFolders")),
      displayOrder: v.number(),
      userPermission: v.union(
        v.literal("none"),
        v.literal("read"),
        v.literal("write"),
        v.literal("admin")
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
};

/**
 * Get the full folder tree for a workspace.
 *
 * Returns a nested tree structure for sidebar navigation.
 *
 * @param workspaceId - Workspace to get tree for
 * @returns Nested folder tree
 *
 * @example
 * const tree = useQuery(api.knowledge.folders.getTree, { workspaceId });
 */
export const getTree = {
  args: {
    workspaceId: v.id("kbWorkspaces"),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbFolders"),
      name: v.string(),
      icon: v.optional(v.string()),
      documentCount: v.number(),
      children: v.any(), // Recursive tree structure
    })
  ),
};

/**
 * Get breadcrumb path for a folder.
 *
 * @param folderId - Folder to get path for
 * @returns Array of ancestors from root to current
 *
 * @example
 * const path = useQuery(api.knowledge.folders.getBreadcrumbs, { folderId });
 * // Returns: [{ name: "Workspace" }, { name: "Parent" }, { name: "Current" }]
 */
export const getBreadcrumbs = {
  args: {
    folderId: v.id("kbFolders"),
  },
  returns: v.array(
    v.object({
      _id: v.union(v.id("kbWorkspaces"), v.id("kbFolders")),
      type: v.union(v.literal("workspace"), v.literal("folder")),
      name: v.string(),
      icon: v.optional(v.string()),
    })
  ),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create a new folder.
 *
 * @param input - Folder creation data
 * @returns Created folder ID
 * @throws Error if user lacks write permission or container limit exceeded (1000)
 *
 * @example
 * const folderId = await createFolder({
 *   workspaceId,
 *   name: "Training Materials",
 * });
 */
export const create = {
  args: folderCreateInput,
  returns: v.id("kbFolders"),
};

/**
 * Update folder metadata.
 *
 * @param input - Fields to update
 * @throws Error if user lacks write permission
 *
 * @example
 * await updateFolder({
 *   folderId,
 *   name: "Updated Name",
 * });
 */
export const update = {
  args: folderUpdateInput,
  returns: v.null(),
};

/**
 * Move a folder to a new location.
 *
 * Validates that move doesn't create circular reference.
 *
 * @param input - Move parameters
 * @throws Error if user lacks write permission on both source and destination
 *
 * @example
 * // Move to different parent
 * await moveFolder({ folderId, newParentId });
 *
 * // Move to root level
 * await moveFolder({ folderId, newParentId: undefined });
 */
export const move = {
  args: folderMoveInput,
  returns: v.null(),
};

/**
 * Reorder folders within a parent.
 *
 * @param folderId - Folder to reorder
 * @param newOrder - New display order index
 * @throws Error if user lacks write permission
 *
 * @example
 * await reorderFolder({ folderId, newOrder: 2 });
 */
export const reorder = {
  args: {
    folderId: v.id("kbFolders"),
    newOrder: v.number(),
  },
  returns: v.null(),
};

/**
 * Archive a folder (soft delete).
 *
 * Archives all contained folders and documents recursively.
 *
 * @param folderId - Folder to archive
 * @throws Error if user lacks admin permission
 *
 * @example
 * await archiveFolder({ folderId });
 */
export const archive = {
  args: {
    folderId: v.id("kbFolders"),
  },
  returns: v.null(),
};

/**
 * Restore an archived folder.
 *
 * @param folderId - Folder to restore
 * @throws Error if user lacks admin permission
 *
 * @example
 * await restoreFolder({ folderId });
 */
export const restore = {
  args: {
    folderId: v.id("kbFolders"),
  },
  returns: v.null(),
};
