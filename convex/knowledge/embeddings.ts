import {
  internalMutation,
  internalQuery,
  query,
} from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { requireKBAuth, checkPermission } from "../lib/kbAuth";
import { extractPlainText } from "./content";
import { batchFilterAccessibleDocuments } from "./permissionHelpers";

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Internal query to get document content for embedding generation.
 * Used by the embeddings action to fetch document content.
 *
 * @param documentId - The document ID
 * @returns Plain text content and document metadata, or null if not found
 */
export const getContentInternal = internalQuery({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.union(
    v.object({
      documentId: v.id("kbDocuments"),
      title: v.string(),
      plainText: v.string(),
      wordCount: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { documentId }) => {
    // Get document metadata
    const document = await ctx.db.get(documentId);
    if (!document) {
      return null;
    }

    // Skip archived documents
    if (document.status === "archived") {
      return null;
    }

    // Get content from kbDocumentContent table
    const content = await ctx.db
      .query("kbDocumentContent")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .unique();

    if (!content) {
      return {
        documentId,
        title: document.title,
        plainText: "",
        wordCount: 0,
      };
    }

    // Use stored contentText if available, otherwise extract from Plate.js content
    const plainText = content.contentText ?? extractPlainText(content.content);
    const words = plainText.trim().split(/\s+/).filter(Boolean);

    return {
      documentId,
      title: document.title,
      plainText,
      wordCount: words.length,
    };
  },
});

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

/**
 * Store a single embedding chunk for a document.
 * Called by the embeddings action after generating embeddings via OpenAI.
 *
 * @param documentId - The document ID
 * @param chunkIndex - 0-based index of this chunk
 * @param content - The text content that was embedded
 * @param embedding - The 1536-dimensional embedding vector
 * @returns The ID of the created embedding record
 */
export const storeEmbedding = internalMutation({
  args: {
    documentId: v.id("kbDocuments"),
    chunkIndex: v.number(),
    content: v.string(),
    embedding: v.array(v.float64()),
  },
  returns: v.id("kbDocumentEmbeddings"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("kbDocumentEmbeddings", {
      documentId: args.documentId,
      chunkIndex: args.chunkIndex,
      content: args.content,
      embedding: args.embedding,
      createdAt: Date.now(),
    });
  },
});

/**
 * Delete all embeddings for a document.
 * Used before regenerating embeddings to ensure clean state.
 *
 * @param documentId - The document ID
 * @returns Count of deleted embedding records
 */
export const deleteDocumentEmbeddings = internalMutation({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.number(),
  handler: async (ctx, { documentId }) => {
    const embeddings = await ctx.db
      .query("kbDocumentEmbeddings")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .collect();

    for (const embedding of embeddings) {
      await ctx.db.delete(embedding._id);
    }

    return embeddings.length;
  },
});

/**
 * Batch store multiple embeddings for a document.
 * More efficient than calling storeEmbedding multiple times.
 *
 * @param documentId - The document ID
 * @param chunks - Array of chunk data with content and embeddings
 * @returns Array of created embedding IDs
 */
export const storeEmbeddingsBatch = internalMutation({
  args: {
    documentId: v.id("kbDocuments"),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        content: v.string(),
        embedding: v.array(v.float64()),
      })
    ),
  },
  returns: v.array(v.id("kbDocumentEmbeddings")),
  handler: async (ctx, { documentId, chunks }) => {
    const now = Date.now();
    const ids: Id<"kbDocumentEmbeddings">[] = [];

    for (const chunk of chunks) {
      const id = await ctx.db.insert("kbDocumentEmbeddings", {
        documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
        createdAt: now,
      });
      ids.push(id);
    }

    return ids;
  },
});

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get embedding status for a document.
 * Returns information about existing embeddings.
 *
 * @param documentId - The document ID
 * @returns Embedding status or null if no access
 */
export const getEmbeddingStatus = query({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.union(
    v.object({
      documentId: v.id("kbDocuments"),
      hasEmbeddings: v.boolean(),
      chunkCount: v.number(),
      lastUpdatedAt: v.union(v.number(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { documentId }) => {
    const { userId } = await requireKBAuth(ctx);

    // Check read permission on document
    const hasAccess = await checkPermission(
      ctx,
      userId,
      "document",
      documentId,
      "read"
    );

    if (!hasAccess) {
      return null;
    }

    // Get embeddings for this document
    const embeddings = await ctx.db
      .query("kbDocumentEmbeddings")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .collect();

    if (embeddings.length === 0) {
      return {
        documentId,
        hasEmbeddings: false,
        chunkCount: 0,
        lastUpdatedAt: null,
      };
    }

    // Find the most recent embedding
    const lastUpdatedAt = Math.max(...embeddings.map((e) => e.createdAt));

    return {
      documentId,
      hasEmbeddings: true,
      chunkCount: embeddings.length,
      lastUpdatedAt,
    };
  },
});

/**
 * List all document IDs that have embeddings.
 * Internal use only for backfill deduplication.
 *
 * @returns Array of unique document IDs that have at least one embedding
 */
export const listDocumentIdsWithEmbeddings = internalQuery({
  args: {},
  returns: v.array(v.id("kbDocuments")),
  handler: async (ctx) => {
    const embeddings = await ctx.db.query("kbDocumentEmbeddings").collect();
    // Use Set to deduplicate, then convert back to array
    const uniqueDocIds = new Set(embeddings.map((e) => e.documentId));
    return Array.from(uniqueDocIds);
  },
});

/**
 * Internal query to fetch embedding results by IDs.
 * Used by the vector search action to load full embedding data.
 *
 * @param ids - Array of embedding IDs from vector search
 * @returns Array of embedding documents with content
 */
export const fetchEmbeddingsByIds = internalQuery({
  args: {
    ids: v.array(v.id("kbDocumentEmbeddings")),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbDocumentEmbeddings"),
      documentId: v.id("kbDocuments"),
      chunkIndex: v.number(),
      content: v.string(),
    })
  ),
  handler: async (ctx, { ids }) => {
    const results: Array<{
      _id: Id<"kbDocumentEmbeddings">;
      documentId: Id<"kbDocuments">;
      chunkIndex: number;
      content: string;
    }> = [];

    for (const id of ids) {
      const embedding = await ctx.db.get(id);
      if (embedding) {
        results.push({
          _id: embedding._id,
          documentId: embedding.documentId,
          chunkIndex: embedding.chunkIndex,
          content: embedding.content,
        });
      }
    }

    return results;
  },
});

/**
 * Internal query to check document permissions for a list of document IDs.
 * Returns the set of document IDs the user has access to.
 *
 * Uses batch permission checking to prevent N+1 queries.
 *
 * @param userId - The user ID to check permissions for
 * @param documentIds - Array of document IDs to check
 * @returns Array of document IDs the user has read access to
 */
export const filterAccessibleDocuments = internalQuery({
  args: {
    userId: v.id("users"),
    documentIds: v.array(v.id("kbDocuments")),
  },
  returns: v.array(v.id("kbDocuments")),
  handler: async (ctx, { userId, documentIds }) => {
    // Use batch permission check to prevent N+1 queries
    const accessibleSet = await batchFilterAccessibleDocuments(
      ctx,
      userId,
      documentIds,
      "read"
    );

    // Convert Set<string> to Id<"kbDocuments">[]
    return documentIds.filter((id) => accessibleSet.has(id));
  },
});
