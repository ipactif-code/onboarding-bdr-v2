# Quickstart: AI Sales Trainer Session Infrastructure

**Feature**: 004-ai-trainer-sessions
**Date**: 2026-01-08

## Prerequisites

Before starting implementation, ensure:

1. **Environment Variables** (add to Convex dashboard):
   ```bash
   LIVEKIT_API_KEY=your-livekit-api-key
   LIVEKIT_API_SECRET=your-livekit-api-secret
   LIVEKIT_URL=wss://livekit.eu.livekit.cloud  # EU Frankfurt
   ```

2. **Dependencies** (if not already installed):
   ```bash
   pnpm add livekit-server-sdk
   pnpm add @livekit/components-react @livekit/components-styles
   ```

3. **Existing System Check**:
   - `teams` table has `leadId` field ✓
   - `teamMembers` table exists ✓
   - `requireAuth()` helper exists in `convex/lib/auth.ts` ✓

---

## Implementation Order

### Phase 1: Schema & Seed Data

1. **Add tables to schema** (`convex/schema.ts`):
   - `aiTrainerScenarios`
   - `aiTrainerPersonas`
   - `trainingSessions`
   - `evaluationAssignments`
   - `aiTrainerNotifications`
   - `aiTrainerSessionLogs`

2. **Create seed script** (`convex/aiTrainer/seed.ts`):
   ```bash
   npx convex run aiTrainer/seed:seedScenarios
   npx convex run aiTrainer/seed:seedPersonas
   ```

### Phase 2: Core Session Functions

3. **Session queries** (`convex/aiTrainer/sessions.ts`):
   - `listScenarios`
   - `listPersonas`
   - `listMySessions`
   - `getSession`
   - `getActiveSession`

4. **Session mutations** (`convex/aiTrainer/sessions.ts`):
   - `createSession`
   - `startSession`
   - `endSession`
   - `heartbeat`

5. **LiveKit actions** (`convex/aiTrainer/actions/livekit.ts`):
   - `createLivekitRoom`
   - `generateLivekitToken`

### Phase 3: Evaluation Features

6. **Evaluation queries** (`convex/aiTrainer/evaluations.ts`):
   - `listMyEvaluations`
   - `getEvaluation`
   - `listAssignableBdrs`
   - `listMyTeams`
   - `listAssignedEvaluations`
   - `listTeamMemberSessions`

7. **Evaluation mutations** (`convex/aiTrainer/evaluations.ts`):
   - `giveAudioConsent`
   - `startEvaluationAttempt`
   - `createEvaluationAssignment`
   - `extendDeadline`
   - `closeEvaluation`

### Phase 4: Background Jobs

8. **Cron jobs** (`convex/crons.ts`):
   - `checkStaleSessions` (every 1 min)
   - `checkExpiredSessions` (every 1 min)
   - `lockExpiredEvaluations` (daily)
   - `sendDeadlineReminders` (daily)

9. **Notifications** (`convex/aiTrainer/notifications.ts`):
   - All notification queries and mutations

### Phase 5: Frontend

10. **Session setup UI** (`src/app/(dashboard)/ai-trainer/page.tsx`):
    - Language selector
    - Scenario selector
    - Persona grid with unlock status
    - Start session button

11. **Session room UI** (`src/app/(dashboard)/ai-trainer/session/[id]/page.tsx`):
    - LiveKit room integration
    - End session button
    - Duration display

12. **History UI** (`src/app/(dashboard)/ai-trainer/history/page.tsx`):
    - Session list with filters
    - Pagination

13. **Evaluations UI** (`src/app/(dashboard)/ai-trainer/evaluations/page.tsx`):
    - BDR view: My evaluations
    - Team Lead view: Assign & manage

---

## File Structure

