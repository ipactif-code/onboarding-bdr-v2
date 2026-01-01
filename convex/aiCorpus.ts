import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { requireAdmin, requireAdminInAction } from "./lib/auth";
import { Id } from "./_generated/dataModel";

// Type workaround: Use require() to avoid TS2589 deep type instantiation on 'internal'
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { internal } = require("./_generated/api") as { internal: any };

// ============================================================================
// Constants
// ============================================================================

/**
 * Default page size for browse queries.
 */
const DEFAULT_PAGE_SIZE = 20;

/**
 * Maximum page size allowed.
 */
const MAX_PAGE_SIZE = 100;

/**
 * Content preview length for browse results.
 */
const CONTENT_PREVIEW_LENGTH = 100;

// ============================================================================
// Type Validators
// ============================================================================

/**
 * Source type validator for AI training corpus entries.
 */
const sourceTypeValidator = v.union(
  v.literal("text"),
  v.literal("voice_transcription")
);

/**
 * Category validator for AI training corpus entries.
 */
const categoryValidator = v.union(
  v.literal("question"),
  v.literal("answer"),
  v.literal("discussion"),
  v.literal("announcement"),
  v.literal("feedback"),
  v.literal("other")
);

// ============================================================================
// Queries
// ============================================================================

/**
 * Get comprehensive statistics about the AI training corpus.
 *
 * Returns aggregate statistics including:
 * - Total entry count
 * - Breakdown by source type (text vs voice_transcription)
 * - Breakdown by category
 * - Average word count across all entries
 * - Entries added in various time periods (today, this week, this month)
 * - Processed vs unprocessed counts
 *
 * Admin access required.
 */
export const getStats = query({
  args: {},
  returns: v.object({
    totalEntries: v.number(),
    bySourceType: v.object({
      text: v.number(),
      voice_transcription: v.number(),
    }),
    byCategory: v.object({
      question: v.number(),
      answer: v.number(),
      discussion: v.number(),
      announcement: v.number(),
      feedback: v.number(),
      other: v.number(),
      uncategorized: v.number(),
    }),
    averageWordCount: v.number(),
    entriesAddedToday: v.number(),
    entriesAddedThisWeek: v.number(),
    entriesAddedThisMonth: v.number(),
    processedCount: v.number(),
    unprocessedCount: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const now = Date.now();

    // Calculate time boundaries
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayStart = startOfToday.getTime();

    const startOfWeek = new Date(now);
    startOfWeek.setUTCHours(0, 0, 0, 0);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());
    const weekStart = startOfWeek.getTime();

    const startOfMonth = new Date(now);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    startOfMonth.setUTCDate(1);
    const monthStart = startOfMonth.getTime();

    // Fetch all entries (for aggregation)
    const allEntries = await ctx.db.query("aiTrainingCorpus").collect();

    // Calculate totals
    const totalEntries = allEntries.length;

    // Count by source type
    const textCount = allEntries.filter((e) => e.sourceType === "text").length;
    const voiceCount = allEntries.filter(
      (e) => e.sourceType === "voice_transcription"
    ).length;

    // Count by category
    const categoryCount = {
      question: 0,
      answer: 0,
      discussion: 0,
      announcement: 0,
      feedback: 0,
      other: 0,
      uncategorized: 0,
    };

    for (const entry of allEntries) {
      if (entry.category) {
        categoryCount[entry.category]++;
      } else {
        categoryCount.uncategorized++;
      }
    }

    // Calculate average word count
    const totalWordCount = allEntries.reduce(
      (sum, entry) => sum + entry.metadata.wordCount,
      0
    );
    const averageWordCount =
      totalEntries > 0 ? Math.round(totalWordCount / totalEntries) : 0;

    // Count entries by time period
    const entriesAddedToday = allEntries.filter(
      (e) => e.anonymizedAt >= todayStart
    ).length;
    const entriesAddedThisWeek = allEntries.filter(
      (e) => e.anonymizedAt >= weekStart
    ).length;
    const entriesAddedThisMonth = allEntries.filter(
      (e) => e.anonymizedAt >= monthStart
    ).length;

    // Count processed vs unprocessed
    const processedCount = allEntries.filter((e) => e.isProcessed).length;
    const unprocessedCount = totalEntries - processedCount;

    return {
      totalEntries,
      bySourceType: {
        text: textCount,
        voice_transcription: voiceCount,
      },
      byCategory: categoryCount,
      averageWordCount,
      entriesAddedToday,
      entriesAddedThisWeek,
      entriesAddedThisMonth,
      processedCount,
      unprocessedCount,
    };
  },
});

/**
 * Browse AI training corpus entries with pagination and filtering.
 *
 * Provides a paginated list of corpus entries with:
 * - Filtering by source type and/or category
 * - Sorting by anonymizedAt (descending - newest first)
 * - Content preview (first 100 characters)
 * - Pagination metadata
 *
 * Admin access required.
 */
export const browse = query({
  args: {
    sourceType: v.optional(sourceTypeValidator),
    category: v.optional(v.union(categoryValidator, v.literal("uncategorized"))),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  returns: v.object({
    data: v.array(
      v.object({
        _id: v.id("aiTrainingCorpus"),
        sourceType: sourceTypeValidator,
        category: v.union(categoryValidator, v.null()),
        contentPreview: v.string(),
        metadata: v.object({
          wordCount: v.number(),
          characterCount: v.number(),
          hasCodeBlock: v.boolean(),
          hasLinks: v.boolean(),
          channelType: v.optional(
            v.union(
              v.literal("public"),
              v.literal("private"),
              v.literal("course")
            )
          ),
          isThreadReply: v.boolean(),
          isLessonDiscussion: v.boolean(),
          detectedLanguage: v.optional(v.string()),
          reactionCount: v.number(),
          wasEdited: v.boolean(),
        }),
        isProcessed: v.boolean(),
        originalCreatedAt: v.number(),
        anonymizedAt: v.number(),
      })
    ),
    meta: v.object({
      page: v.number(),
      pageSize: v.number(),
      totalItems: v.number(),
      totalPages: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, args.pageSize ?? DEFAULT_PAGE_SIZE));

    // Build query based on filters
    let entries;

    if (args.sourceType) {
      // Use by_type index for sourceType filter
      entries = await ctx.db
        .query("aiTrainingCorpus")
        .withIndex("by_type", (q) => q.eq("sourceType", args.sourceType!))
        .collect();
    } else if (args.category && args.category !== "uncategorized") {
      // Use by_category index for category filter
      entries = await ctx.db
        .query("aiTrainingCorpus")
        .withIndex("by_category", (q) => q.eq("category", args.category as "question" | "answer" | "discussion" | "announcement" | "feedback" | "other"))
        .collect();
    } else {
      // No specific filter, get all
      entries = await ctx.db.query("aiTrainingCorpus").collect();
    }

    // Apply secondary filters in memory
    let filteredEntries = entries;

    // If sourceType was used as index and category filter is also needed
    if (args.sourceType && args.category) {
      if (args.category === "uncategorized") {
        filteredEntries = filteredEntries.filter((e) => e.category === undefined);
      } else {
        filteredEntries = filteredEntries.filter((e) => e.category === args.category);
      }
    }

    // If category index was used, apply sourceType filter in memory
    if (args.category && args.sourceType) {
      filteredEntries = filteredEntries.filter((e) => e.sourceType === args.sourceType);
    }

    // Handle uncategorized filter when no sourceType filter
    if (args.category === "uncategorized" && !args.sourceType) {
      filteredEntries = entries.filter((e) => e.category === undefined);
    }

    // Sort by anonymizedAt descending (newest first)
    filteredEntries.sort((a, b) => b.anonymizedAt - a.anonymizedAt);

    const totalItems = filteredEntries.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    // Apply pagination
    const startIndex = (page - 1) * pageSize;
    const paginatedEntries = filteredEntries.slice(startIndex, startIndex + pageSize);

    // Map to response format with content preview
    const data = paginatedEntries.map((entry) => ({
      _id: entry._id,
      sourceType: entry.sourceType,
      category: entry.category ?? null,
      contentPreview:
        entry.anonymizedContent.length > CONTENT_PREVIEW_LENGTH
          ? entry.anonymizedContent.slice(0, CONTENT_PREVIEW_LENGTH) + "..."
          : entry.anonymizedContent,
      metadata: entry.metadata,
      isProcessed: entry.isProcessed,
      originalCreatedAt: entry.originalCreatedAt,
      anonymizedAt: entry.anonymizedAt,
    }));

    return {
      data,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  },
});

/**
 * Get full details of a single corpus entry.
 *
 * Returns the complete anonymized content and all metadata.
 * Useful for reviewing individual entries before processing.
 *
 * Admin access required.
 */
export const getEntry = query({
  args: {
    entryId: v.id("aiTrainingCorpus"),
  },
  returns: v.union(
    v.object({
      _id: v.id("aiTrainingCorpus"),
      sourceMessageHash: v.string(),
      sourceType: sourceTypeValidator,
      anonymizedContent: v.string(),
      metadata: v.object({
        wordCount: v.number(),
        characterCount: v.number(),
        hasCodeBlock: v.boolean(),
        hasLinks: v.boolean(),
        channelType: v.optional(
          v.union(
            v.literal("public"),
            v.literal("private"),
            v.literal("course")
          )
        ),
        isThreadReply: v.boolean(),
        isLessonDiscussion: v.boolean(),
        detectedLanguage: v.optional(v.string()),
        reactionCount: v.number(),
        wasEdited: v.boolean(),
      }),
      category: v.union(categoryValidator, v.null()),
      isProcessed: v.boolean(),
      processedAt: v.optional(v.number()),
      originalCreatedAt: v.number(),
      anonymizedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      return null;
    }

    return {
      _id: entry._id,
      sourceMessageHash: entry.sourceMessageHash,
      sourceType: entry.sourceType,
      anonymizedContent: entry.anonymizedContent,
      metadata: entry.metadata,
      category: entry.category ?? null,
      isProcessed: entry.isProcessed,
      processedAt: entry.processedAt,
      originalCreatedAt: entry.originalCreatedAt,
      anonymizedAt: entry.anonymizedAt,
    };
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Mark corpus entries as processed for AI training.
 *
 * Updates the isProcessed flag and sets processedAt timestamp for
 * the specified entries. This indicates the entries have been
 * exported and used for AI training.
 *
 * Admin access required.
 *
 * @param entryIds - Array of corpus entry IDs to mark as processed
 * @returns Count of entries successfully marked as processed
 */
export const markProcessed = mutation({
  args: {
    entryIds: v.array(v.id("aiTrainingCorpus")),
  },
  returns: v.object({
    processedCount: v.number(),
    notFoundCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.entryIds.length === 0) {
      return { processedCount: 0, notFoundCount: 0 };
    }

    const now = Date.now();
    let processedCount = 0;
    let notFoundCount = 0;

    for (const entryId of args.entryIds) {
      const entry = await ctx.db.get(entryId);

      if (!entry) {
        notFoundCount++;
        continue;
      }

      // Only update if not already processed
      if (!entry.isProcessed) {
        await ctx.db.patch(entryId, {
          isProcessed: true,
          processedAt: now,
        });
      }
      processedCount++;
    }

    return { processedCount, notFoundCount };
  },
});

/**
 * Update the category of a corpus entry.
 *
 * Allows administrators to manually categorize or recategorize
 * corpus entries for better AI training organization.
 *
 * Admin access required.
 */
export const updateCategory = mutation({
  args: {
    entryId: v.id("aiTrainingCorpus"),
    category: v.union(categoryValidator, v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Corpus entry not found");
    }

    await ctx.db.patch(args.entryId, {
      category: args.category ?? undefined,
    });

    return null;
  },
});

/**
 * Delete a corpus entry.
 *
 * Permanently removes an entry from the AI training corpus.
 * Use with caution - this action cannot be undone.
 *
 * Admin access required.
 */
export const deleteEntry = mutation({
  args: {
    entryId: v.id("aiTrainingCorpus"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Corpus entry not found");
    }

    await ctx.db.delete(args.entryId);
    return null;
  },
});

// ============================================================================
// Internal Mutations (for action use)
// ============================================================================

import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Internal query to fetch all unprocessed corpus entries.
 * Used by the exportCorpus action.
 */
export const getUnprocessedEntries = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("aiTrainingCorpus"),
      sourceMessageHash: v.string(),
      sourceType: sourceTypeValidator,
      anonymizedContent: v.string(),
      metadata: v.object({
        wordCount: v.number(),
        characterCount: v.number(),
        hasCodeBlock: v.boolean(),
        hasLinks: v.boolean(),
        channelType: v.optional(
          v.union(
            v.literal("public"),
            v.literal("private"),
            v.literal("course")
          )
        ),
        isThreadReply: v.boolean(),
        isLessonDiscussion: v.boolean(),
        detectedLanguage: v.optional(v.string()),
        reactionCount: v.number(),
        wasEdited: v.boolean(),
      }),
      category: v.union(categoryValidator, v.null()),
      originalCreatedAt: v.number(),
      anonymizedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("aiTrainingCorpus")
      .withIndex("by_unprocessed", (q) => q.eq("isProcessed", false))
      .collect();

    return entries.map((entry) => ({
      _id: entry._id,
      sourceMessageHash: entry.sourceMessageHash,
      sourceType: entry.sourceType,
      anonymizedContent: entry.anonymizedContent,
      metadata: entry.metadata,
      category: entry.category ?? null,
      originalCreatedAt: entry.originalCreatedAt,
      anonymizedAt: entry.anonymizedAt,
    }));
  },
});

/**
 * Internal mutation to store the export file and mark entries as processed.
 */
export const storeExportFile = internalMutation({
  args: {
    storageId: v.id("_storage"),
    entryIds: v.array(v.id("aiTrainingCorpus")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Mark all exported entries as processed
    for (const entryId of args.entryIds) {
      const entry = await ctx.db.get(entryId);
      if (entry && !entry.isProcessed) {
        await ctx.db.patch(entryId, {
          isProcessed: true,
          processedAt: now,
        });
      }
    }

    // Get the URL for the stored file
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Failed to generate URL for export file");
    }

    return url;
  },
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Export all unprocessed corpus entries to a JSONL file.
 *
 * Creates a JSONL (JSON Lines) file containing all unprocessed
 * corpus entries suitable for AI training. Each line is a valid
 * JSON object representing one entry.
 *
 * The export includes:
 * - sourceType
 * - anonymizedContent (as "text" field)
 * - metadata
 * - category
 * - timestamps
 *
 * After successful export, all included entries are marked as processed.
 *
 * Admin access required (verified via requireAdmin in internal functions).
 *
 * @returns Object with file URL, entry count, and file size
 */
export const exportCorpus = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    fileUrl: v.union(v.string(), v.null()),
    entryCount: v.number(),
    fileSizeBytes: v.number(),
    message: v.string(),
  }),
  handler: async (ctx): Promise<{
    success: boolean;
    fileUrl: string | null;
    entryCount: number;
    fileSizeBytes: number;
    message: string;
  }> => {
    // Verify admin access before exporting
    await requireAdminInAction(ctx);

    // Fetch all unprocessed entries
    const entries: Array<{
      _id: Id<"aiTrainingCorpus">;
      sourceMessageHash: string;
      sourceType: "text" | "voice_transcription";
      anonymizedContent: string;
      metadata: {
        wordCount: number;
        characterCount: number;
        hasCodeBlock: boolean;
        hasLinks: boolean;
        channelType?: "public" | "private" | "course";
        isThreadReply: boolean;
        isLessonDiscussion: boolean;
        detectedLanguage?: string;
        reactionCount: number;
        wasEdited: boolean;
      };
      category: "question" | "answer" | "discussion" | "announcement" | "feedback" | "other" | null;
      originalCreatedAt: number;
      anonymizedAt: number;
    }> = await ctx.runQuery(internal.aiCorpus.getUnprocessedEntries);

    if (entries.length === 0) {
      return {
        success: true,
        fileUrl: null,
        entryCount: 0,
        fileSizeBytes: 0,
        message: "No unprocessed entries to export",
      };
    }

    // Build JSONL content
    const jsonlLines: string[] = [];
    const entryIds: Id<"aiTrainingCorpus">[] = [];

    for (const entry of entries) {
      const exportEntry = {
        id: entry.sourceMessageHash,
        type: entry.sourceType,
        text: entry.anonymizedContent,
        category: entry.category,
        metadata: {
          word_count: entry.metadata.wordCount,
          char_count: entry.metadata.characterCount,
          has_code: entry.metadata.hasCodeBlock,
          has_links: entry.metadata.hasLinks,
          channel_type: entry.metadata.channelType,
          is_thread_reply: entry.metadata.isThreadReply,
          is_lesson_discussion: entry.metadata.isLessonDiscussion,
          language: entry.metadata.detectedLanguage,
          reactions: entry.metadata.reactionCount,
          was_edited: entry.metadata.wasEdited,
        },
        original_timestamp: entry.originalCreatedAt,
        anonymized_timestamp: entry.anonymizedAt,
      };

      jsonlLines.push(JSON.stringify(exportEntry));
      entryIds.push(entry._id);
    }

    const jsonlContent = jsonlLines.join("\n");
    const fileSizeBytes = new Blob([jsonlContent]).size;

    // Store the file in Convex storage
    const blob = new Blob([jsonlContent], { type: "application/jsonl" });
    const storageId = await ctx.storage.store(blob);

    // Store file reference and mark entries as processed
    const fileUrl: string = await ctx.runMutation(internal.aiCorpus.storeExportFile, {
      storageId,
      entryIds,
    });

    return {
      success: true,
      fileUrl,
      entryCount: entries.length,
      fileSizeBytes,
      message: `Successfully exported ${entries.length} entries to JSONL format`,
    };
  },
});
