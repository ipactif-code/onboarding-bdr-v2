/**
 * AI Sales Trainer - Certification Contracts
 *
 * Convex function signatures for Bronze/Silver/Gold certifications.
 * Includes verification for fraud prevention.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

export type CertificationLevel = "bronze" | "silver" | "gold";

export interface CertificationRequirements {
  bronze: { sessions: 3; avgScore: 70 };
  silver: { sessions: 5; avgScore: 80 };
  gold: { sessions: 10; avgScore: 90 };
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get current user's certifications
 *
 * @auth Required
 */
export const getMyCertifications = {
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("trainingCertifications"),
      level: v.union(
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold")
      ),
      earnedAt: v.number(),
      averageScore: v.number(),
      certificateNumber: v.string(),
      qrCodeData: v.string(),
      isValid: v.boolean(),
    })
  ),
};

/**
 * Get progress toward next certification
 *
 * @auth Required
 */
export const getCertificationProgress = {
  args: {},
  returns: v.object({
    currentLevel: v.union(
      v.literal("none"),
      v.literal("bronze"),
      v.literal("silver"),
      v.literal("gold")
    ),
    nextLevel: v.union(
      v.literal("bronze"),
      v.literal("silver"),
      v.literal("gold"),
      v.null()
    ),
    progress: v.union(
      v.object({
        sessionsCompleted: v.number(),
        sessionsRequired: v.number(),
        currentAverageScore: v.number(),
        requiredAverageScore: v.number(),
        eligibleSessionIds: v.array(v.id("trainingSessions")),
        percentComplete: v.number(),
      }),
      v.null() // null if already at gold
    ),
  }),
};

/**
 * Verify a certificate by number (public endpoint)
 *
 * @auth Not required - Public verification
 */
export const verifyCertificate = {
  args: {
    certificateNumber: v.string(),
  },
  returns: v.union(
    v.object({
      isValid: v.boolean(),
      level: v.union(
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold")
      ),
      holderName: v.string(), // Redacted to first name + last initial
      earnedAt: v.number(),
      averageScore: v.number(),
      revokedAt: v.optional(v.number()),
      revocationReason: v.optional(v.string()),
    }),
    v.object({
      isValid: v.literal(false),
      error: v.literal("not_found"),
    })
  ),
};

/**
 * Get certification leaderboard
 *
 * @auth Required
 */
export const getCertificationLeaderboard = {
  args: {
    level: v.optional(
      v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold"))
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      userName: v.string(),
      avatarUrl: v.optional(v.string()),
      level: v.string(),
      averageScore: v.number(),
      earnedAt: v.number(),
    })
  ),
};

/**
 * Get all certifications (admin view)
 *
 * @auth Required - Admin role
 */
export const listAllCertifications = {
  args: {
    level: v.optional(
      v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold"))
    ),
    isValid: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    certifications: v.array(
      v.object({
        _id: v.id("trainingCertifications"),
        user: v.object({
          _id: v.id("users"),
          name: v.string(),
          email: v.string(),
        }),
        level: v.string(),
        averageScore: v.number(),
        certificateNumber: v.string(),
        earnedAt: v.number(),
        isValid: v.boolean(),
        revokedAt: v.optional(v.number()),
        revokedBy: v.optional(v.id("users")),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
  }),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Claim a certification when requirements are met
 *
 * @auth Required
 */
export const claimCertification = {
  args: {
    level: v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold")),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      certificationId: v.id("trainingCertifications"),
      certificateNumber: v.string(),
      qrCodeData: v.string(),
    }),
    v.object({
      success: v.literal(false),
      error: v.union(
        v.literal("already_earned"),
        v.literal("insufficient_sessions"),
        v.literal("score_below_threshold"),
        v.literal("prerequisites_not_met")
      ),
      details: v.object({
        sessionsCompleted: v.number(),
        sessionsRequired: v.number(),
        currentAverageScore: v.number(),
        requiredAverageScore: v.number(),
      }),
    })
  ),
};

/**
 * Download certificate as PDF data
 *
 * @auth Required - Must own certificate
 */
export const downloadCertificate = {
  args: {
    certificationId: v.id("trainingCertifications"),
  },
  returns: v.object({
    pdfUrl: v.string(), // Signed URL to generated PDF
    expiresAt: v.number(),
  }),
};

/**
 * Revoke a certification (admin only)
 *
 * @auth Required - Admin role
 */
export const revokeCertification = {
  args: {
    certificationId: v.id("trainingCertifications"),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    revokedAt: v.number(),
  }),
};

/**
 * Reinstate a revoked certification (admin only)
 *
 * @auth Required - Admin role
 */
export const reinstateCertification = {
  args: {
    certificationId: v.id("trainingCertifications"),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

// =============================================================================
// INTERNAL MUTATIONS
// =============================================================================

/**
 * Check and auto-award certification after session completion
 *
 * @internal Called after scoring completes
 */
export const internalCheckCertificationEligibility = {
  args: {
    userId: v.id("users"),
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    eligible: v.boolean(),
    level: v.optional(
      v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold"))
    ),
    autoAwarded: v.boolean(),
    certificationId: v.optional(v.id("trainingCertifications")),
  }),
};