```
convex/
├── aiTrainer/
│   ├── sessions.ts        # Session queries & mutations
│   ├── evaluations.ts     # Evaluation queries & mutations
│   ├── notifications.ts   # Notification functions
│   ├── seed.ts            # Seed data scripts
│   └── actions/
│       └── livekit.ts     # LiveKit room & token actions
├── crons.ts               # Add AI Trainer cron jobs
└── schema.ts              # Add new tables

src/
├── app/(dashboard)/ai-trainer/
│   ├── page.tsx           # Session setup
│   ├── session/[id]/
│   │   └── page.tsx       # Active session room
│   ├── history/
│   │   └── page.tsx       # Session history
│   └── evaluations/
│       └── page.tsx       # Evaluations management
├── components/ai-trainer/
│   ├── ScenarioSelector.tsx
│   ├── PersonaGrid.tsx
│   ├── LanguageSelector.tsx
│   ├── SessionSetupForm.tsx
│   ├── SessionRoom.tsx
│   ├── SessionHistory.tsx
│   ├── SessionHistoryFilters.tsx
│   ├── EvaluationCard.tsx
│   ├── EvaluationAssignForm.tsx
│   └── AudioConsentDialog.tsx
└── hooks/ai-trainer/
    ├── useScenarios.ts
    ├── usePersonas.ts
    ├── useMySessions.ts
    ├── useSession.ts
    ├── useActiveSession.ts
    ├── useMyEvaluations.ts
    ├── useEvaluation.ts
    ├── useNotifications.ts
    └── mutations/
        ├── useCreateSession.ts
        ├── useStartSession.ts
        ├── useEndSession.ts
        └── useHeartbeat.ts
```

---

## Testing Strategy

### Unit Tests (Vitest + convex-test)

```typescript
// tests/unit/ai-trainer/sessions.test.ts
describe("createSession", () => {
  it("creates session in pending state", async () => { });
  it("validates persona-scenario compatibility", async () => { });
  it("enforces org concurrent limit", async () => { });
  it("blocks locked CEO persona", async () => { });
});

describe("startSession", () => {
  it("transitions pending to active", async () => { });
  it("records startedAt timestamp", async () => { });
  it("fails for non-pending session", async () => { });
});
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/ai-trainer/session-flow.spec.ts
test("BDR can start and complete a free practice session", async () => { });
test("BDR sees filtered personas for selected scenario", async () => { });
test("Team Lead can assign evaluation to BDR", async () => { });
```

---

## Environment Setup

### Development
```bash
# Start Convex dev server
npx convex dev

# Start Next.js dev server
pnpm dev

# Run seed scripts (first time only)
npx convex run aiTrainer/seed:seedScenarios
npx convex run aiTrainer/seed:seedPersonas
```

### Testing
```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e
```

---

## Key Patterns to Follow

### 1. Auth First Line
```typescript
export const myQuery = query({
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx); // ALWAYS FIRST LINE
    // ...
  },
});
```

### 2. Use Indexes
```typescript
// CORRECT - uses index
const sessions = await ctx.db
  .query("trainingSessions")
  .withIndex("by_user_status", (q) =>
    q.eq("userId", identity.userId).eq("status", "active")
  )
  .collect();

// WRONG - full scan
const sessions = await ctx.db
  .query("trainingSessions")
  .filter((q) => q.eq(q.field("userId"), identity.userId))
  .collect();
```

### 3. Team Lead Check
```typescript
const teamsLed = await ctx.db
  .query("teams")
  .filter((q) => q.eq(q.field("leadId"), identity.userId))
  .collect();
if (teamsLed.length === 0) {
  throw new Error("User is not a team lead");
}
```

### 4. Timestamps
```typescript
// Always use Date.now() (milliseconds)
createdAt: Date.now(),
startedAt: Date.now(),
```

---

## Common Gotchas

1. **LiveKit in EU**: Make sure `LIVEKIT_URL` points to EU Frankfurt region
2. **Organization ID**: Use Clerk's `orgId` from `requireAuth()` context
3. **Heartbeat Interval**: Client should send heartbeat every 30 seconds
4. **Cron Timing**: Session cleanup runs every minute, evaluation cleanup daily
5. **Language Immutability**: Session language cannot change after creation
