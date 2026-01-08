/**
 * Scoring Engine API Contracts
 * Feature: 009-scoring-evaluation
 *
 * Convex queries, mutations, and actions for the scoring engine.
 */

import { v } from "convex/values";

// =============================================================================
// TYPES (Zod-inferred from validators)
// =============================================================================

/** Scoring job status */
export type ScoringJobStatus = "pending" | "processing" | "completed" | "failed";

/** Evaluation result status */
export type EvaluationStatus = "pass" | "distinction" | "fail";

/** Key moment type */
export type KeyMomentType = "positive" | "negative";

/** Supported languages */
export type SupportedLanguage = "fr" | "en" | "de" | "es" | "it";

// =============================================================================
// VALIDATORS (for Convex function args/returns)
// =============================================================================

/** SPIN dimension scores */
export const spinScoreValidator = v.object({
  situation: v.number(),
  problem: v.number(),
  implication: v.number(),
  needPayoff: v.number(),
  total: v.number(),
  feedback: v.string(),
});

/** MEDDIC dimension scores */
export const meddicScoreValidator = v.object({
  metrics: v.number(),
  economicBuyer: v.number(),
  decisionCriteria: v.number(),
  decisionProcess: v.number(),
  identifyPain: v.number(),
  champion: v.number(),
  competition: v.number(),
  total: v.number(),
  feedback: v.string(),
});

/** BANT dimension scores */
export const bantScoreValidator = v.object({
  budget: v.number(),
  authority: v.number(),
  need: v.number(),
  timeline: v.number(),
  total: v.number(),
  feedback: v.string(),
});

/** Single objection evaluation */
export const objectionEvaluationValidator = v.object({
  verbatim: v.string(),
  reframe: v.number(),
  address: v.number(),
  confirm: v.number(),
  close: v.number(),
  total: v.number(),
  feedback: v.string(),
});

/** RACC dimension scores */
export const raccScoreValidator = v.object({
  objections: v.array(objectionEvaluationValidator),
  average: v.number(),
  feedback: v.string(),
});

/** Behavioral dimension scores */
export const behavioralScoreValidator = v.object({
  talkRatio: v.number(),
  activeListening: v.number(),
  voiceConfidence: v.number(),
  pacing: v.number(),
  total: v.number(),
  feedback: v.string(),
  talkRatioPercent: v.number(),
});

/** Adaptive dimension scores */
export const adaptiveScoreValidator = v.object({
  difficultyProgression: v.number(),
  emotionalNavigation: v.number(),
  total: v.number(),
  feedback: v.string(),
});

/** Key moment */
export const keyMomentValidator = v.object({
  type: v.union(v.literal("positive"), v.literal("negative")),
  timestamp: v.string(),
  description: v.string(),
  feedback: v.string(),
});

/** Competitor mention analysis */
export const competitorMentionValidator = v.object({
  competitor: v.string(),
  timestamp: v.string(),
  acknowledgedStrengths: v.boolean(),
  differentiatedOnValue: v.boolean(),
  bashedCompetitor: v.boolean(),
  usedCaseStudy: v.boolean(),
  feedback: v.string(),
});

/** Evaluation result */
export const evaluationResultValidator = v.object({
  status: v.union(v.literal("pass"), v.literal("distinction"), v.literal("fail")),
  reason: v.string(),
  thresholdsMet: v.object({
    overallAbove70: v.boolean(),
    allDimensionsAbove50: v.boolean(),
    allDimensionsAbove70: v.boolean(),
  }),
});

// =============================================================================
// QUERY CONTRACTS
// =============================================================================

/**
 * Get session score by session ID
 * @access BDR (own scores only), Team Lead (team scores)
 */
export const getSessionScoreContract = {
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("sessionScores"),
      sessionId: v.id("sessions"),
      bdrId: v.id("users"),
      overallScore: v.number(),
      spin: spinScoreValidator,
      meddic: meddicScoreValidator,
      bant: bantScoreValidator,
      racc: raccScoreValidator,
      behavioral: behavioralScoreValidator,
      adaptive: adaptiveScoreValidator,
      keyMoments: v.array(keyMomentValidator),
      strengths: v.array(v.string()),
      improvements: v.array(v.string()),
      recommendedScenarios: v.array(v.string()),
      competitorMentions: v.optional(v.array(competitorMentionValidator)),
      isEvaluation: v.boolean(),
      evaluationResult: v.optional(evaluationResultValidator),
      language: v.string(),
      createdAt: v.number(),
    }),
    v.null()
  ),
};

/**
 * Get scoring job status
 * @access BDR (own jobs only)
 */
export const getScoringStatusContract = {
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.union(
    v.object({
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      attempts: v.number(),
      error: v.optional(v.string()),
      scoreId: v.optional(v.id("sessionScores")),
      createdAt: v.number(),
    }),
    v.null()
  ),
};

/**
 * Get BDR's score history for trend analysis
 * @access BDR (own scores), Team Lead (team member scores)
 */
