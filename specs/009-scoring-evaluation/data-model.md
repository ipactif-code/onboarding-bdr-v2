# Data Model: BDR Performance Scoring & Evaluation System

**Feature**: 009-scoring-evaluation
**Date**: 2026-01-08

## Tables Overview

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `sessionScores` | Complete scoring results per session | by_session, by_bdr, by_team_created |
| `scoringJobs` | Async job queue for scoring processing | by_status, by_session |
| `certificationRecords` | Pass/fail/distinction summary for profiles | by_bdr, by_team |
| `teamLeadNotes` | Team Lead notes on evaluation results | by_score |

## Table Schemas

### sessionScores

Primary storage for all scoring results. Immutable once created (except archivedAt).

```typescript
sessionScores: defineTable({
  // References
  sessionId: v.id("sessions"),
  bdrId: v.id("users"),
  teamId: v.id("teams"),

  // Overall score
  overallScore: v.number(), // 0-100
  calculationFormula: v.string(), // "SPIN*0.20 + MEDDIC*0.20 + ..."

  // Dimension scores (embedded objects for query efficiency)
  spin: v.object({
    situation: v.number(),    // 0-25
    problem: v.number(),      // 0-25
    implication: v.number(),  // 0-25
    needPayoff: v.number(),   // 0-25
    total: v.number(),        // 0-100
    feedback: v.string(),     // Multilingual feedback
  }),
  meddic: v.object({
    metrics: v.number(),         // 0-15
    economicBuyer: v.number(),   // 0-15
    decisionCriteria: v.number(),// 0-15
    decisionProcess: v.number(), // 0-15
    identifyPain: v.number(),    // 0-15
    champion: v.number(),        // 0-15
    competition: v.number(),     // 0-10
    total: v.number(),           // 0-100
    feedback: v.string(),
  }),
  bant: v.object({
    budget: v.number(),    // 0-25
    authority: v.number(), // 0-25
    need: v.number(),      // 0-25
    timeline: v.number(),  // 0-25
    total: v.number(),     // 0-100
    feedback: v.string(),
  }),
  racc: v.object({
    objections: v.array(v.object({
      verbatim: v.string(),      // Original objection text
      reframe: v.number(),       // 0-25
      address: v.number(),       // 0-25
      confirm: v.number(),       // 0-25
      close: v.number(),         // 0-25
      total: v.number(),         // 0-100
      feedback: v.string(),
    })),
    average: v.number(),         // 0-100 (or 70 if no objections)
    feedback: v.string(),
  }),
  behavioral: v.object({
    talkRatio: v.number(),       // 0-25
    activeListening: v.number(), // 0-25
    voiceConfidence: v.number(), // 0-25
    pacing: v.number(),          // 0-25
    total: v.number(),           // 0-100
    feedback: v.string(),
    talkRatioPercent: v.number(),// Actual talk ratio % for display
  }),
  adaptive: v.object({
    difficultyProgression: v.number(), // 0-50
    emotionalNavigation: v.number(),   // 0-50
    total: v.number(),                 // 0-100
    feedback: v.string(),
  }),

  // Key moments
  keyMoments: v.array(v.object({
    type: v.union(v.literal("positive"), v.literal("negative")),
    timestamp: v.string(),      // Position in transcript
    description: v.string(),
    feedback: v.string(),
  })),

  // Summary
  strengths: v.array(v.string()),     // Top 3
  improvements: v.array(v.string()),  // Top 3
  recommendedScenarios: v.array(v.string()),

  // Competitive analysis (optional)
  competitorMentions: v.optional(v.array(v.object({
    competitor: v.string(),           // "icertis", "diligent", "sharepoint"
    timestamp: v.string(),
    acknowledgedStrengths: v.boolean(),
    differentiatedOnValue: v.boolean(),
    bashedCompetitor: v.boolean(),
    usedCaseStudy: v.boolean(),
    feedback: v.string(),
  }))),

  // Evaluation mode (optional)
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

  // Metadata
  language: v.string(),               // Session language (fr, en, de, es, it)
  scoringDurationMs: v.number(),      // How long scoring took
  rawClaudeResponse: v.optional(v.string()), // For audit/debugging

  // Timestamps
  createdAt: v.number(),              // Date.now()
  archivedAt: v.optional(v.number()), // Set after 2 years
})
  .index("by_session", ["sessionId"])
  .index("by_bdr", ["bdrId"])
  .index("by_bdr_created", ["bdrId", "createdAt"])
  .index("by_team_created", ["teamId", "createdAt"])
  .index("by_created", ["createdAt"]),
```

### scoringJobs

Job queue for async scoring processing.

```typescript
scoringJobs: defineTable({
  // Job identification
  sessionId: v.id("sessions"),
  bdrId: v.id("users"),

  // Status tracking
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  ),

  // Retry tracking
  attempts: v.number(),              // 0, 1, 2, 3
  maxAttempts: v.number(),           // Default: 3
  lastAttemptAt: v.optional(v.number()),
  nextRetryAt: v.optional(v.number()),

  // Error tracking
  error: v.optional(v.string()),
  errorCode: v.optional(v.string()), // "API_TIMEOUT", "RATE_LIMIT", etc.

  // Scheduler reference
  scheduledJobId: v.optional(v.id("_scheduled_functions")),

  // Result reference (on completion)
  scoreId: v.optional(v.id("sessionScores")),

  // Timestamps
  createdAt: v.number(),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
})
  .index("by_status", ["status"])
  .index("by_session", ["sessionId"])
  .index("by_status_created", ["status", "createdAt"]),
```

