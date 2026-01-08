import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { ResourceType, ResourceId, PermissionLevel, GranteeType } from "../lib/kbAuth";

// ============================================================================
// BATCH PERMISSION HELPERS (N+1 Query Prevention)
// ============================================================================

/**
 * Compare two permission levels.
 * Returns true if actual >= required.
 */
function hasPermissionLevel(
  actual: PermissionLevel,
  required: PermissionLevel
): boolean {
  const levels: PermissionLevel[] = ["none", "read", "write", "admin"];
  return levels.indexOf(actual) >= levels.indexOf(required);
}

/**
 * Get the higher of two permission levels.
 */
function getHigherPermission(
  a: PermissionLevel | null,
  b: PermissionLevel | null
): PermissionLevel | null {
  if (!a) return b;
  if (!b) return a;
  const levels: PermissionLevel[] = ["none", "read", "write", "admin"];
  return levels.indexOf(a) >= levels.indexOf(b) ? a : b;
}

/**
 * Batch check permissions for multiple documents.
 * Returns a Map from document ID to effective permission level.
 *
 * This eliminates N+1 queries by:
 * 1. Fetching all user-specific permissions in ONE query
 * 2. Fetching all team-specific permissions in ONE query per team
 * 3. Computing effective permission for each document including inheritance
 *
 * @param ctx - Query context
 * @param userId - User ID to check permissions for
 * @param documentIds - Array of document IDs to check
 * @returns Map from document ID string to effective permission level (null if no permission)
 *
 * @example
 * ```typescript
 * const permissions = await batchCheckDocumentPermissions(ctx, userId, docIds);
 * const accessibleDocs = docs.filter(doc =>
 *   hasPermissionLevel(permissions.get(doc._id) ?? "none", "read")
 * );
 * ```
 */
