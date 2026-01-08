# Quickstart: Praiz Video Processing Pipeline

**Feature**: 008-praiz-pipeline
**Date**: 2026-01-08

## Pipeline Overview

The Praiz Pipeline extracts sales intelligence from DiliTrust call recordings to build an Objection Library with RACC-structured responses.

| Stage | Input | Output | Tool |
|-------|-------|--------|------|
| **1. Ingest** | Date range | Queued jobs | Praiz API |
| **2. Process** | Transcript | Patterns | Claude Sonnet |
| **3. Validate** | Patterns | Approved objections | Human review |
| **4. Inject** | Context | AI behavior | Context Builder |

## Quick Implementation Path

### Step 1: Schema Updates

Add to `convex/schema.ts`:

```typescript
// ============================================================================
// PRAIZ PIPELINE TABLES
// ============================================================================

// Main objection entries
objectionLibrary: defineTable({
  slug: v.string(),
  verbatim: v.string(),
  verbatimVariants: v.array(v.string()),
  category: v.union(
    v.literal("existing_solution"),
    v.literal("price"),
    v.literal("timing"),
    v.literal("competition"),
    v.literal("complexity"),
    v.literal("authority"),
    v.literal("budget"),
    v.literal("security"),
    v.literal("integration")
  ),
  dilitrustModule: v.union(
    v.literal("clm"),
    v.literal("board"),
    v.literal("entities"),
    v.literal("litigation"),
    v.literal("doc_library")
  ),
  personaTypes: v.array(v.string()),
  scenarioTypes: v.array(v.union(
    v.literal("cold_call"),
    v.literal("discovery"),
    v.literal("demo"),
    v.literal("negotiation"),
    v.literal("closing")
  )),
  language: v.union(v.literal("fr"), v.literal("en"), v.literal("it"), v.literal("es"), v.literal("de")),
  raccResponse: v.optional(v.object({
    reframe: v.string(),
    address: v.string(),
    confirm: v.string(),
    close: v.string(),
  })),
  sourceVideoId: v.string(),
  sourceTimestamp: v.number(),
  extractedAt: v.number(),
  extractionConfidence: v.number(),
  status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("archived")),
  autoApproved: v.boolean(),
  validatedBy: v.optional(v.id("users")),
  validatedAt: v.optional(v.number()),
  rejectionReason: v.optional(v.string()),
  usageCount: v.number(),
  effectivenessScore: v.number(),
  lastUsedAt: v.optional(v.number()),
  freshnessReviewAt: v.number(),
  isFresh: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_status", ["status"])
  .index("by_category", ["category"])
  .index("by_module_lang", ["dilitrustModule", "language"])
  .index("by_freshness", ["freshnessReviewAt", "isFresh"])
  .index("by_effectiveness", ["effectivenessScore"]),

// Processing jobs
praizProcessingJobs: defineTable({
  videoId: v.string(),
  batchId: v.optional(v.string()),
  status: v.union(v.literal("queued"), v.literal("processing"), v.literal("completed"), v.literal("failed"), v.literal("skipped")),
  videoLanguage: v.union(v.literal("fr"), v.literal("en"), v.literal("it"), v.literal("es"), v.literal("de")),
  dealOutcome: v.union(v.literal("won"), v.literal("lost"), v.literal("stalled"), v.literal("unknown")),
  videoDurationSeconds: v.number(),
  dilitrustModule: v.optional(v.union(
    v.literal("clm"),
    v.literal("board"),
    v.literal("entities"),
    v.literal("litigation"),
    v.literal("doc_library")
  )),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  processingDurationMs: v.optional(v.number()),
  objectionsExtracted: v.number(),
  phrasesExtracted: v.number(),
  costUsd: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  retryCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_status", ["status"])
  .index("by_video", ["videoId"])
  .index("by_batch", ["batchId"]),

// Budget tracking
praizBudgetTracking: defineTable({
  month: v.string(),
  budgetUsd: v.number(),
  spentUsd: v.number(),
  videosProcessed: v.number(),
  alert80PercentSentAt: v.optional(v.number()),
  alert100PercentSentAt: v.optional(v.number()),
  isDisabled: v.boolean(),
  currentHourVideos: v.number(),
  hourlyResetAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_month", ["month"]),
```

### Step 2: Environment Variables

Add to Convex environment:

```bash
# Praiz API
npx convex env set PRAIZ_API_URL "https://api.praiz.io/v1"
npx convex env set PRAIZ_API_KEY "your-api-key"

# Claude API (Anthropic)
npx convex env set ANTHROPIC_API_KEY "your-anthropic-key"
```

### Step 3: Core Processing Action

