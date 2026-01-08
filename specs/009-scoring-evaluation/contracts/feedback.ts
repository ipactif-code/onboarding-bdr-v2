/**
 * Feedback & Trends API Contracts
 * Feature: 009-scoring-evaluation
 *
 * Convex queries for feedback display and trend analysis.
 */

import { v } from "convex/values";

// =============================================================================
// TYPES
// =============================================================================

/** Trend direction */
export type TrendDirection = "up" | "down" | "stable";

/** Dimension name */
export type DimensionName =
  | "spin"
  | "meddic"
  | "bant"
  | "racc"
  | "behavioral"
  | "adaptive";

// =============================================================================
// VALIDATORS
// =============================================================================

/** Dimension trend */
export const dimensionTrendValidator = v.object({
  dimension: v.string(),
  current: v.number(),
  previous: v.number(),
  change: v.number(), // positive = improvement
  direction: v.union(v.literal("up"), v.literal("down"), v.literal("stable")),
});

/** Session trend point */
export const trendPointValidator = v.object({
  sessionId: v.id("sessions"),
  overallScore: v.number(),
  createdAt: v.number(),
});

// =============================================================================
// QUERY CONTRACTS
// =============================================================================

/**
 * Get detailed feedback for a session score
 * @access BDR (own scores), Team Lead (team scores)
 */
export const getDetailedFeedbackContract = {
  args: {
    scoreId: v.id("sessionScores"),
  },
  returns: v.union(
    v.object({
      // Overall summary
      overallScore: v.number(),
      language: v.string(),

      // Strengths & Improvements
      strengths: v.array(
        v.object({
          title: v.string(),
          evidence: v.string(),
        })
      ),
      improvements: v.array(
        v.object({
          title: v.string(),
          advice: v.string(),
        })
      ),
      recommendedScenarios: v.array(v.string()),

      // Dimension breakdowns with feedback
      dimensions: v.object({
        spin: v.object({
          total: v.number(),
          breakdown: v.object({
            situation: v.object({ score: v.number(), maxScore: v.number() }),
            problem: v.object({ score: v.number(), maxScore: v.number() }),
            implication: v.object({ score: v.number(), maxScore: v.number() }),
            needPayoff: v.object({ score: v.number(), maxScore: v.number() }),
          }),
          feedback: v.string(),
        }),
        meddic: v.object({
          total: v.number(),
          breakdown: v.object({
            metrics: v.object({ score: v.number(), maxScore: v.number() }),
            economicBuyer: v.object({ score: v.number(), maxScore: v.number() }),
            decisionCriteria: v.object({ score: v.number(), maxScore: v.number() }),
            decisionProcess: v.object({ score: v.number(), maxScore: v.number() }),
            identifyPain: v.object({ score: v.number(), maxScore: v.number() }),
            champion: v.object({ score: v.number(), maxScore: v.number() }),
            competition: v.object({ score: v.number(), maxScore: v.number() }),
          }),
          feedback: v.string(),
        }),
        bant: v.object({
          total: v.number(),
          breakdown: v.object({
            budget: v.object({ score: v.number(), maxScore: v.number() }),
            authority: v.object({ score: v.number(), maxScore: v.number() }),
            need: v.object({ score: v.number(), maxScore: v.number() }),
            timeline: v.object({ score: v.number(), maxScore: v.number() }),
          }),
          feedback: v.string(),
        }),
        racc: v.object({
          total: v.number(),
          objectionCount: v.number(),
          objections: v.array(
            v.object({
              verbatim: v.string(),
              scores: v.object({
                reframe: v.number(),
                address: v.number(),
                confirm: v.number(),
                close: v.number(),
                total: v.number(),
              }),
              feedback: v.string(),
            })
          ),
          feedback: v.string(),
        }),
        behavioral: v.object({
          total: v.number(),
          breakdown: v.object({
            talkRatio: v.object({
              score: v.number(),
              maxScore: v.number(),
              actualPercent: v.number(),
            }),
            activeListening: v.object({ score: v.number(), maxScore: v.number() }),
            voiceConfidence: v.object({ score: v.number(), maxScore: v.number() }),
            pacing: v.object({ score: v.number(), maxScore: v.number() }),
          }),
          feedback: v.string(),
        }),
        adaptive: v.object({
          total: v.number(),
          breakdown: v.object({
            difficultyProgression: v.object({ score: v.number(), maxScore: v.number() }),
            emotionalNavigation: v.object({ score: v.number(), maxScore: v.number() }),
          }),
          feedback: v.string(),
        }),
      }),

      // Key moments
      keyMoments: v.array(
        v.object({
          type: v.union(v.literal("positive"), v.literal("negative")),
          timestamp: v.string(),
          description: v.string(),
          feedback: v.string(),
        })
      ),

      // Competitive analysis (if any)
      competitorAnalysis: v.optional(
        v.object({
          mentions: v.array(
            v.object({
              competitor: v.string(),
              timestamp: v.string(),
              acknowledgedStrengths: v.boolean(),
              differentiatedOnValue: v.boolean(),
              bashedCompetitor: v.boolean(),
              feedback: v.string(),
            })
          ),
          overallFeedback: v.string(),
        })
      ),
    }),
    v.null()
  ),
};

