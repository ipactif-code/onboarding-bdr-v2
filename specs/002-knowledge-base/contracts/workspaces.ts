/**
 * API Contracts: Workspaces
 *
 * Convex queries and mutations for workspace management.
 * All functions require authentication via requireAuth().
 */

import { v } from "convex/values";

// =============================================================================
// VALIDATORS
// =============================================================================

export const workspaceCreateInput = v.object({
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  defaultPermission: v.union(
    v.literal("none"),
    v.literal("read"),
    v.literal("write")
  ),
});

export const workspaceUpdateInput = v.object({
  workspaceId: v.id("kbWorkspaces"),
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  defaultPermission: v.optional(
    v.union(v.literal("none"), v.literal("read"), v.literal("write"))
  ),
});

// =============================================================================
// QUERIES
// =============================================================================

/**
 * List all workspaces the current user can access.
 *
 * @returns Array of workspaces with user's permission level
 *
 * @example
 * const workspaces = useQuery(api.knowledge.workspaces.list);
 */
export const list = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("kbWorkspaces"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      icon: v.optional(v.string()),
      coverImageUrl: v.optional(v.string()),
      defaultPermission: v.union(
        v.literal("none"),
        v.literal("read"),
        v.literal("write")
      ),
      isOwner: v.boolean(),
      userPermission: v.union(
        v.literal("none"),
        v.literal("read"),
        v.literal("write"),
        v.literal("admin")
      ),
      folderCount: v.number(),
      documentCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
};

/**
 * Get a single workspace by ID.
 *
 * @param workspaceId - Workspace to retrieve
 * @returns Workspace with full details or null if not accessible
 *
 * @example
 * const workspace = useQuery(api.knowledge.workspaces.get, { workspaceId });
 */
export const get = {
  args: {
    workspaceId: v.id("kbWorkspaces"),
  },
  returns: v.union(
    v.object({
      _id: v.id("kbWorkspaces"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      icon: v.optional(v.string()),
      coverImageUrl: v.optional(v.string()),
      defaultPermission: v.union(
        v.literal("none"),
        v.literal("read"),
        v.literal("write")
      ),
      owner: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      isOwner: v.boolean(),
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
 * Get workspace by slug for URL routing.
 *
 * @param slug - URL-safe workspace identifier
 * @returns Workspace ID or null
 *
 * @example
 * const workspaceId = useQuery(api.knowledge.workspaces.getBySlug, { slug: "sales-training" });
 */
export const getBySlug = {
  args: {
    slug: v.string(),
  },
  returns: v.union(v.id("kbWorkspaces"), v.null()),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create a new workspace.
 *
 * @param input - Workspace creation data
 * @returns Created workspace ID
 * @throws Error if slug already exists
 *
 * @example
 * const workspaceId = await createWorkspace({
 *   name: "Sales Training",
 *   slug: "sales-training",
 *   defaultPermission: "read",
 * });
 */
export const create = {
  args: workspaceCreateInput,
  returns: v.id("kbWorkspaces"),
};

/**
 * Update workspace metadata.
 *
 * @param input - Fields to update
 * @throws Error if user lacks admin permission
 *
 * @example
 * await updateWorkspace({
 *   workspaceId,
 *   name: "Updated Name",
 * });
 */
export const update = {
  args: workspaceUpdateInput,
  returns: v.null(),
};

/**
 * Upload a cover image for a workspace.
 *
 * @param workspaceId - Target workspace
 * @returns Upload URL for file storage
 *
 * @example
 * const { uploadUrl } = await generateCoverUploadUrl({ workspaceId });
 * await fetch(uploadUrl, { method: "POST", body: file });
 */
export const generateCoverUploadUrl = {
  args: {
    workspaceId: v.id("kbWorkspaces"),
  },
  returns: v.object({
    uploadUrl: v.string(),
  }),
};

/**
 * Archive a workspace (soft delete).
 *
 * Archives all contained folders and documents.
 *
 * @param workspaceId - Workspace to archive
 * @throws Error if user lacks admin permission
 *
 * @example
 * await archiveWorkspace({ workspaceId });
 */
export const archive = {
  args: {
    workspaceId: v.id("kbWorkspaces"),
  },
  returns: v.null(),
};

/**
 * Restore an archived workspace.
 *
 * @param workspaceId - Workspace to restore
 * @throws Error if user lacks admin permission
 *
 * @example
 * await restoreWorkspace({ workspaceId });
 */
export const restore = {
  args: {
    workspaceId: v.id("kbWorkspaces"),
  },
  returns: v.null(),
};

/**
 * Permanently delete a workspace.
 *
 * Only available for archived workspaces. Deletes all content permanently.
 *
 * @param workspaceId - Workspace to delete
 * @throws Error if user lacks admin permission or workspace not archived
 *
 * @example
 * await deleteWorkspace({ workspaceId });
 */
export const deleteWorkspace = {
  args: {
    workspaceId: v.id("kbWorkspaces"),
  },
  returns: v.null(),
};

/**
 * Transfer workspace ownership.
 *
 * @param workspaceId - Workspace to transfer
 * @param newOwnerId - New owner user ID
 * @throws Error if user is not current owner
 *
 * @example
 * await transferOwnership({ workspaceId, newOwnerId });
 */
export const transferOwnership = {
  args: {
    workspaceId: v.id("kbWorkspaces"),
    newOwnerId: v.id("users"),
  },
  returns: v.null(),
};
