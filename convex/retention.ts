import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";

// ============================================================================
// Constants
// ============================================================================

/**
 * Number of days after deletion before a message is anonymized.
 * GDPR-compliant retention period.
 */
export const RETENTION_DAYS = 90;

/**
 * Maximum number of retention entries to process in a single batch.
 * Prevents timeouts and ensures consistent processing time.
 */
export const BATCH_SIZE = 100;

/**
 * Placeholder text for anonymized message content.
 */
const ANONYMIZED_CONTENT = "[Message deleted]";

/**
 * Minimum content length for a message to be considered for AI training corpus.
 */
const MIN_CORPUS_CONTENT_LENGTH = 10;

// ============================================================================
// Types
// ============================================================================

/**
 * Result of the anonymization batch processing.
 */
type AnonymizationResult = {
  processed: number;
  anonymized: number;
  addedToCorpus: number;
};

/**
 * Stats about pending anonymizations.
 */
type RetentionStats = {
  pendingCount: number;
  oldestPendingDate: number | null;
  processedToday: number;
  addedToCorpusToday: number;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if a message should be added to the AI training corpus.
 *
 * A message is eligible for the corpus if:
 * - It has at least MIN_CORPUS_CONTENT_LENGTH characters
 * - It is not a system message
 * - It was not deleted due to moderation
 * - It is from a public or course channel (not private DM or private channel)
 *
 * @param message - The message document to evaluate
 * @param retentionEntry - The retention entry with deletion reason
 * @param channel - Optional channel document (for checking channel type)
 * @returns true if the message should be added to the corpus
 */
function shouldAddToCorpus(
  message: Doc<"messages">,
  retentionEntry: Doc<"messageRetention">,
  channel: Doc<"channels"> | null
): boolean {
  // Check minimum content length
  if (message.content.length < MIN_CORPUS_CONTENT_LENGTH) {
    return false;
  }

  // Exclude system messages
  if (message.contentType === "system") {
    return false;
  }

  // Exclude messages deleted due to moderation (may contain inappropriate content)
  if (retentionEntry.deletionReason === "admin_moderation") {
    return false;
  }

  // For channel messages, only include public or course channels
  if (message.channelId && channel) {
    // Private channels are excluded
    if (channel.type === "private") {
      return false;
    }
    // Public and course channels are included
    return true;
  }

  // Exclude direct messages (conversations) - these are private
  if (message.conversationId) {
    return false;
  }

  // Default to false for any edge cases
  return false;
}

/**
 * Generate a simple hash of the message ID for corpus tracking.
 * This creates a deterministic, non-reversible identifier.
 *
 * @param messageId - The message ID to hash
 * @returns Hash string
 */
function hashMessageId(messageId: Id<"messages">): string {
  // Simple hash function for Convex (no crypto module available)
  let hash = 0;
  const str = messageId.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Anonymize message content by removing personally identifiable information.
 *
 * Current implementation:
 * - Replaces @mentions with generic placeholder
 * - Removes email addresses
 * - Preserves general structure for AI training
 *
 * @param content - Original message content
 * @returns Anonymized content
 */
function anonymizeContent(content: string): string {
  let anonymized = content;

  // Replace @mentions with generic placeholder
  anonymized = anonymized.replace(/@[a-zA-Z0-9_-]+/g, "@[user]");

  // Replace email addresses with placeholder
  anonymized = anonymized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[email]"
  );

  // Replace URLs with domain-only version (preserve structure but remove specific paths)
  anonymized = anonymized.replace(
    /https?:\/\/[^\s]+/g,
    (url) => {
      try {
        const parsed = new URL(url);
        return `[link:${parsed.hostname}]`;
      } catch {
        return "[link]";
      }
    }
  );

  return anonymized;
}

/**
 * Detect the language of the content (simplified heuristic).
 *
 * @param content - Message content to analyze
 * @returns Detected language code or undefined
 */
function detectLanguage(content: string): string | undefined {
  // Simple heuristic: check for common French/English patterns
  const frenchPatterns = /\b(le|la|les|de|du|des|un|une|est|sont|avec|pour|dans|sur|que|qui|ce|cette|ces)\b/gi;
  const englishPatterns = /\b(the|a|an|is|are|was|were|have|has|had|with|for|in|on|that|which|this|these)\b/gi;

  const frenchMatches = (content.match(frenchPatterns) || []).length;
  const englishMatches = (content.match(englishPatterns) || []).length;

  if (frenchMatches > englishMatches && frenchMatches > 2) {
    return "fr";
  }
  if (englishMatches > frenchMatches && englishMatches > 2) {
    return "en";
  }

  return undefined;
}

/**
 * Categorize the message content for AI training purposes.
 *
 * @param content - Message content to categorize
 * @returns Category string or undefined
 */
function categorizeContent(
  content: string
): "question" | "answer" | "discussion" | "announcement" | "feedback" | "other" | undefined {
  // Question detection
  if (
    content.includes("?") ||
    /^(how|what|why|when|where|who|can|could|would|is|are|do|does)\b/i.test(content)
  ) {
    return "question";
  }

  // Announcement detection
  if (
    /^(announcement|attention|important|notice|update|reminder)/i.test(content) ||
    content.includes("@everyone") ||
    content.includes("@here")
  ) {
    return "announcement";
  }

  // Feedback detection
  if (
    /\b(feedback|suggestion|improve|better|issue|problem|bug)\b/i.test(content)
  ) {
    return "feedback";
  }

  // Answer/solution detection (often starts with "You can", "Try", etc.)
  if (
    /^(you can|try|to do this|the answer|the solution|here's how)/i.test(content)
  ) {
    return "answer";
  }

  // Default to discussion for longer content, other for short
  if (content.length > 50) {
    return "discussion";
  }

  return "other";
}

/**
 * Add an anonymized message to the AI training corpus.
 *
 * @param ctx - Mutation context
 * @param message - Original message document
 * @param channel - Optional channel for metadata
 * @returns The ID of the created corpus entry
 */
async function addToCorpus(
  ctx: MutationCtx,
  message: Doc<"messages">,
  channel: Doc<"channels"> | null
): Promise<Id<"aiTrainingCorpus">> {
  const anonymizedContent = anonymizeContent(message.content);
  const sourceHash = hashMessageId(message._id);

  const hasCodeBlock = /```[\s\S]*?```/.test(message.content);
  const hasLinks = /https?:\/\/[^\s]+/.test(message.content);

  const corpusEntryId = await ctx.db.insert("aiTrainingCorpus", {
    sourceMessageHash: sourceHash,
    sourceType:
      message.contentType === "voice" ? "voice_transcription" : "text",
    anonymizedContent,
    metadata: {
      wordCount: message.content.split(/\s+/).filter(Boolean).length,
      characterCount: message.content.length,
      hasCodeBlock,
      hasLinks,
      channelType: channel?.type,
      isThreadReply: message.parentId !== undefined,
      isLessonDiscussion: message.lessonId !== undefined,
      detectedLanguage: detectLanguage(message.content),
      reactionCount: message.reactionCount ?? 0,
      wasEdited: message.isEdited ?? false,
    },
    category: categorizeContent(message.content),
    isProcessed: false,
    originalCreatedAt: message.createdAt,
    anonymizedAt: Date.now(),
  });

  return corpusEntryId;
}

// ============================================================================
// Internal Mutations
// ============================================================================

/**
 * Anonymize messages that have passed their retention period.
 *
 * This internal mutation is called by a cron job to process messages
 * that were deleted more than RETENTION_DAYS ago. For each message:
 *
 * 1. If eligible, the anonymized content is added to the AI training corpus
 * 2. The message content is replaced with "[Message deleted]"
 * 3. The retention entry is marked as anonymized
 *
 * Processing is limited to BATCH_SIZE entries per invocation to prevent
 * timeouts and ensure consistent performance.
 *
 * @returns Object with counts of processed, anonymized, and corpus additions
 */
export const anonymizeExpiredMessages = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    anonymized: v.number(),
    addedToCorpus: v.number(),
  }),
  handler: async (ctx): Promise<AnonymizationResult> => {
    const now = Date.now();

    // Query retention entries ready for anonymization
    // Uses the by_scheduled_anonymization index
    const pendingEntries = await ctx.db
      .query("messageRetention")
      .withIndex("by_scheduled_anonymization", (q) =>
        q.lte("anonymizationScheduledFor", now)
      )
      .filter((q) => q.eq(q.field("anonymizedAt"), undefined))
      .take(BATCH_SIZE);

    let processed = 0;
    let anonymized = 0;
    let addedToCorpus = 0;

    for (const retentionEntry of pendingEntries) {
      processed++;

      // Get the original message
      const message = await ctx.db.get(retentionEntry.messageId);

      if (!message) {
        // Message already hard-deleted, just mark retention as anonymized
        await ctx.db.patch(retentionEntry._id, {
          anonymizedAt: now,
        });
        continue;
      }

      // Check if message is already anonymized
      if (message.anonymizedAt !== undefined) {
        await ctx.db.patch(retentionEntry._id, {
          anonymizedAt: now,
        });
        continue;
      }

      // Get channel if this is a channel message (for corpus eligibility check)
      let channel: Doc<"channels"> | null = null;
      if (message.channelId) {
        channel = await ctx.db.get(message.channelId);
      }

      // Check if message should be added to AI training corpus
      let corpusEntryId: Id<"aiTrainingCorpus"> | undefined;
      if (shouldAddToCorpus(message, retentionEntry, channel)) {
        corpusEntryId = await addToCorpus(ctx, message, channel);
        addedToCorpus++;
      }

      // Anonymize the message content
      await ctx.db.patch(message._id, {
        content: ANONYMIZED_CONTENT,
        anonymizedAt: now,
      });
      anonymized++;

      // Update retention entry
      await ctx.db.patch(retentionEntry._id, {
        anonymizedAt: now,
        addedToCorpus: corpusEntryId !== undefined,
        corpusEntryId,
      });
    }

    return {
      processed,
      anonymized,
      addedToCorpus,
    };
  },
});

