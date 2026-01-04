# Data Model: AI Sales Trainer

**Feature**: AI Sales Trainer | **Date**: 2026-01-03 | **Phase**: 1

## Overview

This document defines the Convex schema additions for the AI Sales Trainer feature. The design follows existing patterns from the LMS schema and aligns with constitution requirements (Article XI: Convex Patterns).

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI SALES TRAINER DATA MODEL                        │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │      users       │
                              │   (existing)     │
                              └────────┬─────────┘
                                       │
              ┌────────────────────────┼────────────────────────────┐
              │                        │                            │
              ▼                        ▼                            ▼
   ┌─────────────────────┐  ┌─────────────────────┐    ┌─────────────────────┐
   │  trainingConsents   │  │ trainingSessions    │    │ trainingCertifications│
   │                     │  │                     │    │                     │
   │ userId              │  │ userId              │    │ userId              │
   │ voiceRecording ✓/✗  │  │ personaId           │    │ level (bronze/...)  │
   │ transcriptStorage   │  │ scenarioId          │    │ earnedAt            │
   │ performanceAnalysis │  │ mode (practice/eval)│    │ signature           │
   │ aiCoaching          │  │ status              │    │ revokedAt           │
   │ consentVersion      │  │ score               │    └──────────┬──────────┘
   │ consentedAt         │  │                     │               │
   │ expiresAt           │  └─────────┬───────────┘               │
   └─────────────────────┘            │                           │
                                      │                           │
              ┌───────────────────────┼───────────────────────────┤
              │                       │                           │
              ▼                       ▼                           ▼
   ┌─────────────────────┐  ┌─────────────────────┐    ┌─────────────────────┐
   │ trainingTranscripts │  │  trainingScores     │    │ certificationAttempts│
   │                     │  │                     │    │                     │
   │ sessionId           │  │ sessionId           │    │ userId              │
   │ speaker (bdr/ai)    │  │ overall             │    │ level               │
   │ content             │  │ categoryScores {}   │    │ sessionIds []       │
   │ timestamp           │  │ strengths []        │    │ averageScore        │
   │ turnIndex           │  │ improvements []     │    │ passed              │
   │ sentiment           │  │ scoredAt            │    │ attemptedAt         │
   └─────────────────────┘  └─────────────────────┘    └─────────────────────┘
              │                       │
              │                       │
              ▼                       ▼
   ┌─────────────────────┐  ┌─────────────────────┐
   │ trainingRecordings  │  │  trainingWhispers   │
   │                     │  │                     │
   │ sessionId           │  │ sessionId           │
   │ storageId           │  │ type                │
   │ duration            │  │ message             │
   │ encryptionMethod    │  │ triggeredBy         │
   │ expiresAt           │  │ acknowledged        │
   └─────────────────────┘  └─────────────────────┘

   ┌─────────────────────┐  ┌─────────────────────┐    ┌─────────────────────┐
   │ trainingPersonas    │  │ trainingScenarios   │    │ trainingEvaluations │
   │                     │  │                     │    │                     │
   │ name                │  │ name                │    │ assigneeId          │
   │ role                │  │ description         │    │ assignedById        │
   │ company             │  │ difficulty          │    │ personaId           │
   │ personality         │  │ objectives []       │    │ scenarioId          │
   │ painPoints []       │  │ language            │    │ dueBy               │
   │ voiceId (Cartesia)  │  │ isActive            │    │ status              │
   │ avatarId (Simli)    │  └─────────────────────┘    │ sessionId           │
   │ language            │                             └─────────────────────┘
   └─────────────────────┘

   ┌─────────────────────┐  ┌─────────────────────┐
   │ trainingCoachingPlans│ │ trainingAuditLogs   │
   │                     │  │                     │
   │ userId              │  │ userId              │
   │ weekStarting        │  │ action              │
   │ focusAreas []       │  │ entityType          │
   │ recommendations []  │  │ entityId            │
   │ generatedAt         │  │ metadata            │
   │ generatedBy (Claude)│  │ timestamp           │
   └─────────────────────┘  └─────────────────────┘

   ┌─────────────────────┐
   │ trainingCheckpoints │
   │                     │
   │ sessionId           │
   │ agentState          │
   │ conversationContext │
   │ emotionalState      │
   │ difficultyLevel     │
   │ createdAt           │
   └─────────────────────┘
