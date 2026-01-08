# Data Model: Real-Time Voice Pipeline

**Feature**: 005-voice-pipeline
**Date**: 2026-01-08
**Status**: Draft

## Overview

This document defines the database schema additions for the voice pipeline feature. All tables follow Convex conventions and integrate with existing Spec 004 session infrastructure.

## Entity Relationship Diagram

```
trainingSessions (Spec 004)
    │
    ├──────────────────────────────────────────────┐
    │                                              │
    ▼                                              ▼
sessionTranscripts                           voiceMetrics
    │ (1:N - many turns per session)              │ (1:1 per session)
    │                                              │
    └──► emotionalState per turn                   └──► cost tracking
                                                       latency tracking

guardrailViolationCorpus                     guardrailViolations
    │ (global pattern library)                    │ (log per violation)
    │                                              │
    └──► seed + promoted patterns                  └──► links to session
```

## New Tables

### 1. sessionTranscripts

Stores conversation turns with transcripts, responses, and emotional state.

```typescript
// convex/schema.ts addition

sessionTranscripts: defineTable({
  // Reference
  sessionId: v.id("trainingSessions"),  // From Spec 004

  // Turn identification
  turnNumber: v.number(),               // 1, 2, 3... sequential

  // User side
  userTranscript: v.string(),           // Final STT result
  userTranscriptInterim: v.optional(v.array(v.string())),  // Interim results for debugging
  userConfidence: v.optional(v.number()),  // STT confidence 0-1
  userSpeakingDuration: v.number(),     // Milliseconds

  // AI side
  aiResponse: v.string(),               // LLM response text
  aiAudioDuration: v.optional(v.number()),  // TTS audio milliseconds

  // Emotional state (M3)
  emotionalStateBefore: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),
  emotionalStateAfter: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),

  // Guardrail results
  guardrailTriggered: v.boolean(),
  guardrailLayer: v.optional(v.union(
    v.literal("pattern"),
    v.literal("embedding"),
    v.literal("llm")
  )),
  guardrailViolationId: v.optional(v.id("guardrailViolations")),

  // Latency metrics
  sttLatency: v.number(),               // Milliseconds
  guardrailLatency: v.number(),         // Milliseconds
  llmLatency: v.number(),               // Time to first token, milliseconds
  ttsLatency: v.number(),               // Time to first audio, milliseconds
  totalLatency: v.number(),             // End-to-end, milliseconds

  // Barge-in
  wasInterrupted: v.boolean(),          // User interrupted AI mid-response
  interruptedAtMs: v.optional(v.number()),  // When interrupt occurred

  // Timestamps
  startedAt: v.number(),                // Turn start (user began speaking)
  completedAt: v.number(),              // Turn complete (AI finished responding)
})
  .index("by_session", ["sessionId"])
  .index("by_session_turn", ["sessionId", "turnNumber"])
  .index("by_guardrail", ["guardrailTriggered"])
  .index("by_emotional_state", ["emotionalStateAfter"]),
```

### 2. guardrailViolations

Logs all guardrail activations for audit and corpus growth.

```typescript
guardrailViolations: defineTable({
  // Reference
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  organizationId: v.optional(v.string()),  // For multi-org analytics

  // Detection
  layer: v.union(
    v.literal("pattern"),       // Layer 1: Pattern matching
    v.literal("embedding"),     // Layer 2: Embedding similarity
    v.literal("llm")           // Layer 3: LLM judgment
  ),

  // Violation details
  category: v.union(
    v.literal("prompt_injection"),
    v.literal("jailbreak"),
    v.literal("language_switch"),
    v.literal("character_break"),
    v.literal("other")
  ),
  inputText: v.string(),                 // The user input that triggered
  matchedPattern: v.optional(v.string()), // For layer 1: regex that matched
  similarityScore: v.optional(v.number()), // For layer 2: similarity score
  llmReason: v.optional(v.string()),      // For layer 3: LLM explanation

  // Action taken
  blocked: v.boolean(),                  // Was the input blocked?
  action: v.union(
    v.literal("blocked"),       // Input rejected, asked to rephrase
    v.literal("flagged"),       // Allowed but flagged for review
    v.literal("warning")        // Layer 3 soft warning, allowed
  ),

  // Latency
  detectionLatency: v.number(),          // Milliseconds

  // Corpus promotion
  promotedToCorpus: v.boolean(),
  promotedAt: v.optional(v.number()),
  promotedBy: v.optional(v.id("users")),  // Admin who promoted

  // Timestamp
  timestamp: v.number(),
})
  .index("by_session", ["sessionId"])
  .index("by_user", ["userId"])
  .index("by_category", ["category"])
  .index("by_layer", ["layer"])
  .index("by_blocked", ["blocked"])
  .index("by_unpromoted", ["promotedToCorpus"])
  .index("by_timestamp", ["timestamp"]),
```