### certificationRecords

Summary records for BDR certification tracking.

```typescript
certificationRecords: defineTable({
  // References
  bdrId: v.id("users"),
  teamId: v.id("teams"),
  scoreId: v.id("sessionScores"),
  sessionId: v.id("sessions"),

  // Result
  status: v.union(v.literal("pass"), v.literal("distinction"), v.literal("fail")),
  overallScore: v.number(),
  reason: v.string(),

  // Dimension summary
  dimensionScores: v.object({
    spin: v.number(),
    meddic: v.number(),
    bant: v.number(),
    racc: v.number(),
    behavioral: v.number(),
    adaptive: v.number(),
  }),

  // Audit
  evaluatorId: v.optional(v.id("users")), // Team Lead who reviewed
  reviewedAt: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
})
  .index("by_bdr", ["bdrId"])
  .index("by_bdr_created", ["bdrId", "createdAt"])
  .index("by_team", ["teamId"])
  .index("by_team_created", ["teamId", "createdAt"]),
```

### teamLeadNotes

Notes added by Team Leads to evaluation results.

```typescript
teamLeadNotes: defineTable({
  // References
  scoreId: v.id("sessionScores"),
  teamLeadId: v.id("users"),

  // Content
  content: v.string(),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_score", ["scoreId"])
  .index("by_team_lead", ["teamLeadId"]),
```

## Entity Relationships

```
sessions (from Spec 004)
    │
    ├──────────────────────────┐
    │                          │
    ▼                          ▼
scoringJobs              sessionScores
(1:1, pending → completed)  (1:1, final result)
                               │
                               ├──── certificationRecords (1:1, if evaluation)
                               │
                               └──── teamLeadNotes (1:N, Team Lead comments)
```

## State Transitions

### Scoring Job Lifecycle

```
┌─────────┐     pick up      ┌────────────┐
│ pending │ ───────────────► │ processing │
└─────────┘                  └────────────┘
     ▲                             │
     │                             │
     │ retry                       │ success / max retries
     │ (< 3)                       │
     │                             ▼
     │                    ┌─────────────────┐
     └────────────────────│  completed OR   │
                          │    failed       │
                          └─────────────────┘
```

### Evaluation Result Logic

```typescript
function determineEvaluationResult(scores: DimensionScores): EvaluationResult {
  const overall = calculateOverall(scores);
  const lowestDimension = Math.min(
    scores.spin.total,
    scores.meddic.total,
    scores.bant.total,
    scores.racc.average,
    scores.behavioral.total,
    scores.adaptive.total
  );

  // Distinction: overall ≥85 AND all dimensions ≥70
  if (overall >= 85 && lowestDimension >= 70) {
    return { status: "distinction", reason: "Exceptional performance across all dimensions" };
  }

  // Pass: overall ≥70 AND no dimension <50
  if (overall >= 70 && lowestDimension >= 50) {
    return { status: "pass", reason: "Met all minimum requirements" };
  }

  // Fail: overall <70 OR any dimension <40
  if (overall < 70) {
    return { status: "fail", reason: `Overall score ${overall} below 70 threshold` };
  }

  return { status: "fail", reason: `Dimension score ${lowestDimension} below 50 threshold` };
}
```

## Indexes Justification

| Index | Query Pattern | Usage |
|-------|---------------|-------|
| `sessionScores.by_session` | Get score for a specific session | Score results page |
| `sessionScores.by_bdr` | Get all scores for a BDR | BDR profile, access check |
| `sessionScores.by_bdr_created` | Get BDR's recent scores | Trend analysis (last 5) |
| `sessionScores.by_team_created` | Get team's scores by date | Team Lead dashboard |
| `sessionScores.by_created` | All scores by date | Archive cron job |
| `scoringJobs.by_status` | Get pending jobs | Job processor |
| `scoringJobs.by_session` | Get job for session | Status check |
| `scoringJobs.by_status_created` | Get oldest pending jobs | FIFO processing |
| `certificationRecords.by_bdr` | BDR's certification history | Profile |
| `certificationRecords.by_team` | Team certification overview | Team Lead view |

## Data Validation Rules

1. **Overall score**: Must equal weighted formula result (calculated, not stored separately)
2. **Key moments**: 3-5 items, at least 1 positive if overall ≥50
3. **Strengths/Improvements**: Exactly 3 items each
4. **RACC average**: 70 if no objections, else average of objection scores
5. **Language**: One of ["fr", "en", "de", "es", "it"]
6. **Immutability**: Once `sessionScores` created, only `archivedAt` can change

## Migration Notes

This is a new feature with new tables. No migration from existing data needed.

**Schema additions to `convex/schema.ts`**:
- Add `sessionScores` table
- Add `scoringJobs` table
- Add `certificationRecords` table
- Add `teamLeadNotes` table
