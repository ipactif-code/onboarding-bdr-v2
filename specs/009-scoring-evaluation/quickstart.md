# Quickstart: BDR Performance Scoring & Evaluation System

**Feature**: 009-scoring-evaluation
**Date**: 2026-01-08

## Overview

This feature adds an AI-powered scoring engine that evaluates BDR performance across 6 dimensions (SPIN, MEDDIC, BANT, RACC, Behavioral, Adaptive) using Claude Sonnet. It provides actionable multilingual feedback and supports certification evaluations.

## Prerequisites

- [ ] Spec 004 (AI Sales Trainer) tables deployed: `sessions`, `sessionTurns`
- [ ] Spec 006 (Adaptive Behavior) providing M1/M3 metrics
- [ ] Spec 008 (Praiz Pipeline) providing transcripts
- [ ] `ANTHROPIC_API_KEY` environment variable set in Convex

## Quick Setup

### 1. Add Environment Variable

```bash
npx convex env set ANTHROPIC_API_KEY "sk-ant-..."
```

### 2. Update Schema

Add to `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ... existing tables ...

  sessionScores: defineTable({
    sessionId: v.id("sessions"),
    bdrId: v.id("users"),
    teamId: v.id("teams"),
    overallScore: v.number(),
    calculationFormula: v.string(),
    spin: v.object({
      situation: v.number(),
      problem: v.number(),
      implication: v.number(),
      needPayoff: v.number(),
      total: v.number(),
      feedback: v.string(),
    }),
    meddic: v.object({
      metrics: v.number(),
      economicBuyer: v.number(),
      decisionCriteria: v.number(),
      decisionProcess: v.number(),
      identifyPain: v.number(),
      champion: v.number(),
      competition: v.number(),
      total: v.number(),
      feedback: v.string(),
    }),
    bant: v.object({
      budget: v.number(),
      authority: v.number(),
      need: v.number(),
      timeline: v.number(),
      total: v.number(),
      feedback: v.string(),
    }),
    racc: v.object({
      objections: v.array(v.object({
        verbatim: v.string(),
        reframe: v.number(),
        address: v.number(),
        confirm: v.number(),
        close: v.number(),
        total: v.number(),
        feedback: v.string(),
      })),
      average: v.number(),
      feedback: v.string(),
    }),
    behavioral: v.object({
      talkRatio: v.number(),
      activeListening: v.number(),
      voiceConfidence: v.number(),
      pacing: v.number(),
      total: v.number(),
      feedback: v.string(),
      talkRatioPercent: v.number(),
    }),
    adaptive: v.object({
      difficultyProgression: v.number(),
      emotionalNavigation: v.number(),
      total: v.number(),
      feedback: v.string(),
    }),
    keyMoments: v.array(v.object({
      type: v.union(v.literal("positive"), v.literal("negative")),
      timestamp: v.string(),
      description: v.string(),
      feedback: v.string(),
    })),
    strengths: v.array(v.string()),
    improvements: v.array(v.string()),
    recommendedScenarios: v.array(v.string()),
    competitorMentions: v.optional(v.array(v.object({
      competitor: v.string(),
      timestamp: v.string(),
      acknowledgedStrengths: v.boolean(),
      differentiatedOnValue: v.boolean(),
      bashedCompetitor: v.boolean(),
      usedCaseStudy: v.boolean(),
      feedback: v.string(),
    }))),
    isEvaluation: v.boolean(),
    evaluationResult: v.optional(v.object({
      status: v.union(v.literal("pass"), v.literal("distinction"), v.literal("fail")),
      reason: v.string(),
      thresholdsMet: v.object({
        overallAbove70: v.boolean(),
        allDimensionsAbove50: v.boolean(),
        allDimensionsAbove70: v.boolean(),
      }),
    })),
    language: v.string(),
    scoringDurationMs: v.number(),
    rawClaudeResponse: v.optional(v.string()),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_bdr", ["bdrId"])
    .index("by_bdr_created", ["bdrId", "createdAt"])
    .index("by_team_created", ["teamId", "createdAt"])
    .index("by_created", ["createdAt"]),

  scoringJobs: defineTable({
    sessionId: v.id("sessions"),
    bdrId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    attempts: v.number(),
    maxAttempts: v.number(),
    lastAttemptAt: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    error: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    scheduledJobId: v.optional(v.id("_scheduled_functions")),
    scoreId: v.optional(v.id("sessionScores")),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_session", ["sessionId"])
    .index("by_status_created", ["status", "createdAt"]),

  certificationRecords: defineTable({
    bdrId: v.id("users"),
    teamId: v.id("teams"),
    scoreId: v.id("sessionScores"),
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
    evaluatorId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_bdr", ["bdrId"])
    .index("by_bdr_created", ["bdrId", "createdAt"])
    .index("by_team", ["teamId"])
    .index("by_team_created", ["teamId", "createdAt"]),

  teamLeadNotes: defineTable({
    scoreId: v.id("sessionScores"),
    teamLeadId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_score", ["scoreId"])
    .index("by_team_lead", ["teamLeadId"]),
});
```

### 3. Deploy Schema

```bash
npx convex dev
```

## Development Workflow

### Step 1: Implement Scoring Action

