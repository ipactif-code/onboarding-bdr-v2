import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { requireAuth } from "./auth";

/**
 * Permission levels for Knowledge Base resources.
 * Hierarchical: admin > write > read > none
 */
export type PermissionLevel = "none" | "read" | "write" | "admin";

/**
 * Resource types in the Knowledge Base.
 */
export type ResourceType = "workspace" | "folder" | "document";

/**
 * Grantee types for permissions.
 */
export type GranteeType = "user" | "team";

/**
 * Resource ID type (polymorphic union).
 */
export type ResourceId =
  | Id<"kbWorkspaces">
  | Id<"kbFolders">
  | Id<"kbDocuments">;

/**
 * Wrapper around existing requireAuth() that returns { userId, user }.
 * Use this in Knowledge Base mutations and queries.
 *
 * @param ctx - Query or mutation context
 * @returns Object containing userId (as _id) and full user document
 * @throws Error if not authenticated
 *
 * @example
 * ```typescript
 * const { userId, user } = await requireKBAuth(ctx);
 * ```
 */
export async function requireKBAuth(
  ctx: QueryCtx | MutationCtx
): Promise<{ userId: Id<"users">; user: Doc<"users"> }> {
  const user = await requireAuth(ctx);

  return {
    userId: user._id,
    user,
  };
}

/**
 * Compare two permission levels.
 * Returns true if actual >= required.
 *
 * @param actual - The permission level to check
 * @param required - The required minimum permission level
 * @returns True if actual permission is sufficient
 *
 * @example
 * ```typescript
 * hasPermissionLevel("write", "read") // true
 * hasPermissionLevel("read", "write") // false
 * hasPermissionLevel("admin", "write") // true
 * ```
 */
function hasPermissionLevel(
  actual: PermissionLevel,
  required: PermissionLevel
): boolean {
  const levels: PermissionLevel[] = ["none", "read", "write", "admin"];
  return levels.indexOf(actual) >= levels.indexOf(required);
}

/**
 * Check if a user has the required permission on a specific resource.
 * Considers both direct permissions and inherited permissions from parent resources.
 *
 * @param ctx - Query or mutation context
 * @param userId - The user ID to check permissions for
 * @param resourceType - Type of the resource (workspace, folder, or document)
 * @param resourceId - ID of the resource
 * @param requiredPermission - Minimum permission level required
 * @returns True if user has sufficient permission, false otherwise
 *
 * @example
 * ```typescript
 * const canEdit = await checkPermission(
 *   ctx,
 *   userId,
 *   "document",
 *   documentId,
 *   "write"
 * );
 * if (!canEdit) {
 *   throw new Error("Forbidden: Cannot edit this document");
 * }
 * ```
 */
export async function checkPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  resourceType: ResourceType,
  resourceId: ResourceId,
  requiredPermission: PermissionLevel
): Promise<boolean> {
  // Get the effective permission level for this user on this resource
  const effectivePermission = await getEffectivePermission(
    ctx,
    userId,
    resourceType,
    resourceId
  );

  if (!effectivePermission) {
    return requiredPermission === "none";
  }

  return hasPermissionLevel(effectivePermission, requiredPermission);
}

/**
 * Get the highest permission level a user has on a specific resource.
 * Checks direct permissions first, then inherited permissions from parent resources.
 * Also considers global admin role which grants admin permission on all resources.
 *
 * @param ctx - Query or mutation context
 * @param userId - The user ID to check permissions for
 * @param resourceType - Type of the resource (workspace, folder, or document)
 * @param resourceId - ID of the resource
 * @returns The highest permission level, or null if no permissions found
 *
 * @example
 * ```typescript
 * const permission = await getEffectivePermission(
 *   ctx,
 *   userId,
 *   "document",
 *   documentId
 * );
 * // permission: "admin" | "write" | "read" | "none" | null
 * ```
 */
export async function getEffectivePermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  resourceType: ResourceType,
  resourceId: ResourceId
): Promise<PermissionLevel | null> {
  // Check if user is global admin (has admin access to everything)
  const user = await ctx.db.get(userId);
  if (user?.role === "admin") {
    return "admin";
  }

  // Get user's team IDs for team permission checks
  const teamMemberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const teamIds = teamMemberships.map((m) => m.teamId);

  // Check direct permission on the resource
  const directPermission = await getDirectPermission(
    ctx,
    userId,
    teamIds,
    resourceType,
    resourceId
  );

  if (directPermission) {
    return directPermission;
  }

  // No direct permission found, check inherited permissions from parent
  const inheritedPermission = await getInheritedPermission(
    ctx,
    userId,
    teamIds,
    resourceType,
    resourceId
  );

  return inheritedPermission;
}

