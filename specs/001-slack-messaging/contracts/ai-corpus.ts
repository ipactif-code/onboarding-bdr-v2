/**
 * AI Training Corpus API Contracts
 *
 * Manages the anonymized message corpus used for AI training.
 */

import { Id } from "convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type CorpusSourceType = "text" | "voice_transcription";

export type CorpusCategory =
  | "question"
  | "answer"
  | "discussion"
  | "announcement"
  | "feedback"
  | "other";

export interface CorpusEntry {
  _id: Id<"aiTrainingCorpus">;
  sourceType: CorpusSourceType;
  anonymizedContent: string;
  metadata: CorpusMetadata;
  category?: CorpusCategory;
  isProcessed: boolean;
  originalCreatedAt: number;
  anonymizedAt: number;
}

export interface CorpusMetadata {
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
}

export interface CorpusStats {
  totalEntries: number;
  byType: {
    text: number;
    voiceTranscription: number;
  };
  byCategory: Record<CorpusCategory, number>;
  byLanguage: Record<string, number>;
  unprocessedCount: number;
  averageWordCount: number;
  totalWordCount: number;
  oldestEntry: number;
  newestEntry: number;
}

// ============================================================================
// Admin Queries
// ============================================================================

/**
 * Get corpus statistics
 */
export interface GetCorpusStatsResult {
  stats: CorpusStats;
}

// Query: api.aiCorpus.getStats

/**
 * Browse corpus entries with filters
 */
export interface BrowseCorpusArgs {
  filters?: {
    sourceType?: CorpusSourceType;
    category?: CorpusCategory;
    language?: string;
    minWordCount?: number;
    maxWordCount?: number;
    isProcessed?: boolean;
    hasCodeBlock?: boolean;
    isLessonDiscussion?: boolean;
  };
  cursor?: string;
  limit?: number;
}

export interface BrowseCorpusResult {
  entries: CorpusEntry[];
  nextCursor?: string;
  hasMore: boolean;
  totalMatching: number;
}

// Query: api.aiCorpus.browse

/**
 * Get random sample for training preview
 */
export interface GetSampleEntriesArgs {
  filters?: BrowseCorpusArgs["filters"];
  count?: number;
}

export interface GetSampleEntriesResult {
  entries: CorpusEntry[];
}

// Query: api.aiCorpus.getSample

// ============================================================================
// Admin Mutations
// ============================================================================

/**
 * Export corpus as JSONL/CSV for training
 */
export interface ExportCorpusArgs {
  filters?: BrowseCorpusArgs["filters"];
  format: "jsonl" | "csv";
  limit?: number;
}

export interface ExportCorpusResult {
  downloadUrl: string;
  entryCount: number;
  fileSizeBytes: number;
  expiresAt: number;
}

// Mutation: api.aiCorpus.export

/**
 * Mark entries as processed after training
 */
export interface MarkAsProcessedArgs {
  entryIds: Id<"aiTrainingCorpus">[];
  trainingRunId?: string;
}

export interface MarkAsProcessedResult {
  success: boolean;
  markedCount: number;
}

// Mutation: api.aiCorpus.markAsProcessed

/**
 * Update entry category
 */
export interface UpdateEntryCategoryArgs {
  entryId: Id<"aiTrainingCorpus">;
  category: CorpusCategory;
}

export interface UpdateEntryCategoryResult {
  success: boolean;
}

// Mutation: api.aiCorpus.updateCategory

/**
 * Delete corpus entry
 */
export interface DeleteCorpusEntryArgs {
  entryId: Id<"aiTrainingCorpus">;
  reason: string;
}

export interface DeleteCorpusEntryResult {
  success: boolean;
}

// Mutation: api.aiCorpus.deleteEntry

// ============================================================================
// Anonymization Rules
// ============================================================================

/**
 * Anonymization applied when adding to corpus:
 *
 * 1. SENDER REMOVAL - senderId nullified
 * 2. MENTION REPLACEMENT - @username → @[USER_1]
 * 3. PII STRIPPING - emails, phones, user URLs → [EMAIL], [PHONE], [URL]
 * 4. CONTENT PRESERVED - code blocks, markdown, emoji, technical terms
 * 5. METADATA ANONYMIZED - channel/course IDs removed, types preserved
 *
 * Example:
 * Original: "Hey @john.doe, check out john@email.com"
 * Anonymized: "Hey @[USER_1], check out [EMAIL]"
 */

export interface AnonymizationConfig {
  patterns: {
    emails: boolean;
    phones: boolean;
    urls: boolean;
    mentions: boolean;
    filePaths: boolean;
  };
  preserve: {
    codeBlocks: boolean;
    markdown: boolean;
    emoji: boolean;
    technicalTerms: boolean;
  };
}

export const DEFAULT_ANONYMIZATION_CONFIG: AnonymizationConfig = {
  patterns: {
    emails: true,
    phones: true,
    urls: true,
    mentions: true,
    filePaths: true,
  },
  preserve: {
    codeBlocks: true,
    markdown: true,
    emoji: true,
    technicalTerms: true,
  },
};
