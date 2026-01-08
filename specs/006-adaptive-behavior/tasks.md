# Tasks: Adaptive Behavior Modules (M1 & M3)

**Input**: Design documents from `/specs/006-adaptive-behavior/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Included per Constitution Article II (80% coverage, convex-test)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

```text
# Backend (Convex)
convex/
├── schema.ts
├── lib/
│   ├── m1-difficulty-engine.ts
│   └── m3-emotional-state.ts
├── training/
│   ├── difficulty.ts
│   └── emotional-state.ts
└── actions/
    └── session-context.ts

# Frontend
src/
├── components/ai-trainer/
├── hooks/ai-trainer/
└── lib/ai-trainer/

# Tests
tests/
├── unit/convex/
└── integration/ai-trainer/
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema extensions and type foundations

- [ ] T001 Extend trainingSessions table with M1/M3 fields in convex/schema.ts
- [ ] T002 Extend aiTrainerPersonas table with difficulty bounds and emotional config in convex/schema.ts
- [ ] T003 [P] Create m1DifficultyEvents table with indexes in convex/schema.ts
- [ ] T004 [P] Create m3EmotionalEvents table with indexes in convex/schema.ts
- [ ] T005 [P] Create performanceSnapshots table with indexes in convex/schema.ts
- [ ] T006 Run `npx convex dev` to validate schema changes compile correctly

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core pure functions and types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 [P] Create PerformanceMetrics type and PERFORMANCE_WEIGHTS constant in convex/lib/m1-difficulty-engine.ts
- [ ] T008 [P] Create EmotionalState type and state machine constants in convex/lib/m3-emotional-state.ts
- [ ] T009 Implement calculateCompositeScore pure function in convex/lib/m1-difficulty-engine.ts
- [ ] T010 [P] Implement calculateBehaviorModifiers pure function in convex/lib/m1-difficulty-engine.ts
- [ ] T011 Implement initializeEmotionalState pure function in convex/lib/m3-emotional-state.ts
- [ ] T012 [P] Create BehaviorModifiers type and lerp helper in convex/lib/m1-difficulty-engine.ts
- [ ] T013 [P] Create TRANSITION_TRIGGERS and PERSONA_PRESETS constants in convex/lib/m3-emotional-state.ts
- [ ] T014 Update persona seed script with M1/M3 configuration (difficultyMin/Max/Default, defaultEmotionalState, emotionalModifiers) in convex/seed.ts or equivalent

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Dynamic Difficulty Adjustment (Priority: P1) 🎯 MVP

**Goal**: AI prospect difficulty adjusts dynamically based on BDR performance, implementing ZPD

**Independent Test**: Conduct a 10-minute session performing well for 3 minutes then poorly for 3 minutes. Verify difficulty increases then decreases.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T015 [P] [US1] Unit test: calculateCompositeScore with various metric inputs in tests/unit/convex/m1-difficulty-engine.test.ts
- [ ] T016 [P] [US1] Unit test: evaluateAdjustment respects cooldown (60 seconds) in tests/unit/convex/m1-difficulty-engine.test.ts
- [ ] T017 [P] [US1] Unit test: evaluateAdjustment respects persona bounds in tests/unit/convex/m1-difficulty-engine.test.ts
- [ ] T018 [P] [US1] Unit test: evaluateAdjustment requires sustained performance (2+ min) in tests/unit/convex/m1-difficulty-engine.test.ts
- [ ] T019 [P] [US1] Unit test: evaluateAdjustment disabled in evaluation mode in tests/unit/convex/m1-difficulty-engine.test.ts
- [ ] T020 [P] [US1] Unit test: calculateBehaviorModifiers scales linearly with difficulty in tests/unit/convex/m1-difficulty-engine.test.ts

### Implementation for User Story 1

- [ ] T021 [US1] Implement evaluateAdjustment function with cooldown check in convex/lib/m1-difficulty-engine.ts
- [ ] T022 [US1] Implement initializeDifficultyState function in convex/lib/m1-difficulty-engine.ts
- [ ] T023 [US1] Implement mapDifficultyToLevel (numeric → easy/medium/hard) in convex/lib/m1-difficulty-engine.ts
- [ ] T024 [US1] Create getDifficultyState query in convex/training/difficulty.ts
- [ ] T025 [US1] Create updateDifficulty mutation with event logging in convex/training/difficulty.ts
- [ ] T026 [US1] Create initializeSessionDifficulty internal mutation in convex/training/difficulty.ts
- [ ] T027 [US1] Create getDifficultyEvents query for session history in convex/training/difficulty.ts
- [ ] T028 [P] [US1] Create useDifficultyState hook for frontend subscription in src/hooks/ai-trainer/use-difficulty-state.ts

