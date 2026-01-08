# Data Model: Praiz Video Processing Pipeline

**Feature**: 008-praiz-pipeline
**Date**: 2026-01-08

## Overview

This document defines the Convex schema additions for the Praiz Video Processing Pipeline. The data model supports:
- Batch video processing with job tracking
- Objection library with RACC responses
- Validation workflow with audit trail
- Observability metrics and log retention

## Schema Additions

### 1. Objection Library (`objectionLibrary`)

Central repository of extracted objections with RACC-structured responses.

```typescript
objectionLibrary: defineTable({
  // === Identity ===
  slug: v.string(),  // URL-safe identifier: "existing-solution-clm-fr"

  // === Objection Content ===
  verbatim: v.string(),  // "On a déjà un système en place"
  verbatimVariants: v.array(v.string()),  // Alternative phrasings

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

  // === Context ===
  dilitrustModule: v.union(
    v.literal("clm"),
    v.literal("board"),
    v.literal("entities"),
    v.literal("litigation"),
    v.literal("doc_library")
  ),
  personaTypes: v.array(v.string()),  // ["skeptical-analyst", "aggressive-negotiator"]
  scenarioTypes: v.array(v.union(
    v.literal("cold_call"),
    v.literal("discovery"),
    v.literal("demo"),
    v.literal("negotiation"),
    v.literal("closing")
  )),
  language: v.union(
    v.literal("fr"),
    v.literal("en"),
    v.literal("it"),
    v.literal("es"),
    v.literal("de")
  ),

  // === RACC Response ===
  raccResponse: v.optional(v.object({
    reframe: v.string(),   // "Je comprends, vous avez investi dans un système."
    address: v.string(),   // "Nos clients qui migraient ont vu 30% d'accélération..."
    confirm: v.string(),   // "Est-ce que le manque de visibilité..."
    close: v.string(),     // "Si je vous montre comment FM Logistics..."
  })),

  // === Source & Extraction ===
  sourceVideoId: v.string(),
  sourceTimestamp: v.number(),  // Position in video (seconds)
  extractedAt: v.number(),
  extractionConfidence: v.number(),  // 0-1

  // === Validation ===
  status: v.union(
    v.literal("pending"),      // Awaiting validation
    v.literal("approved"),     // Validated, ready for use
    v.literal("rejected"),     // Not suitable
    v.literal("archived")      // Stale, needs review
  ),
  autoApproved: v.boolean(),  // True if confidence >= 0.85
  validatedBy: v.optional(v.id("users")),
  validatedAt: v.optional(v.number()),
  rejectionReason: v.optional(v.string()),

  // === Quality & Usage ===
  usageCount: v.number(),           // Times used in training
  effectivenessScore: v.number(),   // Based on session outcomes (0-100)
  lastUsedAt: v.optional(v.number()),

  // === Freshness ===
  freshnessReviewAt: v.number(),    // extractedAt + 12 months
  isFresh: v.boolean(),

  // === Metadata ===
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_status", ["status"])
  .index("by_category", ["category"])
  .index("by_module_lang", ["dilitrustModule", "language"])
  .index("by_module_status", ["dilitrustModule", "status"])
  .index("by_freshness", ["freshnessReviewAt", "isFresh"])
  .index("by_effectiveness", ["effectivenessScore"])
  .index("by_source_video", ["sourceVideoId"])
  .index("by_validation_pending", ["status", "extractedAt"]),
```

### 2. Winning Phrases (`winningPhrases`)

Extracted successful phrases from top performers (out of scope for V1 but schema ready).

