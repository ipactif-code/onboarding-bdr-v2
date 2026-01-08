# Data Model: Real-Time Coaching Modules (M2, M4, M6)

**Feature**: 007-realtime-coaching
**Date**: 2026-01-08
**Status**: Complete

## Entity Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Real-Time Coaching Data Model                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐                                                   │
│  │  trainingSessions    │ (from Spec 004 - extended)                        │
│  │                      │                                                    │
│  │  + whisperSettings   │ ◄─────────────────────────────────────┐           │
│  │  + voiceAnalysisOn   │                                       │           │
│  └──────────┬───────────┘                                       │           │
│             │                                                   │           │
│             │ 1:N                                               │           │
│             ▼                                                   │           │
│  ┌──────────────────────┐     ┌──────────────────────┐         │           │
│  │   whisperEvents      │     │  branchDecisions     │         │           │
│  │                      │     │                      │         │           │
│  │  M2: coaching hints  │     │  M4: scenario paths  │         │           │
│  │  + latency tracking  │     │  + branch outcomes   │         │           │
│  └──────────────────────┘     └──────────┬───────────┘         │           │
│                                          │                      │           │
│                                          │ 1:N                  │           │
│                                          ▼                      │           │
│  ┌──────────────────────┐     ┌──────────────────────┐         │           │
│  │   voiceMetrics       │     │ whatIfExplorations   │         │           │
│  │                      │     │                      │         │           │
│  │  M6: client-side     │     │  M4: post-session    │         │           │
│  │  analysis snapshots  │     │  replay alternatives │         │           │
│  └──────────────────────┘     └──────────────────────┘         │           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Existing Tables (Extensions)

### 1. `trainingSessions` (Extended from Spec 004/006)

Add M2/M6 configuration fields to the existing trainingSessions table.

```typescript
// NEW FIELDS to add to trainingSessions in schema.ts
trainingSessions: defineTable({
  // ... existing fields from Spec 004 and 006 ...

  // M2: Whisper Configuration
  whispersEnabled: v.optional(v.boolean()), // Default: true for practice, false for evaluation
  whisperLanguage: v.optional(v.union(
    v.literal("fr"),
    v.literal("en"),
    v.literal("it"),
    v.literal("de"),
    v.literal("es")
  )),
  whisperCooldownOverride: v.optional(v.number()), // Optional custom global cooldown

  // M6: Voice Analysis Configuration
  voiceAnalysisEnabled: v.optional(v.boolean()), // Default: true
  voiceFeedbackVisible: v.optional(v.boolean()), // Pace indicator visibility

  // Aggregated metrics for session summary
  totalWhispersShown: v.optional(v.number()),
  totalBranchDecisions: v.optional(v.number()),
  whatIfExplorationsUsed: v.optional(v.number()),
})
// ... existing indexes ...
```

---

## New Tables

### 2. `whisperEvents`

Tracks all whisper events for analytics, debugging, and observability (OBS-001, OBS-002).

```typescript
whisperEvents: defineTable({
  // References
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),

  // Event data
  timestamp: v.number(),
  ruleId: v.union(
    v.literal("talk_ratio_high"),
    v.literal("spin_stuck_situation"),
    v.literal("spin_missing_implication"),
    v.literal("objection_detected"),
    v.literal("competitor_mentioned"),
    v.literal("buying_signal"),
    v.literal("voice_confidence_low"),
    v.literal("speaking_too_fast"),
    v.literal("excellent_spin"),
    v.literal("racc_missing_reframe"),
    v.literal("racc_missing_confirm"),
    v.literal("silence_too_long"),
    v.literal("price_mentioned_early"),
    v.literal("no_discovery_questions"),
    v.literal("meeting_not_proposed")
  ),

  // Whisper content
  messageLanguage: v.union(
    v.literal("fr"),
    v.literal("en"),
    v.literal("it"),
    v.literal("de"),
    v.literal("es")
  ),
  messageContent: v.string(), // Localized message that was displayed

  // Priority & cooldown
  priority: v.union(
    v.literal("racc"),
    v.literal("normal"),
    v.literal("positive")
  ),
  ruleCooldownMs: v.number(), // Rule-specific cooldown applied

  // Performance metrics (OBS-001)
  triggerToDisplayLatencyMs: v.number(), // Time from condition met to display

  // Context at trigger time
  triggerContext: v.optional(v.object({
    talkRatio: v.optional(v.number()),
    spinProgression: v.optional(v.number()),
    confidenceScore: v.optional(v.number()),
    paceWpm: v.optional(v.number()),
    silenceDurationMs: v.optional(v.number()),
  })),

  // Suppression tracking (for analytics)
  wasSuperseded: v.boolean(), // True if a higher priority whisper was shown instead
  supersededBy: v.optional(v.string()), // Rule ID that took priority
})
.index("by_session", ["sessionId"])
.index("by_session_timestamp", ["sessionId", "timestamp"])
.index("by_user", ["userId"])
.index("by_rule", ["ruleId"])
.index("by_rule_timestamp", ["ruleId", "timestamp"])
.index("by_priority", ["priority"])
```

