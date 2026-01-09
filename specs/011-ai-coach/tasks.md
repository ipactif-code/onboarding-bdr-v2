# Tasks: AI Coach Module (M7)

**Input**: Design documents from `/specs/011-ai-coach/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests included per constitution requirements (Article II: convex-test for all Convex functions, E2E for critical flows)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `convex/coach/` for Convex functions
- **Frontend**: `src/app/(dashboard)/coach/`, `src/components/coach/`
- **Tests**: `tests/unit/convex/coach/`, `tests/e2e/coach/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, schema, and shared utilities

- [ ] T001 Add coachConversations table with 4 indexes to convex/schema.ts
- [ ] T002 Add coachMessages table with 2 indexes to convex/schema.ts
- [ ] T003 Add trainingPlans table with 2 indexes to convex/schema.ts
- [ ] T004 Add weeklyCheckins table with 3 indexes to convex/schema.ts
- [ ] T005 Run `npx convex push` to deploy schema changes
- [ ] T006 [P] Create convex/coach/lib/config.ts with COACH_CONFIG constants (limits, model, retention)
- [ ] T007 [P] Create convex/coach/lib/types.ts with shared TypeScript types
- [ ] T008 [P] Create convex/coach/lib/helpers.ts with date utilities (getWeekStart, getStartOfDay, getStartOfMonth)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core queries/mutations shared across ALL user stories - MUST complete before any story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 [P] Create convex/coach/lib/prompts.ts with COACH_PERSONA for all 5 languages (fr, en, it, es, de)
- [ ] T010 [P] Add PLAN_GENERATION_SYSTEM_PROMPT to convex/coach/lib/prompts.ts
- [ ] T011 [P] Add WEEKLY_CHECKIN_SYSTEM_PROMPT to convex/coach/lib/prompts.ts
- [ ] T012 Implement getActiveConversation query in convex/coach/queries.ts
- [ ] T013 Implement getConversationMessages query in convex/coach/queries.ts
- [ ] T014 Implement getConversationHistory query in convex/coach/queries.ts
- [ ] T015 Implement internal getCoachingContext query in convex/coach/queries.ts
- [ ] T016 Implement getCoachRateLimits query in convex/coach/queries.ts
- [ ] T017 Implement startConversation mutation in convex/coach/mutations.ts
- [ ] T018 Implement sendMessage mutation in convex/coach/mutations.ts
- [ ] T019 Implement endConversation mutation in convex/coach/mutations.ts
- [ ] T020 Implement internal storeCoachMessage mutation in convex/coach/mutations.ts
- [ ] T021 Implement generateResponse action in convex/coach/actions.ts (Claude API integration)
- [ ] T022 Add buildSystemPrompt helper function to convex/coach/actions.ts
- [ ] T023 Add extractTranscriptReferences helper function to convex/coach/actions.ts
- [ ] T024 Create src/hooks/use-coach-conversation.ts hook for conversation state management
- [ ] T025 Create src/components/coach/coach-chat.tsx main chat container component
- [ ] T026 Create src/components/coach/message-list.tsx message display component
- [ ] T027 Create src/components/coach/message-input.tsx user input component with limits
- [ ] T028 Create src/components/coach/coach-header.tsx mode indicator component
- [ ] T029 [P] Write convex-test for getActiveConversation in tests/unit/convex/coach/queries.test.ts
- [ ] T030 [P] Write convex-test for startConversation in tests/unit/convex/coach/mutations.test.ts
- [ ] T031 [P] Write convex-test for sendMessage in tests/unit/convex/coach/mutations.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Post-Session Debrief (Priority: P1) 🎯 MVP

**Goal**: BDRs can have conversational debriefs with AI Coach immediately after completing a training session

**Independent Test**: Complete a scored session → initiate debrief → receive personalized feedback with transcript references

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T032 [P] [US1] Write convex-test for debrief conversation flow in tests/unit/convex/coach/debrief.test.ts
- [ ] T033 [P] [US1] Write E2E test for debrief flow in tests/e2e/coach/debrief.spec.ts

### Implementation for User Story 1

