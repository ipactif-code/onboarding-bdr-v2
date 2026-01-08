# Data Model: AI Sales Trainer Session Infrastructure

**Feature**: 004-ai-trainer-sessions
**Date**: 2026-01-08
**Status**: Complete

## Entity Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI Trainer Data Model                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐   │
│  │  scenarios  │◄────────│ trainingSessions │────────►│    personas     │   │
│  │  (seed)     │         │                  │         │    (seed)       │   │
│  └─────────────┘         └────────┬─────────┘         └─────────────────┘   │
│                                   │                                          │
│                                   │ mode="evaluation"                        │
│                                   ▼                                          │
│                          ┌────────────────────┐                              │
│                          │evaluationAssignments│                             │
│                          │                    │                              │
│                          │ assignedBy (lead)  │                              │
│                          │ assignedTo (BDR)   │                              │
│                          └────────────────────┘                              │
│                                                                              │
│  ┌─────────────┐         ┌──────────────────┐                               │
│  │   users     │◄────────│  notifications   │                               │
│  │ (existing)  │         │  (new table)     │                               │
│  └─────────────┘         └──────────────────┘                               │
│                                                                              │
│  ┌─────────────┐                                                            │
│  │   teams     │  ← Team Lead identified by teams.leadId                    │
│  │ (existing)  │                                                            │
│  └─────────────┘                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## New Tables

### 1. `aiTrainerScenarios` (Seed Data)

Stores the two V1 scenario types with their configuration.

```typescript
aiTrainerScenarios: defineTable({
  // Identity
  identifier: v.string(), // "cold_call", "discovery"

  // Display (localized keys, not actual text)
  nameKey: v.string(), // i18n key: "scenario.cold_call.name"
  descriptionKey: v.string(),

  // Duration limits (milliseconds)
  expectedDurationMin: v.number(), // 5 min = 300000
  expectedDurationMax: v.number(), // 7 min = 420000 (cold call)
  maxDuration: v.number(), // 60 min = 3600000 (timeout)

  // Timestamps
  createdAt: v.number(),
})
.index("by_identifier", ["identifier"])
```

**Seed Data**:
| identifier | expectedDurationMin | expectedDurationMax | maxDuration |
|------------|---------------------|---------------------|-------------|
| cold_call | 300000 (5 min) | 420000 (7 min) | 3600000 (60 min) |
| discovery | 1800000 (30 min) | 2700000 (45 min) | 5400000 (90 min) |

---

### 2. `aiTrainerPersonas` (Seed Data)

Stores the 8 predefined prospect personas with localized content.

```typescript
aiTrainerPersonas: defineTable({
  // Identity
  identifier: v.string(), // "marc_dubois", "philippe_renault", etc.

  // Localized content (JSON structure for 5 languages)
  localizations: v.any(), // See structure below

  // Scenario compatibility
  scenarios: v.array(v.string()), // ["cold_call", "discovery"]

  // Difficulty
  difficulty: v.union(
    v.literal("easy"),
    v.literal("medium"),
    v.literal("hard"),
    v.literal("very_hard")
  ),

  // Unlock requirements
  requiresCompletedSessions: v.number(), // 0 for most, 5 for CEO

  // Timestamps
  createdAt: v.number(),
})
.index("by_identifier", ["identifier"])
.index("by_difficulty", ["difficulty"])
```

**Localization Structure**:
```typescript
localizations: {
  fr: {
    name: "Marc Dubois",
    roleTitle: "Directeur Juridique",
    company: "TechCorp France",
    personalityTraits: ["Analytique", "Prudent", "Direct"],
    preferredObjections: ["prix", "timing", "concurrence"],
    culturalNotes: "Vouvoiement, style formel"
  },
  en: {
    name: "Marc Dubois",
    roleTitle: "General Counsel",
    company: "TechCorp France",
    personalityTraits: ["Analytical", "Cautious", "Direct"],
    preferredObjections: ["price", "timing", "competition"],
    culturalNotes: "Professional tone"
  },
  // ... de, it, es
}
```

**8 Personas (V1)**:

| identifier | difficulty | scenarios | requiresCompletedSessions |
|------------|-----------|-----------|---------------------------|
| marc_dubois | medium | cold_call, discovery | 0 |
| sophie_martin | easy | cold_call, discovery | 0 |
| jean_pierre_blanc | easy | cold_call | 0 |
| marie_claire_durand | medium | discovery | 0 |
| philippe_renault | very_hard | cold_call, discovery | 0 |
| isabelle_moreau | hard | cold_call, discovery | 0 |
| antoine_lefebvre | hard | discovery | 0 |
| ceo_persona | very_hard | cold_call, discovery | 5 |

