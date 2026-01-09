# Tasks: BDR Certification System

**Input**: Design documents from `/specs/010-certification-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/certification-api.yaml, quickstart.md

**Tests**: Tests are included as specified in plan.md (Vitest + convex-test for unit/integration, Playwright for E2E).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema additions and seed data for the certification system

- [ ] T001 [P] Add certificationLevels table schema in `convex/schema.ts`
- [ ] T002 [P] Add bdrCertifications table schema in `convex/schema.ts`
- [ ] T003 [P] Add badges table schema in `convex/schema.ts`
- [ ] T004 [P] Add bdrBadges table schema in `convex/schema.ts`
- [ ] T005 [P] Add cooldownResets table schema in `convex/schema.ts`
- [ ] T006 [P] Add lmsSyncQueue table schema in `convex/schema.ts`
- [ ] T007 Create seed mutation for certificationLevels (4 levels) in `convex/seeds/certificationSeeds.ts`
- [ ] T008 Create seed mutation for badges (9 badge definitions) in `convex/seeds/certificationSeeds.ts`
- [ ] T009 Run `npx convex dev` to validate schema and deploy

**Checkpoint**: Schema deployed, seed data ready to insert

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core business logic helpers and shared utilities that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T010 [P] Create LocalizedString type definition in `convex/lib/types.ts`
- [ ] T011 [P] Create LevelRequirements type definition in `convex/lib/types.ts`
- [ ] T012 [P] Create BadgeCriteria type definition in `convex/lib/types.ts`
- [ ] T013 [P] Create certification level helpers (getLevelOrder, canProgressTo) in `convex/lib/certificationRules.ts`
- [ ] T014 [P] Create persona requirement lookup (PERSONA_REQUIREMENTS map) in `convex/lib/certificationRules.ts`
- [ ] T015 [P] Create cooldown helper functions (isOnCooldown, setCooldown, clearCooldown) in `convex/lib/certificationRules.ts`
- [ ] T016 Create badge evaluator framework (BadgeEvaluator type, evaluateBadges dispatcher) in `convex/lib/badgeEvaluators.ts`
- [ ] T017 [P] Create milestone badge evaluator in `convex/lib/badgeEvaluators.ts`
- [ ] T018 [P] Create skill badge evaluator in `convex/lib/badgeEvaluators.ts`
- [ ] T019 [P] Create certification badge evaluator in `convex/lib/badgeEvaluators.ts`
- [ ] T020 [P] Create streak badge evaluator in `convex/lib/badgeEvaluators.ts`
- [ ] T021 Create LMS sync queue helper (queueLmsEvent) in `convex/lib/lmsSyncHelpers.ts`
- [ ] T022 Create useCertification hook shell in `src/hooks/useCertification.ts`

### Tests for Phase 2

- [ ] T023 [P] Unit test for getLevelOrder and canProgressTo in `tests/unit/convex/certificationRules.test.ts`
- [ ] T024 [P] Unit test for cooldown helpers in `tests/unit/convex/certificationRules.test.ts`
- [ ] T025 [P] Unit test for badge evaluators in `tests/unit/convex/badgeEvaluators.test.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Certification Progress Tracking (Priority: P1)

**Goal**: BDRs can see their current certification level, progress toward next level, and persona unlock status

**Independent Test**: Dashboard displays current level, progress bar, and persona grid with locked/unlocked states

### Implementation for User Story 1