export async function batchCheckDocumentPermissions(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentIds: Id<"kbDocuments">[]
): Promise<Map<string, PermissionLevel | null>> {
  if (documentIds.length === 0) {
    return new Map();
  }

  const result = new Map<string, PermissionLevel | null>();

  // Check if user is global admin (has admin access to everything)
  const user = await ctx.db.get(userId);
  if (user?.role === "admin") {
    for (const docId of documentIds) {
      result.set(docId, "admin");
    }
    return result;
  }

  // Get user's team IDs for team permission checks
  const teamMemberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const teamIds = teamMemberships.map((m) => m.teamId);

  // Fetch all documents in one query
  const documents = await Promise.all(
    documentIds.map((id) => ctx.db.get(id))
  );
  const documentMap = new Map<string, Doc<"kbDocuments">>();
  const folderIds = new Set<Id<"kbFolders">>();

  for (const doc of documents) {
    if (doc) {
      documentMap.set(doc._id, doc);
      folderIds.add(doc.folderId);
    }
  }

  // Fetch all folders in one query
  const folders = await Promise.all(
    Array.from(folderIds).map((id) => ctx.db.get(id))
  );
  const folderMap = new Map<string, Doc<"kbFolders">>();
  const workspaceIds = new Set<Id<"kbWorkspaces">>();
  const parentFolderIds = new Set<Id<"kbFolders">>();

  for (const folder of folders) {
    if (folder) {
      folderMap.set(folder._id, folder);
      workspaceIds.add(folder.workspaceId);
      if (folder.parentId) {
        parentFolderIds.add(folder.parentId);
      }
    }
  }

  // Recursively fetch parent folders (for deep nesting)
  let currentParentIds = parentFolderIds;
  while (currentParentIds.size > 0) {
    const newParentIds = new Set<Id<"kbFolders">>();
    const parentFolders = await Promise.all(
      Array.from(currentParentIds)
        .filter((id) => !folderMap.has(id))
        .map((id) => ctx.db.get(id))
    );
    for (const pf of parentFolders) {
      if (pf && !folderMap.has(pf._id)) {
        folderMap.set(pf._id, pf);
        workspaceIds.add(pf.workspaceId);
        if (pf.parentId && !folderMap.has(pf.parentId)) {
          newParentIds.add(pf.parentId);
        }
      }
    }
    currentParentIds = newParentIds;
  }

  // Fetch all user permissions on documents in one query
  const userDocumentPermissions = await ctx.db
    .query("kbResourcePermissions")
    .withIndex("by_resource_user", (q) =>
      q.eq("resourceType", "document").eq("userId", userId)
    )
    .collect();

  const userDocPermMap = new Map<string, PermissionLevel>();
  for (const perm of userDocumentPermissions) {
    if (perm.documentId && documentMap.has(perm.documentId)) {
      userDocPermMap.set(perm.documentId, perm.level);
    }
  }

  // Fetch all user permissions on folders in one query
  const userFolderPermissions = await ctx.db
    .query("kbResourcePermissions")
    .withIndex("by_resource_user", (q) =>
      q.eq("resourceType", "folder").eq("userId", userId)
    )
    .collect();

  const userFolderPermMap = new Map<string, PermissionLevel>();
  for (const perm of userFolderPermissions) {
    if (perm.folderId && folderMap.has(perm.folderId)) {
      userFolderPermMap.set(perm.folderId, perm.level);
    }
  }

  // Fetch all user permissions on workspaces in one query
  const userWorkspacePermissions = await ctx.db
    .query("kbResourcePermissions")
    .withIndex("by_resource_user", (q) =>
      q.eq("resourceType", "workspace").eq("userId", userId)
    )
    .collect();

  const userWorkspacePermMap = new Map<string, PermissionLevel>();
  for (const perm of userWorkspacePermissions) {
    if (perm.workspaceId && workspaceIds.has(perm.workspaceId)) {
      userWorkspacePermMap.set(perm.workspaceId, perm.level);
    }
  }

  // Fetch team permissions if user is in teams
  const teamDocPermMap = new Map<string, PermissionLevel>();
  const teamFolderPermMap = new Map<string, PermissionLevel>();
  const teamWorkspacePermMap = new Map<string, PermissionLevel>();

  for (const teamId of teamIds) {
    // Document permissions
    const teamDocPerms = await ctx.db
      .query("kbResourcePermissions")
      .withIndex("by_resource_team", (q) =>
        q.eq("resourceType", "document").eq("teamId", teamId)
      )
      .collect();
    for (const perm of teamDocPerms) {
      if (perm.documentId && documentMap.has(perm.documentId)) {
        const existing = teamDocPermMap.get(perm.documentId);
        teamDocPermMap.set(
          perm.documentId,
          getHigherPermission(existing ?? null, perm.level) ?? perm.level
        );
      }
    }

    // Folder permissions
    const teamFolderPerms = await ctx.db
      .query("kbResourcePermissions")
      .withIndex("by_resource_team", (q) =>
        q.eq("resourceType", "folder").eq("teamId", teamId)
      )
      .collect();
    for (const perm of teamFolderPerms) {
      if (perm.folderId && folderMap.has(perm.folderId)) {
        const existing = teamFolderPermMap.get(perm.folderId);
        teamFolderPermMap.set(
          perm.folderId,
          getHigherPermission(existing ?? null, perm.level) ?? perm.level
        );
      }
    }

    // Workspace permissions
    const teamWorkspacePerms = await ctx.db
      .query("kbResourcePermissions")
      .withIndex("by_resource_team", (q) =>
        q.eq("resourceType", "workspace").eq("teamId", teamId)
      )
      .collect();
    for (const perm of teamWorkspacePerms) {
      if (perm.workspaceId && workspaceIds.has(perm.workspaceId)) {
        const existing = teamWorkspacePermMap.get(perm.workspaceId);
        teamWorkspacePermMap.set(
          perm.workspaceId,
          getHigherPermission(existing ?? null, perm.level) ?? perm.level
        );
      }
    }
  }

  // Helper to get effective permission on a folder (including inheritance)
  function getEffectiveFolderPermission(folderId: Id<"kbFolders">): PermissionLevel | null {
    // Direct permission
    const directUser = userFolderPermMap.get(folderId);
    const directTeam = teamFolderPermMap.get(folderId);
    const directPerm = getHigherPermission(directUser ?? null, directTeam ?? null);
    if (directPerm) return directPerm;

    // Inherited from parent folder or workspace
    const folder = folderMap.get(folderId);
    if (!folder) return null;

    if (folder.parentId) {
      return getEffectiveFolderPermission(folder.parentId);
    }

    // Check workspace
    const wsUserPerm = userWorkspacePermMap.get(folder.workspaceId);
    const wsTeamPerm = teamWorkspacePermMap.get(folder.workspaceId);
    return getHigherPermission(wsUserPerm ?? null, wsTeamPerm ?? null);
  }

  // Compute effective permission for each document
  for (const docId of documentIds) {
    const doc = documentMap.get(docId);
    if (!doc) {
      result.set(docId, null);
      continue;
    }

    // Direct document permission
    const directUserPerm = userDocPermMap.get(docId);
    const directTeamPerm = teamDocPermMap.get(docId);
    const directPerm = getHigherPermission(directUserPerm ?? null, directTeamPerm ?? null);

    if (directPerm) {
      result.set(docId, directPerm);
      continue;
    }

    // Inherited from folder
    const folderPerm = getEffectiveFolderPermission(doc.folderId);
    result.set(docId, folderPerm);
  }

  return result;
}

