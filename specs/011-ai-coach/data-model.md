# Data Model: AI Coach Module (M7)

**Feature**: 011-ai-coach
**Date**: 2026-01-09
**Status**: Draft

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    AI COACH DATA MODEL                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │     users       │ (existing)
                    │─────────────────│
                    │ _id             │
                    │ clerkId         │
                    │ preferredLang   │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┬────────────────────┐
           │ 1:N             │ 1:N             │ 1:N                │ 1:N
           ▼                 ▼                 ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│coachConversations│ │  trainingPlans   │ │  weeklyCheckins  │ │trainingSessions  │
│──────────────────│ │──────────────────│ │──────────────────│ │──────────────────│
│ _id              │ │ _id              │ │ _id              │ │ _id (existing)   │
│ userId ──────────┼─│ userId ──────────┼─│ userId ──────────│ │ userId           │
│ type             │ │ status           │ │ weekStart        │ │ scenario         │
│ sessionId ───────┼─│ skillGaps[]      │ │ sessionCount     │ │ transcript       │
│ status           │ │ weeks[]          │ │ averageScore     │ │ ...              │
│ messageCount     │ │ createdAt        │ │ comparison       │ └────────┬─────────┘
│ language         │ │ updatedAt        │ │ planProgress     │          │
│ createdAt        │ └──────────────────┘ │ createdAt        │          │
│ updatedAt        │                      │ viewedAt         │          │
│ expiresAt        │                      └──────────────────┘          │
└────────┬─────────┘                                                    │
         │ 1:N                                                          │
         ▼                                                              │
┌──────────────────┐                                                    │
│  coachMessages   │                                                    │
│──────────────────│                                                    │
│ _id              │                                                    │
│ conversationId ──┼────────────────────────────────────────────────────┘
│ sender           │            references (for debrief context)
│ content          │
│ transcriptRefs[] │
│ createdAt        │
└──────────────────┘

                    DEPENDENCIES (read-only access)
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  From Spec 004: trainingSessions, sessionTranscripts                                │
│  From Spec 009: sessionScores, scoreFeedback, keyMoments                           │
│  From Spec 010: bdrCertifications, certificationLevels                             │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Tables

### 1. coachConversations

Stores coaching conversation sessions between BDRs and the AI Coach.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | `Id<"coachConversations">` | Auto | Primary key |
| `userId` | `Id<"users">` | Yes | BDR who owns this conversation |
| `type` | `"debrief" \| "training_plan" \| "weekly_checkin" \| "ask_coach"` | Yes | Coaching mode |
| `sessionId` | `Id<"trainingSessions">` | Optional | Associated session (for debrief mode) |
| `status` | `"active" \| "completed" \| "expired"` | Yes | Conversation state |
| `messageCount` | `number` | Yes | Current message count (for limits) |
| `language` | `"fr" \| "en" \| "it" \| "es" \| "de"` | Yes | Conversation language |
| `createdAt` | `number` | Yes | Creation timestamp (ms) |
| `updatedAt` | `number` | Yes | Last activity timestamp |
| `expiresAt` | `number` | Yes | Auto-deletion timestamp (90 days from creation) |

**Indexes**:
- `by_user`: `["userId"]` - Get all conversations for a BDR
- `by_user_type`: `["userId", "type"]` - Get conversations by type
- `by_session`: `["sessionId"]` - Find debrief for a session
- `by_expiry`: `["expiresAt"]` - For cleanup scheduler

**State Transitions**:
```
active ──────► completed   (user ends or message limit reached)
   │
   └────────► expired      (90 days passed, auto-cleanup)
```

**Validation Rules**:
- Only one `active` conversation per user at a time (FR-005)
- `sessionId` required when `type === "debrief"`
- `messageCount` <= conversation limit per type:
  - debrief: 10
  - weekly_checkin: 5
  - ask_coach: 20
  - training_plan: N/A (single response)

---

### 2. coachMessages

Stores individual messages within coaching conversations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | `Id<"coachMessages">` | Auto | Primary key |
| `conversationId` | `Id<"coachConversations">` | Yes | Parent conversation |
| `sender` | `"coach" \| "bdr"` | Yes | Message author |
| `content` | `string` | Yes | Message text (markdown) |
| `transcriptRefs` | `Array<{ start: number, end: number, text: string }>` | Optional | Session transcript excerpts |
| `createdAt` | `number` | Yes | Message timestamp |

**Indexes**:
- `by_conversation`: `["conversationId"]` - Get messages for a conversation
- `by_conversation_time`: `["conversationId", "createdAt"]` - Ordered messages

**Validation Rules**:
- `content` max length: 2000 characters for BDR, 4000 for coach
- `transcriptRefs` only present for coach messages in debrief mode
- Messages cannot be edited or deleted by user

---

### 3. trainingPlans

