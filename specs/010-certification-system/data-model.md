# Data Model: BDR Certification System

**Feature**: 010-certification-system
**Date**: 2026-01-09
**Status**: Final

## Overview

This document defines the Convex schema additions for the BDR Certification System. Six new tables are introduced to manage certification levels, user progress, badges, and LMS synchronization.

---

## Entity Relationship Diagram

```
┌─────────────────────┐         ┌─────────────────────┐
│  certificationLevels│         │       badges        │
│  (seed data)        │         │    (seed data)      │
├─────────────────────┤         ├─────────────────────┤
│  slug (PK)          │         │  slug (PK)          │
│  name (localized)   │         │  name (localized)   │
│  order              │         │  description        │
│  requirements       │         │  emoji              │
│  unlockedPersonas[] │         │  category           │
│  badge              │         │  criteria           │
└──────────┬──────────┘         │  isShareable        │
           │                    └──────────┬──────────┘
           │ references                    │ references
           │                               │
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│  bdrCertifications  │         │     bdrBadges       │
│  (per user)         │         │   (per user×badge)  │
├─────────────────────┤         ├─────────────────────┤
│  userId (FK→users)  │         │  userId (FK→users)  │
│  currentLevel       │◄────────│  badgeId (FK)       │
│  sessionsCompleted  │         │  earnedAt           │
│  evaluationsPassed  │         │  triggerSessionId   │
│  distinctionsEarned │         │  viewed             │
│  levelHistory[]     │         │  sharedAt           │
│  evaluationCooldowns│         └─────────────────────┘
│  lastLmsSyncAt      │
│  lmsSyncStatus      │
└──────────┬──────────┘
           │
           │ audit trail
           ▼
┌─────────────────────┐         ┌─────────────────────┐
│   cooldownResets    │         │    lmsSyncQueue     │
│   (audit log)       │         │  (async processing) │
├─────────────────────┤         ├─────────────────────┤
│  userId (target)    │         │  userId             │
│  resetBy (actor)    │         │  eventType          │
│  resetByRole        │         │  payload            │
│  scenarioSlug       │         │  status             │
│  reason             │         │  attempts           │
│  resetAt            │         │  lastAttemptAt      │
└─────────────────────┘         │  lastError          │
                                │  createdAt          │
                                └─────────────────────┘
```

---

## Table Definitions

### 1. certificationLevels

**Purpose**: Reference table defining the four certification levels and their requirements.

**Lifecycle**: Seed data, rarely updated (only via admin/migration).

```typescript
certificationLevels: defineTable({
  // Identity
  slug: v.union(
    v.literal("bronze"),
    v.literal("silver"),
    v.literal("gold"),
    v.literal("platinum")
  ),

  // Display
  name: v.object({
    fr: v.string(),
    en: v.string(),
    it: v.string(),
    es: v.string(),
    de: v.string(),
  }),

  // Ordering
  order: v.number(),  // 1=Bronze, 2=Silver, 3=Gold, 4=Platinum

  // Requirements to achieve this level
  requirements: v.object({
    minSessions: v.number(),           // Free practice sessions
    minEvaluations: v.number(),        // Passed evaluations
    minScore: v.number(),              // Minimum passing score
    distinctionRequired: v.boolean(),  // Requires distinction scores
    prerequisiteLevel: v.optional(v.union(
      v.literal("bronze"),
      v.literal("silver"),
      v.literal("gold")
    )),
  }),

  // Personas unlocked at this level
  unlockedPersonas: v.array(v.string()),  // ["enthusiastic-champion", ...]

  // Badge appearance
  badge: v.object({
    emoji: v.string(),   // "🥉"
    color: v.string(),   // "amber" (Tailwind color)
  }),
})
  .index("by_slug", ["slug"])
  .index("by_order", ["order"]),
```

**Seed Data:**
| slug | order | minSessions | minEvaluations | minScore | distinctionRequired | prerequisite |
|------|-------|-------------|----------------|----------|---------------------|--------------|
| bronze | 1 | 3 | 0 | 0 | false | null |
| silver | 2 | 0 | 2 | 70 | false | bronze |
| gold | 3 | 0 | 4 | 75 | false | silver |
| platinum | 4 | 0 | 2 | 85 | true | gold |

---

### 2. bdrCertifications

