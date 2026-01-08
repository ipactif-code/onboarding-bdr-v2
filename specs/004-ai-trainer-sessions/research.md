# Research: AI Sales Trainer Session Infrastructure

**Feature**: 004-ai-trainer-sessions
**Date**: 2026-01-08
**Status**: Complete

## Decisions Summary

### D1: Team Lead Detection

**Decision**: Use existing `teams.leadId` field to identify Team Leads

**Rationale**: The existing LMS has a teams system with `leadId: v.optional(v.id("users"))` in the schema. A user is a Team Lead if they are the `leadId` of any team. This avoids adding new roles to the Clerk/user system.

**Alternatives Considered**:
- Add new "team_lead" role to users table → Rejected: Would require schema migration and role management UI
- Use Clerk Organizations → Rejected: Teams already exist in Convex

**Implementation Pattern**:
```typescript
// Check if user is Team Lead of any team
const teamsLed = await ctx.db
  .query("teams")
  .filter((q) => q.eq(q.field("leadId"), userId))
  .collect();
const isTeamLead = teamsLed.length > 0;

// Get BDRs on a Team Lead's teams
const teamMembers = await ctx.db
  .query("teamMembers")
  .withIndex("by_team", (q) => q.eq("teamId", teamId))
  .collect();
```

---

### D2: LiveKit Integration Pattern

**Decision**: Use Convex action for room creation with token generation

**Rationale**: LiveKit requires server-side API calls with API key/secret. Convex actions are the correct pattern for external API calls per constitution.

**Implementation Pattern**:
```typescript
// convex/actions/livekit.ts
export const createRoom = action({
  args: { sessionId: v.id("trainingSessions") },
  handler: async (ctx, args) => {
    const roomName = `ai-trainer-${args.sessionId}`;
    // Use LiveKit Server SDK to create room
    // Store room name in session record
  },
});

export const generateToken = action({
  args: { sessionId: v.id("trainingSessions"), userId: v.id("users") },
  handler: async (ctx, args) => {
    // Generate participant token with user identity
  },
});
```

**Environment Variables Required**:
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_URL` (EU Frankfurt: `wss://livekit.eu.livekit.cloud`)

---

### D3: Session Status State Machine

**Decision**: Use discriminated union for session status with explicit transitions

**Statuses**:
- `pending` → Initial state when session created, waiting for voice connection
- `active` → Voice connected, conversation in progress
- `completed` → User explicitly ended session
- `abandoned` → 2 minutes of inactivity detected
- `expired` → Session hit timeout (60/90 min)

**Valid Transitions**:
```
pending → active (voice connected)
pending → abandoned (user never connected)
active → completed (user ends)
active → abandoned (inactivity)
active → expired (timeout)
```

---

### D4: Inactivity Detection Pattern

**Decision**: Use heartbeat mechanism with scheduled function cleanup

**Rationale**: WebSocket disconnection doesn't guarantee client-side detection. Use heartbeats from client + scheduled function to check for stale sessions.

**Implementation Pattern**:
```typescript
// Client sends heartbeat every 30 seconds
export const heartbeat = mutation({
  args: { sessionId: v.id("trainingSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastHeartbeatAt: Date.now() });
  },
});

// Cron runs every minute to check stale sessions
export const checkStaleSessions = internalMutation({
  handler: async (ctx) => {
    const threshold = Date.now() - 2 * 60 * 1000; // 2 minutes
    const staleSessions = await ctx.db
      .query("trainingSessions")
      .withIndex("by_status_heartbeat", (q) => q.eq("status", "active"))
      .filter((q) => q.lt(q.field("lastHeartbeatAt"), threshold))
      .collect();

    for (const session of staleSessions) {
      await ctx.db.patch(session._id, {
        status: "abandoned",
        endedAt: Date.now(),
      });
    }
  },
});
```

---

### D5: Persona Data Structure

**Decision**: Store personas as static seed data with localized fields

**Rationale**: 8 predefined personas, not user-created. Localization stored in JSON field.

**Structure**:
```typescript
personas: defineTable({
  // Identity (fixed across languages)
  identifier: v.string(), // "marc_dubois", "philippe_renault"

  // Localized content
  localizations: v.object({
    fr: v.object({
      name: v.string(),
      roleTitle: v.string(),
      companyContext: v.string(),
      personalityTraits: v.array(v.string()),
      preferredObjections: v.array(v.string()),
    }),
    en: v.object({ /* same shape */ }),
    it: v.object({ /* same shape */ }),
    de: v.object({ /* same shape */ }),
    es: v.object({ /* same shape */ }),
  }),

  // Scenario compatibility
  scenarios: v.array(v.union(v.literal("cold_call"), v.literal("discovery"))),

  // Difficulty
  difficulty: v.union(
    v.literal("easy"),
    v.literal("medium"),
    v.literal("hard"),
    v.literal("very_hard")
  ),

  // Unlock requirements
  requiresCompletedSessions: v.optional(v.number()), // 5 for CEO
})
```

---

### D6: Concurrent Session Limit Enforcement

**Decision**: Use atomic counter with optimistic locking

**Rationale**: Must prevent race conditions when multiple BDRs start sessions simultaneously.

