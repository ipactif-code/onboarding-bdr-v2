# Tasks: Praiz Video Processing Pipeline

**Input**: Design documents from `/specs/008-praiz-pipeline/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are included per constitution requirements (Article II: Testing Standards).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, schema updates, and environment configuration

- [ ] T001 Add 6 new Praiz tables to convex/schema.ts per data-model.md
- [ ] T002 [P] Set PRAIZ_API_URL environment variable in Convex
- [ ] T003 [P] Set PRAIZ_API_KEY environment variable in Convex
- [ ] T004 [P] Set ANTHROPIC_API_KEY environment variable in Convex
- [ ] T005 [P] Create convex/praiz/ directory structure
- [ ] T006 [P] Create src/components/praiz/ directory structure
- [ ] T007 [P] Create src/hooks/praiz/ directory structure
- [ ] T008 [P] Create src/app/(dashboard)/admin/praiz/ directory structure
- [ ] T009 [P] Create tests/unit/convex/praiz/ directory structure

**Checkpoint**: Schema deployed, environment configured, directories created

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T010 Copy contract types from specs/008-praiz-pipeline/contracts/extraction.ts to convex/praiz/types/extraction.ts
- [ ] T011 [P] Copy contract types from specs/008-praiz-pipeline/contracts/objection-library.ts to convex/praiz/types/objection-library.ts
- [ ] T012 [P] Copy contract types from specs/008-praiz-pipeline/contracts/validation.ts to convex/praiz/types/validation.ts
- [ ] T013 [P] Copy contract types from specs/008-praiz-pipeline/contracts/observability.ts to convex/praiz/types/observability.ts
- [ ] T014 Create budget tracking initialization mutation in convex/praiz/budget.ts
- [ ] T015 Create rate limiting check function in convex/praiz/budget.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Batch Video Processing (Priority: P1) 🎯 MVP

**Goal**: Process Praiz video batches to populate the objection library with extracted patterns

**Independent Test**: Trigger batch for date range, verify patterns appear in processing log with confidence scores

### Tests for User Story 1

- [ ] T016 [P] [US1] Unit test for extraction logic in tests/unit/convex/praiz/extraction.test.ts
- [ ] T017 [P] [US1] Unit test for batch processing in tests/unit/convex/praiz/processing.test.ts
- [ ] T018 [P] [US1] Unit test for rate limiting in tests/unit/convex/praiz/budget.test.ts

### Backend Implementation for User Story 1

- [ ] T019 [US1] Implement Praiz API client action in convex/praiz/praiz-api.ts (fetch recordings)
- [ ] T020 [US1] Implement Claude Sonnet extraction action in convex/praiz/extraction.ts
- [ ] T021 [US1] Implement batch queueing mutation in convex/praiz/processing.ts (queueBatch)
- [ ] T022 [US1] Implement job processor mutation in convex/praiz/processing.ts (processNextJob)
- [ ] T023 [US1] Implement objection insertion logic in convex/praiz/objections.ts (insertExtractedObjections)
- [ ] T024 [US1] Implement processing status query in convex/praiz/processing.ts (getProcessingStatus)
- [ ] T025 [US1] Implement processing logs insertion in convex/praiz/processing.ts (logProcessingEvent)
- [ ] T026 [US1] Add error handling with retry logic per research.md retry strategy

### Frontend Implementation for User Story 1

- [ ] T027 [P] [US1] Create useProcessingJobs hook in src/hooks/praiz/use-processing-jobs.ts
- [ ] T028 [P] [US1] Create usePraizMetrics hook in src/hooks/praiz/use-praiz-metrics.ts
- [ ] T029 [US1] Create ProcessingDashboard component in src/components/praiz/processing-dashboard.tsx
- [ ] T030 [US1] Create BatchTriggerForm component in src/components/praiz/batch-trigger-form.tsx
- [ ] T031 [US1] Create JobStatusCard component in src/components/praiz/job-status-card.tsx
- [ ] T032 [US1] Create admin processing page in src/app/(dashboard)/admin/praiz/processing/page.tsx
- [ ] T033 [US1] Create admin praiz dashboard page in src/app/(dashboard)/admin/praiz/page.tsx

**Checkpoint**: Videos can be queued, processed, and patterns extracted with rate limiting

---

## Phase 4: User Story 2 - Objection Library Management (Priority: P2)

**Goal**: Human validation workflow for quality control of extracted objections

**Independent Test**: View validation queue, approve/edit/reject entries, verify status changes and audit trail

### Tests for User Story 2

- [ ] T034 [P] [US2] Unit test for validation workflow in tests/unit/convex/praiz/validation.test.ts
- [ ] T035 [P] [US2] Unit test for objection CRUD in tests/unit/convex/praiz/objections.test.ts

### Backend Implementation for User Story 2

- [ ] T036 [US2] Implement requireValidator helper in convex/praiz/validation.ts (admin/manager check)
- [ ] T037 [US2] Implement getValidationQueue query in convex/praiz/validation.ts
- [ ] T038 [US2] Implement approveObjection mutation in convex/praiz/validation.ts
- [ ] T039 [US2] Implement rejectObjection mutation in convex/praiz/validation.ts
- [ ] T040 [US2] Implement editObjection mutation in convex/praiz/validation.ts (with RACC editing)
- [ ] T041 [US2] Implement archiveObjection mutation in convex/praiz/validation.ts
- [ ] T042 [US2] Implement restoreObjection mutation in convex/praiz/validation.ts
- [ ] T043 [US2] Implement getObjectionById query in convex/praiz/objections.ts
- [ ] T044 [US2] Implement listObjections query with filters in convex/praiz/objections.ts
- [ ] T045 [US2] Implement getValidationHistory query in convex/praiz/validation.ts

### Frontend Implementation for User Story 2

- [ ] T046 [P] [US2] Create useValidationQueue hook in src/hooks/praiz/use-validation-queue.ts
- [ ] T047 [P] [US2] Create useObjectionLibrary hook in src/hooks/praiz/use-objection-library.ts
- [ ] T048 [US2] Create ValidationQueue component in src/components/praiz/validation-queue.tsx
- [ ] T049 [US2] Create ObjectionCard component in src/components/praiz/objection-card.tsx
- [ ] T050 [US2] Create RaccEditor component in src/components/praiz/racc-editor.tsx
- [ ] T051 [US2] Create ObjectionFilters component in src/components/praiz/objection-filters.tsx
- [ ] T052 [US2] Create ValidationActions component in src/components/praiz/validation-actions.tsx
- [ ] T053 [US2] Create admin validation page in src/app/(dashboard)/admin/praiz/validation/page.tsx
- [ ] T054 [US2] Create admin library page in src/app/(dashboard)/admin/praiz/library/page.tsx
- [ ] T055 [US2] Create single objection view/edit page in src/app/(dashboard)/admin/praiz/library/[id]/page.tsx

**Checkpoint**: Validators can approve/reject/edit objections with full audit trail

---

## Phase 5: User Story 3 - Pattern Injection in Training (Priority: P3)

**Goal**: Context Builder integration for realistic AI prospect objections

**Independent Test**: Start training session, AI prospect raises objections matching persona/module/scenario context

**Dependencies**: Requires Spec 005 (Context Builder) to be implemented

### Tests for User Story 3

- [ ] T056 [P] [US3] Unit test for objection selection in tests/unit/convex/praiz/context-integration.test.ts

### Backend Implementation for User Story 3

- [ ] T057 [US3] Implement getRelevantObjections query in convex/praiz/objections.ts (Context Builder interface)
- [ ] T058 [US3] Implement calculateSelectionWeight function in convex/praiz/objections.ts
- [ ] T059 [US3] Implement recordObjectionUsage mutation in convex/praiz/objections.ts
- [ ] T060 [US3] Implement toContextBuilderFormat helper in convex/praiz/objections.ts

### Integration Implementation for User Story 3

- [ ] T061 [US3] Update Context Builder V7 to query getRelevantObjections (integration point with Spec 005)
- [ ] T062 [US3] Add objection selection to persona context injection flow
- [ ] T063 [US3] Implement session outcome feedback loop (record usage after session)

**Checkpoint**: AI personas can use validated objections in training sessions

---

## Phase 6: User Story 4 - Effectiveness Tracking (Priority: P4)

**Goal**: Analytics dashboard for objection effectiveness and usage tracking

**Independent Test**: View usage statistics, verify metrics match actual training session usage

### Tests for User Story 4

- [ ] T064 [P] [US4] Unit test for metrics calculation in tests/unit/convex/praiz/observability.test.ts

### Backend Implementation for User Story 4

- [ ] T065 [US4] Implement getProcessingMetrics query in convex/praiz/observability.ts
- [ ] T066 [US4] Implement getBudgetStatus query in convex/praiz/observability.ts
- [ ] T067 [US4] Implement getQueueHealth query in convex/praiz/observability.ts
- [ ] T068 [US4] Implement getObjectionUsageStats query in convex/praiz/observability.ts
- [ ] T069 [US4] Implement getEffectivenessReport query in convex/praiz/observability.ts
- [ ] T070 [US4] Implement updateEffectivenessScore mutation in convex/praiz/objections.ts

### Frontend Implementation for User Story 4

- [ ] T071 [P] [US4] Create usePraizMetrics hook enhancements in src/hooks/praiz/use-praiz-metrics.ts
- [ ] T072 [US4] Create MetricsChart component in src/components/praiz/metrics-chart.tsx
- [ ] T073 [US4] Create BudgetStatusCard component in src/components/praiz/budget-status-card.tsx
- [ ] T074 [US4] Create EffectivenessTable component in src/components/praiz/effectiveness-table.tsx
- [ ] T075 [US4] Add metrics section to admin dashboard in src/app/(dashboard)/admin/praiz/page.tsx

**Checkpoint**: Administrators can track pipeline health and objection effectiveness

---

## Phase 7: Scheduled Jobs & Maintenance

**Purpose**: Background jobs for freshness, cleanup, and budget reset

- [ ] T076 Implement freshness check cron job in convex/praiz/scheduled.ts (daily)
- [ ] T077 Implement log cleanup cron job in convex/praiz/scheduled.ts (daily, 12-month retention)
- [ ] T078 Implement quarterly usage counter reset in convex/praiz/scheduled.ts
- [ ] T079 Implement budget alert sender in convex/praiz/scheduled.ts (80% and 100% thresholds)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T080 [P] Add loading skeletons to all Praiz pages
- [ ] T081 [P] Add error toast notifications for all mutations
- [ ] T082 [P] Add keyboard navigation to validation queue
- [ ] T083 [P] Ensure WCAG 2.1 AA compliance for status indicators
- [ ] T084 [P] Add JSDoc comments to all exported Convex functions
- [ ] T085 Run quickstart.md validation checklist
- [ ] T086 Integration test: full processing flow in tests/integration/praiz/processing-flow.test.ts
- [ ] T087 E2E test: validation workflow in tests/e2e/praiz/validation-workflow.spec.ts

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ─── BLOCKS ALL USER STORIES
    │
    ├──────────────────────────────────────┐
    │                                      │
    ▼                                      ▼
Phase 3 (US1: Processing)        Can start in parallel if team capacity
    │                                      │
    ▼                                      │
Phase 4 (US2: Validation) ◄────────────────┘
    │
    ▼
Phase 5 (US3: Pattern Injection) ─── Requires US1+US2 for populated library
    │
    ▼
Phase 6 (US4: Analytics) ─── Requires US1+US2+US3 for meaningful data
    │
    ▼
Phase 7 (Scheduled Jobs)
    │
    ▼
Phase 8 (Polish)
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| **US1** (Processing) | Foundational | Phase 2 complete |
| **US2** (Validation) | US1 (for objections to validate) | T023 complete (objection insertion) |
| **US3** (Pattern Injection) | US1+US2, Spec 005 | US2 backend complete |
| **US4** (Analytics) | US1+US2+US3 (for data) | US3 complete |

### Parallel Opportunities

**Within Phase 1 (Setup)**:
```
T002, T003, T004 (env vars) - parallel
T005, T006, T007, T008, T009 (directories) - parallel
```

**Within Phase 2 (Foundational)**:
```
T010, T011, T012, T013 (copy contracts) - parallel
```

**Within US1 Backend**:
```
T019 (Praiz API), T020 (Claude extraction) - parallel
T027, T028 (hooks) - parallel
```

**Within US2 Backend**:
```
T037-T045 can be parallelized by assigning different mutations
T046, T047 (hooks) - parallel
```

**Within US4**:
```
T065, T066, T067, T068, T069 (queries) - parallel
```

---

## Parallel Example: User Story 1

```bash
# Launch tests first (write tests, ensure they FAIL):
Task agent: "T016 [US1] Unit test for extraction logic"
Task agent: "T017 [US1] Unit test for batch processing"
Task agent: "T018 [US1] Unit test for rate limiting"

