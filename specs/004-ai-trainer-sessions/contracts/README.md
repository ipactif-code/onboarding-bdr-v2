# API Contracts: AI Sales Trainer Session Infrastructure

**Feature**: 004-ai-trainer-sessions
**Date**: 2026-01-08

## Overview

This directory contains the API contracts (type definitions and function signatures) for the AI Trainer session infrastructure. These contracts define the interface between the frontend and backend.

**Important**: These are TYPE DEFINITIONS only, not actual implementations. Implementation will be in `convex/aiTrainer/*.ts`.

## Contract Files

| File | Domain | Functions |
|------|--------|-----------|
| `sessions.ts` | Training Sessions | Session CRUD, LiveKit integration |
| `evaluations.ts` | Evaluations | Assignment management, Team Lead features |
| `notifications.ts` | Notifications | In-app notification system |

## Implementation Mapping

### Sessions → `convex/aiTrainer/sessions.ts`

| Contract | Convex Function Type | Notes |
|----------|---------------------|-------|
| `listScenarios` | query | Public, no auth |
| `listPersonas` | query | Auth required, filters by unlock |
| `listMySessions` | query | Auth required, paginated |
| `getSession` | query | Auth required, ownership check |
| `getActiveSession` | query | Auth required |
| `getCompletedSessionStats` | query | Auth required |
| `createSession` | mutation | Auth required, validates limits |
| `startSession` | mutation | Auth required, ownership check |
| `endSession` | mutation | Auth required, ownership check |
| `heartbeat` | mutation | Auth required |
| `createLivekitRoom` | action | Auth required, calls LiveKit API |
| `generateLivekitToken` | action | Auth required, calls LiveKit API |
| `checkStaleSessions` | internalMutation | Cron job (1 min) |
| `checkExpiredSessions` | internalMutation | Cron job (1 min) |

### Evaluations → `convex/aiTrainer/evaluations.ts`

| Contract | Convex Function Type | Notes |
|----------|---------------------|-------|
| `listMyEvaluations` | query | Auth required (BDR) |
| `getEvaluation` | query | Auth required (BDR) |
| `listAssignableBdrs` | query | Auth required (Team Lead) |
| `listMyTeams` | query | Auth required (Team Lead) |
| `listAssignedEvaluations` | query | Auth required (Team Lead) |
| `listTeamMemberSessions` | query | Auth required (Team Lead), read-only |
| `giveAudioConsent` | mutation | Auth required (BDR) |
| `startEvaluationAttempt` | mutation | Auth required (BDR) |
| `createEvaluationAssignment` | mutation | Auth required (Team Lead) |
| `extendDeadline` | mutation | Auth required (Team Lead) |
| `closeEvaluation` | mutation | Auth required (Team Lead) |
| `lockExpiredEvaluations` | internalMutation | Cron job (daily) |
| `sendDeadlineReminders` | internalMutation | Cron job (daily) |

### Notifications → `convex/aiTrainer/notifications.ts`

| Contract | Convex Function Type | Notes |
|----------|---------------------|-------|
| `listUnreadNotifications` | query | Auth required |
| `getUnreadCount` | query | Auth required |
| `listNotifications` | query | Auth required, paginated |
| `markAsRead` | mutation | Auth required |
| `markAllAsRead` | mutation | Auth required |
| `createNotification` | internalMutation | Called by other functions |

## Authorization Patterns

### BDR Authorization (default)
```typescript
export const myFunction = query({
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx); // First line
    // ... rest of function
  },
});
```

### Team Lead Authorization
```typescript
export const teamLeadFunction = mutation({
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const teamsLed = await ctx.db
      .query("teams")
      .filter((q) => q.eq(q.field("leadId"), identity.userId))
      .collect();
    if (teamsLed.length === 0) {
      throw new Error("Not a team lead");
    }
    // ... rest of function
  },
});
```

## Cron Schedule

| Job | Schedule | Function |
|-----|----------|----------|
| Check stale sessions | Every 1 minute | `checkStaleSessions` |
| Check expired sessions | Every 1 minute | `checkExpiredSessions` |
| Lock expired evaluations | Daily at 00:00 | `lockExpiredEvaluations` |
| Send deadline reminders | Daily at 08:00 | `sendDeadlineReminders` |

## Frontend Integration

### Hooks Structure

```typescript
// src/hooks/ai-trainer/
├── useScenarios.ts        // listScenarios
├── usePersonas.ts         // listPersonas
├── useMySessions.ts       // listMySessions with filters
├── useSession.ts          // getSession
├── useActiveSession.ts    // getActiveSession
├── useMyEvaluations.ts    // listMyEvaluations
├── useEvaluation.ts       // getEvaluation
├── useNotifications.ts    // notification queries
└── mutations/
    ├── useCreateSession.ts
    ├── useStartSession.ts
    ├── useEndSession.ts
    ├── useHeartbeat.ts
    ├── useStartEvaluationAttempt.ts
    └── ... (Team Lead mutations)
```

## Validation Rules

See `data-model.md` for complete validation rules including:
- Session creation validation
- Evaluation assignment validation
- Evaluation attempt validation
- 24-hour cooldown enforcement