- [ ] T026 [US1] Implement certifications.getCurrent query in `convex/certifications.ts`
- [ ] T027 [US1] Implement certifications.getUnlockedPersonas query in `convex/certifications.ts`
- [ ] T028 [US1] Implement certifications.getLevelDefinitions query (public) in `convex/certifications.ts`
- [ ] T029 [US1] Implement certifications.initialize mutation in `convex/certifications.ts`
- [ ] T030 [P] [US1] Create ProgressCard component in `src/app/(dashboard)/certification/components/progress-card.tsx`
- [ ] T031 [P] [US1] Create LevelBadge component in `src/app/(dashboard)/certification/components/level-badge.tsx`
- [ ] T032 [P] [US1] Create PersonaGrid component (locked/unlocked display) in `src/app/(dashboard)/certification/components/persona-grid.tsx`
- [ ] T033 [P] [US1] Create CertificationLevelIndicator shared component in `src/components/certification/certification-level-indicator.tsx`
- [ ] T034 [US1] Create certification dashboard page in `src/app/(dashboard)/certification/page.tsx`
- [ ] T035 [US1] Connect useCertification hook to getCurrent and getUnlockedPersonas queries in `src/hooks/useCertification.ts`
- [ ] T036 [US1] Add loading skeleton states to dashboard page in `src/app/(dashboard)/certification/page.tsx`
- [ ] T037 [US1] Add error handling with toast notifications in `src/app/(dashboard)/certification/page.tsx`

### Tests for User Story 1

- [ ] T038 [P] [US1] Unit test certifications.getCurrent in `tests/unit/convex/certifications.test.ts`
- [ ] T039 [P] [US1] Unit test certifications.getUnlockedPersonas in `tests/unit/convex/certifications.test.ts`
- [ ] T040 [US1] E2E test: BDR views certification progress in `tests/e2e/certification-progress.spec.ts`

**Checkpoint**: User Story 1 complete - BDRs can view their certification progress

---

## Phase 4: User Story 2 - Certification Evaluation Flow (Priority: P1)

**Goal**: BDRs can attempt certification evaluations with cooldown enforcement and receive pass/fail results

**Independent Test**: Start evaluation → session completes → receive score and pass/fail → cooldown applied

### Implementation for User Story 2

- [ ] T041 [US2] Implement certifications.checkCanStartEvaluation query in `convex/certifications.ts`
- [ ] T042 [US2] Implement certifications.recordSessionComplete internal mutation in `convex/certifications.ts`
- [ ] T043 [US2] Implement certifications.recordEvaluationResult internal mutation in `convex/certifications.ts`
- [ ] T044 [US2] Implement certifications.getCooldowns query in `convex/certifications.ts`
- [ ] T045 [US2] Implement cooldowns.reset mutation (admin/team lead only) in `convex/cooldowns.ts`
- [ ] T046 [P] [US2] Create EvaluationStartButton component in `src/app/(dashboard)/certification/components/evaluation-start.tsx`
- [ ] T047 [P] [US2] Create CooldownTimer component in `src/components/certification/cooldown-timer.tsx`
- [ ] T048 [US2] Add evaluation start UI to certification page in `src/app/(dashboard)/certification/page.tsx`
- [ ] T049 [US2] Add cooldown display to certification page in `src/app/(dashboard)/certification/page.tsx`
- [ ] T050 [US2] Integration hook: Call recordSessionComplete from Spec 004 session completion in `convex/trainingSessions.ts`
- [ ] T051 [US2] Integration hook: Call recordEvaluationResult from Spec 009 scoring completion in `convex/scoringJobs.ts`

### Tests for User Story 2

- [ ] T052 [P] [US2] Unit test certifications.checkCanStartEvaluation in `tests/unit/convex/certifications.test.ts`
- [ ] T053 [P] [US2] Unit test certifications.recordSessionComplete in `tests/unit/convex/certifications.test.ts`
- [ ] T054 [P] [US2] Unit test certifications.recordEvaluationResult in `tests/unit/convex/certifications.test.ts`
- [ ] T055 [P] [US2] Unit test cooldowns.reset with RBAC in `tests/unit/convex/cooldowns.test.ts`
- [ ] T056 [US2] Integration test: Full evaluation flow with cooldown in `tests/integration/evaluation-flow.test.ts`

**Checkpoint**: User Story 2 complete - Evaluation flow with cooldown enforcement works

---

## Phase 5: User Story 3 - Persona Access Control (Priority: P2)

