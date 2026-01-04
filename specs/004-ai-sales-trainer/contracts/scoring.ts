/**
 * AI Sales Trainer - Scoring & Analytics Contracts
 *
 * Convex function signatures for session scoring, analytics,
 * and M7 AI coaching plan generation.
 */

import { v } from "convex/values";
import type { Id } from "../../../convex/_generated/dataModel";

// =============================================================================
// TYPES
// =============================================================================

export interface CategoryScores {
  openingRapport: number;      // 0-100
  discoveryQuestions: number;
  valueProposition: number;
  objectionHandling: number;
  closingTechnique: number;
  activeListening: number;
}

export interface VoiceScores {
  clarity: number;
  confidence: number;
  pacing: number;
  engagement: number;
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get detailed score for a session
 *
 * @auth Required - Must own session or be manager of session owner
 */
export const getSessionScore = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("trainingScores"),
      sessionId: v.id("trainingSessions"),
      overallScore: v.number(),
      passed: v.boolean(),
      categoryScores: v.object({
        openingRapport: v.number(),
        discoveryQuestions: v.number(),
        valueProposition: v.number(),
        objectionHandling: v.number(),
        closingTechnique: v.number(),
        activeListening: v.number(),
      }),
      methodologyScores: v.optional(
        v.object({
          spin: v.optional(v.number()),
          meddic: v.optional(v.number()),
          bant: v.optional(v.number()),
        })
      ),
      voiceScore: v.optional(
        v.object({
          clarity: v.number(),
          confidence: v.number(),
          pacing: v.number(),
          engagement: v.number(),
        })
      ),
      strengths: v.array(v.string()),
      improvements: v.array(v.string()),
      detailedFeedback: v.optional(v.string()),
      scoredAt: v.number(),
    }),
    v.null()
  ),
};

/**
 * Get score trends over time
 *
 * @auth Required
 */
export const getMyScoreTrends = {
  args: {
    days: v.optional(v.number()), // Default 30
  },
  returns: v.object({
    overall: v.array(
      v.object({
        date: v.string(),
        score: v.number(),
        sessionCount: v.number(),
      })
    ),
    byCategory: v.object({
      openingRapport: v.array(v.object({ date: v.string(), score: v.number() })),
      discoveryQuestions: v.array(v.object({ date: v.string(), score: v.number() })),
      valueProposition: v.array(v.object({ date: v.string(), score: v.number() })),
      objectionHandling: v.array(v.object({ date: v.string(), score: v.number() })),
      closingTechnique: v.array(v.object({ date: v.string(), score: v.number() })),
      activeListening: v.array(v.object({ date: v.string(), score: v.number() })),
    }),
    averages: v.object({
      overall: v.number(),
      byCategory: v.object({
        openingRapport: v.number(),
        discoveryQuestions: v.number(),
        valueProposition: v.number(),
        objectionHandling: v.number(),
        closingTechnique: v.number(),
        activeListening: v.number(),
      }),
    }),
  }),
};

/**
 * Get category comparison (user vs team average)
 *
 * @auth Required
 */
export const getCategoryComparison = {
  args: {},
  returns: v.object({
    userScores: v.object({
      openingRapport: v.number(),
      discoveryQuestions: v.number(),
      valueProposition: v.number(),
      objectionHandling: v.number(),
      closingTechnique: v.number(),
      activeListening: v.number(),
    }),
    teamAverages: v.object({
      openingRapport: v.number(),
      discoveryQuestions: v.number(),
      valueProposition: v.number(),
      objectionHandling: v.number(),
      closingTechnique: v.number(),
      activeListening: v.number(),
    }),
    percentileRanks: v.object({
      openingRapport: v.number(),
      discoveryQuestions: v.number(),
      valueProposition: v.number(),
      objectionHandling: v.number(),
      closingTechnique: v.number(),
      activeListening: v.number(),
    }),
  }),
};

/**
 * Get team analytics (manager view)
 *
 * @auth Required - Manager role
 */
export const getTeamAnalytics = {
  args: {
    days: v.optional(v.number()), // Default 30
  },
  returns: v.object({
    teamSize: v.number(),
    activeBdrs: v.number(), // BDRs with at least 1 session
    totalSessions: v.number(),
    averageScore: v.number(),
    certificationBreakdown: v.object({
      none: v.number(),
      bronze: v.number(),
      silver: v.number(),
      gold: v.number(),
    }),
    topPerformers: v.array(
      v.object({
        userId: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
        averageScore: v.number(),
        sessionCount: v.number(),
      })
    ),
    needsImprovement: v.array(
      v.object({
        userId: v.id("users"),
        name: v.string(),
        weakestCategory: v.string(),
        categoryScore: v.number(),
      })
    ),
  }),
};