```

---

## Table Definitions

### trainingConsents

GDPR consent management for the AI Sales Trainer feature.

```typescript
trainingConsents: defineTable({
  userId: v.id("users"),
  // 4 consent types as specified
  voiceRecording: v.boolean(),        // Required for all sessions
  transcriptStorage: v.boolean(),     // Required for evaluations
  performanceAnalysis: v.boolean(),   // Required for scoring
  aiCoaching: v.boolean(),            // Required for M7 coaching
  // Consent metadata
  consentVersion: v.string(),         // "1.0", "1.1", etc.
  consentedAt: v.number(),            // Timestamp of consent
  expiresAt: v.number(),              // 12 months from consent
  // Withdrawal
  withdrawnAt: v.optional(v.number()),
  withdrawalReason: v.optional(v.string()),
})
  .index("by_user", ["userId"])
  .index("by_expires", ["expiresAt"]),
```

**Indexes**:
- `by_user`: Look up consent for session start validation
- `by_expires`: Cron job to send re-confirmation reminders

---

### trainingPersonas

AI prospect personas with voice and avatar configuration.

```typescript
trainingPersonas: defineTable({
  // Identity
  name: v.string(),                   // "Alex Chen"
  role: v.string(),                   // "CTO"
  company: v.string(),                // "TechVenture Inc."
  industry: v.string(),               // "Technology"
  // Character
  personality: v.string(),            // Description for LLM prompt
  communicationStyle: v.string(),     // "Direct", "Analytical", etc.
  painPoints: v.array(v.string()),    // For scenario context
  // Difficulty settings
  baseDifficulty: v.number(),         // 1-5 scale
  objectionTypes: v.array(v.string()), // Types of objections this persona raises
  // Voice & Avatar
  cartesiaVoiceId: v.string(),        // Cartesia voice ID
  simliAvatarId: v.string(),          // Simli face ID
  didImageUrl: v.optional(v.string()), // D-ID fallback image
  // Localization
  language: v.string(),               // "en", "fr", "es", "de", "it"
  culturalNotes: v.optional(v.string()), // Cultural context for LLM
  // State
  isActive: v.boolean(),
  createdAt: v.number(),
})
  .index("by_language", ["language"])
  .index("by_active", ["isActive"])
  .index("by_difficulty", ["baseDifficulty"]),
```

**Notes**:
- 8 personas in V1 across 5 languages
- Each persona has pre-configured voice (Cartesia) and avatar (Simli)

---

### trainingScenarios

Sales conversation scenarios with objectives.

```typescript
trainingScenarios: defineTable({
  // Identity
  name: v.string(),                   // "Cold Call - SaaS Discovery"
  description: v.string(),
  // Configuration
  type: v.union(
    v.literal("cold_call"),
    v.literal("discovery"),           // Phase 2+
  ),
  difficulty: v.number(),             // 1-5 scale
  estimatedDuration: v.number(),      // Minutes
  // Objectives & Scoring
  objectives: v.array(v.object({
    id: v.string(),
    description: v.string(),
    weight: v.number(),               // Percentage of total score
    methodology: v.optional(v.string()), // "SPIN", "MEDDIC", "BANT"
  })),
  // Conversation guidance
  openingContext: v.string(),         // Initial scenario context
  successCriteria: v.array(v.string()),
  // Branch points for What-If replay
  keyMoments: v.array(v.object({
    momentType: v.string(),
    description: v.string(),
    triggerConditions: v.array(v.string()),
  })),
  // Localization
  language: v.string(),
  // State
  isActive: v.boolean(),
  createdAt: v.number(),
})
  .index("by_type", ["type"])
  .index("by_language", ["language"])
  .index("by_active", ["isActive"]),
