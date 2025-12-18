/**
 * Retention & GDPR API Contracts
 *
 * This file defines the TypeScript signatures for message retention,
 * anonymization, and GDPR compliance functionality.
 */

import { Id } from "convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type DeletionReason =
  | "user_deleted"
  | "admin_moderation"
  | "gdpr_request"
  | "user_account_deleted";

export type GdprRequestType = "export" | "deletion";

export type GdprRequestStatus = "pending" | "processing" | "completed" | "failed";

export interface RetentionPolicy {
  softDeleteRetentionDays: 90;
  gdprExportExpirationDays: 7;
  backupRetentionDays: 90;
}

export interface MessageRetentionInfo {
  messageId: Id<"messages">;
  deletedAt: number;
  deletedBy: Id<"users">;
  deletionReason: DeletionReason;
  anonymizationScheduledFor: number;
  anonymizedAt?: number;
  daysUntilAnonymization: number;
  canRestore: boolean;
}

export interface GdprRequest {
  _id: Id<"gdprRequests">;
  userId: Id<"users">;
  type: GdprRequestType;
  status: GdprRequestStatus;
  requestedAt: number;
  processedAt?: number;
  completedAt?: number;
  exportUrl?: string;
  error?: string;
}

// ============================================================================
// Admin Queries
// ============================================================================

/**
 * Get messages pending anonymization
 *
 * Returns messages deleted > 90 days ago not yet anonymized.
 * Admin only.
 */
export interface GetPendingAnonymizationArgs {
  limit?: number;
}

export interface GetPendingAnonymizationResult {
  messages: MessageRetentionInfo[];
  totalPending: number;
}

// Query: api.retention.getPendingAnonymization

/**
 * Get retention statistics
 * Admin only.
 */
export interface GetRetentionStatsResult {
  deletedMessages: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    pendingAnonymization: number;
    anonymizedTotal: number;
  };
  corpusStats: {
    totalEntries: number;
    textEntries: number;
    voiceTranscriptionEntries: number;
    unprocessedEntries: number;
  };
  gdprRequests: {
    pending: number;
    completedThisMonth: number;
  };
}

// Query: api.retention.getStats

/**
 * Get deleted message details for admin recovery
 * Admin only.
 */
export interface GetDeletedMessageArgs {
  messageId: Id<"messages">;
}

export interface GetDeletedMessageResult {
  retention: MessageRetentionInfo;
  content?: string;
  canRestore: boolean;
  restoreDeadline?: number;
}

// Query: api.retention.getDeletedMessage

// ============================================================================
// Admin Mutations
// ============================================================================

/**
 * Restore a deleted message (within 90-day window)
 * Admin only.
 */
export interface RestoreMessageArgs {
  messageId: Id<"messages">;
  reason: string;
}

export interface RestoreMessageResult {
  success: boolean;
  message?: {
    _id: Id<"messages">;
    restoredAt: number;
  };
}

// Mutation: api.retention.restoreMessage

/**
 * Force anonymize immediately (for GDPR)
 * Admin only.
 */
export interface ForceAnonymizeArgs {
  messageId: Id<"messages">;
  reason: string;
  gdprRequestId?: string;
}

export interface ForceAnonymizeResult {
  success: boolean;
  addedToCorpus: boolean;
  corpusEntryId?: Id<"aiTrainingCorpus">;
}

// Mutation: api.retention.forceAnonymize

/**
 * Bulk anonymize all messages for a user
 * Admin only.
 */
export interface BulkAnonymizeUserMessagesArgs {
  userId: Id<"users">;
  gdprRequestId?: string;
}

export interface BulkAnonymizeUserMessagesResult {
  success: boolean;
  messagesAnonymized: number;
  addedToCorpus: number;
}

// Mutation: api.retention.bulkAnonymizeUserMessages

// ============================================================================
// GDPR User Mutations
// ============================================================================

/**
 * Request data export (GDPR portability)
 */
export interface RequestDataExportResult {
  requestId: Id<"gdprRequests">;
  estimatedCompletionTime: number;
}

// Mutation: api.retention.requestDataExport

/**
 * Request account deletion (GDPR erasure)
 */
export interface RequestAccountDeletionArgs {
  confirmEmail: string;
}

export interface RequestAccountDeletionResult {
  requestId: Id<"gdprRequests">;
  scheduledDeletionDate: number;
  canCancel: boolean;
  cancelDeadline: number;
}

// Mutation: api.retention.requestAccountDeletion

/**
 * Cancel pending account deletion (24h window)
 */
export interface CancelAccountDeletionArgs {
  requestId: Id<"gdprRequests">;
}

export interface CancelAccountDeletionResult {
  success: boolean;
}

// Mutation: api.retention.cancelAccountDeletion

/**
 * Download data export
 */
export interface DownloadDataExportArgs {
  requestId: Id<"gdprRequests">;
}

export interface DownloadDataExportResult {
  downloadUrl: string;
  expiresAt: number;
  fileSizeBytes: number;
}

// Mutation: api.retention.downloadDataExport

// ============================================================================
// GDPR Queries
// ============================================================================

/**
 * Get user's own GDPR requests
 */
export interface GetMyGdprRequestsResult {
  requests: GdprRequest[];
}

// Query: api.retention.getMyGdprRequests

/**
 * Get all pending GDPR requests (admin)
 */
export interface GetPendingGdprRequestsResult {
  requests: Array<GdprRequest & {
    user: {
      _id: Id<"users">;
      name: string;
      email: string;
    };
  }>;
}

// Query: api.retention.getPendingGdprRequests

// ============================================================================
// Internal Scheduled Functions
// ============================================================================

// Scheduled: api.retention.anonymizeExpiredMessages - Daily 2:00 AM UTC
// Scheduled: api.retention.processGdprRequests - Every 15 minutes
// Scheduled: api.retention.cleanupExpiredExports - Daily 3:00 AM UTC
// Scheduled: api.retention.cleanupExpiredBackups - Daily 4:00 AM UTC
