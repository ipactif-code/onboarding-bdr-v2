# Data Model: Adaptive Behavior Modules (M1 & M3)

**Feature**: 006-adaptive-behavior
**Date**: 2026-01-08
**Status**: Complete

## Entity Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Adaptive Behavior Data Model                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐                                                   │
│  │  trainingSessions    │ (from Spec 004 - extended)                        │
│  │                      │                                                    │
│  │  + currentDifficulty │ ◄─────────────────────────────────────┐           │
│  │  + emotionalState    │                                       │           │
│  │  + lastDifficultyAdj │                                       │           │
│  │  + stateTransitions  │                                       │           │
│  └──────────┬───────────┘                                       │           │
│             │                                                   │           │
│             │ 1:N                                               │           │
│             ▼                                                   │           │
│  ┌──────────────────────┐     ┌──────────────────────┐         │           │
│  │ m1DifficultyEvents   │     │ m3EmotionalEvents    │         │           │
│  │                      │     │                      │         │           │
│  │  difficulty changes  │     │  state transitions   │         │           │
│  │  with metrics        │     │  with triggers       │         │           │
│  └──────────────────────┘     └──────────────────────┘         │           │
│                                                                 │           │
│  ┌──────────────────────┐     ┌──────────────────────┐         │           │
│  │ performanceSnapshots │     │  aiTrainerPersonas   │─────────┘           │
│  │                      │     │  (from Spec 004)     │                     │
│  │  real-time metrics   │     │                      │                     │
│  │  every 30 seconds    │     │  + difficultyBounds  │                     │
│  └──────────────────────┘     │  + emotionalConfig   │                     │
│                               └──────────────────────┘                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Existing Tables (Extensions)

### 1. `trainingSessions` (Extended from Spec 004)

Add M1/M3 state tracking fields to the existing trainingSessions table.

```typescript
// NEW FIELDS to add to trainingSessions in schema.ts
trainingSessions: defineTable({
  // ... existing fields from Spec 004 ...

  // M1: Difficulty State
  currentDifficulty: v.optional(v.number()), // 0.1-0.95 scale, null before start
  lastDifficultyAdjustmentAt: v.optional(v.number()), // Timestamp for cooldown
  difficultyAdjustmentCount: v.optional(v.number()), // Total adjustments in session

  // M3: Emotional State
  currentEmotionalState: v.optional(v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  )),
  emotionalStateTransitionCount: v.optional(v.number()), // Total transitions
  lastStateTransitionAt: v.optional(v.number()), // For rate limiting
  turnsSinceStateChange: v.optional(v.number()), // For frustrated warning

  // M3: Frustrated handling
  frustratedWarningGivenAt: v.optional(v.number()), // When warning was given
  turnsInFrustrated: v.optional(v.number()), // Turns spent in frustrated state

  // Session outcome extension
  endedBy: v.optional(v.union(
    v.literal("user"),
    v.literal("timeout"),
    v.literal("prospect") // NEW: AI prospect ended the call
  )),
})
// ... existing indexes ...
```

### 2. `aiTrainerPersonas` (Extended from Spec 004)

Add M1/M3 configuration fields to persona definitions.

```typescript
// NEW FIELDS to add to aiTrainerPersonas
aiTrainerPersonas: defineTable({
  // ... existing fields from Spec 004 ...

  // M1: Difficulty bounds for this persona
  difficultyMin: v.number(), // e.g., 0.3 for easy personas
  difficultyMax: v.number(), // e.g., 0.85 for hard personas
  difficultyDefault: v.number(), // Starting difficulty

  // M3: Emotional configuration
  defaultEmotionalState: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),

  // M3: Persona-specific transition modifiers (JSON)
  // Keys are emotional states, values are multipliers (1.0 = normal)
  emotionalModifiers: v.optional(v.any()),
})
```

**Persona Configurations (Seed Data Updates)**:

| identifier | difficultyMin | difficultyMax | difficultyDefault | defaultEmotionalState |
|------------|---------------|---------------|-------------------|-----------------------|
| marc_dubois | 0.35 | 0.75 | 0.50 | neutral |
| sophie_martin | 0.25 | 0.60 | 0.35 | neutral |
| jean_pierre_blanc | 0.25 | 0.55 | 0.30 | neutral |
| marie_claire_durand | 0.40 | 0.70 | 0.50 | neutral |
| philippe_renault | 0.55 | 0.90 | 0.70 | skeptical |
| isabelle_moreau | 0.50 | 0.85 | 0.65 | skeptical |
| antoine_lefebvre | 0.50 | 0.80 | 0.60 | neutral |
| ceo_persona | 0.70 | 0.95 | 0.80 | skeptical |

---

## New Tables

### 3. `m1DifficultyEvents`

Tracks all difficulty adjustment events for analytics and debugging.

```typescript
m1DifficultyEvents: defineTable({
  // References
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),

  // Event data
  timestamp: v.number(),
  previousDifficulty: v.number(),
  newDifficulty: v.number(),
  adjustmentReason: v.union(
    v.literal("sustained_high"),    // Performance > 70 for 2+ min
    v.literal("sustained_low"),     // Performance < 55 for 2+ min
    v.literal("session_start"),     // Initial difficulty from persona
    v.literal("manual_override")    // Admin/debug adjustment
  ),

  // Performance metrics at time of adjustment
  compositeScore: v.number(), // 0-100
  metricsSnapshot: v.object({
    spinQuality: v.number(),
    objectionHandling: v.number(),
    talkRatio: v.number(),
    responseTiming: v.number(),
    questionDepth: v.number(),
    valueArticulation: v.number(),
    closingSignals: v.number(),
  }),

  // Context
  sustainedDurationMs: v.number(), // How long performance was sustained
  personaDifficultyBounds: v.object({
    min: v.number(),
    max: v.number(),
  }),
})
.index("by_session", ["sessionId"])
.index("by_user", ["userId"])
.index("by_timestamp", ["timestamp"])
.index("by_reason", ["adjustmentReason"])
```

### 4. `m3EmotionalEvents`

Tracks all emotional state transitions for analytics and debugging.

```typescript
m3EmotionalEvents: defineTable({
  // References
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),

  // Event data
  timestamp: v.number(),
  previousState: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),
  newState: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),

  // Trigger information
  triggerAction: v.string(), // e.g., "good_spin_question", "premature_pitch"
  triggerQuality: v.number(), // 0-100 quality score
  transitionProbability: v.number(), // The probability that was rolled

  // Rate limiting context
  transitionsInLastMinute: v.number(),
  turnNumber: v.number(), // Which turn in the conversation

  // Special flags
  isWarning: v.optional(v.boolean()), // True if frustrated warning given
  isCallTermination: v.optional(v.boolean()), // True if prospect ends call
})
.index("by_session", ["sessionId"])
.index("by_user", ["userId"])
.index("by_timestamp", ["timestamp"])
.index("by_new_state", ["newState"])
.index("by_trigger", ["triggerAction"])
```

### 5. `performanceSnapshots`

Captures real-time performance metrics every 30 seconds (per FR-002).

```typescript
performanceSnapshots: defineTable({
  // References
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),

  // Timing
  timestamp: v.number(),
  sessionElapsedMs: v.number(), // Time since session started

  // Performance metrics (0-100 scale)
  spinQuality: v.number(),
  objectionHandling: v.number(),
  talkRatio: v.number(),
  responseTiming: v.number(),
  questionDepth: v.number(),
  valueArticulation: v.number(),
  closingSignals: v.number(),

  // Calculated values
  compositeScore: v.number(), // Weighted sum
  currentDifficulty: v.number(), // Difficulty at this snapshot
  currentEmotionalState: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),

  // Trend indicators
  compositeScoreTrend: v.union(
    v.literal("improving"),
    v.literal("stable"),
    v.literal("declining")
  ),
  turnsSinceLastSnapshot: v.number(),
})
.index("by_session", ["sessionId"])
.index("by_session_timestamp", ["sessionId", "timestamp"])
.index("by_user", ["userId"])
.index("by_timestamp", ["timestamp"])
```

---

## Validation Rules