```

**Notes**:
- V1: 2 scenarios (Cold Call, Discovery)
- Key moments used for M4 branching detection and What-If replay

---

### trainingSessions

Core session tracking for practice and evaluation modes.

```typescript
trainingSessions: defineTable({
  // Ownership
  userId: v.id("users"),
  // Configuration
  personaId: v.id("trainingPersonas"),
  scenarioId: v.id("trainingScenarios"),
  mode: v.union(v.literal("practice"), v.literal("evaluation")),
  // For evaluations
  evaluationId: v.optional(v.id("trainingEvaluations")),
  // LiveKit
  livekitRoomName: v.string(),
  livekitRoomToken: v.optional(v.string()), // Encrypted or hashed
  // Session state
  status: v.union(
    v.literal("pending"),             // Created, not started
    v.literal("connecting"),          // LiveKit connecting
    v.literal("active"),              // In progress
    v.literal("paused"),              // User paused (practice only)
    v.literal("completed"),           // Normal completion
    v.literal("abandoned"),           // User left early
    v.literal("error"),               // Technical failure
  ),
  // Timing
  startedAt: v.optional(v.number()),
  endedAt: v.optional(v.number()),
  duration: v.optional(v.number()),   // Seconds
  // Intelligence module state
  finalDifficultyLevel: v.optional(v.number()),
  finalEmotionalState: v.optional(v.string()),
  whisperCount: v.optional(v.number()),
  branchPointCount: v.optional(v.number()),
  // Consent snapshot (for audit)
  consentSnapshot: v.object({
    voiceRecording: v.boolean(),
    transcriptStorage: v.boolean(),
    performanceAnalysis: v.boolean(),
    aiCoaching: v.boolean(),
    consentVersion: v.string(),
  }),
  // Metadata
  language: v.string(),
  userAgent: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_status", ["userId", "status"])
  .index("by_evaluation", ["evaluationId"])
  .index("by_status", ["status"])
  .index("by_created", ["createdAt"]),
```

**Notes**:
- `consentSnapshot` captures consent state at session start for audit trail
- LiveKit room name format: `training_{sessionId}`

---

### trainingTranscripts

Real-time transcript storage with speaker attribution.

```typescript
trainingTranscripts: defineTable({
  sessionId: v.id("trainingSessions"),
  // Turn data
  turnIndex: v.number(),              // Sequential turn number
  speaker: v.union(v.literal("bdr"), v.literal("ai")),
  content: v.string(),
  // Timing
  startedAt: v.number(),              // When speaker started
  endedAt: v.number(),                // When speaker finished
  duration: v.number(),               // Milliseconds
  // Analysis (from M6)
  sentiment: v.optional(v.object({
    score: v.number(),                // -1 to 1
    confidence: v.number(),
  })),
  voiceMetrics: v.optional(v.object({
    avgPitch: v.number(),
    avgEnergy: v.number(),
    speechRate: v.number(),           // Words per minute
    pauseCount: v.number(),
  })),
  // Branch point marker (from M4)
  isBranchPoint: v.boolean(),
  branchType: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_session", ["sessionId"])
  .index("by_session_turn", ["sessionId", "turnIndex"])
  .index("by_session_speaker", ["sessionId", "speaker"]),
```

**Notes**:
- Populated in real-time by agent via Convex HTTP actions
- Voice metrics extracted from Web Audio API on frontend, sent to agent

---

### trainingRecordings

Audio recording storage with encryption metadata.

```typescript
trainingRecordings: defineTable({
  sessionId: v.id("trainingSessions"),
  // Storage
  storageId: v.id("_storage"),        // Convex file storage
  fileSize: v.number(),               // Bytes
  mimeType: v.string(),               // "audio/webm", "audio/mp3"
  duration: v.number(),               // Seconds
  // Security (per clarification: AES-256 at rest)
  encryptionMethod: v.literal("AES-256-GCM"),
  encryptionKeyId: v.string(),        // Reference to key management
  // Retention (90 days per spec)
  expiresAt: v.number(),
  deletedAt: v.optional(v.number()),
  // Metadata
  createdAt: v.number(),
})
  .index("by_session", ["sessionId"])
  .index("by_expires", ["expiresAt"]),
```

**Notes**:
- 90-day retention period per spec
- Cron job deletes expired recordings

---

### trainingScores

Session scoring and performance analysis.

```typescript
trainingScores: defineTable({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  // Overall score
  overallScore: v.number(),           // 0-100
  passed: v.boolean(),                // >= 70 for evaluations
  // Category breakdown
  categoryScores: v.object({
    openingRapport: v.number(),       // 0-100
    discoveryQuestions: v.number(),
    valueProposition: v.number(),
    objectionHandling: v.number(),
    closingTechnique: v.number(),
    activeListening: v.number(),
  }),
  // Methodology scores (if applicable)
  methodologyScores: v.optional(v.object({
    spin: v.optional(v.number()),
    meddic: v.optional(v.number()),
    bant: v.optional(v.number()),
  })),
  // Voice analysis contribution (from M6)
  voiceScore: v.optional(v.object({
    clarity: v.number(),
    confidence: v.number(),
    pacing: v.number(),
    engagement: v.number(),
  })),
  // AI-generated feedback
  strengths: v.array(v.string()),
  improvements: v.array(v.string()),
  detailedFeedback: v.optional(v.string()), // Longer narrative
  // Scoring metadata
  scoredAt: v.number(),
  scoringModel: v.string(),           // "claude-3-5-sonnet-20241022"
  scoringVersion: v.string(),         // For reproducibility
})
  .index("by_session", ["sessionId"])
  .index("by_user", ["userId"])
  .index("by_user_score", ["userId", "overallScore"]),
```

**Notes**:
- Scored by Claude 3.5 Sonnet after session completion
- Category scores align with sales methodology best practices

---

### trainingWhispers

Real-time coaching whisper notifications.

```typescript
trainingWhispers: defineTable({
  sessionId: v.id("trainingSessions"),
  // Whisper content
  type: v.union(
    v.literal("technique_suggestion"),  // Positive guidance
    v.literal("warning"),               // Caution about approach
    v.literal("encouragement"),         // Positive reinforcement
    v.literal("question_prompt"),       // Suggest a question
  ),
  message: v.string(),
  // Trigger context (for analytics)
  triggeredBy: v.string(),            // M2 trigger condition
  turnIndex: v.number(),              // Which turn triggered this
  // Delivery state
  deliveredAt: v.optional(v.number()),
  acknowledgedAt: v.optional(v.number()),
  // For screen reader accessibility
  ariaAnnouncement: v.string(),
  createdAt: v.number(),
})
  .index("by_session", ["sessionId"])
  .index("by_session_time", ["sessionId", "createdAt"]),
```

**Notes**:
- Frontend subscribes to new whispers via Convex real-time query
- Practice mode only (not shown in evaluations)

---

### trainingEvaluations

Manager-assigned evaluation assignments.

```typescript
trainingEvaluations: defineTable({
  // Assignment
  assigneeId: v.id("users"),          // BDR being evaluated
  assignedById: v.id("users"),        // Manager who assigned
  // Configuration
  personaId: v.id("trainingPersonas"),
  scenarioId: v.id("trainingScenarios"),
  // Timing
  dueBy: v.number(),                  // Deadline timestamp
  // Status
  status: v.union(
    v.literal("pending"),             // Assigned, not started
    v.literal("in_progress"),         // Session active
    v.literal("completed"),           // Session completed
    v.literal("expired"),             // Past due, not completed
  ),
  // Completion
  sessionId: v.optional(v.id("trainingSessions")),
  completedAt: v.optional(v.number()),
  score: v.optional(v.number()),
  // Manager review
  managerReviewedAt: v.optional(v.number()),
  managerComments: v.optional(v.string()),
  // Metadata
  notificationSentAt: v.optional(v.number()),
  reminderSentAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_assignee", ["assigneeId"])
  .index("by_assignee_status", ["assigneeId", "status"])
  .index("by_assigned_by", ["assignedById"])
  .index("by_status", ["status"])
  .index("by_due", ["dueBy"]),
```

**Notes**:
- Managers can only assign to their direct reports
- Evaluation sessions cannot be paused (unlike practice)

---

### trainingCertifications

Certification achievements (Bronze, Silver, Gold).

```typescript
trainingCertifications: defineTable({
  userId: v.id("users"),
  // Level
  level: v.union(
    v.literal("bronze"),              // 3 sessions, avg ≥70
    v.literal("silver"),              // 5 sessions, avg ≥80
    v.literal("gold"),                // 10 sessions, avg ≥90
  ),
  // Achievement
  earnedAt: v.number(),
  // Sessions that contributed
  qualifyingSessionIds: v.array(v.id("trainingSessions")),
  averageScore: v.number(),
  // Verification
  certificateNumber: v.string(),      // Unique ID for verification
  signature: v.string(),              // HMAC signature for fraud prevention
  qrCodeData: v.string(),             // Data encoded in QR
  // State
  isValid: v.boolean(),
  revokedAt: v.optional(v.number()),
  revokedBy: v.optional(v.id("users")),
  revocationReason: v.optional(v.string()),
})
  .index("by_user", ["userId"])
  .index("by_user_level", ["userId", "level"])
  .index("by_certificate", ["certificateNumber"]),
```

**Notes**:
- HMAC signature prevents certificate forgery
- Admin can revoke certificates if fraud detected

---

### certificationAttempts

Track certification progression attempts.

```typescript
certificationAttempts: defineTable({
  userId: v.id("users"),
  level: v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold")),
  // Sessions in this attempt
  sessionIds: v.array(v.id("trainingSessions")),
  sessionCount: v.number(),
  averageScore: v.number(),
  // Result
  passed: v.boolean(),
  failureReason: v.optional(v.string()), // "insufficient_sessions", "score_below_threshold"
  // Timing
  attemptedAt: v.number(),
  certificationId: v.optional(v.id("trainingCertifications")),
})
  .index("by_user", ["userId"])
  .index("by_user_level", ["userId", "level"]),
```

---

### trainingCoachingPlans

Weekly AI-generated coaching plans (M7).

```typescript
trainingCoachingPlans: defineTable({
  userId: v.id("users"),
  // Time period
  weekStarting: v.string(),           // "2026-01-06" (Monday)
  weekEnding: v.string(),             // "2026-01-12" (Sunday)
  // Analysis
  sessionsAnalyzed: v.number(),
  averageScore: v.number(),
  // AI-generated content
  focusAreas: v.array(v.object({
    area: v.string(),                 // "Discovery Questions"
    currentLevel: v.number(),
    targetLevel: v.number(),
    specificFeedback: v.string(),
  })),
  recommendations: v.array(v.object({
    type: v.string(),                 // "practice", "study", "review"
    description: v.string(),
    priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    resourceLink: v.optional(v.string()),
  })),
  weeklyGoals: v.array(v.string()),
  // Generation metadata
  generatedAt: v.number(),
  generatedBy: v.literal("claude-3-5-sonnet"),
  sessionIdsAnalyzed: v.array(v.id("trainingSessions")),
  // User interaction
  viewedAt: v.optional(v.number()),
  feedbackRating: v.optional(v.number()), // 1-5
})
  .index("by_user", ["userId"])
  .index("by_user_week", ["userId", "weekStarting"]),
```

**Notes**:
- Generated weekly by Convex cron job
- Only generated if user has ≥2 sessions in the past week

---

### trainingCheckpoints

Agent state checkpoints for crash recovery.

```typescript
trainingCheckpoints: defineTable({
  sessionId: v.id("trainingSessions"),
  // Agent state snapshot
  agentState: v.object({
    difficultyLevel: v.number(),
    emotionalState: v.string(),
    conversationBuffer: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
    pendingWhispers: v.array(v.string()),
  }),
  // Conversation context
  lastTurnIndex: v.number(),
  lastTranscriptId: v.optional(v.id("trainingTranscripts")),
  // Checkpoint metadata
  checkpointNumber: v.number(),
  createdAt: v.number(),
})
  .index("by_session", ["sessionId"])
  .index("by_session_time", ["sessionId", "createdAt"]),
```

**Notes**:
- Created every 60 seconds during active sessions
- Agent loads latest checkpoint on crash recovery

---

### trainingAuditLogs

Comprehensive audit logging for compliance.

```typescript
trainingAuditLogs: defineTable({
  // Actor
  userId: v.optional(v.id("users")),  // null for system actions
  actorType: v.union(
    v.literal("user"),
    v.literal("manager"),
    v.literal("admin"),
    v.literal("system"),
    v.literal("agent"),
  ),
  // Action
  action: v.union(
    v.literal("consent_granted"),
    v.literal("consent_withdrawn"),
    v.literal("session_started"),
    v.literal("session_completed"),
    v.literal("session_abandoned"),
    v.literal("evaluation_assigned"),
    v.literal("evaluation_completed"),
    v.literal("certificate_earned"),
    v.literal("certificate_revoked"),
    v.literal("recording_accessed"),
    v.literal("recording_deleted"),
    v.literal("data_exported"),
    v.literal("coaching_plan_generated"),
  ),
  // Entity
  entityType: v.string(),             // "session", "consent", "certificate"
  entityId: v.string(),               // ID of affected entity
  // Context
  metadata: v.optional(v.any()),      // Additional context
  ipAddress: v.optional(v.string()),  // For security audits
  userAgent: v.optional(v.string()),
  // Timing
  timestamp: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_action", ["action"])
  .index("by_entity", ["entityType", "entityId"])
  .index("by_timestamp", ["timestamp"]),
```

**Notes**:
- Required for GDPR compliance demonstration
- Retained for 7 years per audit requirements

---

## User Table Extension

Add a `role` field to support the manager role:

```typescript
// Extend existing users table role field
role: v.union(
  v.literal("user"),
  v.literal("manager"),  // NEW: Team lead with evaluation powers
  v.literal("admin"),
),
```

**Notes**:
- Manager role required for evaluation assignment
- Admin can assign manager role to users

---

## Index Strategy

### Query Patterns Covered

| Query | Table | Index |
|-------|-------|-------|
| Get user's sessions | trainingSessions | `by_user` |
| Get pending evaluations for user | trainingEvaluations | `by_assignee_status` |
| Get sessions for evaluation | trainingSessions | `by_evaluation` |
| Get transcript for session | trainingTranscripts | `by_session_turn` |
| Get user's certifications | trainingCertifications | `by_user_level` |
| Get coaching plan for week | trainingCoachingPlans | `by_user_week` |
| Get latest checkpoint | trainingCheckpoints | `by_session_time` |
| Audit log query | trainingAuditLogs | `by_timestamp`, `by_user` |
| Expired recordings cleanup | trainingRecordings | `by_expires` |
| Consent expiry reminders | trainingConsents | `by_expires` |

### Composite Index Rationale

- `by_user_status`: Dashboard filtering (pending vs completed sessions)
- `by_session_turn`: Sequential transcript loading
- `by_user_week`: Weekly coaching plan lookup

---

## Migration Strategy

### Phase 1: Schema Addition
1. Add new tables to `convex/schema.ts`
2. Run `npx convex dev` to deploy schema
3. No data migration needed (new tables)

### Phase 2: User Role Migration
1. Identify users who should be managers
2. Run mutation to update role field
3. Verify RBAC permissions

### Data Seeding
1. Seed 8 personas (JSON seed file)
2. Seed 2 scenarios (JSON seed file)
3. Link Cartesia voice IDs and Simli avatar IDs

---

## Next Steps

1. **Phase 1**: Generate `contracts/` with Convex function signatures
2. **Phase 1**: Generate `quickstart.md` for local development setup