export const getScoreTrendContract = {
  args: {
    bdrId: v.id("users"),
    limit: v.optional(v.number()), // Default: 5
  },
  returns: v.array(
    v.object({
      _id: v.id("sessionScores"),
      sessionId: v.id("sessions"),
      overallScore: v.number(),
      spin: v.number(),
      meddic: v.number(),
      bant: v.number(),
      racc: v.number(),
      behavioral: v.number(),
      adaptive: v.number(),
      createdAt: v.number(),
    })
  ),
};

/**
 * Get team scores for Team Lead dashboard
 * @access Team Lead only
 */
export const getTeamScoresContract = {
  args: {
    teamId: v.id("teams"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("sessionScores"),
      sessionId: v.id("sessions"),
      bdrId: v.id("users"),
      bdrName: v.string(),
      overallScore: v.number(),
      isEvaluation: v.boolean(),
      evaluationResult: v.optional(evaluationResultValidator),
      createdAt: v.number(),
    })
  ),
};

// =============================================================================
// MUTATION CONTRACTS
// =============================================================================

/**
 * Enqueue a session for scoring
 * @access Internal (called when session ends)
 */
export const enqueueScoring = {
  args: {
    sessionId: v.id("sessions"),
    isEvaluation: v.optional(v.boolean()),
  },
  returns: v.id("scoringJobs"),
};

/**
 * Add Team Lead notes to an evaluation
 * @access Team Lead only
 */
export const addTeamLeadNotesContract = {
  args: {
    scoreId: v.id("sessionScores"),
    content: v.string(),
  },
  returns: v.id("teamLeadNotes"),
};

/**
 * Update Team Lead notes
 * @access Team Lead who created the note
 */
export const updateTeamLeadNotesContract = {
  args: {
    noteId: v.id("teamLeadNotes"),
    content: v.string(),
  },
  returns: v.null(),
};

// =============================================================================
// ACTION CONTRACTS
// =============================================================================

/**
 * Score a session via Claude API
 * @access Internal only (called by job processor)
 */
export const scoreSessionContract = {
  args: {
    sessionId: v.id("sessions"),
    transcript: v.string(),
    language: v.string(),
    isEvaluation: v.boolean(),
    // M1/M3 metrics from Spec 006
    performanceMetrics: v.optional(
      v.object({
        talkRatioPercent: v.number(),
        wordsPerMinute: v.number(),
        pauseCount: v.number(),
        fillerWordCount: v.number(),
      })
    ),
    emotionalJourney: v.optional(
      v.array(
        v.object({
          state: v.string(),
          timestamp: v.number(),
        })
      )
    ),
  },
  returns: v.object({
    success: v.boolean(),
    score: v.optional(
      v.object({
        overallScore: v.number(),
        spin: spinScoreValidator,
        meddic: meddicScoreValidator,
        bant: bantScoreValidator,
        racc: raccScoreValidator,
        behavioral: behavioralScoreValidator,
        adaptive: adaptiveScoreValidator,
        keyMoments: v.array(keyMomentValidator),
        strengths: v.array(v.string()),
        improvements: v.array(v.string()),
        recommendedScenarios: v.array(v.string()),
        competitorMentions: v.optional(v.array(competitorMentionValidator)),
        evaluationResult: v.optional(evaluationResultValidator),
      })
    ),
    error: v.optional(v.string()),
    durationMs: v.number(),
  }),
};

// =============================================================================
// INTERNAL MUTATION CONTRACTS
// =============================================================================

/**
 * Process a scoring job (called by scheduler)
 * @access Internal only
 */
export const processJobContract = {
  args: {
    jobId: v.id("scoringJobs"),
  },
  returns: v.null(),
};

/**
 * Store scoring results
 * @access Internal only
 */
export const storeScoreContract = {
  args: {
    jobId: v.id("scoringJobs"),
    sessionId: v.id("sessions"),
    bdrId: v.id("users"),
    teamId: v.id("teams"),
    score: v.object({
      overallScore: v.number(),
      spin: spinScoreValidator,
      meddic: meddicScoreValidator,
      bant: bantScoreValidator,
      racc: raccScoreValidator,
      behavioral: behavioralScoreValidator,
      adaptive: adaptiveScoreValidator,
      keyMoments: v.array(keyMomentValidator),
      strengths: v.array(v.string()),
      improvements: v.array(v.string()),
      recommendedScenarios: v.array(v.string()),
      competitorMentions: v.optional(v.array(competitorMentionValidator)),
      evaluationResult: v.optional(evaluationResultValidator),
    }),
    language: v.string(),
    isEvaluation: v.boolean(),
    durationMs: v.number(),
    rawResponse: v.optional(v.string()),
  },
  returns: v.id("sessionScores"),
};

/**
 * Mark job as failed after max retries
 * @access Internal only
 */
export const failJobContract = {
  args: {
    jobId: v.id("scoringJobs"),
    error: v.string(),
    errorCode: v.optional(v.string()),
  },
  returns: v.null(),
};