### 3. `branchDecisions`

Tracks M4 scenario branching decisions during conversations.

```typescript
branchDecisions: defineTable({
  // References
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),

  // Event data
  timestamp: v.number(),
  turnNumber: v.number(), // Which conversation turn

  // Branch context
  decisionPointId: v.string(), // Unique ID for this decision point (e.g., "objection_1")
  triggerType: v.union(
    v.literal("objection_handled"),
    v.literal("buying_signal_response"),
    v.literal("discovery_depth"),
    v.literal("value_proposition"),
    v.literal("closing_attempt")
  ),

  // Transcript context (for What-If replay)
  transcriptBefore: v.string(), // Last 2-3 exchanges before decision
  bdrResponse: v.string(), // BDR's response at decision point

  // Branch outcome
  branchType: v.union(
    v.literal("positive"),   // Opportunity opens
    v.literal("negative"),   // Door closes
    v.literal("neutral")     // Default path
  ),
  branchOutcome: v.string(), // Brief description of what happened

  // Prospect behavior change
  prospectBehaviorShift: v.optional(v.object({
    previousState: v.string(), // From M3 emotional state
    newState: v.string(),
    openessChange: v.number(), // -1 to +1 scale
  })),

  // Logging metrics (SC-006: 90% within 100ms)
  loggingLatencyMs: v.number(),
})
.index("by_session", ["sessionId"])
.index("by_session_turn", ["sessionId", "turnNumber"])
.index("by_user", ["userId"])
.index("by_trigger_type", ["triggerType"])
.index("by_branch_type", ["branchType"])
.index("by_timestamp", ["timestamp"])
```

### 4. `whatIfExplorations`

Tracks M4 What-If post-session replay explorations.

```typescript
whatIfExplorations: defineTable({
  // References
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  branchDecisionId: v.id("branchDecisions"), // Which decision point

  // Event data
  exploredAt: v.number(),
  explorationNumber: v.number(), // 1, 2, or 3 (max 3 per session)

  // User's alternative input
  alternativeResponse: v.string(),

  // AI-generated alternative outcome
  aiAlternativeReply: v.string(),
  aiAlternativeBranchType: v.union(
    v.literal("positive"),
    v.literal("negative"),
    v.literal("neutral")
  ),

  // Context for AI generation
  personaId: v.id("aiTrainerPersonas"), // To maintain persona consistency
  originalContext: v.string(), // Transcript context used for generation

  // Quality tracking (SC-004: 85% persona consistency)
  // This is captured via user feedback survey, stored separately
})
.index("by_session", ["sessionId"])
.index("by_user", ["userId"])
.index("by_branch_decision", ["branchDecisionId"])
.index("by_explored_at", ["exploredAt"])
```

### 5. `voiceMetrics`

Captures M6 voice sentiment analysis snapshots every 5 seconds.

```typescript
voiceMetrics: defineTable({
  // References
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),

  // Timing
  timestamp: v.number(),
  sessionElapsedMs: v.number(),

  // Voice metrics (FR-023)
  confidence: v.number(), // 0-1 scale
  paceWpm: v.number(), // Words per minute
  energy: v.number(), // 0-1 scale
  hesitationRate: v.number(), // 0-1 scale (percentage)

  // Derived indicators
  paceStatus: v.union(
    v.literal("too_slow"),
    v.literal("good"),
    v.literal("too_fast")
  ),

  // Filler word detection (for hesitation calculation)
  fillerWordsDetected: v.optional(v.number()),

  // Processing performance (OBS-003)
  processingTimeMs: v.number(),
})
.index("by_session", ["sessionId"])
.index("by_session_timestamp", ["sessionId", "timestamp"])
.index("by_user", ["userId"])
.index("by_timestamp", ["timestamp"])
```

### 6. `sessionVoiceSummary`

