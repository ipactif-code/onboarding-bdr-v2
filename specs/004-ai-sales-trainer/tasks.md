# Tasks: AI Sales Trainer

**Input**: Design documents from `/specs/004-ai-sales-trainer/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Test tasks are included for critical paths. Follow TDD where specified.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## User Story Summary

| ID | Priority | Title | Core MVP |
|----|----------|-------|----------|
| US1 | P1 | BDR Completes Free Practice Session | 🎯 YES |
| US2 | P2 | BDR Completes Assigned Evaluation | |
| US3 | P2 | Manager Assigns Evaluations to Team | |
| US7 | P2 | BDR Manages Consent Preferences | |
| US4 | P3 | Manager Reviews Evaluation Recording | |
| US5 | P3 | BDR Earns Certification | |
| US6 | P3 | BDR Receives Weekly AI Coach Plan | |
| US8 | P4 | Admin Views Aggregate Analytics | |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project structure, dependencies, environment configuration

- [ ] T001 [Setup] Create `agent/` directory structure per plan.md
- [ ] T002 [Setup] Initialize Python agent with `pyproject.toml` and uv dependencies
- [ ] T003 [P] [Setup] Add LiveKit SDK dependencies to Next.js (`@livekit/components-react`, `livekit-client`)
- [ ] T004 [P] [Setup] Configure environment variables in `.env.example` per quickstart.md
- [ ] T005 [P] [Setup] Add required npm packages: `@cartesia/cartesia-js`, `simli-client`
- [ ] T006 [Setup] Create `src/app/(dashboard)/training/` directory structure
- [ ] T007 [P] [Setup] Create `convex/training/` directory structure for training domain

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### 2A: Convex Schema & Core Tables

- [ ] T008 [Foundation] Add training tables to `convex/schema.ts`:
  - trainingConsents
  - trainingPersonas
  - trainingScenarios
  - trainingSessions
  - trainingTranscripts
  - trainingWhispers
  - trainingCheckpoints
  - trainingRecordings
  - trainingScores
  - trainingEvaluations
  - trainingCertifications
  - certificationAttempts
  - trainingCoachingPlans
  - trainingAuditLogs
- [ ] T009 [Foundation] Run `npx convex dev` to validate schema and generate types
- [ ] T010 [P] [Foundation] Create `convex/lib/trainingAuth.ts` with agent service token validation
- [ ] T011 [P] [Foundation] Create `convex/lib/consentHelpers.ts` with consent validation utilities

### 2B: LiveKit Integration

- [ ] T012 [Foundation] Create `convex/actions/livekit.ts` with `generateLivekitToken` action
- [ ] T013 [Foundation] Create `src/lib/livekit/client.ts` with LiveKit room connection utilities
- [ ] T014 [P] [Foundation] Create `src/hooks/use-livekit-room.ts` for room state management
- [ ] T015 [P] [Foundation] Create `src/components/training/livekit-provider.tsx` context wrapper

### 2C: Python Agent Foundation

- [ ] T016 [Foundation] Create `agent/agent/__init__.py` with package initialization
- [ ] T017 [Foundation] Create `agent/agent/main.py` with LiveKit agent entrypoint
- [ ] T018 [P] [Foundation] Create `agent/agent/config.py` with environment configuration
- [ ] T019 [P] [Foundation] Create `agent/agent/convex_client.py` for Convex HTTP API communication
- [ ] T020 [Foundation] Create `agent/agent/voice_pipeline.py` with Deepgram STT + Cartesia TTS base

### 2D: HTTP Actions (Agent Bridge)

- [ ] T021 [Foundation] Create `convex/http.ts` with training agent routes:
  - POST /api/training/agent/session-started
  - POST /api/training/agent/transcript
  - POST /api/training/agent/whisper
  - POST /api/training/agent/checkpoint
  - GET /api/training/agent/checkpoint/:sessionId
  - POST /api/training/agent/session-completed
  - POST /api/training/agent/error
  - GET /api/training/agent/session/:sessionId/config
  - GET /api/training/agent/session/:sessionId/transcript
- [ ] T022 [Foundation] Create `convex/training/agentBridge.ts` with internal mutations for HTTP handlers

**Checkpoint**: Foundation ready - schema, LiveKit, agent bridge functional

---

## Phase 3: User Story 7 - Consent Management (Priority: P2) 🔒

**Goal**: BDR can grant, view, and withdraw GDPR consent for voice training features

**Why First**: Consent is required before ANY session can start (US1, US2 depend on this)

**Independent Test**: User can view consent UI, grant consent, see expiry info, and withdraw

### Convex Backend (US7)

- [ ] T023 [US7] Create `convex/training/consent.ts` with queries:
  - `getMyConsent` - Get current user's consent status
  - `canStartSession` - Check if user can start practice/evaluation
  - `getConsentText` - Get consent text by language
  - `getConsentHistory` - Get consent audit trail
- [ ] T024 [US7] Add mutations to `convex/training/consent.ts`:
  - `grantConsent` - Grant or update consent
  - `renewConsent` - Renew before expiration
  - `withdrawConsent` - Withdraw specific types
  - `withdrawAllConsent` - Full opt-out
- [ ] T025 [P] [US7] Create `convex/training/consentCrons.ts` with scheduled jobs:
  - `internalSendExpiryReminders` - Weekly expiry reminders
  - `internalMarkExpiredConsents` - Daily expiration check
- [ ] T026 [US7] Add consent validation to session start flow in `convex/lib/consentHelpers.ts`

### Frontend (US7)

- [ ] T027 [US7] Create `src/app/(dashboard)/training/consent/page.tsx` - Consent management page
- [ ] T028 [P] [US7] Create `src/components/training/consent-form.tsx` - Consent grant form
- [ ] T029 [P] [US7] Create `src/components/training/consent-status.tsx` - Status display card
- [ ] T030 [US7] Create `src/components/training/consent-expiry-banner.tsx` - Expiry warning banner
- [ ] T031 [US7] Create `src/hooks/use-training-consent.ts` - Consent state hook

### Tests (US7)

- [ ] T032 [P] [US7] Create `tests/unit/convex/training/consent.test.ts` - Consent mutations tests
- [ ] T033 [P] [US7] Create `tests/unit/components/training/consent-form.test.tsx` - Form tests

**Checkpoint**: Consent system complete - users can grant consent to enable training

---

## Phase 4: User Story 1 - Free Practice Session (Priority: P1) 🎯 MVP

**Goal**: BDR can start a practice session, converse with AI avatar, receive real-time whispers, and see immediate score

**Independent Test**: User selects persona/scenario, starts session, speaks, sees avatar respond, receives whispers, ends session, views score

### Personas & Scenarios Backend (US1)

- [ ] T034 [US1] Create `convex/training/personas.ts` with queries:
  - `listPersonas` - List available personas with filters
  - `getPersona` - Get single persona details
- [ ] T035 [P] [US1] Create `convex/training/scenarios.ts` with queries:
  - `listScenarios` - List scenarios with filters
  - `getScenario` - Get scenario with objectives
  - `getScenariosForPersona` - Get compatible scenarios

### Session Backend (US1)

- [ ] T036 [US1] Create `convex/training/sessions.ts` with queries:
  - `getSession` - Get session with joined persona/scenario
  - `listMySessions` - List user's sessions with pagination
  - `getMySessionStats` - Dashboard statistics
  - `getActiveSession` - Get active session for reconnection
- [ ] T037 [US1] Add mutations to `convex/training/sessions.ts`:
  - `startSession` - Start new session with consent validation
  - `updateSessionStatus` - Update session status
  - `endSession` - End session with scoring trigger
  - `pauseSession` - Pause practice session
  - `resumeSession` - Resume paused session

### Transcript & Whisper Backend (US1)

- [ ] T038 [US1] Create `convex/training/transcripts.ts` with:
  - `getSessionTranscript` - Get full transcript with pagination
  - `internalAddTranscriptEntry` - Add entry from agent
- [ ] T039 [P] [US1] Create `convex/training/whispers.ts` with:
  - `getSessionWhispers` - Get whispers for session
  - `internalTriggerWhisper` - Trigger whisper from agent
  - `markWhisperSeen` - Mark whisper as acknowledged

### Scoring Backend (US1)

- [ ] T040 [US1] Create `convex/training/scoring.ts` with queries:
  - `getSessionScore` - Get detailed score for session
  - `getMyScoreTrends` - Score trends over time
  - `getCategoryComparison` - User vs team comparison
- [ ] T041 [US1] Create `convex/actions/scoring.ts` with:
  - `actionScoreSession` - Claude API scoring action
  - `internalStoreScore` - Store score after API call

### Python Agent Intelligence (US1)

- [ ] T042 [US1] Create `agent/agent/intelligence/difficulty.py` - M1 Difficulty Engine
- [ ] T043 [P] [US1] Create `agent/agent/intelligence/whispers.py` - M2 Whisper System
- [ ] T044 [P] [US1] Create `agent/agent/intelligence/emotional.py` - M3 Emotional Tracking
- [ ] T045 [P] [US1] Create `agent/agent/intelligence/branching.py` - M4 Branching Logic
- [ ] T046 [US1] Create `agent/agent/intelligence/conversation.py` - Main conversation orchestrator
- [ ] T047 [US1] Create `agent/agent/avatar/simli.py` - Simli avatar integration
- [ ] T048 [P] [US1] Create `agent/agent/avatar/did_fallback.py` - D-ID fallback with circuit breaker

### Frontend Session Flow (US1)

- [ ] T049 [US1] Create `src/app/(dashboard)/training/page.tsx` - Training dashboard
- [ ] T050 [US1] Create `src/app/(dashboard)/training/new/page.tsx` - Session setup wizard
- [ ] T051 [P] [US1] Create `src/components/training/persona-selector.tsx` - Persona selection grid
- [ ] T052 [P] [US1] Create `src/components/training/scenario-selector.tsx` - Scenario selection
- [ ] T053 [US1] Create `src/app/(dashboard)/training/session/[sessionId]/page.tsx` - Active session page
- [ ] T054 [US1] Create `src/components/training/session-room.tsx` - Main session UI container
- [ ] T055 [P] [US1] Create `src/components/training/avatar-video.tsx` - Avatar video display
- [ ] T056 [P] [US1] Create `src/components/training/whisper-display.tsx` - Whisper toast/banner
- [ ] T057 [P] [US1] Create `src/components/training/session-controls.tsx` - Mute/end/pause controls
- [ ] T058 [P] [US1] Create `src/components/training/transcript-panel.tsx` - Live transcript
- [ ] T059 [US1] Create `src/hooks/use-training-session.ts` - Session state management

### Frontend Results (US1)

- [ ] T060 [US1] Create `src/app/(dashboard)/training/session/[sessionId]/results/page.tsx` - Results page
- [ ] T061 [P] [US1] Create `src/components/training/score-card.tsx` - Overall score display
- [ ] T062 [P] [US1] Create `src/components/training/category-radar.tsx` - Category radar chart
- [ ] T063 [P] [US1] Create `src/components/training/feedback-panel.tsx` - Strengths/improvements
- [ ] T064 [US1] Create `src/components/training/session-history.tsx` - Session list component

### Tests (US1)

- [ ] T065 [P] [US1] Create `tests/unit/convex/training/sessions.test.ts` - Session mutations tests
- [ ] T066 [P] [US1] Create `tests/unit/convex/training/scoring.test.ts` - Scoring tests
- [ ] T067 [P] [US1] Create `tests/unit/components/training/session-room.test.tsx` - Session UI tests
- [ ] T068 [US1] Create `tests/integration/training/practice-flow.test.ts` - Full practice flow

**Checkpoint**: MVP complete - BDR can practice with AI avatar and receive scores

---

## Phase 5: User Story 2 & 3 - Evaluations (Priority: P2)

**Goal**: Manager can assign evaluations; BDR completes assigned evaluations with recording

### Evaluation Backend (US2/US3)

- [ ] T069 [US2] Create `convex/training/evaluations.ts` with queries:
  - `getMyPendingEvaluations` - BDR's pending evaluations
  - `getMyCompletedEvaluations` - BDR's completed evaluations
  - `getAssignedEvaluations` - Manager's assigned evaluations
  - `getAssignableTeamMembers` - Team members for assignment
  - `getEvaluation` - Single evaluation details
- [ ] T070 [US3] Add mutations to `convex/training/evaluations.ts`:
  - `assignEvaluation` - Assign to team member
  - `bulkAssignEvaluations` - Bulk assign
  - `cancelEvaluation` - Cancel pending evaluation
  - `extendDeadline` - Extend due date
  - `addManagerReview` - Add manager comments
  - `sendReminder` - Send reminder notification
- [ ] T071 [P] [US2] Create `convex/training/evaluationsCrons.ts`:
  - `internalExpireOverdueEvaluations` - Mark overdue as expired

### Recording Backend (US2)

- [ ] T072 [US2] Create `convex/training/recordings.ts` with:
  - `getSessionRecording` - Get recording with signed URL
  - `generateUploadUrl` - Generate Convex file upload URL
  - `internalSaveRecording` - Save recording metadata
- [ ] T073 [US2] Update `convex/training/sessions.ts` to handle evaluation mode

### Frontend Evaluation (US2/US3)

- [ ] T074 [US2] Create `src/app/(dashboard)/training/evaluations/page.tsx` - BDR evaluations list
- [ ] T075 [P] [US2] Create `src/components/training/evaluation-card.tsx` - Pending evaluation card
- [ ] T076 [US2] Update session flow to handle evaluation mode with recording indicator
- [ ] T077 [US3] Create `src/app/(dashboard)/admin/evaluations/page.tsx` - Manager evaluations view
- [ ] T078 [P] [US3] Create `src/components/training/assign-evaluation-dialog.tsx` - Assignment modal
- [ ] T079 [P] [US3] Create `src/components/training/team-member-picker.tsx` - Team member selection
- [ ] T080 [US3] Create `src/components/training/evaluation-table.tsx` - Evaluations data table

### Tests (US2/US3)

- [ ] T081 [P] [US2] Create `tests/unit/convex/training/evaluations.test.ts` - Evaluation tests
- [ ] T082 [P] [US3] Create `tests/unit/components/training/assign-evaluation.test.tsx` - Assignment tests

**Checkpoint**: Evaluation workflow complete - managers can assign, BDRs can complete

---

## Phase 6: User Story 4 - Manager Reviews Recording (Priority: P3)

**Goal**: Manager can watch evaluation recording, view transcript, add comments

### Frontend Review (US4)

- [ ] T083 [US4] Create `src/app/(dashboard)/admin/evaluations/[evaluationId]/review/page.tsx` - Review page
- [ ] T084 [P] [US4] Create `src/components/training/recording-player.tsx` - Video player with controls
- [ ] T085 [P] [US4] Create `src/components/training/synced-transcript.tsx` - Transcript synced to video
- [ ] T086 [US4] Create `src/components/training/manager-review-form.tsx` - Comments form
- [ ] T087 [P] [US4] Create `src/hooks/use-synced-playback.ts` - Video/transcript sync hook

### Tests (US4)

- [ ] T088 [P] [US4] Create `tests/unit/components/training/recording-player.test.tsx` - Player tests

**Checkpoint**: Manager review complete - recordings viewable with synced transcript

---

## Phase 7: User Story 5 - Certifications (Priority: P3)

**Goal**: BDR can earn Bronze/Silver/Gold certifications based on session performance

### Certification Backend (US5)

- [ ] T089 [US5] Create `convex/training/certifications.ts` with queries:
  - `getMyCertifications` - User's certifications
  - `getCertificationProgress` - Progress toward next level
  - `verifyCertificate` - Public verification endpoint
  - `getCertificationLeaderboard` - Top certified users
- [ ] T090 [US5] Add mutations to `convex/training/certifications.ts`:
  - `claimCertification` - Claim when requirements met
  - `downloadCertificate` - Generate PDF download URL
- [ ] T091 [P] [US5] Create `convex/training/certificationsAdmin.ts`:
  - `listAllCertifications` - Admin view
  - `revokeCertification` - Admin revoke
  - `reinstateCertification` - Admin reinstate
- [ ] T092 [US5] Create `convex/actions/certificatePdf.ts` - PDF generation action

### Frontend Certification (US5)

- [ ] T093 [US5] Create `src/app/(dashboard)/training/certifications/page.tsx` - Certifications page
- [ ] T094 [P] [US5] Create `src/components/training/certification-card.tsx` - Cert display card
- [ ] T095 [P] [US5] Create `src/components/training/certification-progress.tsx` - Progress toward next
- [ ] T096 [US5] Create `src/components/training/leaderboard.tsx` - Certification leaderboard
- [ ] T097 [P] [US5] Create `src/app/(dashboard)/verify/[certificateNumber]/page.tsx` - Public verify page

### Tests (US5)

- [ ] T098 [P] [US5] Create `tests/unit/convex/training/certifications.test.ts` - Certification tests

**Checkpoint**: Certification system complete - BDRs can earn and share certificates

---

## Phase 8: User Story 6 - AI Coaching Plan (Priority: P3)

**Goal**: BDR receives weekly AI-generated coaching plan based on session performance

### Coaching Backend (US6)

- [ ] T099 [US6] Add to `convex/training/scoring.ts`:
  - `getMyCoachingPlan` - Get current week's plan
  - `getCoachingPlanHistory` - Historical plans
  - `rateCoachingPlan` - User feedback
  - `markCoachingPlanViewed` - Track views
- [ ] T100 [US6] Create `convex/actions/coaching.ts`:
  - `actionGenerateCoachingPlans` - Weekly generation (Claude API)
  - `internalStoreCoachingPlan` - Store generated plan
- [ ] T101 [US6] Create `convex/training/coachingCrons.ts`:
  - Monday 6 AM UTC cron for plan generation
- [ ] T102 [US6] Create `agent/agent/intelligence/coaching.py` - M7 Coaching module

### Frontend Coaching (US6)

- [ ] T103 [US6] Create `src/app/(dashboard)/training/coaching/page.tsx` - Coaching plan page
- [ ] T104 [P] [US6] Create `src/components/training/coaching-plan-card.tsx` - Current plan display
- [ ] T105 [P] [US6] Create `src/components/training/focus-area-list.tsx` - Focus areas list
- [ ] T106 [P] [US6] Create `src/components/training/recommendation-list.tsx` - Recommendations
- [ ] T107 [US6] Create `src/components/training/coaching-history.tsx` - Historical plans

### Tests (US6)

- [ ] T108 [P] [US6] Create `tests/unit/convex/training/coaching.test.ts` - Coaching tests

**Checkpoint**: AI coaching complete - BDRs receive personalized weekly plans

---

## Phase 9: User Story 8 - Admin Analytics (Priority: P4)

**Goal**: Admin can view aggregate training analytics across organization

### Analytics Backend (US8)

- [ ] T109 [US8] Add to `convex/training/scoring.ts`:
  - `getTeamAnalytics` - Team-level metrics
- [ ] T110 [US8] Create `convex/training/analytics.ts`:
  - `getOrganizationAnalytics` - Org-wide metrics
  - `getTrainingTrends` - Usage trends over time
  - `getTopPerformers` - Leaderboard data
  - `getCertificationBreakdown` - Cert distribution
- [ ] T111 [P] [US8] Create `convex/training/auditLog.ts`:
  - `logAuditEvent` - Log training events
  - `getAuditLog` - Query audit log (admin only)

### Frontend Analytics (US8)

- [ ] T112 [US8] Create `src/app/(dashboard)/admin/training/analytics/page.tsx` - Analytics dashboard
- [ ] T113 [P] [US8] Create `src/components/training/analytics-overview.tsx` - Key metrics cards
- [ ] T114 [P] [US8] Create `src/components/training/usage-chart.tsx` - Sessions over time
- [ ] T115 [P] [US8] Create `src/components/training/score-distribution.tsx` - Score histogram
- [ ] T116 [US8] Create `src/components/training/team-performance-table.tsx` - Team breakdown

### Tests (US8)

- [ ] T117 [P] [US8] Create `tests/unit/convex/training/analytics.test.ts` - Analytics tests

**Checkpoint**: Admin analytics complete - full visibility into training program

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Quality, security, performance, documentation

### Voice Quality (M6)

- [ ] T118 [P] [Polish] Create `agent/agent/intelligence/voice_metrics.py` - M6 Voice Analysis
- [ ] T119 [Polish] Integrate voice metrics into scoring action

### Security Hardening

- [ ] T120 [P] [Polish] Add rate limiting to `convex/training/sessions.ts` (10 sessions/hour)
- [ ] T121 [P] [Polish] Audit all training functions for RBAC compliance
- [ ] T122 [Polish] Add input validation with Zod to all frontend forms

### Performance Optimization

- [ ] T123 [P] [Polish] Add Convex indexes for common query patterns
- [ ] T124 [P] [Polish] Implement lazy loading for session history
- [ ] T125 [Polish] Add React Suspense boundaries with Skeleton states

### Documentation

- [ ] T126 [P] [Polish] Update quickstart.md with final configuration
- [ ] T127 [P] [Polish] Add JSDoc comments to all exported Convex functions
- [ ] T128 [Polish] Run quickstart.md validation end-to-end

### E2E Tests

- [ ] T129 [Polish] Create `tests/e2e/training/practice-session.spec.ts` - Full practice flow E2E
- [ ] T130 [P] [Polish] Create `tests/e2e/training/consent-flow.spec.ts` - Consent E2E
- [ ] T131 [P] [Polish] Create `tests/e2e/training/evaluation-flow.spec.ts` - Evaluation E2E

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    └── Phase 2: Foundational (BLOCKS ALL USER STORIES)
            ├── Phase 3: US7 Consent (P2) - Required by US1, US2
            │       └── Phase 4: US1 Practice (P1) 🎯 MVP
            │               ├── Phase 5: US2/US3 Evaluations (P2)
            │               │       └── Phase 6: US4 Manager Review (P3)
            │               ├── Phase 7: US5 Certifications (P3)
            │               └── Phase 8: US6 AI Coaching (P3)
            └── Phase 9: US8 Analytics (P4) - Can start after Foundation
                    └── Phase 10: Polish (after all features)
```

