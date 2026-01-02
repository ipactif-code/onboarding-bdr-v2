/**
 * API Contracts: Permissions
 *
 * Convex queries and mutations for RBAC permission management.
 * Supports workspace, folder, and document level permissions with inheritance.
 * All functions require authentication via requireAuth().
 */

import { v } from "convex/values";

// =============================================================================
// VALIDATORS
// =============================================================================

export const permissionLevel = v.union(
  v.literal("none"),
  v.literal("read"),
  v.literal("write"),
  v.literal("admin")
);

export const resourceType = v.union(
  v.literal("workspace"),
  v.literal("folder"),
  v.literal("document")
);

export const permissionGrantInput = v.object({
  resourceType: resourceType,
  resourceId: v.string(), // Can be kbWorkspaces, kbFolders, or kbDocuments ID
  granteeType: v.union(v.literal("user"), v.literal("team")),
  granteeId: v.string(), // Can be users or teams ID
  level: permissionLevel,
});

export const permissionRevokeInput = v.object({
  resourceType: resourceType,
  resourceId: v.string(),
  granteeType: v.union(v.literal("user"), v.literal("team")),
  granteeId: v.string(),
});

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Check if current user has a specific permission level on a resource.
 *
 * @param resourceType - Type of resource
 * @param resourceId - Resource ID
 * @param requiredLevel - Minimum required permission level
 * @returns Boolean indicating if user has required permission
 *
 * @example
 * const canEdit = useQuery(api.knowledge.permissions.check, {
 *   resourceType: "document",
 *   resourceId: documentId,
 *   requiredLevel: "write",
 * });
 */
export const check = {
  args: {
    resourceType: resourceType,
    resourceId: v.string(),
    requiredLevel: permissionLevel,
  },
  returns: v.boolean(),
};

/**
 * Get current user's effective permission level on a resource.
 *
 * Computes effective permission considering inheritance.
 *
 * @param resourceType - Type of resource
 * @param resourceId - Resource ID
 * @returns Effective permission level
 *
 * @example
 * const permission = useQuery(api.knowledge.permissions.getEffective, {
 *   resourceType: "document",
 *   resourceId: documentId,
 * });
 */
export const getEffective = {
  args: {
    resourceType: resourceType,
    resourceId: v.string(),
  },
  returns: permissionLevel,
};

/**
 * List all permissions for a resource.
 *
 * @param resourceType - Type of resource
 * @param resourceId - Resource ID
 * @returns Array of permission grants with grantee details
 *
 * @example
 * const permissions = useQuery(api.knowledge.permissions.list, {
 *   resourceType: "workspace",
 *   resourceId: workspaceId,
 * });
 */
export const list = {
  args: {
    resourceType: resourceType,
    resourceId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbResourcePermissions"),
      granteeType: v.union(v.literal("user"), v.literal("team")),
      grantee: v.object({
        _id: v.string(), // users or teams ID
        name: v.string(),
        avatarUrl: v.optional(v.string()),
        memberCount: v.optional(v.number()), // For teams
      }),
      level: permissionLevel,
      isInherited: v.boolean(),
      inheritedFrom: v.optional(v.string()),
      grantedBy: v.object({
        _id: v.id("users"),
        name: v.string(),
      }),
      grantedAt: v.number(),
    })
  ),
};

/**
 * Get effective permissions for all members who can access a resource.
 *
 * Useful for showing "who has access" dialog.
 *
 * @param resourceType - Type of resource
 * @param resourceId - Resource ID
 * @returns Array of users/teams with their effective permissions
 *
 * @example
 * const accessList = useQuery(api.knowledge.permissions.getAccessList, {
 *   resourceType: "document",
 *   resourceId: documentId,
 * });
 */
export const getAccessList = {
  args: {
    resourceType: resourceType,
    resourceId: v.string(),
  },
  returns: v.array(
    v.object({
      type: v.union(v.literal("user"), v.literal("team")),
      id: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      level: permissionLevel,
      source: v.union(v.literal("direct"), v.literal("inherited"), v.literal("owner")),
    })
  ),
};