**Checkpoint**: M1 Difficulty Engine fully functional - difficulty adjusts based on performance with proper cooldowns and bounds

---

## Phase 4: User Story 2 - Emotional State Feedback (Priority: P1)

**Goal**: Prospect emotional state transitions based on BDR actions, affecting voice tone

**Independent Test**: Ask a good SPIN question and verify prospect voice becomes warmer. Pitch too early and verify voice becomes cooler/guarded.

**Dependency**: Can start in parallel with US1 after Phase 2 is complete

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T029 [P] [US2] Unit test: evaluateTransition rate limits to 2 per minute in tests/unit/convex/m3-emotional-state.test.ts
- [ ] T030 [P] [US2] Unit test: evaluateTransition applies persona modifiers in tests/unit/convex/m3-emotional-state.test.ts
- [ ] T031 [P] [US2] Unit test: evaluateTransition blocks frustrated in grace period in tests/unit/convex/m3-emotional-state.test.ts
- [ ] T032 [P] [US2] Unit test: frustrated state triggers warning after 2 turns in tests/unit/convex/m3-emotional-state.test.ts
- [ ] T033 [P] [US2] Unit test: frustrated state triggers call termination after 4 turns in tests/unit/convex/m3-emotional-state.test.ts
- [ ] T034 [P] [US2] Unit test: impressed state requires 5+ excellent exchanges in tests/unit/convex/m3-emotional-state.test.ts
- [ ] T035 [P] [US2] Unit test: getVoiceModulation returns correct parameters per state in tests/unit/convex/m3-emotional-state.test.ts

### Implementation for User Story 2

- [ ] T036 [US2] Implement evaluateTransition function with rate limiting in convex/lib/m3-emotional-state.ts
- [ ] T037 [US2] Implement updateContextAfterTransition function in convex/lib/m3-emotional-state.ts
- [ ] T038 [US2] Add FRUSTRATED_WARNING_MESSAGES and CALL_TERMINATION_MESSAGES constants (5 languages) in convex/lib/m3-emotional-state.ts
- [ ] T039 [US2] Implement getVoiceModulation function for Cartesia integration in convex/lib/m3-emotional-state.ts
- [ ] T040 [US2] Create getEmotionalState query in convex/training/emotional-state.ts
- [ ] T041 [US2] Create evaluateStateTransition mutation with event logging in convex/training/emotional-state.ts
- [ ] T042 [US2] Create initializeSessionEmotionalState internal mutation in convex/training/emotional-state.ts
- [ ] T043 [US2] Create handleFrustratedState mutation for warning/termination logic in convex/training/emotional-state.ts
- [ ] T044 [US2] Create getEmotionalEvents query for session history in convex/training/emotional-state.ts
- [ ] T045 [P] [US2] Create useEmotionalState hook for frontend subscription in src/hooks/ai-trainer/use-emotional-state.ts

**Checkpoint**: M3 Emotional State Machine fully functional - emotions transition with rate limiting and frustrated state handling works

---

## Phase 5: User Story 3 - Consistent Persona Behavior (Priority: P1)

**Goal**: Each persona has distinct baseline difficulty and emotional patterns

**Independent Test**: Start sessions with 3 different personas. Verify each has distinct starting state, difficulty range, and behavior patterns.

**Dependency**: Requires T014 (persona seed data), can otherwise start after Phase 2

### Tests for User Story 3

- [ ] T046 [P] [US3] Unit test: initializeDifficultyState uses persona difficultyDefault in tests/unit/convex/m1-difficulty-engine.test.ts
- [ ] T047 [P] [US3] Unit test: initializeEmotionalState uses persona defaultEmotionalState in tests/unit/convex/m3-emotional-state.test.ts
- [ ] T048 [P] [US3] Unit test: PERSONA_PRESETS contains skeptical_analyst, friendly_champion, pressured_executive, aggressive_negotiator in tests/unit/convex/m3-emotional-state.test.ts
- [ ] T049 [US3] Integration test: Session with philippe_renault persona starts skeptical at difficulty 0.70 in tests/integration/ai-trainer/adaptive-behavior.test.ts