### 3. guardrailViolationCorpus

Pattern library for embedding similarity guardrail (Layer 2).

```typescript
guardrailViolationCorpus: defineTable({
  // Pattern
  patternText: v.string(),               // The text pattern
  patternHash: v.string(),               // SHA256 for deduplication

  // Classification
  category: v.union(
    v.literal("prompt_injection"),
    v.literal("jailbreak"),
    v.literal("language_switch"),
    v.literal("character_break"),
    v.literal("other")
  ),
  language: v.optional(v.union(
    v.literal("fr"),
    v.literal("en"),
    v.literal("it"),
    v.literal("de"),
    v.literal("es"),
    v.literal("any")           // Language-agnostic pattern
  )),

  // Embedding
  embedding: v.array(v.number()),        // text-embedding-3-small vector

  // Source
  source: v.union(
    v.literal("seed"),          // Initial curated set
    v.literal("promoted")       // Promoted from violation log
  ),
  sourceViolationId: v.optional(v.id("guardrailViolations")),

  // Metadata
  effectiveness: v.optional(v.number()), // 0-1 hit rate when used
  lastMatchedAt: v.optional(v.number()), // For decay analysis
  matchCount: v.number(),                // Times this pattern matched

  // Management
  isActive: v.boolean(),                 // Can be deactivated
  addedBy: v.optional(v.id("users")),    // Admin who added/promoted
  addedAt: v.number(),
  deactivatedAt: v.optional(v.number()),
  deactivatedBy: v.optional(v.id("users")),
  deactivationReason: v.optional(v.string()),
})
  .index("by_category", ["category"])
  .index("by_language", ["language"])
  .index("by_source", ["source"])
  .index("by_active", ["isActive"])
  .index("by_hash", ["patternHash"])
  .index("by_effectiveness", ["effectiveness"]),
```

### 4. voiceMetrics

Per-session aggregated metrics for cost control and performance monitoring.

```typescript
voiceMetrics: defineTable({
  // Reference
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  organizationId: v.optional(v.string()),

  // Session summary
  totalTurns: v.number(),
  sessionDuration: v.number(),           // Total milliseconds

  // Latency metrics (aggregated)
  avgLatency: v.number(),                // Average end-to-end
  p50Latency: v.number(),                // Median
  p95Latency: v.number(),                // 95th percentile
  maxLatency: v.number(),                // Maximum
  latencyBudgetExceeded: v.number(),     // Turns > 800ms

  // Component latencies (averages)
  avgSttLatency: v.number(),
  avgGuardrailLatency: v.number(),
  avgLlmLatency: v.number(),
  avgTtsLatency: v.number(),

  // Cost tracking (in cents)
  sttCostCents: v.number(),              // Deepgram
  llmInputTokens: v.number(),            // Claude input tokens
  llmOutputTokens: v.number(),           // Claude output tokens
  llmCostCents: v.number(),              // Claude total
  ttsCostCents: v.number(),              // Cartesia
  avatarCostCents: v.optional(v.number()), // Simli/D-ID if used
  totalCostCents: v.number(),            // Sum

  // Budget tracking
  budgetTargetCents: v.number(),         // $0.50 = 50 cents
  budgetExceeded: v.boolean(),
  budgetAlertSentAt: v.optional(v.number()),

  // Guardrail stats
  guardrailTriggeredCount: v.number(),
  guardrailBlockedCount: v.number(),

  // Emotional journey
  startingEmotionalState: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),
  endingEmotionalState: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),
  emotionalImprovement: v.boolean(),     // Did state improve?

  // Barge-in stats
  bargeInCount: v.number(),              // Times user interrupted

  // Failures
  sttFailures: v.number(),
  ttsFailures: v.number(),
  avatarFailures: v.number(),
  recoveredFromFailure: v.boolean(),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_session", ["sessionId"])
  .index("by_user", ["userId"])
  .index("by_organization", ["organizationId"])
  .index("by_budget_exceeded", ["budgetExceeded"])
  .index("by_created", ["createdAt"]),
```