- [ ] T034 [US1] Add session context enrichment to getCoachingContext for debrief mode in convex/coach/queries.ts
- [ ] T035 [US1] Implement internal getConversationMessagesInternal query in convex/coach/queries.ts
- [ ] T036 [US1] Add debrief-specific system prompt context in convex/coach/actions.ts
- [ ] T037 [US1] Create src/components/coach/transcript-reference.tsx for displaying transcript excerpts
- [ ] T038 [US1] Add debrief entry point button to session completion page in src/app/(dashboard)/sessions/[id]/page.tsx
- [ ] T039 [US1] Create src/app/(dashboard)/coach/page.tsx main coach page with debrief support
- [ ] T040 [US1] Implement conversation message limit enforcement (10 messages) in sendMessage mutation
- [ ] T041 [US1] Add loading skeleton states to coach-chat.tsx
- [ ] T042 [US1] Add error handling with toast notifications to coach components
- [ ] T043 [US1] Verify debrief references specific transcript moments (FR-008)

**Checkpoint**: User Story 1 (Post-Session Debrief) is fully functional and testable independently

---

## Phase 4: User Story 2 - Ask the Coach (Priority: P2)

**Goal**: BDRs can ask their AI Coach questions at any time from any screen

**Independent Test**: Open Ask Coach from any screen → ask about sales technique → receive RACC-based response with context

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T044 [P] [US2] Write convex-test for ask_coach conversation flow in tests/unit/convex/coach/ask-coach.test.ts
- [ ] T045 [P] [US2] Write E2E test for Ask Coach flow in tests/e2e/coach/ask-coach.spec.ts

### Implementation for User Story 2

- [ ] T046 [US2] Add ask_coach context to getCoachingContext (BDR history, no session) in convex/coach/queries.ts
- [ ] T047 [US2] Add RACC framework guidance to ask_coach system prompt in convex/coach/lib/prompts.ts
- [ ] T048 [US2] Create src/components/coach/coach-fab.tsx floating action button component
- [ ] T049 [US2] Add coach-fab.tsx to src/app/(dashboard)/layout.tsx for global access
- [ ] T050 [US2] Implement conversation message limit enforcement (20 messages) for ask_coach type
- [ ] T051 [US2] Create conversation history view in src/app/(dashboard)/coach/history/page.tsx
- [ ] T052 [US2] Add scenario recommendation logic to ask_coach responses based on performance gaps
- [ ] T053 [US2] Ensure Coach FAB is accessible via keyboard (WCAG 2.1 AA)

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Personalized Training Plan (Priority: P3)

**Goal**: BDRs with 5+ sessions can request customized multi-week training plans

**Independent Test**: BDR with 5+ sessions requests plan → receives multi-week program with skill gaps, scenarios, and weekly goals

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T054 [P] [US3] Write convex-test for plan eligibility in tests/unit/convex/coach/plan.test.ts
- [ ] T055 [P] [US3] Write convex-test for plan generation in tests/unit/convex/coach/plan.test.ts
- [ ] T056 [P] [US3] Write E2E test for training plan flow in tests/e2e/coach/training-plan.spec.ts

### Implementation for User Story 3

- [ ] T057 [US3] Implement canGeneratePlan query in convex/coach/queries.ts
- [ ] T058 [US3] Implement getActivePlan query in convex/coach/queries.ts
- [ ] T059 [US3] Implement getPlanHistory query in convex/coach/queries.ts
- [ ] T060 [US3] Implement internal getPlanInternal query in convex/coach/queries.ts
- [ ] T061 [US3] Implement internal getSessionsForAnalysis query in convex/coach/queries.ts
- [ ] T062 [US3] Implement generatePlan mutation in convex/coach/mutations.ts
- [ ] T063 [US3] Implement internal populatePlanContent mutation in convex/coach/mutations.ts
- [ ] T064 [US3] Implement internal updatePlanProgress mutation in convex/coach/mutations.ts
- [ ] T065 [US3] Implement generatePlanContent action in convex/coach/actions.ts
- [ ] T066 [US3] Add buildPlanAnalysisPrompt helper to convex/coach/actions.ts
- [ ] T067 [US3] Add parsePlanResponse helper to convex/coach/actions.ts
- [ ] T068 [US3] Add buildPlanIntroMessage helper to convex/coach/actions.ts
- [ ] T069 [US3] Create src/components/coach/training-plan-card.tsx plan overview component
- [ ] T070 [US3] Create src/components/coach/week-progress.tsx weekly goal tracking component
- [ ] T071 [US3] Create src/components/coach/plan-generation-dialog.tsx plan request dialog
- [ ] T072 [US3] Add training plan section to src/app/(dashboard)/coach/page.tsx
- [ ] T073 [US3] Enforce 5+ session requirement (FR-014) with user feedback
- [ ] T074 [US3] Enforce 5/month plan generation rate limit with user feedback

