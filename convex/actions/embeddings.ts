"use node";

import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// Type workaround: Use dynamic import pattern to avoid TS2589 deep type instantiation
// The internalApi variable is typed as 'any' which breaks the deep type chain
// This is necessary because Convex's internal API generates very deep types
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const internalApi: any = require("../_generated/api").internal;

// ============================================================================
// CONSTANTS
// ============================================================================

/** OpenAI embedding model */
const EMBEDDING_MODEL = "text-embedding-3-small";

/** Embedding dimensions for text-embedding-3-small */
const EMBEDDING_DIMENSIONS = 1536;

/** Maximum characters per chunk (~500 tokens) */
const MAX_CHUNK_CHARS = 2000;

/** Minimum chunk size to avoid tiny fragments */
const MIN_CHUNK_CHARS = 100;

/** Maximum retries for API calls */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const BASE_RETRY_DELAY_MS = 1000;

// ============================================================================
// TYPES
// ============================================================================

/**
 * OpenAI embeddings API response structure.
 */
interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Result of embedding generation.
 */
type EmbeddingResult =
  | { success: true; embedding: number[] }
  | { success: false; error: string };

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep for a specified duration.
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chunk text into segments suitable for embedding.
 * Attempts to break at sentence boundaries when possible.
 *
 * @param text - The text to chunk
 * @param maxChars - Maximum characters per chunk
 * @returns Array of text chunks
 *
 * @example
 * ```typescript
 * const chunks = chunkText("Long document text...", 2000);
 * // Returns: ["First chunk ending at sentence.", "Second chunk..."]
 * ```
 */
