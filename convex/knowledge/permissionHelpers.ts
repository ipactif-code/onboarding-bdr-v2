import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { ResourceType, ResourceId, PermissionLevel, GranteeType } from "../lib/kbAuth";

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
