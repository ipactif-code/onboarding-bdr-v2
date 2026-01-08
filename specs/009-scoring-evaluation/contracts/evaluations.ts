/**
 * Evaluation Mode API Contracts
 * Feature: 009-scoring-evaluation
 *
 * Convex queries and mutations for certification evaluation mode.
 */

import { v } from "convex/values";

// =============================================================================
// TYPES
// =============================================================================

/** Evaluation thresholds */
export const EVALUATION_THRESHOLDS = {
  pass: {
    overall: 70,
    minPerDimension: 50,
  },
  distinction: {
    overall: 85,
    minPerDimension: 70,
  },
  fail: {
    overall: 70, // Below this = fail
    criticalDimension: 40, // Any dimension below this = fail
  },
} as const;

// =============================================================================
// VALIDATORS
// =============================================================================

/** Certification record summary */
export const certificationSummaryValidator = v.object({
  _id: v.id("certificationRecords"),
  bdrId: v.id("users"),
  sessionId: v.id("sessions"),
  status: v.union(v.literal("pass"), v.literal("distinction"), v.literal("fail")),
  overallScore: v.number(),
  reason: v.string(),
  dimensionScores: v.object({
    spin: v.number(),
    meddic: v.number(),
    bant: v.number(),
    racc: v.number(),
    behavioral: v.number(),
    adaptive: v.number(),
  }),
  createdAt: v.number(),
  reviewedAt: v.optional(v.number()),
});

// =============================================================================
// QUERY CONTRACTS
// =============================================================================

/**
 * Get BDR's certification history
 * @access BDR (own records), Team Lead (team member records)
 */
export const getCertificationHistoryContract = {
  args: {
    bdrId: v.id("users"),
  },
  returns: v.array(certificationSummaryValidator),
};

/**
 * Get team certification overview
 * @access Team Lead only
 */
export const getTeamCertificationsContract = {
  args: {
    teamId: v.id("teams"),
    status: v.optional(
      v.union(v.literal("pass"), v.literal("distinction"), v.literal("fail"))
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("certificationRecords"),
      bdrId: v.id("users"),
      bdrName: v.string(),
      status: v.union(v.literal("pass"), v.literal("distinction"), v.literal("fail")),
      overallScore: v.number(),
      createdAt: v.number(),
    })
  ),
};

/**
 * Get detailed certification record
 * @access BDR (own records), Team Lead (team member records)
 */
export const getCertificationDetailContract = {
  args: {
    certificationId: v.id("certificationRecords"),
  },
  returns: v.union(
    v.object({
      certification: certificationSummaryValidator,
      score: v.object({
        _id: v.id("sessionScores"),
        overallScore: v.number(),
        spin: v.number(),
        meddic: v.number(),
        bant: v.number(),
        racc: v.number(),
        behavioral: v.number(),
        adaptive: v.number(),
        keyMoments: v.array(
          v.object({
            type: v.union(v.literal("positive"), v.literal("negative")),
            timestamp: v.string(),
            description: v.string(),
          })
        ),
      }),
      notes: v.array(
        v.object({
          _id: v.id("teamLeadNotes"),
          content: v.string(),
          createdAt: v.number(),
          teamLeadName: v.string(),
        })
      ),
    }),
    v.null()
  ),
};

/**
 * Get certification pass rate stats for a team
 * @access Team Lead only
 */
export const getTeamCertificationStatsContract = {
  args: {
    teamId: v.id("teams"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    total: v.number(),
    passed: v.number(),
    distinctions: v.number(),
    failed: v.number(),
    passRate: v.number(), // 0-100%
    averageScore: v.number(),
  }),
};

// =============================================================================
// MUTATION CONTRACTS
// =============================================================================

/**
 * Create certification record from evaluation score
 * @access Internal only (called after evaluation scoring)
 */
export const createCertificationRecordContract = {
  args: {
    scoreId: v.id("sessionScores"),
    sessionId: v.id("sessions"),
    bdrId: v.id("users"),
    teamId: v.id("teams"),
    status: v.union(v.literal("pass"), v.literal("distinction"), v.literal("fail")),
    overallScore: v.number(),
    reason: v.string(),
    dimensionScores: v.object({
      spin: v.number(),
      meddic: v.number(),
      bant: v.number(),
      racc: v.number(),
      behavioral: v.number(),
      adaptive: v.number(),
    }),
  },
  returns: v.id("certificationRecords"),
};

/**
 * Mark certification as reviewed by Team Lead
 * @access Team Lead only
 */
export const markCertificationReviewedContract = {
  args: {
    certificationId: v.id("certificationRecords"),
  },
  returns: v.null(),
};

// =============================================================================
// HELPER: Evaluation Logic
// =============================================================================

/**
 * Determine evaluation result based on scores
 *
 * Rules:
 * - Distinction: overall ≥85 AND all dimensions ≥70
 * - Pass: overall ≥70 AND all dimensions ≥50
 * - Fail: overall <70 OR any dimension <40
 */
export function determineEvaluationResult(scores: {
  overall: number;
  spin: number;
  meddic: number;
  bant: number;
  racc: number;
  behavioral: number;
  adaptive: number;
}): {
  status: "pass" | "distinction" | "fail";
  reason: string;
  thresholdsMet: {
    overallAbove70: boolean;
    allDimensionsAbove50: boolean;
    allDimensionsAbove70: boolean;
  };
} {
  const { overall, spin, meddic, bant, racc, behavioral, adaptive } = scores;
  const dimensions = [spin, meddic, bant, racc, behavioral, adaptive];
  const lowestDimension = Math.min(...dimensions);

  const thresholdsMet = {
    overallAbove70: overall >= 70,
    allDimensionsAbove50: lowestDimension >= 50,
    allDimensionsAbove70: lowestDimension >= 70,
  };

  // Check for critical failure first (any dimension < 40)
  if (lowestDimension < 40) {
    const failedDimension = getDimensionName(dimensions.indexOf(lowestDimension));
    return {
      status: "fail",
      reason: `${failedDimension} score (${lowestDimension}) below critical threshold of 40`,
      thresholdsMet,
    };
  }

  // Check overall score
  if (overall < 70) {
    return {
      status: "fail",
      reason: `Overall score (${overall}) below passing threshold of 70`,
      thresholdsMet,
    };
  }

  // Check for any dimension below 50
  if (lowestDimension < 50) {
    const failedDimension = getDimensionName(dimensions.indexOf(lowestDimension));
    return {
      status: "fail",
      reason: `${failedDimension} score (${lowestDimension}) below minimum threshold of 50`,
      thresholdsMet,
    };
  }

  // Check for distinction
  if (overall >= 85 && lowestDimension >= 70) {
    return {
      status: "distinction",
      reason: "Exceptional performance: overall ≥85 and all dimensions ≥70",
      thresholdsMet,
    };
  }

  // Pass
  return {
    status: "pass",
    reason: "Met all requirements: overall ≥70 and all dimensions ≥50",
    thresholdsMet,
  };
}

function getDimensionName(index: number): string {
  const names = ["SPIN", "MEDDIC", "BANT", "RACC", "Behavioral", "Adaptive"];
  return names[index] ?? "Unknown";
}
