import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireKBAuth, checkPermission } from "../lib/kbAuth";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum document content size in bytes (10MB) */
const MAX_CONTENT_SIZE_BYTES = 10 * 1024 * 1024; // 10,485,760 bytes

/** Warning threshold for content size (8MB) */
const CONTENT_SIZE_WARNING_BYTES = 8 * 1024 * 1024; // 8,388,608 bytes

// ============================================================================
// TYPES
// ============================================================================

/**
 * Plate.js node structure.
 * Nodes can be elements (with children) or text nodes (with text property).
 */
interface PlateNode {
  type?: string;
  text?: string;
  children?: PlateNode[];
  // Additional properties that may exist on nodes
  [key: string]: unknown;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract plain text from Plate.js JSON content for search indexing.
 * Recursively traverses all nodes and extracts text from children[].text properties.
 *
 * Handles:
 * - Paragraphs (p)
 * - Headings (h1-h6)
 * - Lists (ul, ol, li)
 * - Tables (table, tr, td, th)
 * - Blockquotes (blockquote)
 * - Code blocks (code_block, code_line)
 * - Callouts (callout)
 * - Toggle blocks (toggle)
 * - Horizontal rules (hr) - skipped
 * - Images (img) - skipped
 * - Embedded content - skipped
 *
 * @param content - Plate.js JSON content (array of block nodes)
 * @returns Plain text with blocks separated by newlines
 *
 * @example
 * ```typescript
 * const content = [
 *   { type: "h1", children: [{ text: "Title" }] },
 *   { type: "p", children: [{ text: "Paragraph text" }] },
 * ];
 * const text = extractPlainText(content);
 * // Returns: "Title\nParagraph text"
 * ```
 */
export function extractPlainText(content: unknown): string {
  // Handle null, undefined, or non-array content
  if (!content) {
    return "";
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const blocks: string[] = [];

  for (const node of content) {
    const blockText = extractNodeText(node as PlateNode);
    if (blockText.trim()) {
      blocks.push(blockText.trim());
    }
  }

  return blocks.join("\n");
}

/**
 * Recursively extract text from a single Plate.js node.
 * Handles nested structures like lists and tables.
 *
 * @param node - A Plate.js node (element or text)
 * @returns Extracted text from the node and its children
 */
function extractNodeText(node: PlateNode | null | undefined): string {
  if (!node) {
    return "";
  }

  // Text node - return the text directly
  if (typeof node.text === "string") {
    return node.text;
  }

  // Skip nodes that don't contain meaningful text
  const skipTypes = ["hr", "img", "image", "media_embed", "excalidraw"];
  if (node.type && skipTypes.includes(node.type)) {
    return "";
  }

  // Element node - recursively process children
  if (Array.isArray(node.children)) {
    const childTexts: string[] = [];

    for (const child of node.children) {
      const childText = extractNodeText(child);
      if (childText) {
        childTexts.push(childText);
      }
    }

    // Join child texts based on node type
    // For inline elements (like list items in a row), join with space
    // For block elements, join with nothing (text flows continuously)
    const blockTypes = [
      "ul",
      "ol",
      "table",
      "tbody",
      "thead",
      "tr",
      "blockquote",
      "toggle",
      "code_block",
    ];

    if (node.type && blockTypes.includes(node.type)) {
      // For container blocks, join children with newlines
      return childTexts.join("\n");
    }

    // For inline containers (p, li, td, etc.), join without separator
    return childTexts.join("");
  }

  return "";
}

/**
 * Count words in the extracted plain text.
 *
 * @param text - Plain text string
 * @returns Number of words
 */
export function countWords(text: string): number {
  if (!text || typeof text !== "string") {
    return 0;
  }

  // Split on whitespace and filter empty strings
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get content size in bytes for a document.
 * Returns size information including whether the document is approaching the limit.
 *
 * @param documentId - The document ID
 * @returns Content size information or null if not found/no access
 */
export const getContentSize = query({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.union(
    v.object({
      documentId: v.id("kbDocuments"),
      contentSize: v.number(),
      maxSize: v.number(),
      usagePercent: v.number(),
      isNearLimit: v.boolean(),
      remainingBytes: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return null;
    }

    // Check read permission
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "read"
    );

    if (!hasAccess) {
      return null;
    }

    // Get content from separate table
    const content = await ctx.db
      .query("kbDocumentContent")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();

    if (!content) {
      return {
        documentId: args.documentId,
        contentSize: 0,
        maxSize: MAX_CONTENT_SIZE_BYTES,
        usagePercent: 0,
        isNearLimit: false,
        remainingBytes: MAX_CONTENT_SIZE_BYTES,
      };
    }

    const usagePercent = (content.contentSize / MAX_CONTENT_SIZE_BYTES) * 100;
    const isNearLimit = content.contentSize >= CONTENT_SIZE_WARNING_BYTES;
    const remainingBytes = Math.max(
      0,
      MAX_CONTENT_SIZE_BYTES - content.contentSize
    );

    return {
      documentId: args.documentId,
      contentSize: content.contentSize,
      maxSize: MAX_CONTENT_SIZE_BYTES,
      usagePercent: Math.round(usagePercent * 100) / 100,
      isNearLimit,
      remainingBytes,
    };
  },
});

/**
 * Get plain text version of document content.
 * Useful for preview, search display, or text-only contexts.
 *
 * @param documentId - The document ID
 * @returns Plain text content or null if not found/no access
 */
export const getPlainText = query({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.union(
    v.object({
      documentId: v.id("kbDocuments"),
      text: v.string(),
      wordCount: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return null;
    }

    // Check read permission
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "read"
    );

    if (!hasAccess) {
      return null;
    }

    // Get content from separate table
    const content = await ctx.db
      .query("kbDocumentContent")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();

    if (!content) {
      return {
        documentId: args.documentId,
        text: "",
        wordCount: 0,
      };
    }

    // Use stored contentText if available, otherwise extract
    const text = content.contentText ?? extractPlainText(content.content);
    const wordCount = countWords(text);

    return {
      documentId: args.documentId,
      text,
      wordCount,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Update document content with enhanced validation and metadata.
 * This is a specialized content update that:
 * - Validates content size (max 10MB)
 * - Automatically extracts plain text for search indexing
 * - Calculates word count
 * - Returns size warning if approaching limit
 *
 * @param documentId - Document ID
 * @param content - Plate.js JSON content
 * @returns Update result with size information
 */
export const updateWithMetadata = mutation({
  args: {
    documentId: v.id("kbDocuments"),
    content: v.any(),
  },
  returns: v.object({
    success: v.boolean(),
    contentSize: v.number(),
    wordCount: v.number(),
    isNearLimit: v.boolean(),
    remainingBytes: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId } = await requireKBAuth(ctx);

    // Verify document exists
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // Check write permission
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      args.documentId,
      "write"
    );

    if (!hasAccess) {
      throw new ConvexError(
        "Forbidden: You do not have write access to this document"
      );
    }

    // Validate content size (10MB max)
    const contentString = JSON.stringify(args.content);
    const contentSize = contentString.length;

    if (contentSize > MAX_CONTENT_SIZE_BYTES) {
      throw new ConvexError(
        `Document exceeds maximum size of 10MB. Current size: ${Math.round(contentSize / 1024 / 1024 * 100) / 100}MB`
      );
    }

    // Extract plain text for search indexing
    const contentText = extractPlainText(args.content);
    const wordCount = countWords(contentText);

    const now = Date.now();

    // Get existing content record
    const existingContent = await ctx.db
      .query("kbDocumentContent")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();

    if (existingContent) {
      // Update existing content
      await ctx.db.patch(existingContent._id, {
        content: args.content,
        contentText,
        contentSize,
        updatedAt: now,
      });
    } else {
      // Create new content record if missing
      await ctx.db.insert("kbDocumentContent", {
        documentId: args.documentId,
        content: args.content,
        contentText,
        contentSize,
        updatedAt: now,
      });
    }

    // Update document metadata
    await ctx.db.patch(args.documentId, {
      wordCount,
      lastEditedBy: userId,
      updatedAt: now,
    });

    const isNearLimit = contentSize >= CONTENT_SIZE_WARNING_BYTES;
    const remainingBytes = Math.max(0, MAX_CONTENT_SIZE_BYTES - contentSize);

    return {
      success: true,
      contentSize,
      wordCount,
      isNearLimit,
      remainingBytes,
    };
  },
});

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Internal: Sync contentText field for search indexing.
 * Used by background jobs to ensure search index is up to date.
 *
 * @param documentId - Document ID to sync
 * @returns null
 */
export const syncContentText = internalMutation({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get content record
    const content = await ctx.db
      .query("kbDocumentContent")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();

    if (!content) {
      return null;
    }

    // Extract plain text
    const contentText = extractPlainText(content.content);
    const wordCount = countWords(contentText);

    // Update content record with extracted text
    await ctx.db.patch(content._id, {
      contentText,
      updatedAt: Date.now(),
    });

    // Update word count on document
    await ctx.db.patch(args.documentId, {
      wordCount,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Internal: Batch sync contentText for multiple documents.
 * Used by migration scripts or bulk operations.
 *
 * @param documentIds - Array of document IDs to sync
 * @returns Summary of sync operation
 */
export const batchSyncContentText = internalMutation({
  args: {
    documentIds: v.array(v.id("kbDocuments")),
  },
  returns: v.object({
    processed: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    let processed = 0;
    let skipped = 0;

    for (const documentId of args.documentIds) {
      const content = await ctx.db
        .query("kbDocumentContent")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .unique();

      if (!content) {
        skipped++;
        continue;
      }

      // Extract plain text
      const contentText = extractPlainText(content.content);
      const wordCount = countWords(contentText);

      // Update content record
      await ctx.db.patch(content._id, {
        contentText,
        updatedAt: Date.now(),
      });

      // Update document
      await ctx.db.patch(documentId, {
        wordCount,
        updatedAt: Date.now(),
      });

      processed++;
    }

    return { processed, skipped };
  },
});

/**
 * Internal: Validate content size without saving.
 * Used to pre-check content before expensive operations.
 *
 * @param content - Plate.js JSON content to validate
 * @returns Validation result
 */
export const validateContentSize = internalMutation({
  args: {
    content: v.any(),
  },
  returns: v.object({
    isValid: v.boolean(),
    contentSize: v.number(),
    maxSize: v.number(),
    errorMessage: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const contentString = JSON.stringify(args.content);
    const contentSize = contentString.length;

    if (contentSize > MAX_CONTENT_SIZE_BYTES) {
      return {
        isValid: false,
        contentSize,
        maxSize: MAX_CONTENT_SIZE_BYTES,
        errorMessage: `Content size (${Math.round(contentSize / 1024 / 1024 * 100) / 100}MB) exceeds maximum of 10MB`,
      };
    }

    return {
      isValid: true,
      contentSize,
      maxSize: MAX_CONTENT_SIZE_BYTES,
    };
  },
});