/**
 * Get trend analysis comparing to recent sessions
 * @access BDR (own data), Team Lead (team member data)
 */
export const getTrendAnalysisContract = {
  args: {
    bdrId: v.id("users"),
    sessionCount: v.optional(v.number()), // Default: 5
  },
  returns: v.object({
    // Overall trend
    overallTrend: v.object({
      currentScore: v.number(),
      previousAverage: v.number(),
      change: v.number(),
      direction: v.union(v.literal("up"), v.literal("down"), v.literal("stable")),
    }),

    // Per-dimension trends
    dimensionTrends: v.array(dimensionTrendValidator),

    // Historical data points for chart
    history: v.array(trendPointValidator),

    // Session count
    sessionCount: v.number(),
  }),
};

/**
 * Get quick score overview (for list views)
 * @access BDR (own scores), Team Lead (team scores)
 */
export const getScoreOverviewContract = {
  args: {
    scoreId: v.id("sessionScores"),
  },
  returns: v.union(
    v.object({
      overallScore: v.number(),
      dimensionSummary: v.object({
        spin: v.number(),
        meddic: v.number(),
        bant: v.number(),
        racc: v.number(),
        behavioral: v.number(),
        adaptive: v.number(),
      }),
      keyMomentCount: v.object({
        positive: v.number(),
        negative: v.number(),
      }),
      topStrength: v.string(),
      topImprovement: v.string(),
      isEvaluation: v.boolean(),
      evaluationStatus: v.optional(
        v.union(v.literal("pass"), v.literal("distinction"), v.literal("fail"))
      ),
      createdAt: v.number(),
    }),
    v.null()
  ),
};

// =============================================================================
// HELPER: Trend Calculation
// =============================================================================

/**
 * Calculate trend direction from change value
 */
export function calculateTrendDirection(
  change: number,
  threshold: number = 3
): TrendDirection {
  if (change >= threshold) return "up";
  if (change <= -threshold) return "down";
  return "stable";
}

/**
 * Calculate average score from array
 */
export function calculateAverage(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// =============================================================================
// SCORING RUBRIC DISPLAY DATA
// =============================================================================

/**
 * Scoring rubric for display to BDRs before sessions
 * (FR-054: System MUST make the full scoring rubric visible to BDRs before sessions)
 */
export const SCORING_RUBRIC = {
  spin: {
    name: "SPIN Quality",
    weight: 20,
    maxScore: 100,
    components: [
      { name: "Situation", maxScore: 25, description: "Context questions" },
      { name: "Problem", maxScore: 25, description: "Pain point identification" },
      { name: "Implication", maxScore: 25, description: "Impact exploration" },
      { name: "Need-Payoff", maxScore: 25, description: "Solution visualization" },
    ],
  },
  meddic: {
    name: "MEDDIC Coverage",
    weight: 20,
    maxScore: 100,
    components: [
      { name: "Metrics", maxScore: 15, description: "ROI/KPI discussion" },
      { name: "Economic Buyer", maxScore: 15, description: "Decision maker ID" },
      { name: "Decision Criteria", maxScore: 15, description: "Evaluation factors" },
      { name: "Decision Process", maxScore: 15, description: "Timeline & steps" },
      { name: "Identify Pain", maxScore: 15, description: "Pain quantification" },
      { name: "Champion", maxScore: 15, description: "Internal advocate" },
      { name: "Competition", maxScore: 10, description: "Competitive landscape" },
    ],
  },
  bant: {
    name: "BANT Qualification",
    weight: 15,
    maxScore: 100,
    components: [
      { name: "Budget", maxScore: 25, description: "Financial qualification" },
      { name: "Authority", maxScore: 25, description: "Decision maker" },
      { name: "Need", maxScore: 25, description: "Requirement understanding" },
      { name: "Timeline", maxScore: 25, description: "Urgency & timing" },
    ],
  },
  racc: {
    name: "RACC Execution",
    weight: 20,
    maxScore: 100,
    components: [
      { name: "Reframe", maxScore: 25, description: "Empathetic validation" },
      { name: "Address", maxScore: 25, description: "Value-based response" },
      { name: "Confirm", maxScore: 25, description: "Resolution verification" },
      { name: "Close", maxScore: 25, description: "Next step proposal" },
    ],
    note: "Scored per objection, averaged if multiple",
  },
  behavioral: {
    name: "Behavioral",
    weight: 15,
    maxScore: 100,
    components: [
      { name: "Talk Ratio", maxScore: 25, description: "Ideal: 30-40%" },
      { name: "Active Listening", maxScore: 25, description: "Acknowledgments" },
      { name: "Voice Confidence", maxScore: 25, description: "Tone & presence" },
      { name: "Pacing", maxScore: 25, description: "Speaking rate" },
    ],
  },
  adaptive: {
    name: "Adaptive",
    weight: 10,
    maxScore: 100,
    components: [
      { name: "Difficulty Progression", maxScore: 50, description: "Challenge growth" },
      { name: "Emotional Navigation", maxScore: 50, description: "Rapport building" },
    ],
  },
} as const;