```typescript
winningPhrases: defineTable({
  // === Content ===
  phrase: v.string(),
  context: v.string(),  // What was happening when this phrase worked
  outcome: v.string(),  // What positive reaction it triggered

  // === Classification ===
  phraseType: v.union(
    v.literal("opener"),
    v.literal("value_prop"),
    v.literal("pain_question"),
    v.literal("closing"),
    v.literal("objection_response"),
    v.literal("buying_signal_response")
  ),
  dilitrustModule: v.union(
    v.literal("clm"),
    v.literal("board"),
    v.literal("entities"),
    v.literal("litigation"),
    v.literal("doc_library")
  ),
  language: v.union(
    v.literal("fr"),
    v.literal("en"),
    v.literal("it"),
    v.literal("es"),
    v.literal("de")
  ),

  // === Source ===
  sourceVideoId: v.string(),
  sourceTimestamp: v.number(),
  dealOutcome: v.union(
    v.literal("won"),
    v.literal("lost"),
    v.literal("stalled")
  ),
  extractedAt: v.number(),
  extractionConfidence: v.number(),

  // === Validation ===
  status: v.union(
    v.literal("pending"),
    v.literal("approved"),
    v.literal("rejected")
  ),
  validatedBy: v.optional(v.id("users")),
  validatedAt: v.optional(v.number()),

  // === Usage ===
  usageCount: v.number(),
  effectivenessScore: v.number(),

  // === Metadata ===
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_type_lang", ["phraseType", "language"])
  .index("by_status", ["status"])
  .index("by_module", ["dilitrustModule"])
  .index("by_source_video", ["sourceVideoId"]),
```

### 3. Processing Jobs (`praizProcessingJobs`)

Tracks individual video processing jobs within batches.

```typescript
praizProcessingJobs: defineTable({
  // === Job Identity ===
  videoId: v.string(),  // Praiz video ID
  batchId: v.optional(v.string()),  // Links jobs in same batch

  // === Status ===
  status: v.union(
    v.literal("queued"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("skipped")  // e.g., no transcript, single speaker
  ),

  // === Video Metadata ===
  videoLanguage: v.union(
    v.literal("fr"),
    v.literal("en"),
    v.literal("it"),
    v.literal("es"),
    v.literal("de")
  ),
  dealOutcome: v.union(
    v.literal("won"),
    v.literal("lost"),
    v.literal("stalled"),
    v.literal("unknown")
  ),
  videoDurationSeconds: v.number(),
  dilitrustModule: v.optional(v.union(
    v.literal("clm"),
    v.literal("board"),
    v.literal("entities"),
    v.literal("litigation"),
    v.literal("doc_library")
  )),

  // === Processing Details ===
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  processingDurationMs: v.optional(v.number()),

  // === Results ===
  objectionsExtracted: v.number(),
  phrasesExtracted: v.number(),
  costUsd: v.optional(v.number()),

  // === Error Handling ===
  errorMessage: v.optional(v.string()),
  errorType: v.optional(v.union(
    v.literal("transient"),  // Retry
    v.literal("permanent"),  // Skip
    v.literal("fatal")       // Alert
  )),
  retryCount: v.number(),

  // === Metadata ===
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_status", ["status"])
  .index("by_video", ["videoId"])
  .index("by_batch", ["batchId"])
  .index("by_batch_status", ["batchId", "status"])
  .index("by_created", ["createdAt"]),
```

### 4. Processing Logs (`praizProcessingLogs`)

Detailed logs for debugging and audit (12-month retention).

```typescript
praizProcessingLogs: defineTable({
  jobId: v.id("praizProcessingJobs"),
  level: v.union(
    v.literal("info"),
    v.literal("warn"),
    v.literal("error")
  ),
  message: v.string(),
  data: v.optional(v.any()),  // Structured log data
  timestamp: v.number(),
  expiresAt: v.number(),  // createdAt + 12 months
})
  .index("by_job", ["jobId"])
  .index("by_job_level", ["jobId", "level"])
  .index("by_expiry", ["expiresAt"])
  .index("by_timestamp", ["timestamp"]),
```

### 5. Validation Actions (`praizValidationActions`)

Audit trail of all validation decisions.

```typescript
praizValidationActions: defineTable({
  objectionId: v.id("objectionLibrary"),
  userId: v.id("users"),  // Who performed action

  action: v.union(
    v.literal("approve"),
    v.literal("reject"),
    v.literal("edit"),
    v.literal("archive"),
    v.literal("restore")
  ),

  // === For edits ===
  previousState: v.optional(v.any()),  // Snapshot before edit
  newState: v.optional(v.any()),       // Snapshot after edit
  editedFields: v.optional(v.array(v.string())),  // ["raccResponse", "category"]

  // === For rejections ===
  rejectionReason: v.optional(v.string()),

  // === Metadata ===
  timestamp: v.number(),
})
  .index("by_objection", ["objectionId"])
  .index("by_user", ["userId"])
  .index("by_action", ["action"])
  .index("by_timestamp", ["timestamp"]),
```