/**
 * Get AI coaching plan for current user
 *
 * @auth Required
 * @consent aiCoaching required
 */
export const getMyCoachingPlan = {
  args: {
    weekStarting: v.optional(v.string()), // Default current week
  },
  returns: v.union(
    v.object({
      _id: v.id("trainingCoachingPlans"),
      weekStarting: v.string(),
      weekEnding: v.string(),
      sessionsAnalyzed: v.number(),
      averageScore: v.number(),
      focusAreas: v.array(
        v.object({
          area: v.string(),
          currentLevel: v.number(),
          targetLevel: v.number(),
          specificFeedback: v.string(),
        })
      ),
      recommendations: v.array(
        v.object({
          type: v.string(),
          description: v.string(),
          priority: v.union(
            v.literal("high"),
            v.literal("medium"),
            v.literal("low")
          ),
          resourceLink: v.optional(v.string()),
        })
      ),
      weeklyGoals: v.array(v.string()),
      generatedAt: v.number(),
      viewedAt: v.optional(v.number()),
    }),
    v.null() // No plan available (insufficient data)
  ),
};

/**
 * Get coaching plan history
 *
 * @auth Required
 */
export const getCoachingPlanHistory = {
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("trainingCoachingPlans"),
      weekStarting: v.string(),
      focusAreas: v.array(v.string()),
      averageScore: v.number(),
      viewedAt: v.optional(v.number()),
      feedbackRating: v.optional(v.number()),
    })
  ),
};

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Rate a coaching plan (user feedback)
 *
 * @auth Required - Must own the coaching plan
 */
export const rateCoachingPlan = {
  args: {
    planId: v.id("trainingCoachingPlans"),
    rating: v.number(), // 1-5
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

/**
 * Mark coaching plan as viewed
 *
 * @auth Required - Must own the coaching plan
 */
export const markCoachingPlanViewed = {
  args: {
    planId: v.id("trainingCoachingPlans"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
};

// =============================================================================
// ACTIONS (External API calls)
// =============================================================================

/**
 * Trigger scoring for a completed session
 *
 * @internal Called by session completion
 */
export const actionScoreSession = {
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    scoreId: v.id("trainingScores"),
    overallScore: v.number(),
    passed: v.boolean(),
  }),
};

/**
 * Generate weekly coaching plans (cron job)
 *
 * @internal Called by Monday 6 AM UTC cron
 */
export const actionGenerateCoachingPlans = {
  args: {},
  returns: v.object({
    generated: v.number(),
    skipped: v.number(), // Users without enough sessions
    errors: v.number(),
  }),
};

// =============================================================================
// INTERNAL MUTATIONS
// =============================================================================

/**
 * Store score after Claude API call
 *
 * @internal Called by actionScoreSession
 */
export const internalStoreScore = {
  args: {
    sessionId: v.id("trainingSessions"),
    userId: v.id("users"),
    overallScore: v.number(),
    passed: v.boolean(),
    categoryScores: v.object({
      openingRapport: v.number(),
      discoveryQuestions: v.number(),
      valueProposition: v.number(),
      objectionHandling: v.number(),
      closingTechnique: v.number(),
      activeListening: v.number(),
    }),
    methodologyScores: v.optional(
      v.object({
        spin: v.optional(v.number()),
        meddic: v.optional(v.number()),
        bant: v.optional(v.number()),
      })
    ),
    voiceScore: v.optional(
      v.object({
        clarity: v.number(),
        confidence: v.number(),
        pacing: v.number(),
        engagement: v.number(),
      })
    ),
    strengths: v.array(v.string()),
    improvements: v.array(v.string()),
    detailedFeedback: v.optional(v.string()),
    scoringModel: v.string(),
    scoringVersion: v.string(),
  },
  returns: v.object({
    scoreId: v.id("trainingScores"),
  }),
};

/**
 * Store coaching plan after Claude API call
 *
 * @internal Called by actionGenerateCoachingPlans
 */
export const internalStoreCoachingPlan = {
  args: {
    userId: v.id("users"),
    weekStarting: v.string(),
    weekEnding: v.string(),
    sessionsAnalyzed: v.number(),
    averageScore: v.number(),
    focusAreas: v.array(
      v.object({
        area: v.string(),
        currentLevel: v.number(),
        targetLevel: v.number(),
        specificFeedback: v.string(),
      })
    ),
    recommendations: v.array(
      v.object({
        type: v.string(),
        description: v.string(),
        priority: v.union(
          v.literal("high"),
          v.literal("medium"),
          v.literal("low")
        ),
        resourceLink: v.optional(v.string()),
      })
    ),
    weeklyGoals: v.array(v.string()),
    sessionIdsAnalyzed: v.array(v.id("trainingSessions")),
  },
  returns: v.object({
    planId: v.id("trainingCoachingPlans"),
  }),
};