**Goal**: BDRs can only access personas appropriate to their certification level

**Independent Test**: Attempt to start session with locked persona → blocked with clear error

### Implementation for User Story 3

- [ ] T057 [US3] Create canAccessPersona helper in `convex/lib/certificationRules.ts`
- [ ] T058 [US3] Implement persona gate check in session creation (Spec 004 hook) in `convex/trainingSessions.ts`
- [ ] T059 [US3] Add unlock requirement display to PersonaGrid component in `src/app/(dashboard)/certification/components/persona-grid.tsx`
- [ ] T060 [US3] Add persona access error handling with toast in `src/app/(dashboard)/training/page.tsx` (or wherever sessions start)

### Tests for User Story 3

- [ ] T061 [P] [US3] Unit test canAccessPersona helper in `tests/unit/convex/certificationRules.test.ts`
- [ ] T062 [US3] Integration test: Blocked persona access in `tests/integration/persona-access.test.ts`

**Checkpoint**: User Story 3 complete - Persona gating works based on certification level

---

## Phase 6: User Story 4 - Badge Achievements (Priority: P2)

**Goal**: BDRs earn and view badges for achievements with progress tracking

**Independent Test**: Complete action triggering badge → notification appears → badge in profile

### Implementation for User Story 4

- [ ] T063 [US4] Implement badges.getEarned query in `convex/badges.ts`
- [ ] T064 [US4] Implement badges.getProgress query in `convex/badges.ts`
- [ ] T065 [US4] Implement badges.getUnviewed query in `convex/badges.ts`
- [ ] T066 [US4] Implement badges.markViewed mutation in `convex/badges.ts`
- [ ] T067 [US4] Implement internal awardBadge helper (with idempotency check) in `convex/badges.ts`
- [ ] T068 [US4] Hook badge evaluation into recordSessionComplete in `convex/certifications.ts`
- [ ] T069 [US4] Hook badge evaluation into recordEvaluationResult in `convex/certifications.ts`
- [ ] T070 [P] [US4] Create BadgeCard component in `src/app/(dashboard)/badges/components/badge-card.tsx`
- [ ] T071 [P] [US4] Create BadgeProgressIndicator component in `src/app/(dashboard)/badges/components/badge-progress.tsx`
- [ ] T072 [P] [US4] Create BadgeNotification component in `src/components/certification/badge-notification.tsx`
- [ ] T073 [US4] Create badges collection page in `src/app/(dashboard)/badges/page.tsx`
- [ ] T074 [US4] Create useBadges hook in `src/hooks/useBadges.ts`
- [ ] T075 [US4] Add badge notification integration to dashboard layout in `src/app/(dashboard)/layout.tsx`
- [ ] T076 [US4] Add navigation link to badges page in sidebar/header

### Tests for User Story 4

- [ ] T077 [P] [US4] Unit test badges.getEarned in `tests/unit/convex/badges.test.ts`
- [ ] T078 [P] [US4] Unit test badges.getProgress in `tests/unit/convex/badges.test.ts`
- [ ] T079 [P] [US4] Unit test awardBadge idempotency in `tests/unit/convex/badges.test.ts`
- [ ] T080 [US4] E2E test: Badge earned and notification displayed in `tests/e2e/badge-award.spec.ts`

**Checkpoint**: User Story 4 complete - Badge system with notifications works

---

## Phase 7: User Story 5 - LMS Progress Synchronization (Priority: P2)

**Goal**: AI Trainer progress syncs to LMS within 5 seconds, handles failures gracefully

**Independent Test**: Complete session → LMS shows updated progress; simulate failure → retry succeeds

### Implementation for User Story 5