/**
 * Batch check if user has at least the required permission on multiple documents.
 * This is a convenience wrapper around batchCheckDocumentPermissions.
 *
 * @param ctx - Query context
 * @param userId - User ID to check permissions for
 * @param documentIds - Array of document IDs to check
 * @param requiredPermission - Minimum permission level required
 * @returns Set of document IDs where user has sufficient permission
 */
export async function batchFilterAccessibleDocuments(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentIds: Id<"kbDocuments">[],
  requiredPermission: PermissionLevel
): Promise<Set<string>> {
  const permissions = await batchCheckDocumentPermissions(ctx, userId, documentIds);
  const accessible = new Set<string>();

  permissions.forEach((perm, docId) => {
    if (perm && hasPermissionLevel(perm, requiredPermission)) {
      accessible.add(docId);
    }
  });

  return accessible;
}

/**
 * Batch get effective permissions for multiple workspaces.
 * Returns a Map from workspace ID to effective permission level.
 *
 * @param ctx - Query context
 * @param userId - User ID to check permissions for
 * @param workspaceIds - Array of workspace IDs to check
 * @returns Map from workspace ID string to effective permission level
 */
export async function batchGetWorkspacePermissions(
  ctx: QueryCtx,
  userId: Id<"users">,
  workspaceIds: Id<"kbWorkspaces">[]
): Promise<Map<string, PermissionLevel | null>> {
  if (workspaceIds.length === 0) {
    return new Map();
  }

  const result = new Map<string, PermissionLevel | null>();

  // Check if user is global admin
  const user = await ctx.db.get(userId);
  if (user?.role === "admin") {
    for (const wsId of workspaceIds) {
      result.set(wsId, "admin");
    }
    return result;
  }

  // Get user's team IDs
  const teamMemberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const teamIds = teamMemberships.map((m) => m.teamId);

  // Create a set of workspace IDs for filtering
  const wsIdSet = new Set(workspaceIds.map(id => id as string));

  // Fetch all user permissions on workspaces in one query
  const userPermissions = await ctx.db
    .query("kbResourcePermissions")
    .withIndex("by_resource_user", (q) =>
      q.eq("resourceType", "workspace").eq("userId", userId)
    )
    .collect();

  const userPermMap = new Map<string, PermissionLevel>();
  for (const perm of userPermissions) {
    if (perm.workspaceId && wsIdSet.has(perm.workspaceId)) {
      userPermMap.set(perm.workspaceId, perm.level);
    }
  }

  // Fetch team permissions
  const teamPermMap = new Map<string, PermissionLevel>();
  for (const teamId of teamIds) {
    const teamPerms = await ctx.db
      .query("kbResourcePermissions")
      .withIndex("by_resource_team", (q) =>
        q.eq("resourceType", "workspace").eq("teamId", teamId)
      )
      .collect();

    for (const perm of teamPerms) {
      if (perm.workspaceId && wsIdSet.has(perm.workspaceId)) {
        const existing = teamPermMap.get(perm.workspaceId);
        teamPermMap.set(
          perm.workspaceId,
          getHigherPermission(existing ?? null, perm.level) ?? perm.level
        );
      }
    }
  }

  // Compute effective permission for each workspace
  for (const wsId of workspaceIds) {
    const userPerm = userPermMap.get(wsId);
    const teamPerm = teamPermMap.get(wsId);
    result.set(wsId, getHigherPermission(userPerm ?? null, teamPerm ?? null));
  }

  return result;
}

