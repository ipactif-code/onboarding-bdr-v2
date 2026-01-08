# Research: BDR Performance Scoring & Evaluation System

**Feature**: 009-scoring-evaluation
**Date**: 2026-01-08

## Research Questions

### RQ1: Claude API Integration Pattern for Convex

**Decision**: Use Convex `action` for Claude API calls

**Rationale**:
- Convex `action` is required for external HTTP calls (Claude API)
- API key stored in Convex environment variables (ANTHROPIC_API_KEY)
- Actions can be called from mutations via `ctx.runAction()`
- Supports retry logic via scheduler

**Alternatives Considered**:
- Direct client-side calls: Rejected (exposes API key, CORS issues)
- Next.js API route: Rejected (adds latency hop, not real-time aware)
- Edge function: Rejected (not needed, Convex action is simpler)

**Implementation**:
```typescript
// convex/actions/claude-scoring.ts
import Anthropic from "@anthropic-ai/sdk";

export const scoreSession = action({
  args: { sessionId: v.id("sessions"), transcript: v.string(), ... },
  returns: v.object({ ... }),
  handler: async (ctx, args) => {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.1,
      messages: [{ role: "user", content: buildScoringPrompt(args) }],
    });
    return parseAndValidateScoringResponse(response);
  },
});
```

---

### RQ2: Queue-Based Async Scoring Pattern

**Decision**: Use Convex table as job queue with scheduler for processing

**Rationale**:
- Simple: No external queue service needed
- Real-time: Convex subscriptions show job progress instantly
- Retry: Built-in via scheduler with exponential backoff
- Ordering: FIFO via `_creationTime` index

**Alternatives Considered**:
- External queue (SQS, Redis): Rejected (over-engineering, adds complexity)
- Direct sync call: Rejected (blocks request, poor UX if slow)
- Cron polling: Rejected (latency, inefficient)

**Schema Design**:
```typescript
// scoringJobs table
{
  sessionId: v.id("sessions"),
  status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
  attempts: v.number(),
  lastAttemptAt: v.optional(v.number()),
  error: v.optional(v.string()),
  scheduledJobId: v.optional(v.id("_scheduled_functions")),
}
```

**Flow**:
1. Session ends → insert `scoringJobs` with status "pending"
2. Scheduler picks up job → status "processing"
3. Claude API call → success: status "completed", failure: retry or "failed"
4. Real-time subscription updates UI

---

### RQ3: Scoring Consistency (Temperature 0.1)

**Decision**: Use temperature 0.1 for scoring calls

**Rationale**:
- SC-002 requires 90%+ consistency (same transcript = same score ±5 points)
- Temperature 0.1 minimizes randomness while allowing some flexibility
- Lower than conversation (0.3-0.5) per Article XIV

**Alternatives Considered**:
- Temperature 0.0: Rejected (fully deterministic but may miss nuance)
- Temperature 0.3: Rejected (too much variance for scoring)

**Validation**:
- Store raw Claude response for audit
- Zod schema validates JSON structure
- Score bounds checked (0-100 per dimension)

---

### RQ4: Multilingual Feedback Generation

**Decision**: Single prompt with language instruction, feedback in session language

**Rationale**:
- Claude naturally handles multilingual output
- Session language detected from transcript (>50% rule)
- Rubric is language-agnostic (behavior-based, not word-based)

**Implementation**:
```typescript
const prompt = `
...
IMPORTANT: Generate all feedback in ${sessionLanguage}.
The transcript is in ${sessionLanguage}.
`;
```

**Languages**: French (fr), English (en), German (de), Spanish (es), Italian (it)

---

### RQ5: Structured JSON Output Validation

**Decision**: Use Zod for runtime validation of Claude output

**Rationale**:
- LLM output can be malformed despite instructions
- Zod catches issues before database insert
- Type inference for TypeScript safety

**Schema**:
```typescript
const ScoringOutputSchema = z.object({
  scores: z.object({
    spin: z.object({
      situation: z.number().min(0).max(25),
      problem: z.number().min(0).max(25),
      implication: z.number().min(0).max(25),
      needPayoff: z.number().min(0).max(25),
      total: z.number().min(0).max(100),
    }),
    meddic: z.object({
      metrics: z.number().min(0).max(15),
      economicBuyer: z.number().min(0).max(15),
      decisionCriteria: z.number().min(0).max(15),
      decisionProcess: z.number().min(0).max(15),
      identifyPain: z.number().min(0).max(15),
      champion: z.number().min(0).max(15),
      competition: z.number().min(0).max(10),
      total: z.number().min(0).max(100),
    }),
    bant: z.object({ ... }),
    racc: z.object({ ... }),
    behavioral: z.object({ ... }),
    adaptive: z.object({ ... }),
  }),
  overall: z.object({
    score: z.number().min(0).max(100),
    calculation: z.string(),
  }),
  keyMoments: z.array(z.object({
    type: z.enum(["positive", "negative"]),
    timestamp: z.string(),
    description: z.string(),
    feedback: z.string(),
  })).min(3).max(5),
  strengths: z.array(z.string()).length(3),
  improvements: z.array(z.string()).length(3),
  recommendedScenarios: z.array(z.string()),
  evaluationResult: z.object({
    pass: z.boolean(),
    distinction: z.boolean(),
    reason: z.string(),
  }),
});
```