---

### 3. `trainingSessions`

Core table for tracking practice and evaluation sessions.

```typescript
trainingSessions: defineTable({
  // User & Organization
  userId: v.id("users"),
  organizationId: v.string(), // Clerk org ID (or derived)

  // Configuration (immutable after creation)
  scenarioId: v.id("aiTrainerScenarios"),
  personaId: v.id("aiTrainerPersonas"),
  language: v.union(
    v.literal("fr"),
    v.literal("en"),
    v.literal("it"),
    v.literal("de"),
    v.literal("es")
  ),
  mode: v.union(v.literal("free"), v.literal("evaluation")),

  // For evaluation mode
  evaluationAssignmentId: v.optional(v.id("evaluationAssignments")),

  // LiveKit integration
  livekitRoomName: v.optional(v.string()), // "ai-trainer-{sessionId}"
  livekitRoomCreatedAt: v.optional(v.number()),

  // Status (state machine)
  status: v.union(
    v.literal("pending"),
    v.literal("active"),
    v.literal("completed"),
    v.literal("abandoned"),
    v.literal("expired")
  ),

  // Timing
  createdAt: v.number(),
  startedAt: v.optional(v.number()), // When status → active
  endedAt: v.optional(v.number()), // When status → terminal
  durationSeconds: v.optional(v.number()), // Calculated

  // Heartbeat for inactivity detection
  lastHeartbeatAt: v.optional(v.number()),

  // Denormalized for filtering (avoids joins)
  scenarioIdentifier: v.string(), // "cold_call" or "discovery"
})
.index("by_user", ["userId"])
.index("by_user_status", ["userId", "status"])
.index("by_user_created", ["userId", "createdAt"])
.index("by_org_status", ["organizationId", "status"])
.index("by_status", ["status"])
.index("by_status_heartbeat", ["status", "lastHeartbeatAt"])
.index("by_evaluation_assignment", ["evaluationAssignmentId"])
.index("by_user_scenario_mode", ["userId", "scenarioIdentifier", "mode"])
```

**State Machine**:
```
                    ┌──────────────────┐
                    │     pending      │
                    └────────┬─────────┘
                             │
              ┌──────────────┴──────────────┐
              │ voice connected             │ timeout (never connected)
              ▼                             ▼
        ┌──────────┐                  ┌───────────┐
        │  active  │                  │ abandoned │
        └────┬─────┘                  └───────────┘
             │
    ┌────────┼────────┬────────────┐
    │        │        │            │
    │ user   │ 2min   │ 60/90min   │
    │ ends   │ idle   │ timeout    │
    ▼        ▼        ▼            │
┌─────────┐ ┌─────────┐ ┌─────────┐
│completed│ │abandoned│ │ expired │
└─────────┘ └─────────┘ └─────────┘
```

---

### 4. `evaluationAssignments`

Tracks Team Lead assignments of formal evaluations to BDRs.

```typescript
evaluationAssignments: defineTable({
  // Participants
  assignedBy: v.id("users"), // Team Lead
  assignedTo: v.id("users"), // BDR
  teamId: v.id("teams"), // The team context

  // Configuration
  scenarioId: v.id("aiTrainerScenarios"),
  personaId: v.id("aiTrainerPersonas"),
  language: v.union(
    v.literal("fr"),
    v.literal("en"),
    v.literal("it"),
    v.literal("de"),
    v.literal("es")
  ),

  // Deadline
  deadline: v.optional(v.number()), // Optional timestamp

  // Status (assignment lifecycle)
  status: v.union(
    v.literal("pending"), // Assigned, not started
    v.literal("in_progress"), // At least 1 attempt started
    v.literal("completed"), // All attempts used or passed
    v.literal("locked"), // Deadline passed
    v.literal("closed") // Manually closed by Team Lead
  ),

  // Progress
  attemptsUsed: v.number(), // 0-3
  maxAttempts: v.number(), // Always 3 for V1

  // Audio consent (required before first attempt)
  audioConsentGiven: v.boolean(),
  audioConsentAt: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
  lockedAt: v.optional(v.number()),
})
.index("by_assignee", ["assignedTo"])
.index("by_assignee_status", ["assignedTo", "status"])
.index("by_assigner", ["assignedBy"])
.index("by_team", ["teamId"])
.index("by_status", ["status"])
.index("by_deadline", ["deadline"])
```