Stores personalized multi-week training plans generated by the coach.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | `Id<"trainingPlans">` | Auto | Primary key |
| `userId` | `Id<"users">` | Yes | BDR who owns this plan |
| `status` | `"active" \| "completed" \| "abandoned"` | Yes | Plan state |
| `skillGaps` | `Array<{ dimension: string, score: number, priority: number }>` | Yes | Top 3 identified weaknesses |
| `weeks` | `Array<WeekPlan>` | Yes | Weekly breakdown (see below) |
| `analyzedSessions` | `Array<Id<"trainingSessions">>` | Yes | Sessions used for analysis |
| `createdAt` | `number` | Yes | Generation timestamp |
| `updatedAt` | `number` | Yes | Last progress update |

**WeekPlan Structure**:
```typescript
interface WeekPlan {
  weekNumber: number;           // 1, 2, 3, 4
  focus: string;                // "SPIN Questioning Technique"
  targetDimension: string;      // "spinScore"
  scenarios: Array<{
    scenarioId: string;         // Scenario reference
    personaId: string;          // Persona reference
    targetScore: number;        // e.g., 75
    completed: boolean;         // Progress tracking
    completedAt?: number;       // Completion timestamp
    actualScore?: number;       // Achieved score
  }>;
  weeklyGoal: string;           // "Complete 3 sessions with SPIN score >= 70"
  status: "pending" | "in_progress" | "completed";
}
```

**Indexes**:
- `by_user`: `["userId"]` - Get plans for a BDR
- `by_user_status`: `["userId", "status"]` - Get active plan

**State Transitions**:
```
active ──────► completed   (all weekly goals met)
   │
   └────────► abandoned    (user requests new plan before completion)
```

**Validation Rules**:
- Only one `active` plan per user at a time
- `skillGaps.length === 3` (top 3 weaknesses)
- `weeks.length >= 2 && weeks.length <= 4` (2-4 week plans)
- User must have >= 5 sessions to generate plan (FR-014)

---

### 4. weeklyCheckins

Stores weekly progress check-in summaries.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | `Id<"weeklyCheckins">` | Auto | Primary key |
| `userId` | `Id<"users">` | Yes | BDR who owns this check-in |
| `weekStart` | `number` | Yes | Monday timestamp (week identifier) |
| `sessionCount` | `number` | Yes | Sessions completed this week |
| `averageScore` | `number` | Yes | Average score across sessions |
| `comparison` | `{ previousWeek: number, change: number, trend: "up" \| "down" \| "stable" }` | Yes | Week-over-week comparison |
| `planProgress` | `{ planId: Id<"trainingPlans">, goalsCompleted: number, totalGoals: number }` | Optional | Training plan progress if active |
| `conversationId` | `Id<"coachConversations">` | Optional | Associated check-in conversation |
| `createdAt` | `number` | Yes | Check-in trigger timestamp |
| `viewedAt` | `number` | Optional | When BDR viewed the check-in |

**Indexes**:
- `by_user`: `["userId"]` - Get all check-ins for a BDR
- `by_user_week`: `["userId", "weekStart"]` - Get specific week's check-in
- `by_week`: `["weekStart"]` - For batch processing

**Validation Rules**:
- Only one check-in per user per week
- `weekStart` must be a Monday at 00:00:00 UTC
- `sessionCount >= 1` (no check-in if zero sessions)
- `averageScore` between 0 and 100

---

## Relationships Summary

| From | To | Type | Description |
|------|-----|------|-------------|
| `coachConversations` | `users` | N:1 | BDR ownership |
| `coachConversations` | `trainingSessions` | N:1 | Session context (debrief) |
| `coachMessages` | `coachConversations` | N:1 | Parent conversation |
| `trainingPlans` | `users` | N:1 | BDR ownership |
| `trainingPlans` | `trainingSessions` | N:N | Analyzed sessions |
| `weeklyCheckins` | `users` | N:1 | BDR ownership |
| `weeklyCheckins` | `trainingPlans` | N:1 | Plan progress tracking |
| `weeklyCheckins` | `coachConversations` | 1:1 | Check-in conversation |

---

## External Dependencies (Read-Only)

These tables are owned by other specs and accessed read-only by the AI Coach:

### From Spec 004 (Sessions)

| Table | Fields Used | Purpose |
|-------|-------------|---------|
| `trainingSessions` | `userId`, `scenario`, `persona`, `completedAt` | Session history context |
| `sessionTranscripts` | `sessionId`, `content`, `timestamps` | Debrief transcript excerpts |

### From Spec 009 (Scoring)

| Table | Fields Used | Purpose |
|-------|-------------|---------|
| `sessionScores` | `sessionId`, `overallScore`, `spinScore`, `medddicScore`, `bantScore`, `raccScore`, `behavioralScore`, `adaptiveScore` | Performance analysis |
| `scoreFeedback` | `sessionId`, `strengths`, `improvements` | Coaching recommendations |
| `keyMoments` | `sessionId`, `momentType`, `transcriptRef`, `analysis` | Specific transcript highlights |

### From Spec 010 (Certification)

