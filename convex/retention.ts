import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import crypto from "crypto";

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of retention records to process in a single batch.
 * Prevents timeouts and ensures consistent processing time.
 */
const ANONYMIZATION_BATCH_SIZE = 50;

/**
 * Retention period in days before anonymization.
 * Messages are eligible for anonymization 90 days after soft deletion.
 * Note: The actual schedule is controlled by anonymizationScheduledFor in messageRetention.
 */
const _RETENTION_DAYS = 90;

// ============================================================================
// Internal Mutations (Cron Jobs)
// ============================================================================

/**
 * Anonymize messages that have passed their retention period.
 *
 * This internal mutation is called by a cron job daily at 2:00 AM UTC.
 * It processes messages whose anonymizationScheduledFor timestamp has passed
 * and have not yet been anonymized.
 *
 * Processing steps for each eligible message:
 * 1. Get the original message content (if message still exists)
 * 2. Add to AI training corpus (if from public/course channels)
 * 3. Replace message content with "[Message deleted]"
 * 4. Mark retention entry as anonymized
 *
 * Processing is limited to ANONYMIZATION_BATCH_SIZE entries per invocation
 * to prevent timeouts and ensure consistent performance.
 *
 * @returns Object with processing statistics
 */
export const anonymizeExpiredMessages = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    anonymized: v.number(),
    addedToCorpus: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // Query retention entries that are due for anonymization
    // Using the by_scheduled_anonymization index
    const pendingEntries = await ctx.db
      .query("messageRetention")
      .withIndex("by_scheduled_anonymization", (q) =>
        q.lte("anonymizationScheduledFor", now)
      )
      .filter((q) => q.eq(q.field("anonymizedAt"), undefined))
      .take(ANONYMIZATION_BATCH_SIZE);

    let processed = 0;
    let anonymized = 0;
    let addedToCorpus = 0;
    let errors = 0;

    for (const entry of pendingEntries) {
      processed++;

      try {
        // Get the original message
        const message = await ctx.db.get(entry.messageId);

        if (!message) {
          // Message was already deleted - just mark as anonymized
          await ctx.db.patch(entry._id, {
            anonymizedAt: now,
            addedToCorpus: false,
          });
          anonymized++;
          continue;
        }

        // Get the channel to check if public/course for corpus eligibility
        const channel = message.channelId
          ? await ctx.db.get(message.channelId)
          : null;

        const isEligibleForCorpus =
          message.content &&
          message.content.trim().length > 0 &&
          channel &&
          (channel.type === "public" || channel.type === "course");

        let corpusEntryId = undefined;

        // Add to AI training corpus if eligible
        if (isEligibleForCorpus && message.content) {
          // Create a hash of the original message for deduplication
          const sourceHash = crypto
            .createHash("sha256")
            .update(message._id + message.content)
            .digest("hex");

          // Check if already in corpus (by hash)
          const existingCorpusEntry = await ctx.db
            .query("aiTrainingCorpus")
            .withIndex("by_source_hash", (q) =>
              q.eq("sourceMessageHash", sourceHash)
            )
            .first();

          if (!existingCorpusEntry) {
            // Anonymize the content for training
            // Remove any @mentions, URLs, and normalize whitespace
            const anonymizedContent = message.content
              .replace(/@\w+/g, "@user") // Replace mentions
              .replace(/https?:\/\/\S+/g, "[link]") // Replace URLs
              .replace(/\s+/g, " ") // Normalize whitespace
              .trim();

            // Calculate metadata
            const wordCount = anonymizedContent.split(/\s+/).filter(Boolean).length;
            const characterCount = anonymizedContent.length;
            const hasCodeBlock =
              message.content.includes("```") || message.content.includes("`");
            const hasLinks = /https?:\/\//.test(message.content);
            const isThreadReply = message.parentId !== undefined;
            const isLessonDiscussion = message.lessonId !== undefined;
            const wasEdited = message.isEdited === true;

            // Insert into corpus
            corpusEntryId = await ctx.db.insert("aiTrainingCorpus", {
              sourceMessageHash: sourceHash,
              sourceType: "text",
              anonymizedContent,
              metadata: {
                wordCount,
                characterCount,
                hasCodeBlock,
                hasLinks,
                channelType: channel?.type as "public" | "private" | "course" | undefined,
                isThreadReply,
                isLessonDiscussion,
                reactionCount: message.reactionCount ?? 0,
                wasEdited,
              },
              isProcessed: false,
              originalCreatedAt: message.createdAt,
              anonymizedAt: now,
            });
            addedToCorpus++;
          }
        }

        // Anonymize the message content
        await ctx.db.patch(message._id, {
          content: "[Message deleted]",
          // Clear any rich text or attachments references
        });

        // Mark retention entry as anonymized
        await ctx.db.patch(entry._id, {
          anonymizedAt: now,
          addedToCorpus: corpusEntryId !== undefined,
          corpusEntryId,
        });

        anonymized++;
      } catch (error) {
        errors++;
        console.error(
          `[retention.anonymizeExpiredMessages] Error processing message ${entry.messageId}:`,
          error
        );
      }
    }

    if (processed > 0) {
      // Use console.warn for informational logging (console.log not allowed by eslint)
      console.warn(
        `[retention.anonymizeExpiredMessages] Processed ${processed} entries: ${anonymized} anonymized, ${addedToCorpus} added to corpus, ${errors} errors`
      );
    }

    return {
      processed,
      anonymized,
      addedToCorpus,
      errors,
    };
  },
});