### M1: Difficulty Adjustment

1. **Difficulty bounds**: Must be within persona's `difficultyMin` and `difficultyMax`
2. **Cooldown**: Cannot adjust within 60 seconds of last adjustment
3. **Sustained performance**: Must have 2+ minutes of consistent performance
4. **Increment size**: Adjustments must be 0.05-0.10 per change
5. **Evaluation mode**: No difficulty adjustments allowed in evaluation mode

### M3: Emotional State Transitions

1. **Valid transitions**: State must be one of the 6 defined states
2. **Rate limiting**: Maximum 2 transitions per minute
3. **Grace period**: Cannot enter `frustrated` state in first 30 seconds
4. **Warning required**: Must give verbal warning before call termination
5. **Turn tracking**: Must track turns in `frustrated` state accurately

### Performance Snapshots

1. **Interval**: Created every 30 seconds (±5 seconds tolerance)
2. **Metrics range**: All metrics must be 0-100
3. **Composite score**: Must match weighted calculation of metrics
4. **Session reference**: Must reference valid active session

---

## Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| m1DifficultyEvents | by_session | Get all difficulty changes for a session |
| m1DifficultyEvents | by_user | User's difficulty adjustment history |
| m1DifficultyEvents | by_reason | Analytics: group by adjustment reason |
| m3EmotionalEvents | by_session | Get all state transitions for a session |
| m3EmotionalEvents | by_user | User's emotional journey history |
| m3EmotionalEvents | by_new_state | Analytics: find frustrated sessions |
| m3EmotionalEvents | by_trigger | Analytics: which actions cause transitions |
| performanceSnapshots | by_session | Session performance timeline |
| performanceSnapshots | by_session_timestamp | Ordered performance history |
| performanceSnapshots | by_user | User performance across sessions |

---

## Data Flow

### Session Start

```
1. Create trainingSession (pending)
2. Load persona config (difficultyBounds, defaultEmotionalState)
3. Set currentDifficulty = persona.difficultyDefault
4. Set currentEmotionalState = persona.defaultEmotionalState
5. Create m1DifficultyEvent (reason: session_start)
6. Update session status to active
```

### Per-Turn Update (Voice Pipeline Integration)

```
1. Receive BDR transcript + LLM response
2. Calculate metrics (spinQuality, objectionHandling, etc.)
3. M1: Check if difficulty adjustment needed
   - If adjusted, create m1DifficultyEvent
   - Update session.currentDifficulty
4. M3: Evaluate state transition
   - If transitioned, create m3EmotionalEvent
   - Update session.currentEmotionalState
5. Pass state to Context Builder for next turn
```

### 30-Second Snapshot

```
1. Collect current metrics from session
2. Calculate composite score
3. Determine trend (compare to previous snapshot)
4. Create performanceSnapshot record
```

### Session End (Prospect Termination)

```
1. Detect frustrated state persisting 4+ turns
2. Create m3EmotionalEvent (isCallTermination: true)
3. Update session:
   - status = "completed"
   - endedBy = "prospect"
   - endedAt = Date.now()
4. Mark evaluationAssignment (if applicable) as completed
```

---

## Migration Notes

1. **Schema extension**: Add new fields to `trainingSessions` and `aiTrainerPersonas`
2. **New tables**: Create `m1DifficultyEvents`, `m3EmotionalEvents`, `performanceSnapshots`
3. **Seed data update**: Update persona seed data with M1/M3 configuration
4. **No data migration**: New fields are optional, existing sessions unaffected
5. **Backward compatibility**: Old sessions without M1/M3 fields work normally

---

## Storage Estimates

| Table | Events/Session | Size/Event | Sessions/Month | Monthly Storage |
|-------|---------------|------------|----------------|-----------------|
| m1DifficultyEvents | ~3-5 | ~500 bytes | 10,000 | ~25 MB |
| m3EmotionalEvents | ~10-15 | ~400 bytes | 10,000 | ~60 MB |
| performanceSnapshots | ~20-40 | ~300 bytes | 10,000 | ~120 MB |

**Total**: ~200 MB/month additional storage (within Convex limits)