/**
 * Get direct permission on a specific resource (not inherited).
 * Checks both user-specific and team-based permissions.
 *
 * @param ctx - Query or mutation context
 * @param userId - The user ID to check
 * @param teamIds - Team IDs the user belongs to
 * @param resourceType - Type of resource
 * @param resourceId - ID of resource
 * @returns Highest direct permission level, or null if none found
 */
async function getDirectPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  teamIds: Id<"teams">[],
  resourceType: ResourceType,
  resourceId: ResourceId
): Promise<PermissionLevel | null> {
  // Query for user-specific permission
  const userPermission = await ctx.db
    .query("kbResourcePermissions")
    .withIndex("by_resource_user", (q) =>
      q.eq("resourceType", resourceType).eq("userId", userId)
    )
    .filter((q) => {
      switch (resourceType) {
        case "workspace":
          return q.eq(q.field("workspaceId"), resourceId as Id<"kbWorkspaces">);
        case "folder":
          return q.eq(q.field("folderId"), resourceId as Id<"kbFolders">);
        case "document":
          return q.eq(q.field("documentId"), resourceId as Id<"kbDocuments">);
      }
    })
    .first();

  let highestPermission: PermissionLevel | null = userPermission?.level ?? null;

  // Check team-based permissions
  for (const teamId of teamIds) {
    const teamPermission = await ctx.db
      .query("kbResourcePermissions")
      .withIndex("by_resource_team", (q) =>
        q.eq("resourceType", resourceType).eq("teamId", teamId)
      )
      .filter((q) => {
        switch (resourceType) {
          case "workspace":
            return q.eq(q.field("workspaceId"), resourceId as Id<"kbWorkspaces">);
          case "folder":
            return q.eq(q.field("folderId"), resourceId as Id<"kbFolders">);
          case "document":
            return q.eq(q.field("documentId"), resourceId as Id<"kbDocuments">);
        }
      })
      .first();

    if (
      teamPermission &&
      (!highestPermission ||
        hasPermissionLevel(teamPermission.level, highestPermission))
    ) {
      highestPermission = teamPermission.level;
    }
  }

  return highestPermission;
}

/**
 * Get inherited permission by traversing the resource hierarchy.
 * Documents inherit from folders, folders inherit from workspaces.
 *
 * @param ctx - Query or mutation context
 * @param userId - The user ID to check
 * @param teamIds - Team IDs the user belongs to
 * @param resourceType - Type of resource
 * @param resourceId - ID of resource
 * @returns Highest inherited permission, or null if none found
 */
async function getInheritedPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  teamIds: Id<"teams">[],
  resourceType: ResourceType,
  resourceId: ResourceId
): Promise<PermissionLevel | null> {
  // Workspaces don't inherit (they are root)
  if (resourceType === "workspace") {
    return null;
  }

  // Get the parent resource
  if (resourceType === "document") {
    const document = await ctx.db.get(resourceId as Id<"kbDocuments">);
    if (!document) return null;

    // Check permission on parent folder
    const folderPermission = await getDirectPermission(
      ctx,
      userId,
      teamIds,
      "folder",
      document.folderId
    );

    if (folderPermission) {
      return folderPermission;
    }

    // Recursively check folder's parent
    return getInheritedPermission(
      ctx,
      userId,
      teamIds,
      "folder",
      document.folderId
    );
  }

  if (resourceType === "folder") {
    const folder = await ctx.db.get(resourceId as Id<"kbFolders">);
    if (!folder) return null;

    // Check parent folder if exists
    if (folder.parentId) {
      const parentFolderPermission = await getDirectPermission(
        ctx,
        userId,
        teamIds,
        "folder",
        folder.parentId
      );

      if (parentFolderPermission) {
        return parentFolderPermission;
      }

      // Recursively check parent folder's parent
      return getInheritedPermission(
        ctx,
        userId,
        teamIds,
        "folder",
        folder.parentId
      );
    }

    // Check workspace permission (folder is at root level)
    return getDirectPermission(
      ctx,
      userId,
      teamIds,
      "workspace",
      folder.workspaceId
    );
  }

  return null;
}