**Purpose**: Tracks each BDR's certification progress, current level, and cooldowns.

**Lifecycle**: Created on first session, updated on progress events.

```typescript
bdrCertifications: defineTable({
  // Owner
  userId: v.id("users"),

  // Current state
  currentLevel: v.union(
    v.literal("none"),
    v.literal("bronze"),
    v.literal("silver"),
    v.literal("gold"),
    v.literal("platinum")
  ),

  // Progress counters
  sessionsCompleted: v.number(),      // Free practice sessions
  evaluationsPassed: v.number(),      // Total passed evaluations
  distinctionsEarned: v.number(),     // Evaluations with score >= 85

  // Detailed tracking for certification requirements
  passedScenarios: v.array(v.string()),  // Distinct scenarios passed (for Silver/Gold)

  // Level history (append-only)
  levelHistory: v.array(v.object({
    level: v.string(),
    achievedAt: v.number(),
    evaluationId: v.optional(v.id("trainingSessions")),
  })),

  // Cooldown tracking
  evaluationCooldowns: v.array(v.object({
    scenarioSlug: v.string(),
    cooldownUntil: v.number(),  // Unix timestamp (ms)
  })),

  // LMS sync status
  lastLmsSyncAt: v.optional(v.number()),
  lmsSyncStatus: v.union(
    v.literal("synced"),
    v.literal("pending"),
    v.literal("failed")
  ),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_level", ["currentLevel"])
  .index("by_lms_sync", ["lmsSyncStatus"])
  .index("by_updated", ["updatedAt"]),  // For stalled detection
```

**State Transitions:**
```
none → bronze (onboarding + 3 sessions)
bronze → silver (2 evaluations @ 70+, different scenarios)
silver → gold (4 evaluations @ 75+, all scenarios)
gold → platinum (2 distinctions @ 85+)
```

**Validation Rules:**
- `userId` must reference existing user
- `currentLevel` can only increase (never downgrade)
- `passedScenarios` has no duplicates
- `evaluationCooldowns` entries are auto-cleaned when expired

---

### 3. badges

**Purpose**: Reference table defining all available badges and their criteria.

**Lifecycle**: Seed data, rarely updated (only via admin/migration).

```typescript
badges: defineTable({
  // Identity
  slug: v.string(),  // "first-session", "spin-master", etc.

  // Display
  name: v.object({
    fr: v.string(),
    en: v.string(),
    it: v.string(),
    es: v.string(),
    de: v.string(),
  }),
  description: v.object({
    fr: v.string(),
    en: v.string(),
    it: v.string(),
    es: v.string(),
    de: v.string(),
  }),
  emoji: v.string(),  // "🎯", "🔄", etc.

  // Classification
  category: v.union(
    v.literal("milestone"),      // One-time achievements
    v.literal("skill"),          // Skill mastery
    v.literal("certification"),  // Level badges
    v.literal("streak")          // Consistency
  ),

  // Award criteria
  criteria: v.object({
    type: v.string(),  // "sessions_completed", "dimension_score", etc.
    threshold: v.number(),
    dimension: v.optional(v.string()),    // For skill badges
    minScore: v.optional(v.number()),     // For skill/streak
    count: v.optional(v.number()),        // Times to achieve threshold
    level: v.optional(v.string()),        // For certification badges
  }),

  // Sharing
  isShareable: v.boolean(),
})
  .index("by_slug", ["slug"])
  .index("by_category", ["category"]),
```

**Seed Data:**
| slug | category | criteria.type | criteria.threshold |
|------|----------|---------------|-------------------|
| first-session | milestone | sessions_completed | 1 |
| ten-sessions | milestone | sessions_completed | 10 |
| spin-master | skill | dimension_score | 85 (3 times) |
| objection-handler | skill | objections_handled | 10 (@ 80+) |
| consistent-performer | streak | consecutive_sessions | 5 (@ 70+) |
| bronze-certified | certification | certification_level | bronze |
| silver-certified | certification | certification_level | silver |
| gold-certified | certification | certification_level | gold |
| platinum-elite | certification | certification_level | platinum |

---

### 4. bdrBadges

**Purpose**: Records badges earned by users.

**Lifecycle**: Created when badge awarded, updated when viewed/shared.