# Then launch backend actions in parallel:
Task agent: "T019 [US1] Praiz API client action"
Task agent: "T020 [US1] Claude Sonnet extraction action"

# Then hooks in parallel:
Task agent: "T027 [US1] useProcessingJobs hook"
Task agent: "T028 [US1] usePraizMetrics hook"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + env vars)
2. Complete Phase 2: Foundational (contract types + budget tracking)
3. Complete Phase 3: User Story 1 (batch processing pipeline)
4. **STOP and VALIDATE**: Can queue videos, process with Claude Sonnet, extract patterns
5. Deploy/demo if ready - pipeline working without validation UI

### Incremental Delivery

| Increment | User Stories | Deliverable |
|-----------|--------------|-------------|
| **MVP** | US1 only | Batch processing pipeline works, patterns extracted |
| **+Validation** | US1 + US2 | Human validation workflow, quality control |
| **+Integration** | US1 + US2 + US3 | AI personas use real objections |
| **+Analytics** | All stories | Full observability and effectiveness tracking |

### Suggested Team Assignment (if parallel)

- **Engineer A**: US1 backend (T019-T026) → US1 frontend (T029-T033)
- **Engineer B**: US2 backend (T036-T045) → US2 frontend (T048-T055)
- **Engineer C**: Tests (T016-T018, T034-T035) → US3/US4 after US1/US2 complete

---

## Success Criteria Mapping

| Task | Success Criteria |
|------|------------------|
| T020-T026 | SC-001: >80% accuracy, SC-002: <$0.50/video, SC-005: <5min/video |
| T021, T015 | SC-006: 50 videos/hour without errors |
| T037-T042 | SC-007: Validated objections available in <24h |
| T057-T063 | SC-003: 100+ validated objections in 4 weeks, SC-004: >75% realistic |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story is independently completable and testable
- Verify tests fail before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- External dependency: Spec 005 (Context Builder) for US3