Aggregated voice metrics for post-session review (FR-029).

```typescript
sessionVoiceSummary: defineTable({
  // Reference
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),

  // Aggregated metrics
  averageConfidence: v.number(),
  averagePaceWpm: v.number(),
  averageEnergy: v.number(),
  averageHesitationRate: v.number(),

  // Distribution metrics
  confidenceMin: v.number(),
  confidenceMax: v.number(),
  paceMin: v.number(),
  paceMax: v.number(),

  // Time in each pace status
  timeInGoodPaceMs: v.number(),
  timeInTooFastMs: v.number(),
  timeInTooSlowMs: v.number(),

  // Total speaking time analyzed
  totalSpeakingTimeMs: v.number(),
  sampleCount: v.number(),

  // Timeline data for visualization (compressed)
  // Array of {timestamp, confidence, pace, energy} at 30s intervals
  timelineData: v.array(v.object({
    timestamp: v.number(),
    confidence: v.number(),
    paceWpm: v.number(),
    energy: v.number(),
  })),

  // Computed at session end
  computedAt: v.number(),
})
.index("by_session", ["sessionId"])
.index("by_user", ["userId"])
```

### 7. `whisperRules` (Configuration Table)

Static configuration for the 15 whisper rules.

```typescript
whisperRules: defineTable({
  // Identity
  ruleId: v.string(), // e.g., "talk_ratio_high"

  // Trigger configuration
  triggerCondition: v.object({
    metricType: v.string(), // e.g., "talk_ratio", "spin_progression", "voice_confidence"
    operator: v.union(
      v.literal("gt"),      // Greater than
      v.literal("lt"),      // Less than
      v.literal("eq"),      // Equal
      v.literal("gte"),     // Greater than or equal
      v.literal("lte"),     // Less than or equal
      v.literal("between")  // Range
    ),
    threshold: v.number(),
    thresholdMax: v.optional(v.number()), // For "between" operator
    sustainedDurationMs: v.optional(v.number()), // How long condition must persist
  }),

  // Cooldown
  cooldownMs: v.number(),

  // Priority
  priority: v.union(
    v.literal("racc"),
    v.literal("normal"),
    v.literal("positive")
  ),
  priorityScore: v.number(), // Numeric for comparison (100 = highest)

  // Messages (5 languages)
  messages: v.object({
    fr: v.string(),
    en: v.string(),
    it: v.string(),
    de: v.string(),
    es: v.string(),
  }),

  // Display configuration
  displayDurationMs: v.number(), // Default: 5000

  // State
  isActive: v.boolean(),
})
.index("by_rule_id", ["ruleId"])
.index("by_priority", ["priority"])
.index("by_active", ["isActive"])
```

---

## Validation Rules

### M2: Whisper System

1. **Rate limiting**: Maximum 4 whispers per 60-second rolling window
2. **Global cooldown**: Minimum 15 seconds between any two whispers
3. **Rule cooldown**: Each rule has individual cooldown (45s-300s)
4. **Priority order**: RACC > Normal (corrective) > Positive reinforcement
5. **Display duration**: All whispers display for 5 seconds then fade
6. **Mode restriction**: Whispers disabled in evaluation mode

### M4: Scenario Branching

1. **Decision limit**: Maximum 5 branch decisions per session
2. **Logging latency**: Branch decisions must be logged within 100ms
3. **What-If limit**: Maximum 3 What-If explorations per completed session
4. **Session state**: What-If only available for completed sessions

### M6: Voice Analysis

1. **Update interval**: Metrics captured every 5 seconds during active speech
2. **Privacy**: Raw audio never leaves browser; only numeric metrics sent
3. **Pace thresholds**: Too fast > 180 WPM, Too slow < 100 WPM
4. **Confidence threshold**: Low confidence < 0.35
5. **Mode restriction**: Voice feedback indicator hidden in evaluation mode

---

## Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| whisperEvents | by_session | Get all whispers for a session |
| whisperEvents | by_rule | Analytics: trigger rates by rule |
| whisperEvents | by_rule_timestamp | Time-series analysis per rule |
| branchDecisions | by_session | Get all decisions for a session |
| branchDecisions | by_session_turn | Ordered decision history |
| branchDecisions | by_branch_type | Analytics: positive/negative outcomes |
| whatIfExplorations | by_session | Get all explorations for a session |
| whatIfExplorations | by_branch_decision | Link exploration to decision point |
| voiceMetrics | by_session | Get all voice data for a session |
| voiceMetrics | by_session_timestamp | Time-ordered voice data |
| sessionVoiceSummary | by_session | Get summary for a session |
| whisperRules | by_rule_id | Lookup rule configuration |