### Implementation for User Story 3

- [ ] T050 [US3] Implement getPersonaAdaptiveConfig query to fetch persona M1/M3 config in convex/training/difficulty.ts
- [ ] T051 [US3] Implement formatBehaviorModifiersForPrompt for Context Builder in convex/lib/m1-difficulty-engine.ts
- [ ] T052 [US3] Implement formatEmotionalStateForPrompt for Context Builder in convex/lib/m3-emotional-state.ts
- [ ] T053 [US3] Create buildSessionContext action integrating M1/M3 with Context Builder V7 in convex/actions/session-context.ts
- [ ] T054 [US3] Update session creation to initialize M1/M3 state from persona config in convex/training/sessions.ts

**Checkpoint**: All personas have distinct adaptive behavior - skeptical_analyst harder to impress, friendly_champion easier to warm up

---

## Phase 6: User Story 4 - Performance Visibility (Priority: P2)

**Goal**: Optional real-time performance overlay in free practice mode (disabled in evaluation)

**Independent Test**: Toggle overlay on/off in free practice. Verify metrics display and update within 15 seconds. Verify overlay is disabled in evaluation mode.

**Dependency**: Requires US1 (difficulty state) and US2 (emotional state) to be complete

### Tests for User Story 4

- [ ] T055 [P] [US4] Unit test: isOverlayAllowed returns false for evaluation mode in tests/unit/convex/performance-overlay.test.ts
- [ ] T056 [P] [US4] Unit test: calculateTrend correctly identifies improving/stable/declining in tests/unit/convex/performance-overlay.test.ts
- [ ] T057 [P] [US4] Unit test: getMetricStatus returns good/warning/poor based on thresholds in tests/unit/convex/performance-overlay.test.ts
- [ ] T058 [US4] Component test: PerformanceOverlay renders metrics correctly in tests/unit/components/performance-overlay.test.tsx

### Implementation for User Story 4

- [ ] T059 [US4] Create createPerformanceSnapshot mutation (30-second interval) in convex/training/difficulty.ts
- [ ] T060 [US4] Create getLatestSnapshot query for overlay data in convex/training/difficulty.ts
- [ ] T061 [US4] Implement isOverlayAllowed, calculateTrend, getMetricStatus utilities in src/lib/ai-trainer/metrics-calculator.ts
- [ ] T062 [US4] Create MetricCard component for individual metric display in src/components/ai-trainer/metric-card.tsx
- [ ] T063 [US4] Create DifficultyGauge component showing current difficulty level in src/components/ai-trainer/difficulty-indicator.tsx
- [ ] T064 [US4] Create EmotionalStateIndicator component showing current state in src/components/ai-trainer/emotional-state-indicator.tsx
- [ ] T065 [US4] Create PerformanceOverlay container with toggle and all metrics in src/components/ai-trainer/performance-overlay.tsx
- [ ] T066 [P] [US4] Create usePerformanceOverlay hook managing config and state in src/hooks/ai-trainer/use-performance-overlay.ts
- [ ] T067 [US4] Add overlay toggle to session UI (only visible in free practice mode)

**Checkpoint**: Performance overlay shows real-time metrics in free practice, hidden in evaluation mode

---

## Phase 7: Integration & Polish

**Purpose**: Voice pipeline integration and cross-cutting improvements

- [ ] T068 Integrate M1/M3 state injection into voice pipeline turn processing in convex/actions/session-context.ts
- [ ] T069 Add performance benchmarking to verify <10ms overhead per turn (FR-016) in tests/integration/ai-trainer/performance.test.ts
- [ ] T070 [P] Add JSDoc comments to all exported functions in convex/lib/m1-difficulty-engine.ts
- [ ] T071 [P] Add JSDoc comments to all exported functions in convex/lib/m3-emotional-state.ts
- [ ] T072 [P] Add JSDoc comments to all exported queries/mutations in convex/training/difficulty.ts
- [ ] T073 [P] Add JSDoc comments to all exported queries/mutations in convex/training/emotional-state.ts
- [ ] T074 Run full test suite and verify 80%+ coverage for M1/M3 modules
- [ ] T075 Run quickstart.md validation scenarios manually
- [ ] T076 Update Spec 005 integration documentation to reference M1/M3 inputs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Phase 2 completion
  - US1 and US2 can proceed in parallel (P1 priority)
  - US3 can proceed in parallel with US1/US2 (P1 priority)
  - US4 depends on US1 + US2 completion (P2 priority)