/**
 * Parent resource information.
 */
export interface ParentResource {
  type: ResourceType;
  id: ResourceId;
}

/**
 * Get the parent resource of a given resource.
 * Used for permission inheritance traversal.
 *
 * Hierarchy:
 * - Document → Folder → Workspace → null
 * - Folder → Parent Folder OR Workspace → null
 * - Workspace → null (root level)
 *
 * @param ctx - Query context
 * @param resourceType - Type of the resource
 * @param resourceId - ID of the resource
 * @returns Parent resource info, or null if no parent (workspace is root)
 *
 * @example
 * ```typescript
 * // Get parent of a document
 * const parent = await getParentResource(ctx, "document", documentId);
 * // parent: { type: "folder", id: folderId }
 *
 * // Get parent of a folder (could be another folder or workspace)
 * const parent = await getParentResource(ctx, "folder", folderId);
 * // parent: { type: "folder", id: parentFolderId } OR
 * // parent: { type: "workspace", id: workspaceId }
 *
 * // Get parent of workspace (root level)
 * const parent = await getParentResource(ctx, "workspace", workspaceId);
 * // parent: null
 * ```
 */
export async function getParentResource(
  ctx: QueryCtx,
  resourceType: ResourceType,
  resourceId: ResourceId
): Promise<ParentResource | null> {
  switch (resourceType) {
    case "document": {
      const document = await ctx.db.get(resourceId as Id<"kbDocuments">);
      if (!document) return null;

      // Document's parent is always its folder
      return {
        type: "folder",
        id: document.folderId,
      };
    }

    case "folder": {
      const folder = await ctx.db.get(resourceId as Id<"kbFolders">);
      if (!folder) return null;

      // If folder has a parent folder, return it
      if (folder.parentId) {
        return {
          type: "folder",
          id: folder.parentId,
        };
      }

      // Otherwise, parent is the workspace
      return {
        type: "workspace",
        id: folder.workspaceId,
      };
    }

    case "workspace":
      // Workspaces have no parent (they are root)
      return null;

    default:
      return null;
  }
}

/**
 * Traverse the resource hierarchy upwards to find an inherited permission.
 * Stops at the first parent with an explicit permission for the user.
 *
 * @param ctx - Query context
 * @param resourceType - Starting resource type
 * @param resourceId - Starting resource ID
 * @param userId - User ID to check permissions for
 * @returns Highest inherited permission level, or null if none found
 *
 * @example
 * ```typescript
 * // Check if document inherits permission from folder or workspace
 * const permission = await inheritPermission(
 *   ctx,
 *   "document",
 *   documentId,
 *   userId
 * );
 * // Traverses: Document → Folder → Workspace
 * // Returns first permission found, or null
 * ```
 */
