import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of items allowed in a single container (folder or workspace).
 * Applies to both folders within a parent folder and documents within a folder.
 */
export const MAX_CONTAINER_ITEMS = 1000;

/**
 * Maximum depth of folder nesting to prevent infinite recursion.
 */
export const MAX_FOLDER_DEPTH = 10;

/**
 * Maximum length of a document title.
 */
export const MAX_TITLE_LENGTH = 255;

/**
 * Minimum length of a document title.
 */
export const MIN_TITLE_LENGTH = 1;

/**
 * Invalid characters for document/folder titles.
 * These characters can cause issues with URLs or file systems.
 */
const INVALID_TITLE_CHARS = /[<>:"/\\|?*\x00-\x1F]/;

/**
 * Maximum content size in bytes (10MB).
 */
export const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates that a container (folder or workspace) does not exceed the maximum item limit.
 * Throws an error if the limit would be exceeded.
 *
 * @param ctx - Query or mutation context
 * @param parentId - The parent folder ID (or null for root folders)
 * @param resourceType - Type of resource being added: "folder" or "document"
 * @throws Error if adding another item would exceed the 1000 item limit
 *
 * @example
 * ```typescript
 * // Before creating a new folder
 * await validateContainerLimit(ctx, parentFolderId, "folder");
 *
 * // Before creating a new document
 * await validateContainerLimit(ctx, folderId, "document");
 * ```
 */
export async function validateContainerLimit(
  ctx: QueryCtx | MutationCtx,
  parentId: Id<"kbFolders"> | null,
  resourceType: "folder" | "document"
): Promise<void> {
  let count: number;

  if (resourceType === "folder") {
    // Count folders with this parent
    if (parentId === null) {
      // For root folders, we'd need workspaceId - this function handles subfolder count
      // Root folder count should be validated separately with workspaceId
      return;
    }
    const folders = await ctx.db
      .query("kbFolders")
      .withIndex("by_parent", (q) => q.eq("parentId", parentId))
      .collect();
    count = folders.length;
  } else {
    // Count documents in this folder
    if (parentId === null) {
      throw new Error("Documents must be in a folder");
    }
    const documents = await ctx.db
      .query("kbDocuments")
      .withIndex("by_folder", (q) => q.eq("folderId", parentId))
      .collect();
    count = documents.length;
  }

  if (count >= MAX_CONTAINER_ITEMS) {
    throw new Error(
      `Container limit exceeded: Maximum ${MAX_CONTAINER_ITEMS} ${resourceType}s allowed per container`
    );
  }
}

/**
 * Validates that adding items to a workspace root does not exceed the limit.
 *
 * @param ctx - Query or mutation context
 * @param workspaceId - The workspace to check
 * @throws Error if adding another root folder would exceed the 1000 item limit
 */
export async function validateWorkspaceRootLimit(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"kbWorkspaces">
): Promise<void> {
  const rootFolders = await ctx.db
    .query("kbFolders")
    .withIndex("by_workspace_parent", (q) =>
      q.eq("workspaceId", workspaceId).eq("parentId", undefined)
    )
    .collect();

  if (rootFolders.length >= MAX_CONTAINER_ITEMS) {
    throw new Error(
      `Workspace limit exceeded: Maximum ${MAX_CONTAINER_ITEMS} root folders allowed per workspace`
    );
  }
}

/**
 * Validates a document or folder title.
 * Checks length constraints and invalid characters.
 *
 * @param title - The title to validate
 * @throws Error if title is invalid
 *
 * @example
 * ```typescript
 * validateDocumentTitle(args.title);
 * // Throws: "Title must be between 1 and 255 characters"
 * // Throws: "Title contains invalid characters"
 * ```
 */
export function validateDocumentTitle(title: string): void {
  // Trim whitespace for validation
  const trimmedTitle = title.trim();

  // Check minimum length
  if (trimmedTitle.length < MIN_TITLE_LENGTH) {
    throw new Error(
      `Title must be at least ${MIN_TITLE_LENGTH} character${MIN_TITLE_LENGTH > 1 ? "s" : ""}`
    );
  }

  // Check maximum length
  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    throw new Error(`Title must be at most ${MAX_TITLE_LENGTH} characters`);
  }

  // Check for invalid characters
  if (INVALID_TITLE_CHARS.test(trimmedTitle)) {
    throw new Error(
      'Title contains invalid characters. Avoid: < > : " / \\ | ? * and control characters'
    );
  }
}

/**
 * Validates that moving a folder would not create a circular reference
 * and that the nesting depth does not exceed the maximum.
 *
 * @param ctx - Query or mutation context
 * @param folderId - The folder being moved
 * @param targetParentId - The new parent folder ID (or null for root)
 * @throws Error if move would create circular reference or exceed max depth
 *
 * @example
 * ```typescript
 * // Before moving a folder
 * await validateFolderPath(ctx, folderId, newParentId);
 * ```
 */