| Table | Fields Used | Purpose |
|-------|-------------|---------|
| `bdrCertifications` | `userId`, `levelId`, `earnedAt` | Certification context for tone |
| `certificationLevels` | `_id`, `name`, `requirements` | Level information |

---

## Convex Schema Definition

```typescript
// convex/schema.ts additions

export const coachConversations = defineTable({
  userId: v.id("users"),
  type: v.union(
    v.literal("debrief"),
    v.literal("training_plan"),
    v.literal("weekly_checkin"),
    v.literal("ask_coach")
  ),
  sessionId: v.optional(v.id("trainingSessions")),
  status: v.union(
    v.literal("active"),
    v.literal("completed"),
    v.literal("expired")
  ),
  messageCount: v.number(),
  language: v.union(
    v.literal("fr"),
    v.literal("en"),
    v.literal("it"),
    v.literal("es"),
    v.literal("de")
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_type", ["userId", "type"])
  .index("by_session", ["sessionId"])
  .index("by_expiry", ["expiresAt"]);

export const coachMessages = defineTable({
  conversationId: v.id("coachConversations"),
  sender: v.union(v.literal("coach"), v.literal("bdr")),
  content: v.string(),
  transcriptRefs: v.optional(
    v.array(
      v.object({
        start: v.number(),
        end: v.number(),
        text: v.string(),
      })
    )
  ),
  createdAt: v.number(),
})
  .index("by_conversation", ["conversationId"])
  .index("by_conversation_time", ["conversationId", "createdAt"]);

export const trainingPlans = defineTable({
  userId: v.id("users"),
  status: v.union(
    v.literal("active"),
    v.literal("completed"),
    v.literal("abandoned")
  ),
  skillGaps: v.array(
    v.object({
      dimension: v.string(),
      score: v.number(),
      priority: v.number(),
    })
  ),
  weeks: v.array(
    v.object({
      weekNumber: v.number(),
      focus: v.string(),
      targetDimension: v.string(),
      scenarios: v.array(
        v.object({
          scenarioId: v.string(),
          personaId: v.string(),
          targetScore: v.number(),
          completed: v.boolean(),
          completedAt: v.optional(v.number()),
          actualScore: v.optional(v.number()),
        })
      ),
      weeklyGoal: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed")
      ),
    })
  ),
  analyzedSessions: v.array(v.id("trainingSessions")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_status", ["userId", "status"]);

export const weeklyCheckins = defineTable({
  userId: v.id("users"),
  weekStart: v.number(),
  sessionCount: v.number(),
  averageScore: v.number(),
  comparison: v.object({
    previousWeek: v.number(),
    change: v.number(),
    trend: v.union(
      v.literal("up"),
      v.literal("down"),
      v.literal("stable")
    ),
  }),
  planProgress: v.optional(
    v.object({
      planId: v.id("trainingPlans"),
      goalsCompleted: v.number(),
      totalGoals: v.number(),
    })
  ),
  conversationId: v.optional(v.id("coachConversations")),
  createdAt: v.number(),
  viewedAt: v.optional(v.number()),
})
  .index("by_user", ["userId"])
  .index("by_user_week", ["userId", "weekStart"])
  .index("by_week", ["weekStart"]);
```

---

## Data Lifecycle

### Conversation Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    CONVERSATION LIFECYCLE                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User starts conversation                                         │
│       │                                                           │
│       ▼                                                           │
│  ┌─────────┐                                                      │
│  │ active  │ ◄─── Messages exchanged, messageCount increments     │
│  └────┬────┘                                                      │
│       │                                                           │
│       ├────► Message limit reached ────► status = "completed"     │
│       │                                                           │
│       ├────► User ends conversation ──► status = "completed"      │
│       │                                                           │
│       └────► 90 days elapsed ─────────► status = "expired"        │
│                                         (scheduled cleanup)        │
│                                                                   │
│  Expired conversations: deleted with all messages                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Training Plan Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    TRAINING PLAN LIFECYCLE                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  BDR requests plan (>= 5 sessions)                               │
│       │                                                           │
│       ▼                                                           │
│  ┌─────────┐                                                      │
│  │ active  │ ◄─── Week progress tracked as sessions complete      │
│  └────┬────┘                                                      │
│       │                                                           │
│       ├────► All weeks completed ─────► status = "completed"      │
│       │                                                           │
│       └────► BDR requests new plan ──► status = "abandoned"       │
│                                         (new plan created)        │
│                                                                   │
│  Plans retained indefinitely (historical analysis value)          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Privacy Constraints

1. **Data Isolation**: All queries MUST filter by `userId` matching authenticated user
2. **Team Lead Access**: Team Leads CANNOT access coaching conversations (private to BDR)
3. **Transcript References**: Only excerpts stored in `transcriptRefs`, not full transcripts
4. **Session Data**: Read-only access to session data (no writes to Spec 004/009/010 tables)
5. **Auto-Deletion**: Conversations auto-expire after 90 days (FR-030)