- **Integration (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **User Story 3 (P1)**: Can start after Phase 2 + T014 - Requires persona seed data
- **User Story 4 (P2)**: Depends on US1 + US2 completion for meaningful metrics

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Pure functions before Convex queries/mutations
- Backend before frontend hooks
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 parallelizable**:
- T003, T004, T005 (new tables)

**Phase 2 parallelizable**:
- T007, T008 (types and constants)
- T010, T012, T013 (pure functions)

**US1 tests parallelizable**:
- T015, T016, T017, T018, T019, T020 (all independent unit tests)

**US2 tests parallelizable**:
- T029, T030, T031, T032, T033, T034, T035 (all independent unit tests)

**US3 tests parallelizable**:
- T046, T047, T048 (unit tests)

**US4 parallelizable**:
- T055, T056, T057 (unit tests)

**Cross-story parallelization**:
- US1 and US2 can be worked on simultaneously by different developers
- US3 can be worked on in parallel once Phase 2 is complete

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (ensure they fail first):
Task: T015 "Unit test: calculateCompositeScore"
Task: T016 "Unit test: evaluateAdjustment respects cooldown"
Task: T017 "Unit test: evaluateAdjustment respects persona bounds"
Task: T018 "Unit test: evaluateAdjustment requires sustained performance"
Task: T019 "Unit test: evaluateAdjustment disabled in evaluation mode"
Task: T020 "Unit test: calculateBehaviorModifiers scales linearly"

# Then implement (sequential within story):
Task: T021 "Implement evaluateAdjustment function"
Task: T022 "Implement initializeDifficultyState function"
# ...etc
```

---

## Parallel Example: Cross-Story

```bash
# After Phase 2 complete, launch US1, US2, US3 in parallel:

# Developer A: User Story 1
Task: T015-T020 (US1 tests)
Task: T021-T028 (US1 implementation)

# Developer B: User Story 2
Task: T029-T035 (US2 tests)
Task: T036-T045 (US2 implementation)

# Developer C: User Story 3
Task: T046-T049 (US3 tests)
Task: T050-T054 (US3 implementation)

# Then US4 after US1+US2 complete
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema extensions)
2. Complete Phase 2: Foundational (types, pure functions, seed data)
3. Complete Phase 3: User Story 1 (M1 Difficulty Engine)
4. **STOP and VALIDATE**: Test difficulty adjustment independently
5. Deploy/demo if ready - BDRs can experience adaptive difficulty

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (difficulty adjustment works)
3. Add User Story 2 → Test independently → Deploy (emotional states + voice tone)
4. Add User Story 3 → Test independently → Deploy (personas feel distinct)
5. Add User Story 4 → Test independently → Deploy (performance overlay)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With 3 developers after Phase 2:

1. Team completes Setup + Foundational together
2. Once Phase 2 done:
   - Developer A: User Story 1 (M1 Difficulty)
   - Developer B: User Story 2 (M3 Emotional)
   - Developer C: User Story 3 (Persona Behavior)
3. After US1 + US2: Any developer takes US4 (Performance Overlay)
4. All: Phase 7 Integration & Polish

---

## Task Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| 1. Setup | T001-T006 (6) | 3 |
| 2. Foundational | T007-T014 (8) | 5 |
| 3. US1 - Difficulty | T015-T028 (14) | 7 |
| 4. US2 - Emotional | T029-T045 (17) | 8 |
| 5. US3 - Personas | T046-T054 (9) | 4 |
| 6. US4 - Overlay | T055-T067 (13) | 5 |
| 7. Polish | T068-T076 (9) | 4 |
| **Total** | **76 tasks** | **36 parallel opportunities** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Performance target: <10ms overhead per turn (validate with T069)