### 6. Budget Tracking (`praizBudgetTracking`)

Monthly budget and rate limit tracking.

```typescript
praizBudgetTracking: defineTable({
  month: v.string(),  // "2026-01" format

  // === Budget ===
  budgetUsd: v.number(),        // Monthly budget (default 500)
  spentUsd: v.number(),         // Total spent this month
  videosProcessed: v.number(),  // Count this month

  // === Alerts ===
  alert80PercentSentAt: v.optional(v.number()),
  alert100PercentSentAt: v.optional(v.number()),
  isDisabled: v.boolean(),  // True if budget exhausted

  // === Rate Limiting ===
  currentHourVideos: v.number(),
  hourlyResetAt: v.number(),

  // === Metadata ===
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_month", ["month"]),
```

## Entity Relationships

```
┌───────────────────────┐
│   praizBudgetTracking │
│   (monthly budget)    │
└───────────────────────┘
            │ controls
            ▼
┌───────────────────────┐       ┌───────────────────────┐
│  praizProcessingJobs  │──────▶│  praizProcessingLogs  │
│  (video processing)   │ 1:N   │  (detailed logs)      │
└───────────────────────┘       └───────────────────────┘
            │ extracts
            ▼
┌───────────────────────┐       ┌───────────────────────┐
│   objectionLibrary    │──────▶│praizValidationActions │
│   (main objections)   │ 1:N   │  (audit trail)        │
└───────────────────────┘       └───────────────────────┘
            │
            ├──▶ Context Builder (Spec 005)
            │
            └──▶ AI Personas (Spec 004)

┌───────────────────────┐
│    winningPhrases     │
│  (future expansion)   │
└───────────────────────┘
```

## Index Strategy

### objectionLibrary
| Index | Use Case |
|-------|----------|
| `by_slug` | Unique lookup by slug |
| `by_status` | Filter by validation status |
| `by_category` | Filter by objection category |
| `by_module_lang` | Context Builder queries (module + language) |
| `by_module_status` | Admin filtering (module + approved) |
| `by_freshness` | Scheduled freshness review |
| `by_effectiveness` | Sort by effectiveness for injection |
| `by_source_video` | Deduplicate from same video |
| `by_validation_pending` | Validation queue sorting |

### praizProcessingJobs
| Index | Use Case |
|-------|----------|
| `by_status` | Queue management |
| `by_video` | Deduplicate video processing |
| `by_batch` | Batch progress tracking |
| `by_batch_status` | Batch statistics |
| `by_created` | Processing history |

### praizProcessingLogs
| Index | Use Case |
|-------|----------|
| `by_job` | Job detail view |
| `by_job_level` | Error filtering |
| `by_expiry` | Scheduled cleanup |
| `by_timestamp` | Log timeline |

### praizValidationActions
| Index | Use Case |
|-------|----------|
| `by_objection` | Objection history |
| `by_user` | User audit trail |
| `by_action` | Action statistics |
| `by_timestamp` | Recent actions |

### praizBudgetTracking
| Index | Use Case |
|-------|----------|
| `by_month` | Current month lookup |

## Data Retention Policy

| Table | Retention | Cleanup Method |
|-------|-----------|----------------|
| `objectionLibrary` | Indefinite | Manual archive after 12+ months stale |
| `winningPhrases` | Indefinite | Manual archive |
| `praizProcessingJobs` | 12 months | Scheduled deletion |
| `praizProcessingLogs` | 12 months | `expiresAt` index + scheduled job |
| `praizValidationActions` | Indefinite | Audit compliance |
| `praizBudgetTracking` | 24 months | Historical reporting |

## Migration Notes

1. **No breaking changes**: All tables are new additions
2. **Indexes created with tables**: No separate migration needed
3. **Default values**: Jobs initialize with `retryCount: 0`, `objectionsExtracted: 0`
4. **Budget initialization**: First processing creates current month record

## Schema Validation Rules

1. **Confidence bounds**: `extractionConfidence` must be 0.0-1.0
2. **Effectiveness bounds**: `effectivenessScore` must be 0-100
3. **Slug uniqueness**: `by_slug` index enforces unique slugs
4. **Video uniqueness**: Check `by_video` before queueing
5. **RACC completeness**: All 4 fields required when editing response