function chunkText(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;

    // If this would be the last chunk, just take the rest
    if (end >= text.length) {
      const chunk = text.slice(start).trim();
      if (chunk.length >= MIN_CHUNK_CHARS) {
        chunks.push(chunk);
      } else if (chunks.length > 0 && chunk.length > 0) {
        // Append small final chunk to previous chunk
        chunks[chunks.length - 1] += " " + chunk;
      } else if (chunk.length > 0) {
        // Even if small, include if it's the only content
        chunks.push(chunk);
      }
      break;
    }

    // Try to find a sentence boundary to break at
    const searchStart = start + Math.floor(maxChars / 2);
    const searchEnd = Math.min(end, text.length);
    const searchArea = text.slice(searchStart, searchEnd);

    // Look for sentence-ending punctuation followed by space or newline
    const sentenceEndRegex = /[.!?]\s/g;
    let lastMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;

    while ((match = sentenceEndRegex.exec(searchArea)) !== null) {
      lastMatch = match;
    }

    if (lastMatch) {
      // Break at the sentence boundary
      end = searchStart + lastMatch.index + 1; // Include the punctuation
    } else {
      // No sentence boundary found, try to break at a newline
      const lastNewline = text.lastIndexOf("\n", end);
      if (lastNewline > start + MIN_CHUNK_CHARS) {
        end = lastNewline;
      } else {
        // No good break point, try to break at a space
        const lastSpace = text.lastIndexOf(" ", end);
        if (lastSpace > start + MIN_CHUNK_CHARS) {
          end = lastSpace;
        }
        // Otherwise just break at maxChars
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length >= MIN_CHUNK_CHARS) {
      chunks.push(chunk);
    } else if (chunks.length > 0 && chunk.length > 0) {
      // Append small chunk to previous
      chunks[chunks.length - 1] += " " + chunk;
    }

    start = end;
    // Skip any leading whitespace for next chunk
    while (start < text.length) {
      const char = text[start];
      if (char === undefined || !/\s/.test(char)) {
        break;
      }
      start++;
    }
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Call OpenAI embeddings API with retry logic.
 *
 * @param text - Text to generate embedding for
 * @param apiKey - OpenAI API key
 * @returns Embedding result with success/failure and embedding or error
 */
async function generateEmbeddingWithRetry(
  text: string,
  apiKey: string
): Promise<EmbeddingResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text,
        }),
      });

      // Log request ID for debugging (required by task spec)
      const requestId = response.headers.get("x-request-id");
      if (requestId) {
        // eslint-disable-next-line no-console
        console.log(`[embeddings] OpenAI request_id: ${requestId}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `OpenAI API error (${response.status}): ${errorText}`;

        // Don't retry on client errors (4xx) except rate limits (429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return { success: false, error: errorMessage };
        }

        throw new Error(errorMessage);
      }

      const data = (await response.json()) as OpenAIEmbeddingResponse;

      if (!data.data?.[0]?.embedding) {
        throw new Error("Invalid response structure from OpenAI API");
      }

      // eslint-disable-next-line no-console
      console.log(`[embeddings] Generated embedding, tokens used: ${data.usage.total_tokens}`);

      return { success: true, embedding: data.data[0].embedding };
    } catch (error) {
      lastError = error as Error;
      console.error(
        `[embeddings] Attempt ${attempt}/${MAX_RETRIES} failed:`,
        lastError.message
      );

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[embeddings] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: lastError?.message ?? "Unknown error after max retries",
  };
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Generate embedding for a single text string.
 * This is a public action that requires authentication.
 *
 * @param text - The text to generate an embedding for
 * @returns 1536-dimensional embedding vector
 *
 * @example
 * ```typescript
 * const embedding = await ctx.runAction(api.actions.embeddings.generateEmbedding, {
 *   text: "How do I create a new course?",
 * });
 * // Returns: [0.123, -0.456, ...] (1536 numbers)
 * ```
 */
export const generateEmbedding = action({
  args: {
    text: v.string(),
  },
  returns: v.array(v.float64()),
  handler: async (ctx, { text }): Promise<number[]> => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not configured");
    }

    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    // Truncate very long text (API limit is ~8000 tokens, ~32000 chars)
    const truncatedText = text.slice(0, 32000);

    const result = await generateEmbeddingWithRetry(truncatedText, apiKey);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.embedding;
  },
});

/**
 * Internal action to generate embeddings for a document.
 * Chunks the document content and generates embeddings for each chunk.
 * Should be called via scheduler from a mutation.
 *
 * @param documentId - The document ID to generate embeddings for
 * @returns Array of created embedding IDs
 *
 * @example
 * ```typescript
 * // From a mutation:
 * await ctx.scheduler.runAfter(0, internal.actions.embeddings.generateDocumentEmbeddings, {
 *   documentId: args.documentId,
 * });
 * ```
 */
export const generateDocumentEmbeddings = internalAction({
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.array(v.id("kbDocumentEmbeddings")),
  handler: async (ctx, { documentId }): Promise<Id<"kbDocumentEmbeddings">[]> => {
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not configured");
    }

    // Fetch document content via internal query
    const content: {
      documentId: Id<"kbDocuments">;
      title: string;
      plainText: string;
      wordCount: number;
    } | null = await ctx.runQuery(internalApi.knowledge.embeddings.getContentInternal, {
      documentId,
    });

    if (!content) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Skip if document has no content
    if (!content.plainText || content.plainText.trim().length === 0) {
      console.warn(`[embeddings] Document ${documentId} has no content, skipping`);
      return [];
    }

    // eslint-disable-next-line no-console
    console.log(`[embeddings] Processing document "${content.title}" (${content.wordCount} words)`);

    // Delete existing embeddings for this document
    const deletedCount: number = await ctx.runMutation(
      internalApi.knowledge.embeddings.deleteDocumentEmbeddings,
      { documentId }
    );

    if (deletedCount > 0) {
      // eslint-disable-next-line no-console
      console.log(`[embeddings] Deleted ${deletedCount} existing embeddings for document ${documentId}`);
    }

    // Chunk the content
    const chunks = chunkText(content.plainText, MAX_CHUNK_CHARS);

    if (chunks.length === 0) {
      console.warn(`[embeddings] No chunks generated for document ${documentId}`);
      return [];
    }

    // eslint-disable-next-line no-console
    console.log(`[embeddings] Split into ${chunks.length} chunks`);

    // Generate embeddings for each chunk
    const embeddingData: Array<{
      chunkIndex: number;
      content: string;
      embedding: number[];
    }> = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      // eslint-disable-next-line no-console
      console.log(`[embeddings] Generating embedding for chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);

      const result = await generateEmbeddingWithRetry(chunk, apiKey);

      if (!result.success) {
        console.error(`[embeddings] Failed to generate embedding for chunk ${i}: ${result.error}`);
        throw new Error(`Failed to generate embedding for chunk ${i}: ${result.error}`);
      }

      embeddingData.push({
        chunkIndex: i,
        content: chunk,
        embedding: result.embedding,
      });
    }

    // Store all embeddings in batch
    const embeddingIds: Id<"kbDocumentEmbeddings">[] = await ctx.runMutation(
      internalApi.knowledge.embeddings.storeEmbeddingsBatch,
      {
        documentId,
        chunks: embeddingData,
      }
    );

    // eslint-disable-next-line no-console
    console.log(`[embeddings] Successfully stored ${embeddingIds.length} embeddings for document ${documentId}`);

    return embeddingIds;
  },
});

