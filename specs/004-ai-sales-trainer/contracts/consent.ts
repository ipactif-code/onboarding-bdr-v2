/**
 * AI Sales Trainer - Consent Management Contracts
 *
 * Convex function signatures for GDPR consent management.
 * Implements 4 consent types with 12-month expiration.
 */

import { v } from "convex/values";
import type { Id as _Id } from "../../../convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

export interface ConsentTypes {
  voiceRecording: boolean;     // Required for all sessions
  transcriptStorage: boolean;  // Required for evaluations
  performanceAnalysis: boolean; // Required for scoring
  aiCoaching: boolean;         // Required for M7 coaching
}

export interface ConsentStatus extends ConsentTypes {
  consentVersion: string;
  consentedAt: number;
  expiresAt: number;
  isExpired: boolean;
  daysUntilExpiry: number;
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get current user's consent status
 *
 * @auth Required
 */
export const getMyConsent = {
  args: {},
  returns: v.union(
    v.object({
      hasConsent: v.literal(true),
      voiceRecording: v.boolean(),
      transcriptStorage: v.boolean(),
      performanceAnalysis: v.boolean(),
      aiCoaching: v.boolean(),
      consentVersion: v.string(),
      consentedAt: v.number(),
      expiresAt: v.number(),
      isExpired: v.boolean(),
      daysUntilExpiry: v.number(),
      withdrawnAt: v.optional(v.number()),
    }),
    v.object({
      hasConsent: v.literal(false),
    })
  ),
};

/**
 * Check if user can start a specific type of session
 *
 * @auth Required
 */
export const canStartSession = {
  args: {
    mode: v.union(v.literal("practice"), v.literal("evaluation")),
  },
  returns: v.object({
    canStart: v.boolean(),
    missingConsents: v.array(
      v.union(
        v.literal("voiceRecording"),
        v.literal("transcriptStorage"),
        v.literal("performanceAnalysis"),
        v.literal("aiCoaching")
      )
    ),
    isExpired: v.boolean(),
    expiresAt: v.optional(v.number()),
  }),
};

/**
 * Get consent text for display (returns current consent version)
 *
 * @auth Not required - Public
 */
export const getConsentText = {
  args: {
    language: v.string(), // "en", "fr", "es", "de", "it"
  },
  returns: v.object({
    version: v.string(),
    effectiveDate: v.string(),
    sections: v.array(
      v.object({
        type: v.union(
          v.literal("voiceRecording"),
          v.literal("transcriptStorage"),
          v.literal("performanceAnalysis"),
          v.literal("aiCoaching")
        ),
        title: v.string(),
        description: v.string(),
        dataCollected: v.array(v.string()),
        retentionPeriod: v.string(),
        isRequired: v.boolean(), // For minimum viable session
      })
    ),
    withdrawalInstructions: v.string(),
  }),
};

/**
 * Get consent history for user (GDPR data access)
 *
 * @auth Required
 */
export const getConsentHistory = {
  args: {},
  returns: v.array(
    v.object({
      consentVersion: v.string(),
      consentedAt: v.number(),
      consents: v.object({
        voiceRecording: v.boolean(),
        transcriptStorage: v.boolean(),
        performanceAnalysis: v.boolean(),
        aiCoaching: v.boolean(),
      }),
      expiresAt: v.number(),
      withdrawnAt: v.optional(v.number()),
      withdrawalReason: v.optional(v.string()),
    })
  ),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Grant or update consent
 *
 * @auth Required
 */
export const grantConsent = {
  args: {
    voiceRecording: v.boolean(),
    transcriptStorage: v.boolean(),
    performanceAnalysis: v.boolean(),
    aiCoaching: v.boolean(),
    consentVersion: v.string(),
    acknowledgedTerms: v.boolean(), // Must be true
  },
  returns: v.object({
    success: v.boolean(),
    expiresAt: v.number(),
    validFor: v.string(), // "12 months"
  }),
};

/**
 * Renew consent before expiration
 *
 * @auth Required
 */
export const renewConsent = {
  args: {
    voiceRecording: v.boolean(),
    transcriptStorage: v.boolean(),
    performanceAnalysis: v.boolean(),
    aiCoaching: v.boolean(),
    consentVersion: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    newExpiresAt: v.number(),
  }),
};

/**
 * Withdraw specific consent types
 *
 * @auth Required
 */
export const withdrawConsent = {
  args: {
    types: v.array(
      v.union(
        v.literal("voiceRecording"),
        v.literal("transcriptStorage"),
        v.literal("performanceAnalysis"),
        v.literal("aiCoaching")
      )
    ),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    impacts: v.array(v.string()), // What features are now unavailable
  }),
};

/**
 * Withdraw all consent (full opt-out)
 *
 * @auth Required
 */
export const withdrawAllConsent = {
  args: {
    reason: v.optional(v.string()),
    confirmDeletion: v.boolean(), // Must acknowledge data deletion
  },
  returns: v.object({
    success: v.boolean(),
    dataRetentionInfo: v.string(), // What happens to existing data
    deletionScheduledAt: v.optional(v.number()),
  }),
};

// =============================================================================
// INTERNAL MUTATIONS
// =============================================================================

/**
 * Send consent expiry reminders (cron job)
 *
 * @internal Called by weekly cron
 */
export const internalSendExpiryReminders = {
  args: {},
  returns: v.object({
    remindersSent: v.number(),
    expiring7Days: v.number(),
    expiring30Days: v.number(),
  }),
};

/**
 * Mark expired consents (cron job)
 *
 * @internal Called by daily cron
 */
export const internalMarkExpiredConsents = {
  args: {},
  returns: v.object({
    markedExpired: v.number(),
  }),
};

/**
 * Validate consent for session start
 *
 * @internal Called by startSession mutation
 */
export const internalValidateConsent = {
  args: {
    userId: v.id("users"),
    mode: v.union(v.literal("practice"), v.literal("evaluation")),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      snapshot: v.object({
        voiceRecording: v.boolean(),
        transcriptStorage: v.boolean(),
        performanceAnalysis: v.boolean(),
        aiCoaching: v.boolean(),
        consentVersion: v.string(),
      }),
    }),
    v.object({
      valid: v.literal(false),
      reason: v.union(
        v.literal("no_consent"),
        v.literal("expired"),
        v.literal("missing_required")
      ),
      missingConsents: v.array(v.string()),
    })
  ),
};