export async function validateFolderPath(
  ctx: QueryCtx | MutationCtx,
  folderId: Id<"kbFolders">,
  targetParentId: Id<"kbFolders"> | null
): Promise<void> {
  // If moving to root, no circular reference possible, but check depth
  if (targetParentId === null) {
    // Get the folder's subtree depth
    const subtreeDepth = await getSubtreeDepth(ctx, folderId);
    if (subtreeDepth > MAX_FOLDER_DEPTH) {
      throw new Error(
        `Cannot move folder: subtree would exceed maximum depth of ${MAX_FOLDER_DEPTH}`
      );
    }
    return;
  }

  // Check for circular reference: target cannot be the folder itself
  if (folderId === targetParentId) {
    throw new Error("Cannot move a folder into itself");
  }

  // Check if targetParentId is a descendant of folderId (would create circular ref)
  const isDescendant = await isFolderDescendant(ctx, folderId, targetParentId);
  if (isDescendant) {
    throw new Error("Cannot move a folder into one of its descendants");
  }

  // Check depth constraint: count ancestors of target + subtree depth of folder
  const targetDepth = await getFolderDepth(ctx, targetParentId);
  const subtreeDepth = await getSubtreeDepth(ctx, folderId);

  // New depth would be targetDepth + 1 (for the folder being moved) + subtreeDepth - 1 (don't count folder twice)
  const newMaxDepth = targetDepth + subtreeDepth;

  if (newMaxDepth > MAX_FOLDER_DEPTH) {
    throw new Error(
      `Cannot move folder: would exceed maximum nesting depth of ${MAX_FOLDER_DEPTH} levels`
    );
  }
}

/**
 * Gets the depth of a folder in the hierarchy (1 = root level).
 *
 * @param ctx - Query or mutation context
 * @param folderId - The folder to check
 * @returns The depth of the folder (1-based)
 */
async function getFolderDepth(
  ctx: QueryCtx | MutationCtx,
  folderId: Id<"kbFolders">
): Promise<number> {
  let depth = 1;
  let currentId: Id<"kbFolders"> | undefined = folderId;

  while (currentId) {
    const folder: Doc<"kbFolders"> | null = await ctx.db.get(currentId);
    if (!folder) {
      throw new Error(`Folder not found: ${currentId}`);
    }

    if (folder.parentId) {
      depth++;
      currentId = folder.parentId;

      // Safety check to prevent infinite loops
      if (depth > MAX_FOLDER_DEPTH + 1) {
        throw new Error("Circular reference detected in folder hierarchy");
      }
    } else {
      break;
    }
  }

  return depth;
}

/**
 * Gets the maximum depth of the subtree rooted at a folder.
 *
 * @param ctx - Query or mutation context
 * @param folderId - The root of the subtree
 * @returns The maximum depth of the subtree (1 = leaf node)
 */
async function getSubtreeDepth(
  ctx: QueryCtx | MutationCtx,
  folderId: Id<"kbFolders">
): Promise<number> {
  const children = await ctx.db
    .query("kbFolders")
    .withIndex("by_parent", (q) => q.eq("parentId", folderId))
    .collect();

  if (children.length === 0) {
    return 1; // This folder is a leaf
  }

  // Get max depth of all children
  let maxChildDepth = 0;
  for (const child of children) {
    const childDepth = await getSubtreeDepth(ctx, child._id);
    maxChildDepth = Math.max(maxChildDepth, childDepth);
  }

  return 1 + maxChildDepth;
}

/**
 * Checks if a folder is a descendant of another folder.
 *
 * @param ctx - Query or mutation context
 * @param ancestorId - The potential ancestor folder
 * @param descendantId - The folder to check
 * @returns True if descendantId is a descendant of ancestorId
 */
async function isFolderDescendant(
  ctx: QueryCtx | MutationCtx,
  ancestorId: Id<"kbFolders">,
  descendantId: Id<"kbFolders">
): Promise<boolean> {
  let currentId: Id<"kbFolders"> | undefined = descendantId;
  let iterations = 0;

  while (currentId) {
    const folder: Doc<"kbFolders"> | null = await ctx.db.get(currentId);
    if (!folder) {
      return false;
    }

    if (folder.parentId === ancestorId) {
      return true;
    }

    currentId = folder.parentId;
    iterations++;

    // Safety check to prevent infinite loops
    if (iterations > MAX_FOLDER_DEPTH + 1) {
      throw new Error("Circular reference detected in folder hierarchy");
    }
  }

  return false;
}

/**
 * Validates content size against the maximum limit.
 *
 * @param contentSize - Size of the content in bytes
 * @throws Error if content exceeds the 10MB limit
 */
export function validateContentSize(contentSize: number): void {
  if (contentSize > MAX_CONTENT_SIZE) {
    const sizeMB = (contentSize / (1024 * 1024)).toFixed(2);
    throw new Error(
      `Content size (${sizeMB}MB) exceeds maximum allowed size of 10MB`
    );
  }
}

/**
 * Generates a URL-safe slug from a name.
 *
 * @param name - The name to convert to a slug
 * @returns A URL-safe slug
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Validates a workspace slug.
 *
 * @param slug - The slug to validate
 * @throws Error if slug is invalid
 */
export function validateSlug(slug: string): void {
  if (slug.length < 1) {
    throw new Error("Slug must be at least 1 character");
  }

  if (slug.length > 50) {
    throw new Error("Slug must be at most 50 characters");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      "Slug must contain only lowercase letters, numbers, and hyphens"
    );
  }
}