---

## Data Flow

### Session Start

```
1. Create/update trainingSession
   - Set whispersEnabled = mode === "practice"
   - Set whisperLanguage from session config
   - Set voiceAnalysisEnabled = true (default)
   - Set voiceFeedbackVisible = mode === "practice"
2. Initialize whisper cooldown state (client-side)
3. Start Web Audio API voice analysis (if enabled)
```

### Per-Turn Whisper Evaluation (100ms budget)

```
1. Receive metrics from M1/M3/M6 + transcript analysis
2. Evaluate all 15 whisper rules in parallel:
   a. Check if condition is met
   b. Check rule-specific cooldown
   c. Check global cooldown (15s)
   d. Check rate limit (4 per minute)
3. If multiple whispers triggered:
   a. Sort by priority (RACC > Normal > Positive)
   b. For same priority, sort by priority score
   c. Select highest priority whisper
4. If whisper selected:
   a. Send to client for display
   b. Create whisperEvent record
   c. Update cooldown states
```

### Voice Analysis Flow (5-second intervals)

```
1. Web Audio API captures audio chunk (client-side)
2. Client-side analysis:
   a. Calculate pace (WPM) from transcript timing
   b. Calculate confidence from volume/pitch variance
   c. Calculate energy from amplitude
   d. Detect filler words for hesitation
3. Send only numeric metrics to backend
4. Create voiceMetrics record
5. Feed to whisper trigger evaluation (confidence, pace)
6. Update client-side pace indicator
```

### Branch Decision Detection

```
1. Transcript analysis detects decision point:
   - Objection handling response
   - Buying signal response
   - Discovery question depth
   - Value proposition delivery
   - Closing attempt
2. Evaluate BDR response quality
3. Determine branch type (positive/negative/neutral)
4. Create branchDecision record (within 100ms)
5. Pass branch outcome to M3 for emotional state influence
6. Update Context Builder for next AI response
```

### Session End

```
1. Stop voice analysis
2. Aggregate voice metrics:
   a. Calculate averages
   b. Generate timeline data (30s intervals)
   c. Create sessionVoiceSummary record
3. Update session:
   a. totalWhispersShown = count(whisperEvents)
   b. totalBranchDecisions = count(branchDecisions)
4. Enable What-If replay (session complete)
```

### What-If Replay Flow

```
1. User selects decision point from session review
2. User enters alternative response
3. Generate AI alternative reply:
   a. Load original persona + context
   b. Generate response consistent with persona
   c. Determine alternative branch type
4. Create whatIfExploration record
5. Increment whatIfExplorationsUsed
6. Check limit (max 3): if reached, disable feature
```

---

## Migration Notes

1. **Schema extension**: Add new fields to `trainingSessions`
2. **New tables**: Create all 7 new tables
3. **Seed data**: Populate `whisperRules` with 15 rule configurations
4. **No data migration**: New fields are optional, existing sessions unaffected
5. **Backward compatibility**: Old sessions without M2/M4/M6 fields work normally

---

## Storage Estimates

| Table | Events/Session | Size/Event | Sessions/Month | Monthly Storage |
|-------|---------------|------------|----------------|-----------------|
| whisperEvents | ~10-20 | ~600 bytes | 10,000 | ~120 MB |
| branchDecisions | ~3-5 | ~1 KB | 10,000 | ~50 MB |
| whatIfExplorations | ~1-2 | ~2 KB | 5,000 | ~20 MB |
| voiceMetrics | ~100-200 | ~200 bytes | 10,000 | ~400 MB |
| sessionVoiceSummary | 1 | ~2 KB | 10,000 | ~20 MB |
| whisperRules | 15 (static) | ~500 bytes | N/A | ~8 KB |

**Total**: ~600 MB/month additional storage (within Convex limits)

---

## Retention Policy

- **whisperEvents**: Retained with session data (2-3 years per clarification)
- **branchDecisions**: Retained with session data (2-3 years)
- **whatIfExplorations**: Retained with session data (2-3 years)
- **voiceMetrics**: 90 days (raw data), then aggregated into sessionVoiceSummary
- **sessionVoiceSummary**: Retained with session data (2-3 years)
- **whisperRules**: Permanent (configuration data)
