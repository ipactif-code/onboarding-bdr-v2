import { v, ConvexError } from "convex/values";
import { query, mutation } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { requireKBAuth, checkPermission, getEffectivePermission } from "../lib/kbAuth";

// ============================================================================
// VALIDATORS
// ============================================================================

/** Validator for permission levels used in workspaces */
const permissionLevelValidator = v.union(
  v.literal("none"),
  v.literal("read"),
  v.literal("write")
);

/** Validator for workspace metadata returned by queries */
const workspaceMetadataValidator = v.object({
  _id: v.id("kbWorkspaces"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  coverImageId: v.optional(v.id("_storage")),
  coverImageUrl: v.optional(v.union(v.string(), v.null())),
  ownerId: v.id("users"),
  defaultPermission: permissionLevelValidator,
  isArchived: v.boolean(),
  archivedAt: v.optional(v.number()),
  archivedBy: v.optional(v.id("users")),
  createdAt: v.number(),
  updatedAt: v.number(),
  userPermission: v.union(
    v.literal("none"),
    v.literal("read"),
    v.literal("write"),
    v.literal("admin"),
    v.null()
  ),
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all workspaces accessible to the current user.
 * Returns workspaces the user owns OR has explicit permission to access.
 * Excludes archived workspaces by default.
 *
 * @param includeArchived - Whether to include archived workspaces (default: false)
 * @returns Array of workspace metadata with user's effective permission
 */
export const list = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(workspaceMetadataValidator),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);
    const includeArchived = args.includeArchived ?? false;

    // Get workspaces owned by user
    const ownedWorkspaces = await ctx.db
      .query("kbWorkspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    // Get workspaces with explicit permissions for user
    const userPermissions = await ctx.db
      .query("kbResourcePermissions")
      .withIndex("by_resource_user", (q) =>
        q.eq("resourceType", "workspace").eq("userId", userId)
      )
      .collect();

    // Get workspace IDs from permissions
    const permittedWorkspaceIds = new Set(
      userPermissions
        .filter((p) => p.workspaceId && p.level !== "none")
        .map((p) => p.workspaceId as Id<"kbWorkspaces">)
    );

    // Fetch permitted workspaces not already owned
    const ownedIds = new Set(ownedWorkspaces.map((w) => w._id));
    const permittedWorkspaces: Doc<"kbWorkspaces">[] = [];

    for (const workspaceId of Array.from(permittedWorkspaceIds)) {
      if (!ownedIds.has(workspaceId)) {
        const workspace = await ctx.db.get(workspaceId);
        if (workspace && !workspace.isArchived) {
          permittedWorkspaces.push(workspace as Doc<"kbWorkspaces">);
        }
      }
    }

    // Combine and filter
    const allWorkspaces = [...ownedWorkspaces, ...permittedWorkspaces];
    const filteredWorkspaces = includeArchived
      ? allWorkspaces
      : allWorkspaces.filter((w) => !w.isArchived);

    // Build response with effective permissions and cover image URLs
    const result = await Promise.all(
      filteredWorkspaces.map(async (workspace) => {
        const userPermission = await getEffectivePermission(
          ctx,
          userId,
          "workspace",
          workspace._id
        );

        // Get cover image URL if exists
        let coverImageUrl: string | null = null;
        if (workspace.coverImageId) {
          coverImageUrl = await ctx.storage.getUrl(workspace.coverImageId);
        }

        return {
          ...workspace,
          coverImageUrl,
          userPermission,
        };
      })
    );

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get a specific workspace by ID.
 * Requires at least read permission.
 *
 * @param id - The workspace ID
 * @returns Workspace metadata with user's effective permission, or null if not found/not accessible
 */
export const get = query({
  args: {
    id: v.id("kbWorkspaces"),
  },
  returns: v.union(workspaceMetadataValidator, v.null()),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const workspace = await ctx.db.get(args.id);
    if (!workspace) {
      return null;
    }

    // Check permission
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "workspace",
      args.id,
      "read"
    );

    if (!hasAccess) {
      return null;
    }

    const userPermission = await getEffectivePermission(
      ctx,
      userId,
      "workspace",
      args.id
    );

    // Get cover image URL if exists
    let coverImageUrl: string | null = null;
    if (workspace.coverImageId) {
      coverImageUrl = await ctx.storage.getUrl(workspace.coverImageId);
    }

    return {
      ...workspace,
      coverImageUrl,
      userPermission,
    };
  },
});

/**
 * Get a workspace by its URL slug.
 * Requires at least read permission.
 *
 * @param slug - The workspace URL slug
 * @returns Workspace metadata with user's effective permission, or null if not found/not accessible
 */
export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(workspaceMetadataValidator, v.null()),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    const workspace = await ctx.db
      .query("kbWorkspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!workspace) {
      return null;
    }

    // Check permission
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "workspace",
      workspace._id,
      "read"
    );

    if (!hasAccess) {
      return null;
    }

    const userPermission = await getEffectivePermission(
      ctx,
      userId,
      "workspace",
      workspace._id
    );

    // Get cover image URL if exists
    let coverImageUrl: string | null = null;
    if (workspace.coverImageId) {
      coverImageUrl = await ctx.storage.getUrl(workspace.coverImageId);
    }

    return {
      ...workspace,
      coverImageUrl,
      userPermission,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new workspace.
 * The creator becomes the owner with admin permission.
 *
 * @param name - Workspace name (3-100 characters)
 * @param slug - URL-safe slug (3-50 characters, lowercase alphanumeric + hyphens)
 * @param description - Optional description (max 1000 characters)
 * @param icon - Optional emoji or icon name
 * @param defaultPermission - Default permission for new items (none/read/write)
 * @returns The created workspace ID
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    defaultPermission: v.optional(permissionLevelValidator),
  },
  returns: v.id("kbWorkspaces"),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Validate name
    if (args.name.length < 3 || args.name.length > 100) {
      throw new ConvexError("Workspace name must be between 3 and 100 characters");
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!slugRegex.test(args.slug)) {
      throw new ConvexError(
        "Slug must be lowercase, start and end with alphanumeric characters, and contain only letters, numbers, and hyphens"
      );
    }
    if (args.slug.length < 3 || args.slug.length > 50) {
      throw new ConvexError("Slug must be between 3 and 50 characters");
    }

    // Check slug uniqueness
    const existingWorkspace = await ctx.db
      .query("kbWorkspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingWorkspace) {
      throw new ConvexError("A workspace with this slug already exists");
    }

    // Validate description
    if (args.description && args.description.length > 1000) {
      throw new ConvexError("Description must be at most 1000 characters");
    }

    const now = Date.now();

    // Create workspace
    const workspaceId = await ctx.db.insert("kbWorkspaces", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      icon: args.icon,
      ownerId: userId,
      defaultPermission: args.defaultPermission ?? "read",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create admin permission for owner
    await ctx.db.insert("kbResourcePermissions", {
      resourceType: "workspace",
      workspaceId,
      userId,
      level: "admin",
      isInherited: false,
      grantedBy: userId,
      grantedAt: now,
    });

    // Log audit event
    await ctx.db.insert("kbAuditLogs", {
      eventType: "workspace_created",
      resourceType: "workspace",
      resourceId: workspaceId,
      resourceName: args.name,
      actorId: userId,
      details: {
        slug: args.slug,
        defaultPermission: args.defaultPermission ?? "read",
      },
      timestamp: now,
    });

    return workspaceId;
  },
});