---

### 5. `aiTrainerNotifications`

Stores notifications for the AI Trainer feature.

```typescript
aiTrainerNotifications: defineTable({
  // Recipient
  userId: v.id("users"),

  // Type
  type: v.union(
    v.literal("evaluation_assigned"),
    v.literal("evaluation_deadline_approaching"), // 24h before
    v.literal("evaluation_deadline_passed"),
    v.literal("evaluation_extended"),
    v.literal("evaluation_closed")
  ),

  // Content
  titleKey: v.string(), // i18n key
  messageKey: v.string(), // i18n key
  messageParams: v.optional(v.any()), // { deadline: "2026-01-15" }

  // Related entity
  evaluationAssignmentId: v.optional(v.id("evaluationAssignments")),

  // State
  isRead: v.boolean(),
  readAt: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
})
.index("by_user", ["userId"])
.index("by_user_unread", ["userId", "isRead"])
.index("by_user_created", ["userId", "createdAt"])
```

---

### 6. `aiTrainerSessionLogs` (Observability)

Structured event logs for session lifecycle (per FR-043 to FR-046).

```typescript
aiTrainerSessionLogs: defineTable({
  // Event identification
  eventType: v.union(
    v.literal("session_created"),
    v.literal("session_started"),
    v.literal("session_completed"),
    v.literal("session_abandoned"),
    v.literal("session_expired"),
    v.literal("heartbeat_received"),
    v.literal("room_created"),
    v.literal("room_joined"),
    v.literal("room_left")
  ),

  // References
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  organizationId: v.string(),

  // Metadata
  metadata: v.optional(v.any()), // Event-specific data

  // Timestamp
  timestamp: v.number(),
})
.index("by_session", ["sessionId"])
.index("by_user", ["userId"])
.index("by_org", ["organizationId"])
.index("by_event_type", ["eventType"])
.index("by_timestamp", ["timestamp"])
```

---

## Existing Tables (Relationships)

### `users` (No changes needed)

Sessions link to users via `userId`. Team Lead status determined by `teams.leadId`.

### `teams` (No changes needed)

- `leadId: v.optional(v.id("users"))` identifies Team Leads
- `teamMembers` table links users to teams

### `teamMembers` (No changes needed)

Used to get BDRs on a Team Lead's teams:
```typescript
const teamMembers = await ctx.db
  .query("teamMembers")
  .withIndex("by_team", (q) => q.eq("teamId", teamId))
  .collect();
```

---

## Validation Rules

### Session Creation
1. User must be authenticated (`requireAuth`)
2. Organization must have < 10 active sessions
3. Scenario and persona must be valid IDs
4. Persona must be compatible with selected scenario
5. If CEO persona, user must have 5+ completed sessions with lower difficulty
6. Language must be one of: fr, en, it, de, es

### Evaluation Assignment Creation
1. Assigner must be Team Lead of a team containing the BDR
2. BDR must be member of the specified team
3. Scenario and persona must be valid
4. If deadline set, must be in the future

### Evaluation Attempt Start
1. Assignment must be in `pending` or `in_progress` status
2. `attemptsUsed` must be < `maxAttempts` (3)
3. 24-hour cooldown must have passed since last attempt
4. Audio consent must be given (`audioConsentGiven: true`)

---

## Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| trainingSessions | by_user | User's session history |
| trainingSessions | by_user_status | Filter user sessions by status |
| trainingSessions | by_user_created | User sessions sorted by date |
| trainingSessions | by_org_status | Concurrent session count per org |
| trainingSessions | by_status | Find all sessions by status (cron) |
| trainingSessions | by_status_heartbeat | Find stale active sessions |
| trainingSessions | by_evaluation_assignment | Sessions for an assignment |
| evaluationAssignments | by_assignee | BDR's evaluations |
| evaluationAssignments | by_assignee_status | BDR's pending evaluations |
| evaluationAssignments | by_assigner | Team Lead's assignments |
| evaluationAssignments | by_team | Team's evaluations |
| evaluationAssignments | by_deadline | Find approaching deadlines |
| aiTrainerNotifications | by_user_unread | User's unread notifications |

---

## Migration Notes

1. **No migrations required** - All tables are new
2. **Seed data required** - Must run seed script for scenarios and personas
3. **Cron jobs to add** - Stale session cleanup, timeout expiration, deadline checks