### Why Consent (US7) Before Practice (US1)?

Although US1 is P1 priority, it cannot function without consent validation. US7 is a hard dependency.

### User Story Dependencies

| Story | Hard Dependencies | Soft Dependencies |
|-------|-------------------|-------------------|
| US1 (Practice) | Foundation, US7 (Consent) | None |
| US2 (BDR Eval) | Foundation, US7, US1 (session flow) | None |
| US3 (Assign) | Foundation | US2 (to see completed) |
| US4 (Review) | US2 (recordings exist) | None |
| US5 (Certs) | US1 (sessions to count) | None |
| US6 (Coaching) | US1 (scores for analysis) | None |
| US7 (Consent) | Foundation | None |
| US8 (Analytics) | Foundation | US1, US2 (data to aggregate) |

### Parallel Opportunities

After Foundation completes:

```
┌─────────────────┐
│    Foundation   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌───────┐
│  US7  │  │  US8  │  (can run in parallel)
│Consent│  │Analyt.│
└───┬───┘  └───────┘
    │
    ▼
┌───────┐
│  US1  │  (depends on US7)
│Practice│
└───┬───┘
    │
    ├───────────┬───────────┐
    ▼           ▼           ▼
┌───────┐   ┌───────┐   ┌───────┐
│US2/US3│   │  US5  │   │  US6  │  (can run in parallel)
│ Eval  │   │ Certs │   │Coach. │
└───┬───┘   └───────┘   └───────┘
    │
    ▼
┌───────┐
│  US4  │  (depends on US2)
│Review │
└───────┘
```