- [ ] T081 [US5] Implement lmsSync.getPendingEvents internal query in `convex/lmsSync.ts`
- [ ] T082 [US5] Implement lmsSync.markCompleted internal mutation in `convex/lmsSync.ts`
- [ ] T083 [US5] Implement lmsSync.markFailed internal mutation in `convex/lmsSync.ts`
- [ ] T084 [US5] Implement lmsSync.processQueue scheduled action (cron every 30s) in `convex/lmsSync.ts`
- [ ] T085 [US5] Implement lmsSync.getQueueStatus query (admin only) in `convex/lmsSync.ts`
- [ ] T086 [US5] Implement lmsSync.retryFailed mutation (admin only) in `convex/lmsSync.ts`
- [ ] T087 [US5] Queue LMS event on session completion in `convex/certifications.ts`
- [ ] T088 [US5] Queue LMS event on certification level change in `convex/certifications.ts`
- [ ] T089 [US5] Queue LMS event on badge award in `convex/badges.ts`
- [ ] T090 [US5] Configure scheduled function in `convex/crons.ts`
- [ ] T091 [US5] Add LMS_API_BASE_URL environment variable configuration

### Tests for User Story 5

- [ ] T092 [P] [US5] Unit test lmsSync.processQueue with mock fetch in `tests/unit/convex/lmsSync.test.ts`
- [ ] T093 [P] [US5] Unit test retry logic with exponential backoff in `tests/unit/convex/lmsSync.test.ts`
- [ ] T094 [US5] Integration test: End-to-end sync flow in `tests/integration/lms-sync.test.ts`

**Checkpoint**: User Story 5 complete - LMS synchronization with retry works

---

## Phase 8: User Story 6 - Team Certification Dashboard (Priority: P3)

**Goal**: Team Leads see certification distribution, stalled members, and individual progress

**Independent Test**: Team Lead views dashboard → sees distribution chart, stalled flags, member details

### Implementation for User Story 6

- [ ] T095 [US6] Implement team.getCertificationOverview query in `convex/team.ts`
- [ ] T096 [US6] Implement team.getMemberProgress query with pagination in `convex/team.ts`
- [ ] T097 [US6] Implement team.getMemberDetail query in `convex/team.ts`
- [ ] T098 [US6] Create useTeamCertifications hook in `src/hooks/useTeamCertifications.ts`
- [ ] T099 [P] [US6] Create CertificationDistributionChart component in `src/app/(dashboard)/admin/team-certifications/components/distribution-chart.tsx`
- [ ] T100 [P] [US6] Create TeamMemberTable component in `src/app/(dashboard)/admin/team-certifications/components/member-table.tsx`
- [ ] T101 [P] [US6] Create MemberDetailModal component in `src/app/(dashboard)/admin/team-certifications/components/member-detail.tsx`
- [ ] T102 [P] [US6] Create StalledBadge component in `src/app/(dashboard)/admin/team-certifications/components/stalled-badge.tsx`
- [ ] T103 [US6] Create team certifications admin page in `src/app/(dashboard)/admin/team-certifications/page.tsx`
- [ ] T104 [US6] Add filter controls (level, status) to team dashboard in `src/app/(dashboard)/admin/team-certifications/page.tsx`
- [ ] T105 [US6] Add cooldown reset UI for team leads in `src/app/(dashboard)/admin/team-certifications/components/member-detail.tsx`
- [ ] T106 [US6] Add navigation link to admin menu (Team Lead/Admin only)

### Tests for User Story 6

- [ ] T107 [P] [US6] Unit test team.getCertificationOverview in `tests/unit/convex/team.test.ts`
- [ ] T108 [P] [US6] Unit test team.getMemberProgress with filters in `tests/unit/convex/team.test.ts`
- [ ] T109 [US6] E2E test: Team Lead views team dashboard in `tests/e2e/team-dashboard.spec.ts`

**Checkpoint**: User Story 6 complete - Team Lead dashboard with all features works

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Observability, metrics, and final quality checks