// ============================================================================
// Internal Queries
// ============================================================================

/**
 * Get statistics about pending message anonymizations.
 *
 * Returns counts and dates useful for monitoring the retention system:
 * - Number of messages pending anonymization
 * - Oldest pending anonymization date (to detect backlogs)
 * - Number processed today (to monitor throughput)
 * - Number added to corpus today (to track AI training data growth)
 *
 * @returns RetentionStats object with current statistics
 */
export const getRetentionStats = internalQuery({
  args: {},
  returns: v.object({
    pendingCount: v.number(),
    oldestPendingDate: v.union(v.number(), v.null()),
    processedToday: v.number(),
    addedToCorpusToday: v.number(),
  }),
  handler: async (ctx): Promise<RetentionStats> => {
    const now = Date.now();

    // Calculate start of today (midnight UTC)
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayStart = startOfToday.getTime();

    // Count pending entries (not yet anonymized)
    const pendingEntries = await ctx.db
      .query("messageRetention")
      .withIndex("by_scheduled_anonymization")
      .filter((q) => q.eq(q.field("anonymizedAt"), undefined))
      .collect();

    const pendingCount = pendingEntries.length;

    // Find oldest pending date
    let oldestPendingDate: number | null = null;
    if (pendingEntries.length > 0) {
      oldestPendingDate = Math.min(
        ...pendingEntries.map((e) => e.anonymizationScheduledFor)
      );
    }

    // Count entries processed today
    // We need to scan all retention entries with anonymizedAt set today
    const allRetentionEntries = await ctx.db
      .query("messageRetention")
      .filter((q) =>
        q.and(
          q.neq(q.field("anonymizedAt"), undefined),
          q.gte(q.field("anonymizedAt"), todayStart)
        )
      )
      .collect();

    const processedToday = allRetentionEntries.length;

    // Count corpus entries added today
    const corpusEntriesToday = await ctx.db
      .query("aiTrainingCorpus")
      .withIndex("by_anonymized_date")
      .filter((q) => q.gte(q.field("anonymizedAt"), todayStart))
      .collect();

    const addedToCorpusToday = corpusEntriesToday.length;

    return {
      pendingCount,
      oldestPendingDate,
      processedToday,
      addedToCorpusToday,
    };
  },
});