**Checkpoint**: User Stories 1, 2, AND 3 all work independently

---

## Phase 6: User Story 4 - Weekly Progress Check-In (Priority: P4)

**Goal**: BDRs receive weekly coaching check-ins on Mondays to stay motivated and track progress

**Independent Test**: Trigger Monday notification → enter check-in conversation → see weekly summary with week-over-week comparison

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T075 [P] [US4] Write convex-test for weekly check-in creation in tests/unit/convex/coach/checkin.test.ts
- [ ] T076 [P] [US4] Write convex-test for scheduled trigger in tests/unit/convex/coach/scheduled.test.ts

### Implementation for User Story 4

- [ ] T077 [US4] Implement getCurrentWeekCheckin query in convex/coach/queries.ts
- [ ] T078 [US4] Implement getCheckinHistory query in convex/coach/queries.ts
- [ ] T079 [US4] Implement internal getCheckinInternal query in convex/coach/queries.ts
- [ ] T080 [US4] Implement internal createWeeklyCheckin mutation in convex/coach/mutations.ts
- [ ] T081 [US4] Implement markCheckinViewed mutation in convex/coach/mutations.ts
- [ ] T082 [US4] Implement internal linkCheckinConversation mutation in convex/coach/mutations.ts
- [ ] T083 [US4] Implement generateWeeklyCheckinMessage action in convex/coach/actions.ts
- [ ] T084 [US4] Add buildWeeklyCheckinPrompt helper to convex/coach/actions.ts
- [ ] T085 [US4] Implement triggerWeeklyCheckins scheduled function in convex/coach/scheduled.ts
- [ ] T086 [US4] Add weekly check-in cron job to convex/crons.ts (Monday 8 AM UTC)
- [ ] T087 [US4] Create src/components/coach/weekly-checkin-banner.tsx notification banner
- [ ] T088 [US4] Add weekly check-in banner to dashboard layout
- [ ] T089 [US4] Implement conversation limit (5 messages) for weekly_checkin type
- [ ] T090 [US4] Add plan progress reference to check-in if active plan exists (FR-022)

**Checkpoint**: User Stories 1, 2, 3, AND 4 all work independently

---

## Phase 7: User Story 5 - Coach Language Preference (Priority: P5)

**Goal**: AI Coach communicates in the BDR's preferred language (FR, EN, IT, ES, DE)

**Independent Test**: Set language preference → start conversation → Coach responds in selected language with localized templates

### Tests for User Story 5 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T091 [P] [US5] Write convex-test for language detection in tests/unit/convex/coach/language.test.ts

### Implementation for User Story 5

- [ ] T092 [US5] Add Italian (it) persona to COACH_PERSONA in convex/coach/lib/prompts.ts
- [ ] T093 [US5] Add Spanish (es) persona to COACH_PERSONA in convex/coach/lib/prompts.ts
- [ ] T094 [US5] Add German (de) persona to COACH_PERSONA in convex/coach/lib/prompts.ts
- [ ] T095 [US5] Add getLanguageName helper to convex/coach/lib/helpers.ts
- [ ] T096 [US5] Add language detection fallback (default to English if unsupported) in startConversation
- [ ] T097 [US5] Verify language consistency across all conversation types
- [ ] T098 [US5] Add language indicator to coach-header.tsx

