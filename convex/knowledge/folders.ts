import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { requireKBAuth, checkPermission } from "../lib/kbAuth";
import {
  validateDocumentTitle,
  validateContainerLimit,
  validateWorkspaceRootLimit,
  validateFolderPath,
} from "../lib/kbValidation";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Folder with basic information for listing.
 */
const folderValidator = v.object({
  _id: v.id("kbFolders"),
  _creationTime: v.number(),
  name: v.string(),
  workspaceId: v.id("kbWorkspaces"),
  parentId: v.optional(v.id("kbFolders")),
  icon: v.optional(v.string()),
  displayOrder: v.number(),
  isArchived: v.boolean(),
  archivedAt: v.optional(v.number()),
  archivedBy: v.optional(v.id("users")),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * Folder tree node with children.
 */
const folderTreeNodeValidator: ReturnType<typeof v.object> = v.object({
  _id: v.id("kbFolders"),
  name: v.string(),
  icon: v.optional(v.string()),
  displayOrder: v.number(),
  isArchived: v.boolean(),
  children: v.array(v.any()), // Recursive type - contains folderTreeNodeValidator
});

/**
 * Breadcrumb item for navigation.
 */
const breadcrumbValidator = v.object({
  _id: v.id("kbFolders"),
  name: v.string(),
  icon: v.optional(v.string()),
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List folders in a workspace at a specific parent level.
 * Returns folders ordered by displayOrder.
 * Filters out archived folders unless includeArchived is true.
 *
 * @param workspaceId - The workspace to list folders from
 * @param parentId - The parent folder ID (undefined for root folders)
 * @param includeArchived - Whether to include archived folders (default: false)
 * @returns Array of folders ordered by displayOrder
 */
export const list = query({
  args: {
    workspaceId: v.id("kbWorkspaces"),
    parentId: v.optional(v.id("kbFolders")),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(folderValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Check permission on workspace
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "workspace",
      args.workspaceId,
      "read"
    );

    if (!hasAccess) {
      throw new ConvexError("You do not have permission to access this workspace");
    }

    // Query folders using the composite index
    let folders: Doc<"kbFolders">[];

    if (args.parentId === undefined) {
      // Root-level folders
      folders = await ctx.db
        .query("kbFolders")
        .withIndex("by_workspace_parent", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("parentId", undefined)
        )
        .collect();
    } else {
      // Check permission on parent folder
      const hasParentAccess = await checkPermission(
        ctx,
        userId,
        "folder",
        args.parentId,
        "read"
      );

      if (!hasParentAccess) {
        throw new ConvexError("You do not have permission to access this folder");
      }

      folders = await ctx.db
        .query("kbFolders")
        .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
        .collect();
    }

    // Filter archived if needed
    if (!args.includeArchived) {
      folders = folders.filter((folder) => !folder.isArchived);
    }

    // Sort by displayOrder
    folders.sort((a, b) => a.displayOrder - b.displayOrder);

    return folders;
  },
});

/**
 * Get a single folder by ID with permission check.
 *
 * @param id - The folder ID
 * @returns The folder document or null if not found/no access
 */
export const get = query({
  args: {
    id: v.id("kbFolders"),
  },
  returns: v.union(folderValidator, v.null()),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const folder = await ctx.db.get(args.id);
    if (!folder) {
      return null;
    }

    // Check permission on folder
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "folder",
      args.id,
      "read"
    );

    if (!hasAccess) {
      return null;
    }

    return folder;
  },
});

/**
 * Get the folder tree structure for a workspace.
 * Returns a hierarchical structure with all folders and their children.
 *
 * @param workspaceId - The workspace to get the tree for
 * @param includeArchived - Whether to include archived folders (default: false)
 * @returns Array of root-level folder nodes with nested children
 */
export const getTree = query({
  args: {
    workspaceId: v.id("kbWorkspaces"),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(folderTreeNodeValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Check permission on workspace
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "workspace",
      args.workspaceId,
      "read"
    );

    if (!hasAccess) {
      throw new ConvexError("You do not have permission to access this workspace");
    }

    // Get all folders in the workspace
    let allFolders = await ctx.db
      .query("kbFolders")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Filter archived if needed
    if (!args.includeArchived) {
      allFolders = allFolders.filter((folder) => !folder.isArchived);
    }

    // Build a map of parentId to children
    const childrenMap = new Map<string | undefined, Doc<"kbFolders">[]>();

    for (const folder of allFolders) {
      const parentKey = folder.parentId ?? "root";
      const children = childrenMap.get(parentKey) ?? [];
      children.push(folder);
      childrenMap.set(parentKey, children);
    }

    // Sort children by displayOrder
    for (const [, children] of Array.from(childrenMap.entries())) {
      children.sort((a, b) => a.displayOrder - b.displayOrder);
    }

    // Recursive function to build tree nodes
    function buildTreeNode(folder: Doc<"kbFolders">): {
      _id: Id<"kbFolders">;
      name: string;
      icon?: string;
      displayOrder: number;
      isArchived: boolean;
      children: ReturnType<typeof buildTreeNode>[];
    } {
      const children = childrenMap.get(folder._id) ?? [];
      return {
        _id: folder._id,
        name: folder.name,
        icon: folder.icon,
        displayOrder: folder.displayOrder,
        isArchived: folder.isArchived,
        children: children.map(buildTreeNode),
      };
    }

    // Get root folders and build tree
    const rootFolders = childrenMap.get("root") ?? [];
    return rootFolders.map(buildTreeNode);
  },
});

/**
 * Get the breadcrumb path from root to the specified folder.
 * Returns an array of folders from root to the current folder (inclusive).
 *
 * @param folderId - The folder to get breadcrumbs for
 * @returns Array of breadcrumb items from root to current folder
 */
export const getBreadcrumbs = query({
  args: {
    folderId: v.id("kbFolders"),
  },
  returns: v.array(breadcrumbValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new ConvexError("Folder not found");
    }

    // Check permission on folder
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "folder",
      args.folderId,
      "read"
    );

    if (!hasAccess) {
      throw new ConvexError("You do not have permission to access this folder");
    }

    // Build path from current folder to root
    const breadcrumbs: { _id: Id<"kbFolders">; name: string; icon?: string }[] = [];
    let currentFolder: Doc<"kbFolders"> | null = folder;

    // Safety limit to prevent infinite loops
    const MAX_DEPTH = 20;
    let depth = 0;

    while (currentFolder && depth < MAX_DEPTH) {
      breadcrumbs.unshift({
        _id: currentFolder._id,
        name: currentFolder.name,
        icon: currentFolder.icon,
      });

      if (currentFolder.parentId) {
        currentFolder = await ctx.db.get(currentFolder.parentId);
      } else {
        currentFolder = null;
      }

      depth++;
    }

    return breadcrumbs;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new folder in a workspace.
 *
 * @param name - The folder name
 * @param workspaceId - The workspace to create the folder in
 * @param parentId - The parent folder ID (undefined for root folder)
 * @param icon - Optional icon (emoji or icon name)
 * @returns The ID of the newly created folder
 */
export const create = mutation({
  args: {
    name: v.string(),
    workspaceId: v.id("kbWorkspaces"),
    parentId: v.optional(v.id("kbFolders")),
    icon: v.optional(v.string()),
  },
  returns: v.id("kbFolders"),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Validate title
    validateDocumentTitle(args.name);

    // Check workspace exists
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    if (workspace.isArchived) {
      throw new ConvexError("Cannot create folder in an archived workspace");
    }

    // Check permission on container (parent folder or workspace)
    if (args.parentId) {
      // Check parent folder exists and is accessible
      const parentFolder = await ctx.db.get(args.parentId);
      if (!parentFolder) {
        throw new ConvexError("Parent folder not found");
      }

      if (parentFolder.workspaceId !== args.workspaceId) {
        throw new ConvexError("Parent folder is not in the specified workspace");
      }

      if (parentFolder.isArchived) {
        throw new ConvexError("Cannot create folder in an archived folder");
      }

      const hasParentAccess = await checkPermission(
        ctx,
        userId,
        "folder",
        args.parentId,
        "write"
      );

      if (!hasParentAccess) {
        throw new ConvexError("You do not have permission to create folders here");
      }

      // Validate container limit for parent folder
      await validateContainerLimit(ctx, args.parentId, "folder");
    } else {
      // Check workspace write permission
      const hasWorkspaceAccess = await checkPermission(
        ctx,
        userId,
        "workspace",
        args.workspaceId,
        "write"
      );

      if (!hasWorkspaceAccess) {
        throw new ConvexError("You do not have permission to create folders in this workspace");
      }

      // Validate root folder limit
      await validateWorkspaceRootLimit(ctx, args.workspaceId);
    }

    // Get the next display order
    let siblings: Doc<"kbFolders">[];
    if (args.parentId) {
      siblings = await ctx.db
        .query("kbFolders")
        .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
        .collect();
    } else {
      siblings = await ctx.db
        .query("kbFolders")
        .withIndex("by_workspace_parent", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("parentId", undefined)
        )
        .collect();
    }

    const maxOrder = siblings.reduce(
      (max, folder) => Math.max(max, folder.displayOrder),
      0
    );

    const now = Date.now();

    // Create the folder
    const folderId = await ctx.db.insert("kbFolders", {
      name: args.name.trim(),
      workspaceId: args.workspaceId,
      parentId: args.parentId,
      icon: args.icon,
      displayOrder: maxOrder + 1,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    // Log the creation in audit logs
    await ctx.db.insert("kbAuditLogs", {
      eventType: "folder_created",
      resourceType: "folder",
      resourceId: folderId,
      resourceName: args.name.trim(),
      actorId: userId,
      details: {
        workspaceId: args.workspaceId,
        parentId: args.parentId,
      },
      timestamp: now,
    });

    return folderId;
  },
});

/**
 * Update folder metadata (name, icon).
 *
 * @param id - The folder ID
 * @param name - Optional new name
 * @param icon - Optional new icon
 * @returns null
 */
export const update = mutation({
  args: {
    id: v.id("kbFolders"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const folder = await ctx.db.get(args.id);
    if (!folder) {
      throw new ConvexError("Folder not found");
    }

    if (folder.isArchived) {
      throw new ConvexError("Cannot update an archived folder");
    }

    // Check permission on folder
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "folder",
      args.id,
      "write"
    );

    if (!hasAccess) {
      throw new ConvexError("You do not have permission to update this folder");
    }

    // Validate name if provided
    if (args.name !== undefined) {
      validateDocumentTitle(args.name);
    }

    // Build update object
    const updates: { name?: string; icon?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name.trim();
    }

    if (args.icon !== undefined) {
      updates.icon = args.icon;
    }

    await ctx.db.patch(args.id, updates);

    return null;
  },
});

/**
 * Move a folder to a different parent folder or workspace root.
 *
 * @param id - The folder ID to move
 * @param newParentId - The new parent folder ID (undefined to move to root)
 * @returns null
 */
export const move = mutation({
  args: {
    id: v.id("kbFolders"),
    newParentId: v.optional(v.id("kbFolders")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const folder = await ctx.db.get(args.id);
    if (!folder) {
      throw new ConvexError("Folder not found");
    }

    if (folder.isArchived) {
      throw new ConvexError("Cannot move an archived folder");
    }

    // Check write permission on folder being moved
    const hasSourceAccess = await checkPermission(
      ctx,
      userId,
      "folder",
      args.id,
      "write"
    );

    if (!hasSourceAccess) {
      throw new ConvexError("You do not have permission to move this folder");
    }

    // Check permission on new parent
    if (args.newParentId) {
      const newParent = await ctx.db.get(args.newParentId);
      if (!newParent) {
        throw new ConvexError("Target parent folder not found");
      }

      if (newParent.workspaceId !== folder.workspaceId) {
        throw new ConvexError("Cannot move folder to a different workspace");
      }

      if (newParent.isArchived) {
        throw new ConvexError("Cannot move folder to an archived folder");
      }

      const hasTargetAccess = await checkPermission(
        ctx,
        userId,
        "folder",
        args.newParentId,
        "write"
      );

      if (!hasTargetAccess) {
        throw new ConvexError("You do not have permission to move folders here");
      }

      // Validate container limit
      await validateContainerLimit(ctx, args.newParentId, "folder");
    } else {
      // Moving to workspace root
      const hasWorkspaceAccess = await checkPermission(
        ctx,
        userId,
        "workspace",
        folder.workspaceId,
        "write"
      );

      if (!hasWorkspaceAccess) {
        throw new ConvexError("You do not have permission to move folders to workspace root");
      }

      // Validate root folder limit
      await validateWorkspaceRootLimit(ctx, folder.workspaceId);
    }

    // Validate folder path (circular reference and depth)
    await validateFolderPath(ctx, args.id, args.newParentId ?? null);

    // Get new display order (last in new parent)
    let siblings: Doc<"kbFolders">[];
    if (args.newParentId) {
      siblings = await ctx.db
        .query("kbFolders")
        .withIndex("by_parent", (q) => q.eq("parentId", args.newParentId))
        .collect();
    } else {
      siblings = await ctx.db
        .query("kbFolders")
        .withIndex("by_workspace_parent", (q) =>
          q.eq("workspaceId", folder.workspaceId).eq("parentId", undefined)
        )
        .collect();
    }

    // Exclude the folder being moved from siblings
    siblings = siblings.filter((s) => s._id !== args.id);

    const maxOrder = siblings.reduce(
      (max, f) => Math.max(max, f.displayOrder),
      0
    );

    await ctx.db.patch(args.id, {
      parentId: args.newParentId,
      displayOrder: maxOrder + 1,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Reorder a folder within its parent.
 * Changes the displayOrder to position the folder at a specific index.
 *
 * @param id - The folder ID to reorder
 * @param newOrder - The new display order value
 * @returns null
 */
export const reorder = mutation({
  args: {
    id: v.id("kbFolders"),
    newOrder: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const folder = await ctx.db.get(args.id);
    if (!folder) {
      throw new ConvexError("Folder not found");
    }

    if (folder.isArchived) {
      throw new ConvexError("Cannot reorder an archived folder");
    }

    // Check permission on folder
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "folder",
      args.id,
      "write"
    );

    if (!hasAccess) {
      throw new ConvexError("You do not have permission to reorder this folder");
    }

    // Validate order is positive
    if (args.newOrder < 0) {
      throw new ConvexError("Display order must be a positive number");
    }

    await ctx.db.patch(args.id, {
      displayOrder: args.newOrder,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Archive a folder (soft delete).
 * Sets isArchived=true and records archivedAt/archivedBy.
 *
 * @param id - The folder ID to archive
 * @returns null
 */
export const archive = mutation({
  args: {
    id: v.id("kbFolders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const folder = await ctx.db.get(args.id);
    if (!folder) {
      throw new ConvexError("Folder not found");
    }

    if (folder.isArchived) {
      throw new ConvexError("Folder is already archived");
    }

    // Check permission on folder (need write to archive)
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "folder",
      args.id,
      "write"
    );

    if (!hasAccess) {
      throw new ConvexError("You do not have permission to archive this folder");
    }

    const now = Date.now();

    // Archive the folder
    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: now,
      archivedBy: userId,
      updatedAt: now,
    });

    // Log the archive in audit logs
    await ctx.db.insert("kbAuditLogs", {
      eventType: "folder_archived",
      resourceType: "folder",
      resourceId: args.id,
      resourceName: folder.name,
      actorId: userId,
      details: {
        workspaceId: folder.workspaceId,
        parentId: folder.parentId,
      },
      timestamp: now,
    });

    return null;
  },
});

/**
 * Restore a folder from archive.
 * Sets isArchived=false and clears archivedAt/archivedBy.
 *
 * @param id - The folder ID to restore
 * @returns null
 */
export const restore = mutation({
  args: {
    id: v.id("kbFolders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const folder = await ctx.db.get(args.id);
    if (!folder) {
      throw new ConvexError("Folder not found");
    }

    if (!folder.isArchived) {
      throw new ConvexError("Folder is not archived");
    }

    // Check permission on folder
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "folder",
      args.id,
      "write"
    );

    if (!hasAccess) {
      throw new ConvexError("You do not have permission to restore this folder");
    }

    // Check if parent is archived (cannot restore if parent is archived)
    if (folder.parentId) {
      const parentFolder = await ctx.db.get(folder.parentId);
      if (parentFolder?.isArchived) {
        throw new ConvexError("Cannot restore folder: parent folder is archived");
      }
    } else {
      // Check if workspace is archived
      const workspace = await ctx.db.get(folder.workspaceId);
      if (workspace?.isArchived) {
        throw new ConvexError("Cannot restore folder: workspace is archived");
      }
    }

    // Validate container limit before restoring
    if (folder.parentId) {
      await validateContainerLimit(ctx, folder.parentId, "folder");
    } else {
      await validateWorkspaceRootLimit(ctx, folder.workspaceId);
    }

    const now = Date.now();

    // Restore the folder
    await ctx.db.patch(args.id, {
      isArchived: false,
      archivedAt: undefined,
      archivedBy: undefined,
      updatedAt: now,
    });

    return null;
  },
});