```typescript
// convex/praiz/extraction.ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildExtractionPrompt,
  EXTRACTION_CONFIG,
  validateExtractionResult,
} from "@/specs/008-praiz-pipeline/contracts/extraction";

export const extractPatterns = action({
  args: {
    jobId: v.id("praizProcessingJobs"),
    transcript: v.string(),
    language: v.string(),
    dilitrustModule: v.string(),
    dealOutcome: v.string(),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build prompt
    const prompt = buildExtractionPrompt(args.transcript, {
      module: args.dilitrustModule as any,
      dealOutcome: args.dealOutcome as any,
      language: args.language as any,
    });

    // Call Claude Sonnet
    const response = await anthropic.messages.create({
      model: EXTRACTION_CONFIG.model,
      max_tokens: EXTRACTION_CONFIG.maxTokens,
      temperature: EXTRACTION_CONFIG.temperature,
      messages: [{ role: "user", content: prompt }],
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const result = JSON.parse(content.text);
    if (!validateExtractionResult(result)) {
      throw new Error("Invalid extraction result structure");
    }

    // Calculate cost
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd =
      (inputTokens * 0.003 + outputTokens * 0.015) / 1000;

    return {
      result,
      tokensUsed: inputTokens + outputTokens,
      estimatedCostUsd: costUsd,
      processingTimeMs: Date.now() - startTime,
    };
  },
});
```

### Step 4: Batch Processing Mutation

```typescript
// convex/praiz/processing.ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";

export const queueBatch = mutation({
  args: {
    batchId: v.string(),
    videos: v.array(v.object({
      videoId: v.string(),
      language: v.string(),
      dealOutcome: v.string(),
      durationSeconds: v.number(),
      dilitrustModule: v.optional(v.string()),
    })),
  },
  returns: v.object({
    queuedCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();

    let queuedCount = 0;
    let skippedCount = 0;

    for (const video of args.videos) {
      // Check if already processed
      const existing = await ctx.db
        .query("praizProcessingJobs")
        .withIndex("by_video", (q) => q.eq("videoId", video.videoId))
        .first();

      if (existing) {
        skippedCount++;
        continue;
      }

      // Queue job
      await ctx.db.insert("praizProcessingJobs", {
        videoId: video.videoId,
        batchId: args.batchId,
        status: "queued",
        videoLanguage: video.language as any,
        dealOutcome: video.dealOutcome as any,
        videoDurationSeconds: video.durationSeconds,
        dilitrustModule: video.dilitrustModule as any,
        objectionsExtracted: 0,
        phrasesExtracted: 0,
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      queuedCount++;
    }

    return { queuedCount, skippedCount };
  },
});

export const getProcessingStatus = query({
  args: { batchId: v.string() },
  returns: v.object({
    total: v.number(),
    queued: v.number(),
    processing: v.number(),
    completed: v.number(),
    failed: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("praizProcessingJobs")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .collect();

    return {
      total: jobs.length,
      queued: jobs.filter((j) => j.status === "queued").length,
      processing: jobs.filter((j) => j.status === "processing").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      skipped: jobs.filter((j) => j.status === "skipped").length,
    };
  },
});
```

### Step 5: Validation Mutations

```typescript
// convex/praiz/validation.ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

// Check if user can validate (admin or sales_enablement_manager)
async function requireValidator(ctx: any) {
  const identity = await requireAuth(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user || (user.role !== "admin" && user.role !== "sales_enablement_manager")) {
    throw new Error("Insufficient permissions for validation");
  }
  return user;
}

export const getValidationQueue = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("objectionLibrary")
      .withIndex("by_status", (q) => q.eq("status", args.status ?? "pending"))
      .order("asc");

    const items = await query.take(args.limit ?? 20);
    return items;
  },
});

export const approveObjection = mutation({
  args: {
    objectionId: v.id("objectionLibrary"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireValidator(ctx);
    const now = Date.now();

    await ctx.db.patch(args.objectionId, {
      status: "approved",
      validatedBy: user._id,
      validatedAt: now,
      updatedAt: now,
    });

    // Log action
    await ctx.db.insert("praizValidationActions", {
      objectionId: args.objectionId,
      userId: user._id,
      action: "approve",
      timestamp: now,
    });
  },
});

export const rejectObjection = mutation({
  args: {
    objectionId: v.id("objectionLibrary"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireValidator(ctx);
    const now = Date.now();

    await ctx.db.patch(args.objectionId, {
      status: "rejected",
      validatedBy: user._id,
      validatedAt: now,
      rejectionReason: args.reason,
      updatedAt: now,
    });

    await ctx.db.insert("praizValidationActions", {
      objectionId: args.objectionId,
      userId: user._id,
      action: "reject",
      rejectionReason: args.reason,
      timestamp: now,
    });
  },
});
```

### Step 6: Context Builder Integration