---

### RQ6: Access Control Pattern

**Decision**: Query-level filtering with auth context

**Rationale**:
- BDR queries filtered by `bdrId === identity.userId`
- Team Lead queries filtered by team membership
- No separate permission table needed

**Implementation**:
```typescript
// BDR access
export const getMyScore = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const score = await ctx.db
      .query("sessionScores")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .first();

    // Access check
    if (score?.bdrId !== identity.userId) {
      throw new Error("Access denied");
    }
    return score;
  },
});

// Team Lead access
export const getTeamScores = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const isTeamLead = await verifyTeamLead(ctx, identity.userId, args.teamId);
    if (!isTeamLead) throw new Error("Access denied");

    return ctx.db
      .query("sessionScores")
      .withIndex("by_team", q => q.eq("teamId", args.teamId))
      .collect();
  },
});
```

---

### RQ7: Retry Strategy with Exponential Backoff

**Decision**: 3 retries with exponential backoff (1s, 4s, 16s)

**Rationale**:
- Handles transient Claude API failures
- Exponential backoff prevents thundering herd
- 3 attempts aligns with spec clarification

**Implementation**:
```typescript
const RETRY_DELAYS = [1000, 4000, 16000]; // ms

export const processJob = internalMutation({
  args: { jobId: v.id("scoringJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "pending") return;

    try {
      await ctx.db.patch(args.jobId, { status: "processing" });
      const result = await ctx.runAction(internal.actions.claudeScoring.scoreSession, { ... });
      await ctx.db.patch(args.jobId, { status: "completed" });
      // Store result...
    } catch (error) {
      const attempts = job.attempts + 1;
      if (attempts < 3) {
        // Schedule retry
        const delay = RETRY_DELAYS[attempts];
        await ctx.scheduler.runAfter(delay, internal.scoring.jobs.processJob, { jobId: args.jobId });
        await ctx.db.patch(args.jobId, { attempts, lastAttemptAt: Date.now(), status: "pending" });
      } else {
        await ctx.db.patch(args.jobId, { status: "failed", error: String(error) });
        // Notify BDR of permanent failure
      }
    }
  },
});
```

---

### RQ8: Trend Analysis Query Pattern

**Decision**: Query last 5 scores by BDR, compute trends client-side

**Rationale**:
- Simple query with index on bdrId + createdAt
- Client-side calculation is fast for 5 records
- Avoids complex aggregation in Convex

**Implementation**:
```typescript
export const getScoreTrend = query({
  args: { bdrId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    // Access check...

    return ctx.db
      .query("sessionScores")
      .withIndex("by_bdr_created", q => q.eq("bdrId", args.bdrId))
      .order("desc")
      .take(args.limit ?? 5);
  },
});
```

---

### RQ9: Data Retention (2 Years + Archive)

**Decision**: Soft-delete with `archivedAt` timestamp after 2 years

**Rationale**:
- Scores not deleted, just filtered from normal queries
- Archived scores still accessible for audit/compliance
- Cleanup job runs daily via Convex cron

**Implementation**:
```typescript
// Schema
{
  archivedAt: v.optional(v.number()),
}

// Archive cron (runs daily)
export const archiveOldScores = internalMutation({
  handler: async (ctx) => {
    const twoYearsAgo = Date.now() - (2 * 365 * 24 * 60 * 60 * 1000);
    const oldScores = await ctx.db
      .query("sessionScores")
      .withIndex("by_created")
      .filter(q => q.lt(q.field("createdAt"), twoYearsAgo))
      .filter(q => q.eq(q.field("archivedAt"), undefined))
      .take(100);

    for (const score of oldScores) {
      await ctx.db.patch(score._id, { archivedAt: Date.now() });
    }
  },
});
```

---

## Technology Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Claude integration | Convex action | Required for external HTTP, secure key storage |
| Queue system | Convex table + scheduler | Simple, real-time, built-in retry |
| Temperature | 0.1 | Consistency for scoring (90%+ target) |
| Multilingual | Language instruction in prompt | Natural Claude capability |
| Output validation | Zod runtime validation | Catches malformed LLM output |
| Access control | Query-level filtering | Simple, no permission table |
| Retry strategy | 3x exponential backoff | Handles transient failures |
| Trend analysis | Last 5 query + client calc | Simple, efficient |
| Data retention | Soft-delete after 2 years | Compliance, audit trail |

---

## No Outstanding Clarifications

All technical decisions resolved. Ready for Phase 1 design.