/**
 * Backfill embeddings for all documents that don't have them.
 * Run once via Convex CLI: npx convex run actions/embeddings:backfillAllDocuments
 *
 * This is an internal action (no auth required) for admin/migration operations.
 * It will process all documents that:
 * 1. Are not archived
 * 2. Do not already have embeddings
 *
 * @returns Statistics about the backfill operation
 *
 * @example
 * ```bash
 * npx convex run actions/embeddings:backfillAllDocuments
 * ```
 */
export const backfillAllDocuments = internalAction({
  args: {},
  returns: v.object({
    processed: v.number(),
    skipped: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx): Promise<{ processed: number; skipped: number; errors: number }> => {
    // No auth check - internal actions are secure by design
    // Only callable from Convex CLI, dashboard, or other internal functions

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not configured");
    }

    // Get all non-archived documents
    const documents: Array<{ _id: Id<"kbDocuments">; title: string }> =
      await ctx.runQuery(internalApi.knowledge.documents.listAllForEmbedding);

    // Get documents that already have embeddings
    const existingDocIds: Id<"kbDocuments">[] = await ctx.runQuery(
      internalApi.knowledge.embeddings.listDocumentIdsWithEmbeddings
    );
    const existingSet = new Set(existingDocIds.map((id) => id.toString()));

    // eslint-disable-next-line no-console
    console.log(
      `[backfill] Found ${documents.length} documents, ${existingDocIds.length} already have embeddings`
    );

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of documents) {
      if (existingSet.has(doc._id.toString())) {
        skipped++;
        // eslint-disable-next-line no-console
        console.log(`[backfill] Skipping "${doc.title}" - already has embeddings`);
        continue;
      }

      try {
        // eslint-disable-next-line no-console
        console.log(`[backfill] Processing "${doc.title}"...`);

        await ctx.runAction(
          internalApi.actions.embeddings.generateDocumentEmbeddings,
          { documentId: doc._id }
        );

        processed++;
        // eslint-disable-next-line no-console
        console.log(`[backfill] Completed "${doc.title}"`);
      } catch (error) {
        console.error(`[backfill] Failed "${doc.title}":`, error);
        errors++;
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[backfill] Complete: ${processed} processed, ${skipped} skipped, ${errors} errors`
    );

    return { processed, skipped, errors };
  },
});

/**
 * Generate embedding for a search query.
 * This is a lightweight action for converting search text to a vector.
 *
 * @param query - The search query text
 * @returns 1536-dimensional embedding vector
 */
export const generateQueryEmbedding = action({
  args: {
    query: v.string(),
  },
  returns: v.array(v.float64()),
  handler: async (ctx, { query }): Promise<number[]> => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not configured");
    }

    // Validate input
    if (!query || query.trim().length === 0) {
      throw new Error("Query cannot be empty");
    }

    // Queries are typically short, but truncate just in case
    const truncatedQuery = query.slice(0, 8000);

    const result = await generateEmbeddingWithRetry(truncatedQuery, apiKey);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.embedding;
  },
});

/**
 * Semantic search action.
 * Generates an embedding for the query and performs vector similarity search.
 *
 * @param query - The search query text
 * @param limit - Maximum number of results to return (default: 10)
 * @returns Array of search results with document content and similarity scores
 */
export const semanticSearch = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      documentId: v.id("kbDocuments"),
      chunkIndex: v.number(),
      content: v.string(),
      score: v.float64(),
    })
  ),
  handler: async (
    ctx,
    { query, limit }
  ): Promise<
    Array<{
      documentId: Id<"kbDocuments">;
      chunkIndex: number;
      content: string;
      score: number;
    }>
  > => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not configured");
    }

    // Validate input
    if (!query || query.trim().length === 0) {
      throw new Error("Query cannot be empty");
    }

    const searchLimit = limit ?? 10;

    // Step 1: Generate embedding for the query
    const embeddingResult = await generateEmbeddingWithRetry(query, apiKey);
    if (!embeddingResult.success) {
      throw new Error(`Failed to generate query embedding: ${embeddingResult.error}`);
    }

    // Step 2: Perform vector search
    const vectorResults = await ctx.vectorSearch(
      "kbDocumentEmbeddings",
      "by_embedding",
      {
        vector: embeddingResult.embedding,
        limit: searchLimit * 3, // Fetch extra to account for permission filtering
      }
    );

    if (vectorResults.length === 0) {
      return [];
    }

    // Step 3: Fetch full embedding data
    const embeddingIds = vectorResults.map((r) => r._id);
    const embeddings: Array<{
      _id: Id<"kbDocumentEmbeddings">;
      documentId: Id<"kbDocuments">;
      chunkIndex: number;
      content: string;
    }> = await ctx.runQuery(
      internalApi.knowledge.embeddings.fetchEmbeddingsByIds,
      { ids: embeddingIds }
    );

    // Create a map of embedding ID to full data
    const embeddingMap = new Map(embeddings.map((e) => [e._id, e]));

    // Create a map of embedding ID to score
    const scoreMap = new Map(vectorResults.map((r) => [r._id, r._score]));

    // Step 4: Get user ID for permission filtering
    const user: { _id: Id<"users"> } | null = await ctx.runQuery(
      internalApi.users.getByClerkIdInternal,
      { clerkId: identity.subject }
    );

    if (!user) {
      throw new Error("User not found");
    }

    // Step 5: Filter by document permissions
    const uniqueDocumentIds = [
      ...new Set(embeddings.map((e) => e.documentId)),
    ];

    const accessibleDocIds: Id<"kbDocuments">[] = await ctx.runQuery(
      internalApi.knowledge.embeddings.filterAccessibleDocuments,
      {
        userId: user._id,
        documentIds: uniqueDocumentIds,
      }
    );

    const accessibleDocIdSet = new Set(accessibleDocIds);

    // Step 6: Build results maintaining relevance order
    const results: Array<{
      documentId: Id<"kbDocuments">;
      chunkIndex: number;
      content: string;
      score: number;
    }> = [];

    for (const vectorResult of vectorResults) {
      if (results.length >= searchLimit) break;

      const embedding = embeddingMap.get(vectorResult._id);
      if (!embedding) continue;

      if (!accessibleDocIdSet.has(embedding.documentId)) continue;

      results.push({
        documentId: embedding.documentId,
        chunkIndex: embedding.chunkIndex,
        content: embedding.content,
        score: scoreMap.get(vectorResult._id) ?? 0,
      });
    }

    return results;
  },
});

/**
 * Full semantic search action with enriched results.
 * Performs vector search and returns results in the same format as keyword search.
 * This action is designed to be called from the frontend for semantic search mode.
 *
 * @param query - The search query text
 * @param limit - Maximum number of results to return (default: 20)
 * @returns Search response with full document metadata, matching keyword search format
 */
export const semanticSearchWithEnrichment = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    results: v.array(
      v.object({
        _id: v.id("kbDocuments"),
        title: v.string(),
        icon: v.optional(v.string()),
        snippet: v.string(),
        highlightedTerms: v.array(v.string()),
        workspace: v.object({
          _id: v.id("kbWorkspaces"),
          name: v.string(),
        }),
        folder: v.object({
          _id: v.id("kbFolders"),
          name: v.string(),
        }),
        creator: v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        }),
        relevanceScore: v.optional(v.number()),
        updatedAt: v.number(),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
    totalCount: v.optional(v.number()),
    mode: v.union(v.literal("keyword"), v.literal("semantic")),
  }),
  handler: async (ctx, { query, limit }) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not configured");
    }

    // Validate input
    if (!query || query.trim().length === 0) {
      return {
        results: [],
        nextCursor: undefined,
        hasMore: false,
        totalCount: 0,
        mode: "semantic" as const,
      };
    }

    const searchLimit = limit ?? 20;

    // Step 1: Generate embedding for the query
    const embeddingResult = await generateEmbeddingWithRetry(query, apiKey);
    if (!embeddingResult.success) {
      throw new Error(`Failed to generate query embedding: ${embeddingResult.error}`);
    }

    // Step 2: Perform vector search
    const vectorResults = await ctx.vectorSearch(
      "kbDocumentEmbeddings",
      "by_embedding",
      {
        vector: embeddingResult.embedding,
        limit: searchLimit * 3, // Fetch extra to account for permission filtering & deduplication
      }
    );

    if (vectorResults.length === 0) {
      return {
        results: [],
        nextCursor: undefined,
        hasMore: false,
        totalCount: 0,
        mode: "semantic" as const,
      };
    }

    // Step 3: Fetch full embedding data
    const embeddingIds = vectorResults.map((r) => r._id);
    const embeddings: Array<{
      _id: Id<"kbDocumentEmbeddings">;
      documentId: Id<"kbDocuments">;
      chunkIndex: number;
      content: string;
    }> = await ctx.runQuery(
      internalApi.knowledge.embeddings.fetchEmbeddingsByIds,
      { ids: embeddingIds }
    );

    // Create a map of embedding ID to full data
    const embeddingMap = new Map(embeddings.map((e) => [e._id, e]));

    // Create a map of embedding ID to score
    const scoreMap = new Map(vectorResults.map((r) => [r._id, r._score]));

    // Step 4: Get user ID for permission filtering
    const user: { _id: Id<"users"> } | null = await ctx.runQuery(
      internalApi.users.getByClerkIdInternal,
      { clerkId: identity.subject }
    );

    if (!user) {
      throw new Error("User not found");
    }

    // Step 5: Filter by document permissions
    const uniqueDocumentIds = [
      ...new Set(embeddings.map((e) => e.documentId)),
    ];

    const accessibleDocIds: Id<"kbDocuments">[] = await ctx.runQuery(
      internalApi.knowledge.embeddings.filterAccessibleDocuments,
      {
        userId: user._id,
        documentIds: uniqueDocumentIds,
      }
    );

    const accessibleDocIdSet = new Set(accessibleDocIds);

    // Step 6: Build unique document results (deduplicate by documentId, keep highest score)
    const documentScoreMap = new Map<string, { documentId: Id<"kbDocuments">; score: number; content: string }>();

    for (const vectorResult of vectorResults) {
      const embedding = embeddingMap.get(vectorResult._id);
      if (!embedding) continue;
      if (!accessibleDocIdSet.has(embedding.documentId)) continue;

      const docIdStr = embedding.documentId.toString();
      const existingEntry = documentScoreMap.get(docIdStr);
      const currentScore = scoreMap.get(vectorResult._id) ?? 0;

      // Keep the entry with the highest score for each document
      if (!existingEntry || currentScore > existingEntry.score) {
        documentScoreMap.set(docIdStr, {
          documentId: embedding.documentId,
          score: currentScore,
          content: embedding.content,
        });
      }
    }

    // Convert to array and limit
    const uniqueDocResults = Array.from(documentScoreMap.values()).slice(0, searchLimit);

    if (uniqueDocResults.length === 0) {
      return {
        results: [],
        nextCursor: undefined,
        hasMore: false,
        totalCount: 0,
        mode: "semantic" as const,
      };
    }

    // Step 7: Enrich results with full document metadata
    const enrichedResults = await ctx.runQuery(
      internalApi.knowledge.search.enrichDocumentsForSearch,
      {
        documents: uniqueDocResults.map((r) => ({
          documentId: r.documentId,
          score: r.score,
          content: r.content,
        })),
        userId: user._id,
        searchTerms: query.split(/\s+/).filter((t) => t.length > 0),
      }
    );

    return {
      results: enrichedResults,
      nextCursor: undefined, // Semantic search doesn't support cursor pagination
      hasMore: false, // All results returned in one batch
      totalCount: enrichedResults.length,
      mode: "semantic" as const,
    };
  },
});

// Export constants for use in other modules
export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL };
