/**
 * API Contracts: AI Features
 *
 * Convex actions for AI-powered editor commands and content generation.
 * All actions count against rate limits and budget.
 * All functions require authentication via requireAuth().
 */

import { v } from "convex/values";

// =============================================================================
// VALIDATORS
// =============================================================================

export const aiCommandType = v.union(
  v.literal("summarize"),  // Condense text to 3 sentences
  v.literal("translate"),  // Translate to target language
  v.literal("rephrase"),   // Rewrite with different style
  v.literal("expand")      // Add more detail
);

export const rephraseStyle = v.union(
  v.literal("formal"),      // Professional tone
  v.literal("simpler"),     // Easier to understand
  v.literal("persuasive"),  // More compelling
  v.literal("concise")      // More brief
);

export const targetLanguage = v.union(
  v.literal("en"),  // English
  v.literal("fr"),  // French
  v.literal("de"),  // German
  v.literal("es"),  // Spanish
  v.literal("it"),  // Italian
  v.literal("pt")   // Portuguese
);

export const aiCommandInput = v.object({
  documentId: v.id("kbDocuments"),
  command: aiCommandType,
  selectedText: v.string(),
  // For translate
  targetLanguage: v.optional(targetLanguage),
  // For rephrase
  style: v.optional(rephraseStyle),
});

export const aiGenerateInput = v.object({
  documentId: v.id("kbDocuments"),
  prompt: v.string(),
  context: v.optional(v.string()), // Surrounding content for context
});

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get current user's AI usage for rate limit display.
 *
 * @returns Current month's usage and limits
 *
 * @example
 * const usage = useQuery(api.knowledge.ai.getUsage);
 * // { commandsUsed: 45, commandsLimit: 100, ... }
 */
export const getUsage = {
  args: {},
  returns: v.object({
    month: v.string(), // "YYYY-MM"
    // Commands (summarize, translate, rephrase, expand)
    commandsUsed: v.number(),
    commandsLimit: v.number(), // 100
    // Content generation
    generationsUsed: v.number(),
    generationsLimit: v.number(), // 50
    // Semantic searches
    searchesUsed: v.number(),
    searchesLimit: v.number(), // 500
    // Budget tracking
    totalCostCents: v.number(),
    budgetCents: v.number(), // 15000 (150 EUR)
    budgetPercentUsed: v.number(),
  }),
};

/**
 * Check if a specific AI feature is available.
 *
 * @param feature - Feature to check
 * @returns Availability status
 *
 * @example
 * const canGenerate = useQuery(api.knowledge.ai.checkAvailability, {
 *   feature: "generate",
 * });
 */
export const checkAvailability = {
  args: {
    feature: v.union(
      v.literal("command"),
      v.literal("generate"),
      v.literal("search")
    ),
  },
  returns: v.object({
    available: v.boolean(),
    reason: v.optional(
      v.union(
        v.literal("rate_limit_exceeded"),
        v.literal("budget_exceeded"),
        v.literal("feature_disabled")
      )
    ),
    remaining: v.number(),
  }),
};

// =============================================================================
// ACTIONS (external API calls)
// =============================================================================

/**
 * Execute an AI command on selected text.
 *
 * Uses Claude Haiku for fast, low-cost responses.
 * Streams response back to client.
 *
 * @param input - Command parameters
 * @returns Generated text and metadata
 * @throws Error if rate limit or budget exceeded
 *
 * @example
 * // Summarize
 * const result = await executeCommand({
 *   documentId,
 *   command: "summarize",
 *   selectedText: "Long text to summarize...",
 * });
 *
 * // Translate
 * const translated = await executeCommand({
 *   documentId,
 *   command: "translate",
 *   selectedText: "Hello world",
 *   targetLanguage: "fr",
 * });
 *
 * // Rephrase
 * const rephrased = await executeCommand({
 *   documentId,
 *   command: "rephrase",
 *   selectedText: "This is a sentence",
 *   style: "formal",
 * });
 */
export const executeCommand = {
  args: aiCommandInput,
  returns: v.object({
    result: v.string(),
    command: aiCommandType,
    // Usage info
    tokensUsed: v.number(),
    costCents: v.number(),
    commandsRemaining: v.number(),
  }),
};

/**
 * Generate content from a prompt.
 *
 * Uses Claude Sonnet for higher quality generation.
 * Streams response back to client.
 *
 * @param input - Generation parameters
 * @returns Generated content
 * @throws Error if rate limit or budget exceeded
 *
 * @example
 * const generated = await generateContent({
 *   documentId,
 *   prompt: "Write an introduction to SPIN selling methodology",
 *   context: "This document covers sales techniques...",
 * });
 */
export const generateContent = {
  args: aiGenerateInput,
  returns: v.object({
    content: v.any(), // Plate.js JSON blocks
    // Usage info
    tokensUsed: v.number(),
    costCents: v.number(),
    generationsRemaining: v.number(),
  }),
};

/**
 * Generate embedding for document content.
 *
 * Called internally when documents are published/updated.
 * Uses OpenAI text-embedding-3-small.
 *
 * @internal
 */
export const generateEmbedding = {
  args: {
    documentId: v.id("kbDocuments"),
    content: v.string(),
  },
  returns: v.object({
    embeddingId: v.id("kbDocumentEmbeddings"),
    dimensions: v.number(),
    tokensUsed: v.number(),
  }),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Accept AI-generated content and insert into document.
 *
 * Records the acceptance for quality tracking.
 *
 * @param documentId - Document to insert into
 * @param content - Generated content to accept
 * @param command - Original command type (for tracking)
 *
 * @example
 * await acceptResult({
 *   documentId,
 *   content: "Generated text...",
 *   command: "summarize",
 * });
 */
export const acceptResult = {
  args: {
    documentId: v.id("kbDocuments"),
    content: v.string(),
    command: v.optional(aiCommandType),
  },
  returns: v.null(),
};

/**
 * Reject AI-generated content.
 *
 * Records the rejection for quality tracking.
 *
 * @param documentId - Document the content was for
 * @param command - Original command type (for tracking)
 * @param reason - Optional rejection reason
 *
 * @example
 * await rejectResult({
 *   documentId,
 *   command: "translate",
 *   reason: "incorrect_translation",
 * });
 */
export const rejectResult = {
  args: {
    documentId: v.id("kbDocuments"),
    command: v.optional(aiCommandType),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
};

// =============================================================================
// INTERNAL (budget management)
// =============================================================================

/**
 * Update global budget usage.
 *
 * Called after each AI operation to track costs.
 *
 * @internal
 */
export const updateBudget = {
  args: {
    costCents: v.number(),
    feature: v.union(
      v.literal("command"),
      v.literal("generate"),
      v.literal("search")
    ),
  },
  returns: v.object({
    totalCostCents: v.number(),
    budgetCents: v.number(),
    percentUsed: v.number(),
    alertTriggered: v.optional(
      v.union(v.literal("80_percent"), v.literal("95_percent"))
    ),
  }),
};

/**
 * Check if budget allows operation.
 *
 * @internal
 */
export const checkBudget = {
  args: {
    estimatedCostCents: v.number(),
  },
  returns: v.object({
    allowed: v.boolean(),
    percentUsed: v.number(),
    remainingCents: v.number(),
  }),
};
