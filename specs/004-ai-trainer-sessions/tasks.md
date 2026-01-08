# Tasks: AI Sales Trainer Session Infrastructure

**Input**: Design documents from `/specs/004-ai-trainer-sessions/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Tests are NOT explicitly requested. Test tasks are minimal (quality gates only).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Convex Backend**: `convex/aiTrainer/*.ts`
- **Frontend Pages**: `src/app/(dashboard)/ai-trainer/**/*.tsx`
- **Components**: `src/components/ai-trainer/*.tsx`
- **Hooks**: `src/hooks/ai-trainer/*.ts`
- **Tests**: `tests/unit/ai-trainer/*.test.ts`, `tests/e2e/ai-trainer/*.spec.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and base configuration

- [ ] T001 Install LiveKit dependencies: `pnpm add livekit-server-sdk @livekit/components-react @livekit/components-styles`
- [ ] T002 [P] Add LiveKit environment variables to `.env.example` and Convex dashboard (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL)
- [ ] T003 [P] Create AI Trainer directory structure: `convex/aiTrainer/`, `src/components/ai-trainer/`, `src/hooks/ai-trainer/`
- [ ] T004 [P] Add i18n keys for AI Trainer in existing locale files (scenario names, persona traits, notification messages)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, seed data, and core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Schema & Types

- [ ] T005 Add `aiTrainerScenarios` table to `convex/schema.ts` with indexes per data-model.md
- [ ] T006 [P] Add `aiTrainerPersonas` table to `convex/schema.ts` with indexes per data-model.md
- [ ] T007 [P] Add `trainingSessions` table to `convex/schema.ts` with all indexes per data-model.md
- [ ] T008 [P] Add `evaluationAssignments` table to `convex/schema.ts` with indexes per data-model.md
- [ ] T009 [P] Add `aiTrainerNotifications` table to `convex/schema.ts` with indexes per data-model.md
- [ ] T010 [P] Add `aiTrainerSessionLogs` table to `convex/schema.ts` with indexes per data-model.md
- [ ] T011 Run `npx convex dev` to generate types and verify schema compiles

### Seed Data

- [ ] T012 Create seed script for scenarios in `convex/aiTrainer/seed.ts` (cold_call, discovery with duration configs)
- [ ] T013 [P] Create seed script for personas in `convex/aiTrainer/seed.ts` (8 personas with 5-language localizations)
- [ ] T014 Run seed scripts: `npx convex run aiTrainer/seed:seedScenarios` and `npx convex run aiTrainer/seed:seedPersonas`

### Core Queries (Shared)

- [ ] T015 Implement `listScenarios` query in `convex/aiTrainer/sessions.ts` (public, returns all scenarios)
- [ ] T016 [P] Implement `listPersonas` query in `convex/aiTrainer/sessions.ts` (auth required, filters by scenario, calculates unlock status)
- [ ] T017 [P] Implement `getCompletedSessionStats` query in `convex/aiTrainer/sessions.ts` (auth required, counts by difficulty)

### LiveKit Actions

- [ ] T018 Implement `createLivekitRoom` action in `convex/aiTrainer/actions/livekit.ts` (creates room via LiveKit Server SDK)
- [ ] T019 [P] Implement `generateLivekitToken` action in `convex/aiTrainer/actions/livekit.ts` (generates JWT with user identity)

### Notification Infrastructure

- [ ] T020 Implement `createNotification` internal mutation in `convex/aiTrainer/notifications.ts`
- [ ] T021 [P] Implement `listUnreadNotifications` query in `convex/aiTrainer/notifications.ts`
- [ ] T022 [P] Implement `getUnreadCount` query in `convex/aiTrainer/notifications.ts`
- [ ] T023 [P] Implement `markAsRead` mutation in `convex/aiTrainer/notifications.ts`
- [ ] T024 [P] Implement `markAllAsRead` mutation in `convex/aiTrainer/notifications.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Start a Free Practice Session (Priority: P1) 🎯 MVP

**Goal**: BDR can select language, scenario, persona and start a practice session connected to LiveKit

**Independent Test**: BDR logs in → navigates to AI Trainer → selects options → clicks Start → sees LiveKit room connecting

### Backend for US1

- [ ] T025 [US1] Implement `createSession` mutation in `convex/aiTrainer/sessions.ts` (validates persona-scenario compatibility, org limit, persona unlock)
- [ ] T026 [US1] Implement `getActiveSession` query in `convex/aiTrainer/sessions.ts` (returns user's current active session if any)
- [ ] T027 [US1] Implement `startSession` mutation in `convex/aiTrainer/sessions.ts` (transitions pending→active, sets startedAt)
- [ ] T028 [US1] Implement session logging helper in `convex/aiTrainer/sessions.ts` (logs to aiTrainerSessionLogs)

### Frontend Components for US1

- [ ] T029 [P] [US1] Create `LanguageSelector` component in `src/components/ai-trainer/LanguageSelector.tsx` (5 language options with flags)
- [ ] T030 [P] [US1] Create `ScenarioSelector` component in `src/components/ai-trainer/ScenarioSelector.tsx` (Cold Call, Discovery cards)
- [ ] T031 [P] [US1] Create `PersonaGrid` component in `src/components/ai-trainer/PersonaGrid.tsx` (filtered by scenario, shows unlock status)
- [ ] T032 [US1] Create `SessionSetupForm` component in `src/components/ai-trainer/SessionSetupForm.tsx` (combines selectors, Start button)

### Frontend Hooks for US1

- [ ] T033 [P] [US1] Create `useScenarios` hook in `src/hooks/ai-trainer/useScenarios.ts`
- [ ] T034 [P] [US1] Create `usePersonas` hook in `src/hooks/ai-trainer/usePersonas.ts` (accepts scenarioId, language)
- [ ] T035 [P] [US1] Create `useActiveSession` hook in `src/hooks/ai-trainer/useActiveSession.ts`
- [ ] T036 [US1] Create `useCreateSession` mutation hook in `src/hooks/ai-trainer/mutations/useCreateSession.ts`

### Frontend Pages for US1

- [ ] T037 [US1] Create AI Trainer landing page at `src/app/(dashboard)/ai-trainer/page.tsx` (session setup UI)
- [ ] T038 [US1] Create `SessionRoom` component in `src/components/ai-trainer/SessionRoom.tsx` (LiveKit integration, audio-only)
- [ ] T039 [US1] Create session page at `src/app/(dashboard)/ai-trainer/session/[id]/page.tsx` (displays SessionRoom)

### Integration for US1

- [ ] T040 [US1] Wire up SessionSetupForm to call createSession → createLivekitRoom → generateLivekitToken → redirect to session page
- [ ] T041 [US1] Implement LiveKit room connection in SessionRoom (connect on mount, call startSession when connected)

**Checkpoint**: User Story 1 complete - BDR can start a free practice session

---

## Phase 4: User Story 2 - End a Training Session (Priority: P1)

**Goal**: BDR can end session gracefully, see duration, and handle unexpected disconnections

**Independent Test**: BDR in active session → clicks End → sees completion screen with duration → session marked completed

### Backend for US2

- [ ] T042 [US2] Implement `endSession` mutation in `convex/aiTrainer/sessions.ts` (transitions active→completed, calculates duration)
- [ ] T043 [US2] Implement `heartbeat` mutation in `convex/aiTrainer/sessions.ts` (updates lastHeartbeatAt)
- [ ] T044 [US2] Implement `getSession` query in `convex/aiTrainer/sessions.ts` (returns full session details with persona/scenario names)

### Cron Jobs for US2

- [ ] T045 [US2] Implement `checkStaleSessions` internal mutation in `convex/aiTrainer/sessions.ts` (marks abandoned after 2 min no heartbeat)
- [ ] T046 [US2] Implement `checkExpiredSessions` internal mutation in `convex/aiTrainer/sessions.ts` (marks expired at 60/90 min)
- [ ] T047 [US2] Add cron job entries to `convex/crons.ts` for checkStaleSessions (every 1 min) and checkExpiredSessions (every 1 min)

### Frontend for US2

- [ ] T048 [P] [US2] Create `useEndSession` mutation hook in `src/hooks/ai-trainer/mutations/useEndSession.ts`
- [ ] T049 [P] [US2] Create `useHeartbeat` hook in `src/hooks/ai-trainer/mutations/useHeartbeat.ts` (sends heartbeat every 30 sec)
- [ ] T050 [P] [US2] Create `useSession` hook in `src/hooks/ai-trainer/useSession.ts` (fetches session by ID)
- [ ] T051 [US2] Add End Session button to `SessionRoom` component with confirmation dialog
- [ ] T052 [US2] Create `SessionSummary` component in `src/components/ai-trainer/SessionSummary.tsx` (shows duration, status)
- [ ] T053 [US2] Add heartbeat effect to `SessionRoom` component (calls useHeartbeat while active)
- [ ] T054 [US2] Handle disconnection in `SessionRoom` (detect LiveKit disconnect, show reconnection UI or summary)

**Checkpoint**: User Stories 1 AND 2 complete - Full session lifecycle works

---

## Phase 5: User Story 3 - View Session History (Priority: P2)

**Goal**: BDR can view past sessions with filters and pagination

**Independent Test**: BDR with past sessions → navigates to History → sees paginated list → applies filters → results update

### Backend for US3

- [ ] T055 [US3] Implement `listMySessions` query in `convex/aiTrainer/sessions.ts` (paginated, filterable by scenario/language/date/mode)

### Frontend for US3

- [ ] T056 [P] [US3] Create `useMySessions` hook in `src/hooks/ai-trainer/useMySessions.ts` (accepts filters, paginationOpts)
- [ ] T057 [P] [US3] Create `SessionHistoryFilters` component in `src/components/ai-trainer/SessionHistoryFilters.tsx` (scenario, language, date range dropdowns)
- [ ] T058 [US3] Create `SessionHistory` component in `src/components/ai-trainer/SessionHistory.tsx` (table/list with pagination)
- [ ] T059 [US3] Create history page at `src/app/(dashboard)/ai-trainer/history/page.tsx`

**Checkpoint**: User Story 3 complete - BDR can view and filter session history

---

## Phase 6: User Story 4 - Assign Evaluation Session (Priority: P2)

**Goal**: Team Lead can assign evaluations to BDRs; BDRs can view and start evaluation attempts

**Independent Test**: Team Lead assigns evaluation → BDR sees it in Evaluations tab → BDR gives consent → starts attempt

### Backend for US4 - Team Lead

- [ ] T060 [US4] Implement `listMyTeams` query in `convex/aiTrainer/evaluations.ts` (returns teams where user is leadId)
- [ ] T061 [US4] Implement `listAssignableBdrs` query in `convex/aiTrainer/evaluations.ts` (team members with pending eval count)
- [ ] T062 [US4] Implement `createEvaluationAssignment` mutation in `convex/aiTrainer/evaluations.ts` (validates Team Lead, creates assignment, sends notification)
- [ ] T063 [US4] Implement `listAssignedEvaluations` query in `convex/aiTrainer/evaluations.ts` (Team Lead's assignments with status filter)
- [ ] T064 [US4] Implement `listTeamMemberSessions` query in `convex/aiTrainer/evaluations.ts` (read-only access per FR-051)

### Backend for US4 - BDR

- [ ] T065 [US4] Implement `listMyEvaluations` query in `convex/aiTrainer/evaluations.ts` (BDR's pending/in_progress assignments)
- [ ] T066 [US4] Implement `getEvaluation` query in `convex/aiTrainer/evaluations.ts` (full assignment details with attempts)
- [ ] T067 [US4] Implement `giveAudioConsent` mutation in `convex/aiTrainer/evaluations.ts` (records consent before first attempt)
- [ ] T068 [US4] Implement `startEvaluationAttempt` mutation in `convex/aiTrainer/evaluations.ts` (validates cooldown, attempts, consent; creates session in evaluation mode)

### Backend for US4 - Deadline Management

- [ ] T069 [US4] Implement `extendDeadline` mutation in `convex/aiTrainer/evaluations.ts` (Team Lead extends locked assignment)
- [ ] T070 [US4] Implement `closeEvaluation` mutation in `convex/aiTrainer/evaluations.ts` (Team Lead closes as incomplete)
- [ ] T071 [US4] Implement `lockExpiredEvaluations` internal mutation in `convex/aiTrainer/evaluations.ts`
- [ ] T072 [US4] Implement `sendDeadlineReminders` internal mutation in `convex/aiTrainer/evaluations.ts` (24h before deadline)
- [ ] T073 [US4] Add cron job entries to `convex/crons.ts` for lockExpiredEvaluations (daily 00:00) and sendDeadlineReminders (daily 08:00)

### Frontend Hooks for US4

- [ ] T074 [P] [US4] Create `useMyTeams` hook in `src/hooks/ai-trainer/useMyTeams.ts`
- [ ] T075 [P] [US4] Create `useAssignableBdrs` hook in `src/hooks/ai-trainer/useAssignableBdrs.ts`
- [ ] T076 [P] [US4] Create `useMyEvaluations` hook in `src/hooks/ai-trainer/useMyEvaluations.ts`
- [ ] T077 [P] [US4] Create `useEvaluation` hook in `src/hooks/ai-trainer/useEvaluation.ts`
- [ ] T078 [P] [US4] Create `useAssignedEvaluations` hook in `src/hooks/ai-trainer/useAssignedEvaluations.ts`
- [ ] T079 [US4] Create evaluation mutation hooks in `src/hooks/ai-trainer/mutations/` (createEvaluationAssignment, giveAudioConsent, startEvaluationAttempt, extendDeadline, closeEvaluation)

### Frontend Components for US4

- [ ] T080 [P] [US4] Create `EvaluationCard` component in `src/components/ai-trainer/EvaluationCard.tsx` (shows assignment details, attempts, cooldown)
- [ ] T081 [P] [US4] Create `AudioConsentDialog` component in `src/components/ai-trainer/AudioConsentDialog.tsx` (consent checkbox, legal text)
- [ ] T082 [P] [US4] Create `EvaluationAssignForm` component in `src/components/ai-trainer/EvaluationAssignForm.tsx` (BDR selector, scenario, persona, deadline)
- [ ] T083 [US4] Create `TeamMemberSessionHistory` component in `src/components/ai-trainer/TeamMemberSessionHistory.tsx` (read-only view)

### Frontend Pages for US4

- [ ] T084 [US4] Create evaluations page at `src/app/(dashboard)/ai-trainer/evaluations/page.tsx` (tabs: My Evaluations / Assign & Manage)
- [ ] T085 [US4] Integrate EvaluationCard list in My Evaluations tab (BDR view)
- [ ] T086 [US4] Integrate EvaluationAssignForm and assigned evaluations table in Assign & Manage tab (Team Lead view)
- [ ] T087 [US4] Wire startEvaluationAttempt to create session and redirect to session page

**Checkpoint**: User Story 4 complete - Evaluation assignment workflow functional

---

## Phase 7: User Story 5 - Manage Concurrent Session Limits (Priority: P3)

**Goal**: System enforces 10 concurrent sessions per org and auto-expires sessions at timeout

**Independent Test**: 10 sessions active → 11th attempt blocked → session at 60min auto-expires

### Backend for US5

- [ ] T088 [US5] Add org concurrent session check to `createSession` mutation (count active sessions by org, block if ≥ 10)
- [ ] T089 [US5] Verify checkExpiredSessions cron correctly uses scenario-specific timeouts (60min cold_call, 90min discovery)
- [ ] T090 [US5] Add structured logging for limit reached and timeout events to aiTrainerSessionLogs

### Frontend for US5

- [ ] T091 [US5] Show user-friendly error when concurrent limit reached in SessionSetupForm
- [ ] T092 [US5] Display remaining time in SessionRoom (countdown to auto-expire)
- [ ] T093 [US5] Handle expired status gracefully (redirect to summary with "Session Expired" message)

**Checkpoint**: User Story 5 complete - System limits enforced

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, navigation, and final integration

### Navigation & Layout

- [ ] T094 Add AI Trainer link to dashboard navigation in `src/components/layout/Sidebar.tsx` or equivalent
- [ ] T095 [P] Add notification badge to AI Trainer nav item using getUnreadCount

### Notification UI

- [ ] T096 Create `NotificationList` component in `src/components/ai-trainer/NotificationList.tsx`
- [ ] T097 Integrate NotificationList in AI Trainer header or dropdown

### Quality Gates

- [ ] T098 Run `pnpm typecheck` - verify no TypeScript errors
- [ ] T099 Run `pnpm lint` - verify no ESLint errors
- [ ] T100 Run `pnpm test` - verify unit tests pass (if any added)
- [ ] T101 Manual smoke test: Complete full session flow (start → end → view history)
- [ ] T102 Manual smoke test: Complete evaluation flow (assign → consent → attempt)

### Documentation

- [ ] T103 Update README with AI Trainer feature overview
- [ ] T104 Verify all env vars documented in `.env.example`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ◄── BLOCKS ALL USER STORIES
    │
    ├──────────────────────────────────────┐
    │                                      │
    ▼                                      ▼
Phase 3 (US1) ──► Phase 4 (US2) ──► Phase 5 (US3)
    │                                      │
    │                                      │
    │              ┌───────────────────────┘
    │              │
    ▼              ▼
Phase 6 (US4) ──► Phase 7 (US5)
    │
    ▼
Phase 8 (Polish)
```

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|------------|-------------------|
| US1 (Start Session) | Phase 2 | - |
| US2 (End Session) | US1 | - |
| US3 (History) | Phase 2 | US1, US2 |
| US4 (Evaluations) | Phase 2, US1 | US3 |
| US5 (Limits) | US1, US2 | US3, US4 |

### Within Each User Story

1. Backend mutations/queries FIRST
2. Frontend hooks NEXT (can parallel)
3. Frontend components NEXT (can parallel)
4. Frontend pages LAST (integration)

### Parallel Opportunities

**Phase 2 (8 parallel streams):**
```
T006, T007, T008, T009, T010 (schema tables)
T012, T013 (seed scripts)
T016, T017 (queries)
T019 (action)
T021, T022, T023, T024 (notifications)
```

**Phase 3 - US1 (6 parallel streams):**
```
T029, T030, T031 (components)
T033, T034, T035 (hooks)
```

**Phase 4 - US2 (3 parallel streams):**
```
T048, T049, T050 (hooks)
```

**Phase 6 - US4 (6 parallel streams):**
```
T074, T075, T076, T077, T078 (hooks)
T080, T081, T082 (components)
```

---

## Parallel Example: Phase 2 Foundation

```bash
# Launch schema tasks in parallel:
Task: "Add aiTrainerPersonas table to convex/schema.ts"
Task: "Add trainingSessions table to convex/schema.ts"
Task: "Add evaluationAssignments table to convex/schema.ts"
Task: "Add aiTrainerNotifications table to convex/schema.ts"
Task: "Add aiTrainerSessionLogs table to convex/schema.ts"

# After schema compiles, launch queries in parallel:
Task: "Implement listPersonas query in convex/aiTrainer/sessions.ts"
Task: "Implement getCompletedSessionStats query in convex/aiTrainer/sessions.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T024)
3. Complete Phase 3: User Story 1 (T025-T041)
4. Complete Phase 4: User Story 2 (T042-T054)
5. **STOP and VALIDATE**: Test full session lifecycle
6. Deploy/demo if ready

### Incremental Delivery

| Milestone | Stories | Deliverable |
|-----------|---------|-------------|
| MVP | US1 + US2 | BDR can practice sessions |
| v1.1 | + US3 | Session history available |
| v1.2 | + US4 | Team Lead evaluations |
| v1.3 | + US5 | System limits enforced |
| v1.4 | Polish | Full feature complete |

### Parallel Team Strategy

With 3 developers after Phase 2:
- **Dev A**: US1 → US2 (session lifecycle)
- **Dev B**: US3 (history) → US5 (limits)
- **Dev C**: US4 (evaluations)

---

## Agent Assignments

| Task Range | Primary Agent | Notes |
|------------|---------------|-------|
| T001-T004 | `backend-engineer` | Setup & config |
| T005-T024 | `schema-architect` → `backend-engineer` | Schema then queries |
| T025-T028 | `backend-engineer` | Session mutations |
| T029-T032 | `frontend-engineer` | UI components |
| T033-T041 | `frontend-engineer` | Hooks and pages |
| T042-T047 | `backend-engineer` | End session & crons |
| T048-T054 | `frontend-engineer` | End session UI |
| T055-T059 | `backend-engineer` → `frontend-engineer` | History feature |
| T060-T087 | `backend-engineer` → `frontend-engineer` | Evaluations |
| T088-T093 | `backend-engineer` → `frontend-engineer` | Limits |
| T094-T104 | `frontend-engineer` | Polish |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All Convex functions MUST have `requireAuth()` as first line (except listScenarios)
- Use `.withIndex()` for all queries - never `.filter()` on full scan
- Timestamps use `Date.now()` (milliseconds)