- [ ] T110 [P] Implement metrics aggregation query for certification rates in `convex/metrics.ts`
- [ ] T111 [P] Implement LMS sync health metrics query in `convex/metrics.ts`
- [ ] T112 [P] Implement badge engagement metrics query in `convex/metrics.ts`
- [ ] T113 Add alert action for sync failure rate >5% in `convex/lmsSync.ts`
- [ ] T114 Create admin operations dashboard page in `src/app/(dashboard)/admin/ops/page.tsx`
- [ ] T115 Run full E2E test suite and fix any failures
- [ ] T116 Run `pnpm typecheck` and fix any TypeScript errors
- [ ] T117 Run `pnpm lint` and fix any linting issues
- [ ] T118 Verify all queries use `.withIndex()` instead of `.filter()`
- [ ] T119 Verify all mutations have `requireAuth` on first line
- [ ] T120 Run quickstart.md validation (manual walkthrough)

**Checkpoint**: All quality gates passed, feature ready for code review

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema deployed) - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Phase 2 completion
  - US1 and US2 can proceed in parallel (both P1)
  - US3 depends on US1 (persona grid component)
  - US4 can start after US2 (needs evaluation hooks)
  - US5 can start after US2 (needs event queuing)
  - US6 depends on US1 (certification data structure)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational)
    │
    ├──────────┬──────────┐
    ▼          ▼          │
[US1: P1]  [US2: P1]     │
    │          │          │
    ├──────────┼──────────┤
    │          │          │
    ▼          ▼          ▼
[US3: P2]  [US4: P2]  [US5: P2]
(needs US1) (needs US2) (needs US2)
    │          │          │
    └──────────┴──────────┘
               │
               ▼
          [US6: P3]
         (needs US1)
               │
               ▼
        Phase 9 (Polish)
```

### Within Each User Story

- Tests are written alongside implementation (not TDD for this spec)
- Queries before mutations (data access patterns first)
- Backend before frontend (API contracts first)
- Components before pages (composition pattern)

### Parallel Opportunities

- All Phase 1 schema tasks (T001-T006) can run in parallel
- All Phase 2 type definitions (T010-T012) can run in parallel
- All Phase 2 evaluators (T017-T020) can run in parallel after T016
- Component tasks within each user story marked [P] can run in parallel
- US1 and US2 can be worked on in parallel by different team members

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all schema additions in parallel:
Task: "Add certificationLevels table schema in convex/schema.ts"
Task: "Add bdrCertifications table schema in convex/schema.ts"
Task: "Add badges table schema in convex/schema.ts"
Task: "Add bdrBadges table schema in convex/schema.ts"
Task: "Add cooldownResets table schema in convex/schema.ts"
Task: "Add lmsSyncQueue table schema in convex/schema.ts"
```

---

## Parallel Example: User Story 1 Components

```bash
# Launch all US1 components in parallel:
Task: "Create ProgressCard component in src/app/(dashboard)/certification/components/progress-card.tsx"
Task: "Create LevelBadge component in src/app/(dashboard)/certification/components/level-badge.tsx"
Task: "Create PersonaGrid component in src/app/(dashboard)/certification/components/persona-grid.tsx"
Task: "Create CertificationLevelIndicator shared component in src/components/certification/certification-level-indicator.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (Progress Tracking)
4. Complete Phase 4: User Story 2 (Evaluation Flow)
5. **STOP and VALIDATE**: Test US1 + US2 independently
6. Deploy/demo if ready (MVP achieved)

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test → Deploy (Progress visible)
3. Add US2 → Test → Deploy (Evaluations work)
4. Add US3 → Test → Deploy (Persona gating)
5. Add US4 → Test → Deploy (Badges)
6. Add US5 → Test → Deploy (LMS sync)
7. Add US6 → Test → Deploy (Team dashboard)
8. Polish → Code review → Production

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + User Story 3
   - Developer B: User Story 2 + User Story 4 + User Story 5
   - Developer C: User Story 6 + Polish
3. Each developer completes their stories and opens PR for review

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All Convex functions must have `returns:` validator per contracts
- All queries must use `.withIndex()` per Constitution Article VI
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