/**
 * Search users and teams for permission grants.
 *
 * @param query - Search query
 * @param resourceId - Resource to check existing permissions against
 * @returns Matching users and teams with current permission status
 *
 * @example
 * const results = useQuery(api.knowledge.permissions.searchGrantees, {
 *   query: "john",
 *   resourceId: documentId,
 * });
 */
export const searchGrantees = {
  args: {
    query: v.string(),
    resourceType: resourceType,
    resourceId: v.string(),
  },
  returns: v.object({
    users: v.array(
      v.object({
        _id: v.id("users"),
        name: v.string(),
        email: v.string(),
        avatarUrl: v.optional(v.string()),
        currentLevel: v.optional(permissionLevel),
      })
    ),
    teams: v.array(
      v.object({
        _id: v.id("teams"),
        name: v.string(),
        memberCount: v.number(),
        currentLevel: v.optional(permissionLevel),
      })
    ),
  }),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Grant permission to a user or team.
 *
 * Creates audit log entry for permission change.
 *
 * @param input - Permission grant details
 * @throws Error if user lacks admin permission or tries to escalate beyond own level
 *
 * @example
 * await grantPermission({
 *   resourceType: "document",
 *   resourceId: documentId,
 *   granteeType: "user",
 *   granteeId: userId,
 *   level: "write",
 * });
 */
export const grant = {
  args: permissionGrantInput,
  returns: v.null(),
};

/**
 * Update an existing permission grant.
 *
 * @param input - Permission update details
 * @throws Error if user lacks admin permission or tries to escalate beyond own level
 *
 * @example
 * await updatePermission({
 *   resourceType: "document",
 *   resourceId: documentId,
 *   granteeType: "user",
 *   granteeId: userId,
 *   level: "read", // Downgrade from write to read
 * });
 */
export const update = {
  args: permissionGrantInput,
  returns: v.null(),
};

/**
 * Revoke permission from a user or team.
 *
 * Creates audit log entry for permission change.
 *
 * @param input - Permission revoke details
 * @throws Error if user lacks admin permission
 *
 * @example
 * await revokePermission({
 *   resourceType: "document",
 *   resourceId: documentId,
 *   granteeType: "user",
 *   granteeId: userId,
 * });
 */
export const revoke = {
  args: permissionRevokeInput,
  returns: v.null(),
};

/**
 * Set default permission for a workspace.
 *
 * Affects all new items and items without explicit permissions.
 *
 * @param workspaceId - Workspace to update
 * @param level - New default permission level
 * @throws Error if user lacks admin permission
 *
 * @example
 * await setDefaultPermission({
 *   workspaceId,
 *   level: "read",
 * });
 */
export const setDefault = {
  args: {
    workspaceId: v.id("kbWorkspaces"),
    level: v.union(v.literal("none"), v.literal("read"), v.literal("write")),
  },
  returns: v.null(),
};

/**
 * Clear all inherited permissions and use only explicit grants.
 *
 * @param resourceType - Type of resource
 * @param resourceId - Resource ID
 * @throws Error if user lacks admin permission
 *
 * @example
 * await breakInheritance({
 *   resourceType: "folder",
 *   resourceId: folderId,
 * });
 */
export const breakInheritance = {
  args: {
    resourceType: resourceType,
    resourceId: v.string(),
  },
  returns: v.null(),
};

/**
 * Restore permission inheritance from parent.
 *
 * @param resourceType - Type of resource
 * @param resourceId - Resource ID
 * @throws Error if user lacks admin permission
 *
 * @example
 * await restoreInheritance({
 *   resourceType: "folder",
 *   resourceId: folderId,
 * });
 */
export const restoreInheritance = {
  args: {
    resourceType: resourceType,
    resourceId: v.string(),
  },
  returns: v.null(),
};