```typescript
bdrBadges: defineTable({
  // References
  userId: v.id("users"),
  badgeId: v.id("badges"),

  // Award details
  earnedAt: v.number(),
  triggerSessionId: v.optional(v.id("trainingSessions")),

  // Engagement tracking
  viewed: v.boolean(),
  viewedAt: v.optional(v.number()),
  sharedAt: v.optional(v.number()),
})
  .index("by_user", ["userId"])
  .index("by_badge", ["badgeId"])
  .index("by_user_badge", ["userId", "badgeId"])  // Uniqueness check
  .index("by_earned", ["earnedAt"]),  // Recent badges
```

**Constraints:**
- Unique constraint on (userId, badgeId) - each badge earned once
- `viewed` defaults to false on creation
- `triggerSessionId` nullable for non-session badges (e.g., certification)

---

### 5. cooldownResets

**Purpose**: Audit log for admin cooldown resets.

**Lifecycle**: Insert-only (immutable), never updated or deleted.

```typescript
cooldownResets: defineTable({
  // Target user whose cooldown was reset
  userId: v.id("users"),

  // Actor who performed the reset
  resetBy: v.id("users"),
  resetByRole: v.union(
    v.literal("admin"),
    v.literal("team_lead")
  ),

  // What was reset
  scenarioSlug: v.string(),

  // Justification (required)
  reason: v.string(),

  // When
  resetAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_reset_by", ["resetBy"])
  .index("by_date", ["resetAt"]),
```

**Audit Requirements:**
- `reason` is required (cannot be empty string)
- Records are immutable (no update/delete mutations)
- Used for compliance reporting and abuse detection

---

### 6. lmsSyncQueue

**Purpose**: Queue for asynchronous LMS synchronization events.

**Lifecycle**: Created on event, processed by scheduled action, completed/failed.

```typescript
lmsSyncQueue: defineTable({
  // Target user
  userId: v.id("users"),

  // Event details
  eventType: v.union(
    v.literal("session_completed"),
    v.literal("certification_earned"),
    v.literal("badge_awarded")
  ),
  payload: v.any(),  // Event-specific data

  // Processing state
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  ),
  attempts: v.number(),
  lastAttemptAt: v.optional(v.number()),
  lastError: v.optional(v.string()),

  // Timestamps
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_status", ["status"])
  .index("by_user", ["userId"])
  .index("by_created", ["createdAt"]),
```

**Event Payloads:**

```typescript
// session_completed
{
  moduleId: "ai-sales-trainer",
  lessonId: string,
  completedAt: number,
  score: number,
  duration: number,
}

// certification_earned
{
  certificationId: string,
  level: "bronze" | "silver" | "gold" | "platinum",
  earnedAt: number,
}

// badge_awarded
{
  badgeId: string,
  awardedAt: number,
}
```

**Processing Rules:**
- Max 5 attempts before marking as "failed"
- Exponential backoff: 30s, 2min, 8min, 32min, 2h
- Alert ops team on failure
- Completed items retained 30 days for audit

---

## Index Usage Patterns

| Query | Table | Index | Purpose |
|-------|-------|-------|---------|
| Get user certification | bdrCertifications | by_user | BDR dashboard |
| List users by level | bdrCertifications | by_level | Team dashboard filter |
| Find stalled users | bdrCertifications | by_updated | Stalled detection |
| Get user badges | bdrBadges | by_user | Badge collection |
| Check badge uniqueness | bdrBadges | by_user_badge | Award idempotency |
| Process sync queue | lmsSyncQueue | by_status | Scheduled processing |
| Audit by user | cooldownResets | by_user | User audit trail |
| Audit by admin | cooldownResets | by_reset_by | Admin activity |

---

## Migration Notes

### New Tables
All six tables are new - no migration of existing data required.

### Seed Data Required
1. `certificationLevels` - 4 level definitions
2. `badges` - 9 badge definitions

### Integration Points
- Reference `users` table (existing)
- Reference `trainingSessions` table (Spec 004)
- Reference `personas` definitions (Spec 004 seed data)

### Backward Compatibility
No breaking changes to existing schema. All new tables are additive.

---

## Schema File Location

Add to: `convex/schema.ts`

```typescript
// === Certification System (Spec 010) ===
// Tables: certificationLevels, bdrCertifications, badges, bdrBadges, cooldownResets, lmsSyncQueue
// See: specs/010-certification-system/data-model.md
```