**Implementation Pattern**:
```typescript
export const startSession = mutation({
  handler: async (ctx, args) => {
    // Count active sessions for org
    const activeSessions = await ctx.db
      .query("trainingSessions")
      .withIndex("by_org_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active")
      )
      .collect();

    if (activeSessions.length >= 10) {
      throw new Error("Organization session limit reached (10 concurrent)");
    }

    // Create session in pending state
    // Race condition handled by Convex transaction semantics
  },
});
```

---

### D7: Evaluation Assignment Workflow

**Decision**: Separate `evaluationAssignments` table linked to sessions

**Rationale**: Assignments have their own lifecycle (pending, in_progress, completed, locked, closed) independent of individual session attempts.

**Relationships**:
```
evaluationAssignments (1) → trainingSessions (0..3)
```

**Implementation Pattern**:
```typescript
evaluationAssignments: defineTable({
  assignedBy: v.id("users"), // Team Lead
  assignedTo: v.id("users"), // BDR
  teamId: v.id("teams"),

  // Configuration
  scenarioType: v.union(v.literal("cold_call"), v.literal("discovery")),
  personaId: v.id("personas"),
  language: v.union(v.literal("fr"), v.literal("en"), v.literal("it"), v.literal("de"), v.literal("es")),

  // Deadline
  deadline: v.optional(v.number()),

  // Progress
  status: v.union(
    v.literal("pending"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("locked"),
    v.literal("closed")
  ),
  attemptsUsed: v.number(), // 0-3

  // Consent
  audioConsentGiven: v.boolean(),
  audioConsentAt: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

---

### D8: Notification System

**Decision**: Use existing channel messaging for notifications + in-app toast

**Rationale**: No dedicated notification table exists. For MVP, use:
1. In-app toast notifications via Convex subscription
2. Create a system message in relevant conversation

**Implementation Pattern**:
```typescript
// Create notification record for real-time subscription
notifications: defineTable({
  userId: v.id("users"),
  type: v.union(
    v.literal("evaluation_assigned"),
    v.literal("evaluation_deadline_passed"),
    v.literal("evaluation_deadline_reminder")
  ),
  title: v.string(),
  message: v.string(),
  isRead: v.boolean(),
  relatedId: v.optional(v.string()), // evaluationAssignment ID
  createdAt: v.number(),
})
.index("by_user", ["userId"])
.index("by_user_unread", ["userId", "isRead"])
```

---

### D9: Session Timeout Implementation

**Decision**: Use Convex cron job to check for expired sessions

**Rationale**: Server-side timeout enforcement is more reliable than client-side timers.

**Implementation**:
```typescript
// Cron every 1 minute
export const checkExpiredSessions = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();

    // Cold Call: 60 min = 3,600,000 ms
    const coldCallThreshold = now - 60 * 60 * 1000;
    // Discovery: 90 min = 5,400,000 ms
    const discoveryThreshold = now - 90 * 60 * 1000;

    const expiredColdCalls = await ctx.db
      .query("trainingSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) =>
        q.and(
          q.eq(q.field("scenarioType"), "cold_call"),
          q.lt(q.field("startedAt"), coldCallThreshold)
        )
      )
      .collect();

    // Similar for discovery sessions...

    for (const session of [...expiredColdCalls, ...expiredDiscovery]) {
      await ctx.db.patch(session._id, {
        status: "expired",
        endedAt: now,
      });
    }
  },
});
```

---

### D10: 24-Hour Cooldown Enforcement

**Decision**: Check last completed evaluation attempt timestamp before allowing new attempt

**Implementation**:
```typescript
export const startEvaluationAttempt = mutation({
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId);

    // Find last completed session for this assignment's scenario
    const lastAttempt = await ctx.db
      .query("trainingSessions")
      .withIndex("by_user_scenario", (q) =>
        q.eq("userId", assignment.assignedTo)
         .eq("scenarioType", assignment.scenarioType)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("mode"), "evaluation"),
          q.eq(q.field("status"), "completed")
        )
      )
      .order("desc")
      .first();

    if (lastAttempt) {
      const cooldownEnd = lastAttempt.endedAt + 24 * 60 * 60 * 1000;
      if (Date.now() < cooldownEnd) {
        throw new Error(`Cooldown active until ${new Date(cooldownEnd).toISOString()}`);
      }
    }
  },
});
```

---

## Technology Stack Confirmation

| Component | Technology | Notes |
|-----------|------------|-------|
| Backend | Convex | EU region per constitution |
| Auth | Clerk | Existing integration |
| Voice | LiveKit Cloud | EU Frankfurt, WebRTC |
| Frontend | Next.js 15 + React 19 | App Router |
| Styling | Tailwind CSS 4 | Existing setup |
| UI Components | shadcn/ui | Existing setup |
| Testing | Vitest + convex-test | Per constitution |

---

## Open Items (Deferred to Implementation)

1. **Persona seed data content** - Actual names, traits, objections for 8 personas
2. **Exact LiveKit room configuration** - Audio-only, recording settings
3. **UI/UX wireframes** - Session setup flow, history page layout
4. **i18n keys** - Specific translation keys for UI strings