---

## Parallel Example: Foundation Phase

```bash
# Launch parallel foundation tasks:
Task: "Create convex/lib/trainingAuth.ts"
Task: "Create convex/lib/consentHelpers.ts"
Task: "Create src/hooks/use-livekit-room.ts"
Task: "Create src/components/training/livekit-provider.tsx"
Task: "Create agent/agent/config.py"
Task: "Create agent/agent/convex_client.py"
```

## Parallel Example: US1 Practice Models

```bash
# Launch parallel model/query tasks:
Task: "Create convex/training/personas.ts"
Task: "Create convex/training/scenarios.ts"
Task: "Create agent/agent/intelligence/difficulty.py"
Task: "Create agent/agent/intelligence/whispers.py"
Task: "Create agent/agent/intelligence/emotional.py"
Task: "Create agent/agent/intelligence/branching.py"
```

---

## Implementation Strategy

### MVP First (Foundation + US7 + US1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US7 Consent
4. Complete Phase 4: US1 Practice
5. **STOP and VALIDATE**: Test full practice flow
6. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundation + US7 + US1 → **MVP Demo** (Practice works)
2. Add US2/US3 → **Manager Demo** (Evaluations work)
3. Add US4 → **Review Demo** (Recordings viewable)
4. Add US5 → **Gamification Demo** (Certifications work)
5. Add US6 → **AI Coach Demo** (Weekly plans)
6. Add US8 + Polish → **Full Release**

### Parallel Team Strategy

With 3 developers after Foundation:

- Developer A: US7 → US1 (core flow)
- Developer B: US8 (analytics, independent)
- Developer C: Python agent modules

After US1 complete:

- Developer A: US2/US3 → US4
- Developer B: US5 (certifications)
- Developer C: US6 (coaching)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story should be independently testable after completion
- Commit after each task or logical group
- Run `pnpm typecheck && pnpm lint` after each phase
- Run `npx convex dev` to validate schema changes