export async function inheritPermission(
  ctx: QueryCtx,
  resourceType: ResourceType,
  resourceId: ResourceId,
  userId: Id<"users">
): Promise<PermissionLevel | null> {
  // Get parent resource
  const parent = await getParentResource(ctx, resourceType, resourceId);

  if (!parent) {
    // Reached root level (workspace has no parent)
    return null;
  }

  // Get user's team memberships
  const teamMemberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const teamIds = teamMemberships.map((m) => m.teamId);

  // Check for direct user permission on parent
  const userPermission = await ctx.db
    .query("kbResourcePermissions")
    .withIndex("by_resource_user", (q) =>
      q.eq("resourceType", parent.type).eq("userId", userId)
    )
    .filter((q) => {
      switch (parent.type) {
        case "workspace":
          return q.eq(q.field("workspaceId"), parent.id as Id<"kbWorkspaces">);
        case "folder":
          return q.eq(q.field("folderId"), parent.id as Id<"kbFolders">);
        case "document":
          return q.eq(q.field("documentId"), parent.id as Id<"kbDocuments">);
      }
    })
    .first();

  let highestPermission: PermissionLevel | null = userPermission?.level ?? null;

  // Check team-based permissions on parent
  for (const teamId of teamIds) {
    const teamPermission = await ctx.db
      .query("kbResourcePermissions")
      .withIndex("by_resource_team", (q) =>
        q.eq("resourceType", parent.type).eq("teamId", teamId)
      )
      .filter((q) => {
        switch (parent.type) {
          case "workspace":
            return q.eq(q.field("workspaceId"), parent.id as Id<"kbWorkspaces">);
          case "folder":
            return q.eq(q.field("folderId"), parent.id as Id<"kbFolders">);
          case "document":
            return q.eq(q.field("documentId"), parent.id as Id<"kbDocuments">);
        }
      })
      .first();

    if (teamPermission) {
      const levels: PermissionLevel[] = ["none", "read", "write", "admin"];
      if (
        !highestPermission ||
        levels.indexOf(teamPermission.level) > levels.indexOf(highestPermission)
      ) {
        highestPermission = teamPermission.level;
      }
    }
  }

  // If permission found on parent, return it
  if (highestPermission) {
    return highestPermission;
  }

  // Otherwise, recursively check parent's parent
  return inheritPermission(ctx, parent.type, parent.id, userId);
}

/**
 * Result of a cascade operation.
 */
export interface CascadeResult {
  resourcesUpdated: number;
  resourceIds: string[];
}

/**
 * Apply a permission to a resource and all its children (cascade).
 * Used for bulk permission changes (e.g., granting write access to a folder
 * and all documents within it).
 *
 * Note: This creates explicit permissions on each child resource.
 * If you want inheritance-based permissions, just set the permission on the parent.
 *
 * @param ctx - Mutation context
 * @param resourceId - ID of the resource to cascade from
 * @param resourceType - Type of the resource
 * @param permission - Permission level to apply
 * @param granteeType - Type of grantee (user or team)
 * @param granteeId - ID of the user or team receiving permission
 * @param grantedBy - ID of the user granting the permission
 * @returns Object with count of resources updated and their IDs
 *
 * @example
 * ```typescript
 * // Grant write permission to a folder and all its contents
 * const result = await cascadePermissions(
 *   ctx,
 *   folderId,
 *   "folder",
 *   "write",
 *   "user",
 *   userId,
 *   adminId
 * );
 * // result: { resourcesUpdated: 15, resourceIds: [...] }
 * ```
 */
export async function cascadePermissions(
  ctx: MutationCtx,
  resourceId: ResourceId,
  resourceType: ResourceType,
  permission: PermissionLevel,
  granteeType: GranteeType,
  granteeId: Id<"users"> | Id<"teams">,
  grantedBy: Id<"users">
): Promise<CascadeResult> {
  const updatedResourceIds: string[] = [];
  let count = 0;

  // Apply permission to the resource itself
  await upsertPermission(
    ctx,
    resourceType,
    resourceId,
    permission,
    granteeType,
    granteeId,
    grantedBy
  );
  updatedResourceIds.push(resourceId);
  count++;

  // Cascade to children based on resource type
  if (resourceType === "workspace") {
    // Get all root-level folders in workspace
    const folders = await ctx.db
      .query("kbFolders")
      .withIndex("by_workspace_parent", (q) =>
        q
          .eq("workspaceId", resourceId as Id<"kbWorkspaces">)
          .eq("parentId", undefined)
      )
      .collect();

    // Recursively cascade to each folder
    for (const folder of folders) {
      const result = await cascadePermissions(
        ctx,
        folder._id,
        "folder",
        permission,
        granteeType,
        granteeId,
        grantedBy
      );
      count += result.resourcesUpdated;
      updatedResourceIds.push(...result.resourceIds);
    }
  } else if (resourceType === "folder") {
    // Get all child folders
    const childFolders = await ctx.db
      .query("kbFolders")
      .withIndex("by_parent", (q) => q.eq("parentId", resourceId as Id<"kbFolders">))
      .collect();

    // Recursively cascade to each child folder
    for (const folder of childFolders) {
      const result = await cascadePermissions(
        ctx,
        folder._id,
        "folder",
        permission,
        granteeType,
        granteeId,
        grantedBy
      );
      count += result.resourcesUpdated;
      updatedResourceIds.push(...result.resourceIds);
    }

    // Get all documents in this folder
    const documents = await ctx.db
      .query("kbDocuments")
      .withIndex("by_folder", (q) => q.eq("folderId", resourceId as Id<"kbFolders">))
      .collect();

    // Apply permission to each document
    for (const document of documents) {
      await upsertPermission(
        ctx,
        "document",
        document._id,
        permission,
        granteeType,
        granteeId,
        grantedBy
      );
      updatedResourceIds.push(document._id);
      count++;
    }
  }
  // Documents have no children, so no cascade needed

  return {
    resourcesUpdated: count,
    resourceIds: updatedResourceIds,
  };
}