```typescript
// convex/praiz/objections.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getRelevantObjections = query({
  args: {
    dilitrustModule: v.string(),
    personaType: v.optional(v.string()),
    language: v.string(),
    scenarioType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    verbatim: v.string(),
    variants: v.array(v.string()),
    category: v.string(),
    raccResponse: v.optional(v.object({
      reframe: v.string(),
      address: v.string(),
      confirm: v.string(),
      close: v.string(),
    })),
    weight: v.number(),
  })),
  handler: async (ctx, args) => {
    const objections = await ctx.db
      .query("objectionLibrary")
      .withIndex("by_module_lang", (q) =>
        q.eq("dilitrustModule", args.dilitrustModule as any)
         .eq("language", args.language as any)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("isFresh"), true)
        )
      )
      .take(args.limit ?? 10);

    // Filter by persona/scenario if provided
    let filtered = objections;
    if (args.personaType) {
      filtered = filtered.filter((o) =>
        o.personaTypes.includes(args.personaType!)
      );
    }
    if (args.scenarioType) {
      filtered = filtered.filter((o) =>
        o.scenarioTypes.includes(args.scenarioType as any)
      );
    }

    // Sort by effectiveness and return formatted
    return filtered
      .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
      .slice(0, args.limit ?? 5)
      .map((o) => ({
        verbatim: o.verbatim,
        variants: o.verbatimVariants,
        category: o.category,
        raccResponse: o.raccResponse,
        weight: calculateWeight(o.effectivenessScore, o.usageCount, o.isFresh),
      }));
  },
});

function calculateWeight(effectiveness: number, usage: number, fresh: boolean): number {
  const base = 0.5 + effectiveness / 100;
  const usageFactor = Math.min(1.2, 1 + usage / 100);
  const freshFactor = fresh ? 1 : 0.7;
  return base * usageFactor * freshFactor;
}
```

## Key Integration Points

### With Context Builder (Spec 005)

```typescript
// In context builder V7
import { api } from "convex/_generated/api";

async function getObjectionsForSession(
  ctx: any,
  persona: Persona,
  language: string
): Promise<ContextBuilderObjection[]> {
  return await ctx.runQuery(api.praiz.objections.getRelevantObjections, {
    dilitrustModule: persona.module,
    personaType: persona.type,
    language,
    scenarioType: persona.scenario,
    limit: 5,
  });
}
```

### With AI Training Sessions (Spec 004)

```typescript
// After session completion, update objection usage
async function recordObjectionUsage(
  ctx: any,
  objectionIds: string[],
  sessionOutcome: "positive" | "negative" | "neutral"
) {
  for (const id of objectionIds) {
    await ctx.runMutation(api.praiz.objections.recordUsage, {
      objectionId: id,
      outcome: sessionOutcome,
    });
  }
}
```

## Testing Checklist

### Processing Pipeline
- [ ] Videos queued correctly from date range
- [ ] Rate limit of 50/hour enforced
- [ ] Budget alert at 80% ($400)
- [ ] Extraction completes < 5 min per video
- [ ] Error retry with exponential backoff

### Objection Library
- [ ] Auto-approve at confidence >= 0.85
- [ ] Manual validation required at 0.7-0.85
- [ ] Auto-reject at confidence < 0.7
- [ ] RACC response editable
- [ ] Freshness flag after 12 months

### Validation Workflow
- [ ] Only admins/managers can validate
- [ ] Approve/reject with audit trail
- [ ] Edit preserves history
- [ ] Approved objections available in 24h

### Context Builder Integration
- [ ] Query by module + language works
- [ ] Persona type filtering works
- [ ] Effectiveness weighting applied
- [ ] Fresh objections only returned

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Extraction accuracy | > 80% | Manual validation approval rate |
| Cost per video | < $0.50 | Sum(API costs) / videos processed |
| Processing time | < 5 min | End-to-end per video |
| Throughput | 50/hour | Rate limit check |
| Availability | < 24h | Time from approval to injection |

## Common Pitfalls

1. **Don't forget PII anonymization**: The extraction prompt handles named entities, but verify outputs before storage.

2. **Rate limit race conditions**: Use atomic counters in Convex to prevent exceeding 50/hour.

3. **Budget tracking accuracy**: Log costs per job immediately, don't batch cost updates.

4. **RACC completeness**: Partial RACC responses are allowed but flagged for completion in validation queue.

5. **Freshness cron job**: Schedule daily job to update `isFresh` flags when `freshnessReviewAt < now`.

## Files to Create

```
convex/
  praiz/
    processing.ts       # Batch processing & job management
    extraction.ts       # Claude Sonnet action
    objections.ts       # Library CRUD & Context Builder queries
    validation.ts       # Validation workflow
    observability.ts    # Metrics queries
    scheduled.ts        # Cron jobs (freshness, log cleanup)

src/
  app/
    (dashboard)/
      admin/
        praiz/
          page.tsx              # Dashboard
          processing/page.tsx   # Batch trigger
          validation/page.tsx   # Validation queue
          library/page.tsx      # Objection library

  components/
    praiz/
      processing-dashboard.tsx
      validation-queue.tsx
      objection-card.tsx
      racc-editor.tsx

  hooks/
    praiz/
      use-processing-jobs.ts
      use-validation-queue.ts
      use-objection-library.ts
```