## Indexes Summary

### sessionTranscripts
| Index | Purpose |
|-------|---------|
| by_session | Get all turns for a session |
| by_session_turn | Get specific turn by number |
| by_guardrail | Find turns with guardrail triggers |
| by_emotional_state | Analytics on emotional outcomes |

### guardrailViolations
| Index | Purpose |
|-------|---------|
| by_session | Get violations for a session |
| by_user | Find violations by user (repeat offenders) |
| by_category | Analytics on violation types |
| by_layer | Analytics on detection layer effectiveness |
| by_blocked | Audit blocked inputs |
| by_unpromoted | Find candidates for corpus promotion |
| by_timestamp | Chronological audit trail |

### guardrailViolationCorpus
| Index | Purpose |
|-------|---------|
| by_category | Filter corpus by type |
| by_language | Language-specific patterns |
| by_source | Seed vs promoted patterns |
| by_active | Only active patterns |
| by_hash | Deduplication check |
| by_effectiveness | Find low-performing patterns |

### voiceMetrics
| Index | Purpose |
|-------|---------|
| by_session | Get metrics for session |
| by_user | User cost tracking |
| by_organization | Org cost tracking |
| by_budget_exceeded | Find over-budget sessions |
| by_created | Time-based reporting |

## Validation Rules

### sessionTranscripts
- `turnNumber` must be positive integer, sequential within session
- `userSpeakingDuration` must be positive
- `emotionalStateBefore` of turn N must equal `emotionalStateAfter` of turn N-1
- `sttLatency + guardrailLatency + llmLatency + ttsLatency <= totalLatency`
- If `guardrailTriggered` is true, `guardrailLayer` must be set

### guardrailViolations
- `inputText` max length 2000 characters
- If `layer` is "pattern", `matchedPattern` must be set
- If `layer` is "embedding", `similarityScore` must be set
- If `layer` is "llm", `llmReason` must be set
- `detectionLatency` must match layer expectations (<1ms, <10ms, <50ms)

### guardrailViolationCorpus
- `patternText` max length 500 characters
- `embedding` must have correct dimensions (1536 for text-embedding-3-small)
- `patternHash` must be unique
- If `source` is "promoted", `sourceViolationId` must be set

### voiceMetrics
- All cost values must be non-negative
- `totalCostCents` must equal sum of component costs
- `p50Latency <= avgLatency <= p95Latency <= maxLatency`
- `guardrailBlockedCount <= guardrailTriggeredCount`

## Relationships

### With Spec 004 Tables

```typescript
// sessionTranscripts.sessionId → trainingSessions._id
// Training session must exist before transcripts can be created

// guardrailViolations.sessionId → trainingSessions._id
// guardrailViolations.userId → users._id

// voiceMetrics.sessionId → trainingSessions._id (1:1)
// voiceMetrics.userId → users._id
```

### Internal Relationships

```typescript
// sessionTranscripts.guardrailViolationId → guardrailViolations._id (optional)
// Links specific turn to its violation record

// guardrailViolationCorpus.sourceViolationId → guardrailViolations._id (optional)
// Links promoted pattern to original violation
```

## Data Retention

Per Constitution Article XIV and Spec clarifications:

| Table | Retention | Notes |
|-------|-----------|-------|
| sessionTranscripts | 2 years | Deleted with session |
| guardrailViolations | 2 years | Audit trail |
| guardrailViolationCorpus | Permanent | Pattern library |
| voiceMetrics | 2 years | Deleted with session |

## Migration Notes

1. No data migration needed - new tables only
2. Foreign key to `trainingSessions` requires Spec 004 deployment first
3. Seed data for `guardrailViolationCorpus` loaded separately (~100 patterns)
4. Indexes should be created before production traffic