```typescript
// convex/actions/claude-scoring.ts
import Anthropic from "@anthropic-ai/sdk";
import { action } from "../_generated/server";
import { v } from "convex/values";

export const scoreSession = action({
  args: {
    sessionId: v.id("sessions"),
    transcript: v.string(),
    language: v.string(),
    isEvaluation: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    score: v.optional(v.any()),
    error: v.optional(v.string()),
    durationMs: v.number(),
  }),
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        temperature: 0.1, // Low for consistency
        messages: [{
          role: "user",
          content: buildScoringPrompt(args.transcript, args.language),
        }],
      });

      const result = parseAndValidateResponse(response);
      return {
        success: true,
        score: result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
});
```

### Step 2: Implement Job Queue

```typescript
// convex/scoring/jobs.ts
import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const RETRY_DELAYS = [1000, 4000, 16000]; // Exponential backoff

export const enqueueScoring = mutation({
  args: {
    sessionId: v.id("sessions"),
    isEvaluation: v.optional(v.boolean()),
  },
  returns: v.id("scoringJobs"),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const jobId = await ctx.db.insert("scoringJobs", {
      sessionId: args.sessionId,
      bdrId: identity.userId,
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
    });

    // Schedule immediate processing
    await ctx.scheduler.runAfter(0, internal.scoring.jobs.processJob, { jobId });

    return jobId;
  },
});
```

### Step 3: Implement Score Retrieval

```typescript
// convex/scoring/results.ts
import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

export const getSessionScore = query({
  args: { sessionId: v.id("sessions") },
  returns: v.union(v.object({ /* full score schema */ }), v.null()),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const score = await ctx.db
      .query("sessionScores")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Access control: BDR sees own, Team Lead sees team
    if (!score) return null;
    if (score.bdrId !== identity.userId) {
      const isTeamLead = await verifyTeamLead(ctx, identity.userId, score.teamId);
      if (!isTeamLead) return null;
    }

    return score;
  },
});
```

## Testing

### Unit Test Example

```typescript
// tests/unit/convex/scoring/jobs.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../../../convex/schema";

describe("scoring jobs", () => {
  it("should create a pending job on enqueue", async () => {
    const t = convexTest(schema);

    // Setup: create user and session
    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { /* ... */ });
    });

    const sessionId = await t.run(async (ctx) => {
      return ctx.db.insert("sessions", { /* ... */ });
    });

    // Test: enqueue scoring
    const jobId = await t.mutation(api.scoring.jobs.enqueueScoring, {
      sessionId,
    });

    // Verify
    const job = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(job?.status).toBe("pending");
    expect(job?.attempts).toBe(0);
  });
});
```

## Key Patterns

### 1. Weighted Score Calculation

```typescript
function calculateOverallScore(dimensions: DimensionScores): number {
  return Math.round(
    dimensions.spin.total * 0.20 +
    dimensions.meddic.total * 0.20 +
    dimensions.bant.total * 0.15 +
    dimensions.racc.average * 0.20 +
    dimensions.behavioral.total * 0.15 +
    dimensions.adaptive.total * 0.10
  );
}
```

### 2. Evaluation Result Determination

```typescript
function determineEvaluationResult(scores: Scores): EvaluationResult {
  const overall = scores.overall;
  const lowest = Math.min(
    scores.spin, scores.meddic, scores.bant,
    scores.racc, scores.behavioral, scores.adaptive
  );

  if (lowest < 40) return { status: "fail", reason: "Critical dimension below 40" };
  if (overall < 70) return { status: "fail", reason: "Overall below 70" };
  if (lowest < 50) return { status: "fail", reason: "Dimension below 50" };
  if (overall >= 85 && lowest >= 70) return { status: "distinction", reason: "Exceptional" };
  return { status: "pass", reason: "Met all requirements" };
}
```

### 3. Real-Time Status Subscription

```typescript
// Client component
function ScoringStatus({ sessionId }: { sessionId: Id<"sessions"> }) {
  const status = useQuery(api.scoring.jobs.getScoringStatus, { sessionId });

  if (status?.status === "processing") {
    return <Skeleton className="h-32" />;
  }

  if (status?.status === "failed") {
    return <Alert variant="destructive">Scoring failed: {status.error}</Alert>;
  }

  if (status?.status === "completed") {
    return <ScoreDisplay scoreId={status.scoreId!} />;
  }

  return null;
}
```

## Common Gotchas

1. **Temperature**: Always use 0.1 for scoring (consistency requirement SC-002)
2. **RACC Average**: Use 70 if no objections detected (default neutral score)
3. **Access Control**: Always check BDR ownership or Team Lead membership
4. **Retry Timing**: Exponential backoff prevents API rate limiting
5. **Language**: Feedback must be in session language (detected from transcript)

## Related Documentation

- [Data Model](./data-model.md) - Full schema definitions
- [API Contracts](./contracts/) - TypeScript contracts for all endpoints
- [Research](./research.md) - Technical decision rationale
- [Spec](./spec.md) - Full requirements specification

## Success Criteria Checklist

Before shipping, verify:

- [ ] SC-001: Overall score formula matches documented weights
- [ ] SC-002: Same transcript produces ±5 point variance (test with 10 runs)
- [ ] SC-003: Scoring completes in <30s for 15-minute transcript
- [ ] SC-004: API cost <$0.10 per session (check billing dashboard)
- [ ] SC-005: Feedback displays correctly in all 5 languages
- [ ] SC-006: BDR cannot access other BDRs' scores (test auth)
- [ ] SC-007: Evaluation thresholds match spec (70/50/85/70)