**Checkpoint**: All 5 user stories are independently functional

---

## Phase 8: Data Retention & Scheduled Jobs

**Purpose**: Implement 90-day retention and cleanup per FR-030, FR-031

- [ ] T099 Implement cleanupExpiredConversations scheduled function in convex/coach/scheduled.ts
- [ ] T100 Implement sendExpirationWarnings scheduled function in convex/coach/scheduled.ts
- [ ] T101 Add cleanup cron job to convex/crons.ts (daily 3 AM UTC)
- [ ] T102 Add expiration warning cron job to convex/crons.ts (daily 9 AM UTC)
- [ ] T103 Implement updatePlanProgressOnSessionComplete scheduled function in convex/coach/scheduled.ts
- [ ] T104 [P] Write convex-test for cleanup functions in tests/unit/convex/coach/scheduled.test.ts

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T105 [P] Add accessibility audit for coach components (WCAG 2.1 AA)
- [ ] T106 [P] Add keyboard navigation to message-list.tsx and coach-fab.tsx
- [ ] T107 Verify rate limit enforcement (30/day interactions) across all modes
- [ ] T108 Add rate limit feedback UI to message-input.tsx
- [ ] T109 Implement streaming response indicator in message-list.tsx
- [ ] T110 Add conversation export functionality (optional)
- [ ] T111 Run pnpm typecheck and fix any TypeScript errors
- [ ] T112 Run pnpm lint and fix any ESLint warnings
- [ ] T113 Run pnpm test to verify all tests pass
- [ ] T114 Run quickstart.md validation checklist
- [ ] T115 Performance test: Verify <5s response latency (NFR-001)
- [ ] T116 Verify cost per interaction <$0.05 (SC-003)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5)
- **Data Retention (Phase 8)**: Can start after Foundational, independent of user stories
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1) - Debrief**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2) - Ask Coach**: Can start after Foundational (Phase 2) - Reuses conversation infrastructure from US1
- **User Story 3 (P3) - Training Plan**: Can start after Foundational (Phase 2) - Independent data model
- **User Story 4 (P4) - Weekly Check-In**: Can start after Foundational (Phase 2) - May reference US3 training plans
- **User Story 5 (P5) - Language**: Can be parallelized with US1-4, extends prompts created in Foundational

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks T006-T008 can run in parallel
- All Foundational tests T029-T031 can run in parallel
- All user story tests for each phase can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: T032 "Write convex-test for debrief conversation flow"
Task: T033 "Write E2E test for debrief flow"

# After tests are written (RED), launch implementation tasks:
Task: T034 "Add session context enrichment to getCoachingContext"
Task: T037 "Create transcript-reference.tsx component"
```

---

## Parallel Example: Foundational Phase

```bash
# Launch all prompt tasks together:
Task: T009 "Create COACH_PERSONA for all 5 languages"
Task: T010 "Add PLAN_GENERATION_SYSTEM_PROMPT"
Task: T011 "Add WEEKLY_CHECKIN_SYSTEM_PROMPT"

# Launch all foundational tests together:
Task: T029 "Write convex-test for getActiveConversation"
Task: T030 "Write convex-test for startConversation"
Task: T031 "Write convex-test for sendMessage"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T031)
3. Complete Phase 3: User Story 1 - Post-Session Debrief (T032-T043)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Debrief) → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (Ask Coach) → Test independently → Deploy/Demo
4. Add User Story 3 (Training Plan) → Test independently → Deploy/Demo
5. Add User Story 4 (Weekly Check-In) → Test independently → Deploy/Demo
6. Add User Story 5 (Language) → Test independently → Deploy/Demo
7. Complete Data Retention + Polish → Full release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Debrief)
   - Developer B: User Story 2 (Ask Coach)
   - Developer C: User Story 3 (Training Plan)
3. Then:
   - Developer A: User Story 4 (Weekly Check-In)
   - Developer B: User Story 5 (Language)
   - Developer C: Data Retention + Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- External dependencies: Spec 004 (Sessions), Spec 009 (Scoring), Spec 010 (Certification), Anthropic API