/**
 * Upsert a permission record (create or update).
 * Helper function for cascadePermissions.
 *
 * @param ctx - Mutation context
 * @param resourceType - Type of resource
 * @param resourceId - ID of resource
 * @param permission - Permission level
 * @param granteeType - Type of grantee
 * @param granteeId - ID of grantee
 * @param grantedBy - ID of user granting permission
 */
async function upsertPermission(
  ctx: MutationCtx,
  resourceType: ResourceType,
  resourceId: ResourceId,
  permission: PermissionLevel,
  granteeType: GranteeType,
  granteeId: Id<"users"> | Id<"teams">,
  grantedBy: Id<"users">
): Promise<void> {
  // Check if permission already exists
  const existingPermission = await ctx.db
    .query("kbResourcePermissions")
    .filter((q) => {
      let resourceCheck;
      switch (resourceType) {
        case "workspace":
          resourceCheck = q.eq(
            q.field("workspaceId"),
            resourceId as Id<"kbWorkspaces">
          );
          break;
        case "folder":
          resourceCheck = q.eq(q.field("folderId"), resourceId as Id<"kbFolders">);
          break;
        case "document":
          resourceCheck = q.eq(
            q.field("documentId"),
            resourceId as Id<"kbDocuments">
          );
          break;
      }

      const granteeCheck =
        granteeType === "user"
          ? q.eq(q.field("userId"), granteeId as Id<"users">)
          : q.eq(q.field("teamId"), granteeId as Id<"teams">);

      return q.and(
        q.eq(q.field("resourceType"), resourceType),
        resourceCheck,
        granteeCheck
      );
    })
    .first();

  if (existingPermission) {
    // Update existing permission
    await ctx.db.patch(existingPermission._id, {
      level: permission,
      grantedBy,
      grantedAt: Date.now(),
    });
  } else {
    // Create new permission
    const permissionData: {
      resourceType: ResourceType;
      level: PermissionLevel;
      isInherited: boolean;
      grantedBy: Id<"users">;
      grantedAt: number;
      workspaceId?: Id<"kbWorkspaces">;
      folderId?: Id<"kbFolders">;
      documentId?: Id<"kbDocuments">;
      userId?: Id<"users">;
      teamId?: Id<"teams">;
    } = {
      resourceType,
      level: permission,
      isInherited: false,
      grantedBy,
      grantedAt: Date.now(),
    };

    // Set resource ID based on type
    switch (resourceType) {
      case "workspace":
        permissionData.workspaceId = resourceId as Id<"kbWorkspaces">;
        break;
      case "folder":
        permissionData.folderId = resourceId as Id<"kbFolders">;
        break;
      case "document":
        permissionData.documentId = resourceId as Id<"kbDocuments">;
        break;
    }

    // Set grantee based on type
    if (granteeType === "user") {
      permissionData.userId = granteeId as Id<"users">;
    } else {
      permissionData.teamId = granteeId as Id<"teams">;
    }

    await ctx.db.insert("kbResourcePermissions", permissionData);
  }
}