/**
 * Update workspace metadata.
 * Requires admin permission on the workspace.
 *
 * @param id - The workspace ID
 * @param name - Optional new name
 * @param description - Optional new description
 * @param icon - Optional new icon
 * @param coverImageId - Optional new cover image storage ID
 * @param defaultPermission - Optional new default permission
 * @returns null on success
 */
export const update = mutation({
  args: {
    id: v.id("kbWorkspaces"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    defaultPermission: v.optional(permissionLevelValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Check workspace exists
    const workspace = await ctx.db.get(args.id);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    // Check admin permission
    const hasPermission = await checkPermission(
      ctx,
      userId,
      "workspace",
      args.id,
      "admin"
    );

    if (!hasPermission) {
      throw new ConvexError("You do not have permission to update this workspace");
    }

    // Build updates object
    const updates: Partial<Doc<"kbWorkspaces">> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      if (args.name.length < 3 || args.name.length > 100) {
        throw new ConvexError("Workspace name must be between 3 and 100 characters");
      }
      updates.name = args.name;
    }

    if (args.description !== undefined) {
      if (args.description.length > 1000) {
        throw new ConvexError("Description must be at most 1000 characters");
      }
      updates.description = args.description;
    }

    if (args.icon !== undefined) {
      updates.icon = args.icon;
    }

    if (args.coverImageId !== undefined) {
      // Delete old cover image if exists
      if (workspace.coverImageId) {
        await ctx.storage.delete(workspace.coverImageId);
      }
      updates.coverImageId = args.coverImageId;
    }

    if (args.defaultPermission !== undefined) {
      updates.defaultPermission = args.defaultPermission;
    }

    await ctx.db.patch(args.id, updates);

    return null;
  },
});

/**
 * Archive a workspace (soft delete).
 * Sets isArchived=true and records archive metadata.
 * Requires admin permission on the workspace.
 *
 * @param id - The workspace ID
 * @returns null on success
 */
export const archive = mutation({
  args: {
    id: v.id("kbWorkspaces"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Check workspace exists
    const workspace = await ctx.db.get(args.id);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    if (workspace.isArchived) {
      throw new ConvexError("Workspace is already archived");
    }

    // Check admin permission
    const hasPermission = await checkPermission(
      ctx,
      userId,
      "workspace",
      args.id,
      "admin"
    );

    if (!hasPermission) {
      throw new ConvexError("You do not have permission to archive this workspace");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: now,
      archivedBy: userId,
      updatedAt: now,
    });

    // Log audit event
    await ctx.db.insert("kbAuditLogs", {
      eventType: "workspace_archived",
      resourceType: "workspace",
      resourceId: args.id,
      resourceName: workspace.name,
      actorId: userId,
      timestamp: now,
    });

    return null;
  },
});

/**
 * Restore an archived workspace.
 * Clears archive metadata and sets isArchived=false.
 * Requires admin permission on the workspace.
 *
 * @param id - The workspace ID
 * @returns null on success
 */
export const restore = mutation({
  args: {
    id: v.id("kbWorkspaces"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Check workspace exists
    const workspace = await ctx.db.get(args.id);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    if (!workspace.isArchived) {
      throw new ConvexError("Workspace is not archived");
    }

    // Check admin permission
    const hasPermission = await checkPermission(
      ctx,
      userId,
      "workspace",
      args.id,
      "admin"
    );

    if (!hasPermission) {
      throw new ConvexError("You do not have permission to restore this workspace");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      isArchived: false,
      archivedAt: undefined,
      archivedBy: undefined,
      updatedAt: now,
    });

    // Log audit event
    await ctx.db.insert("kbAuditLogs", {
      eventType: "document_restored", // Using closest available event type
      resourceType: "workspace",
      resourceId: args.id,
      resourceName: workspace.name,
      actorId: userId,
      details: {
        event: "workspace_restored",
      },
      timestamp: now,
    });

    return null;
  },
});

/**
 * Transfer ownership of a workspace to another user.
 * The new owner receives admin permission automatically.
 * Requires admin permission on the workspace.
 *
 * @param id - The workspace ID
 * @param newOwnerId - The user ID to transfer ownership to
 * @returns null on success
 */
export const transferOwnership = mutation({
  args: {
    id: v.id("kbWorkspaces"),
    newOwnerId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Check workspace exists
    const workspace = await ctx.db.get(args.id);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    // Check admin permission
    const hasPermission = await checkPermission(
      ctx,
      userId,
      "workspace",
      args.id,
      "admin"
    );

    if (!hasPermission) {
      throw new ConvexError(
        "You do not have permission to transfer ownership of this workspace"
      );
    }

    // Check new owner exists
    const newOwner = await ctx.db.get(args.newOwnerId);
    if (!newOwner) {
      throw new ConvexError("New owner not found");
    }

    // Cannot transfer to self
    if (args.newOwnerId === workspace.ownerId) {
      throw new ConvexError("Cannot transfer ownership to current owner");
    }

    const now = Date.now();

    // Update workspace owner
    await ctx.db.patch(args.id, {
      ownerId: args.newOwnerId,
      updatedAt: now,
    });

    // Ensure new owner has admin permission
    const existingPermission = await ctx.db
      .query("kbResourcePermissions")
      .withIndex("by_resource_user", (q) =>
        q.eq("resourceType", "workspace").eq("userId", args.newOwnerId)
      )
      .filter((q) => q.eq(q.field("workspaceId"), args.id))
      .first();

    if (existingPermission) {
      // Update existing permission to admin
      await ctx.db.patch(existingPermission._id, {
        level: "admin",
        grantedBy: userId,
        grantedAt: now,
      });
    } else {
      // Create admin permission for new owner
      await ctx.db.insert("kbResourcePermissions", {
        resourceType: "workspace",
        workspaceId: args.id,
        userId: args.newOwnerId,
        level: "admin",
        isInherited: false,
        grantedBy: userId,
        grantedAt: now,
      });
    }

    // Log audit event
    await ctx.db.insert("kbAuditLogs", {
      eventType: "permission_changed",
      resourceType: "workspace",
      resourceId: args.id,
      resourceName: workspace.name,
      actorId: userId,
      targetUserId: args.newOwnerId,
      details: {
        event: "ownership_transferred",
        previousOwnerId: workspace.ownerId,
        newOwnerId: args.newOwnerId,
      },
      timestamp: now,
    });

    return null;
  },
});
