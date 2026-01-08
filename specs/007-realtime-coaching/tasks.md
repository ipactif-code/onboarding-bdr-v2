# Tasks: Real-Time Coaching Modules (M2, M4, M6)

**Input**: Design documents from `/specs/007-realtime-coaching/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/ ✅
**Branch**: `007-realtime-coaching`
**Date**: 2026-01-08

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- Include exact file paths in descriptions

## User Story Overview

| Story | Priority | Module | Description |
|-------|----------|--------|-------------|
| US1 | P1 🎯 MVP | M2 | Real-Time Coaching Whispers |
| US2 | P2 | M6 | Voice Delivery Feedback |
| US3 | P3 | M4 | Dynamic Scenario Branching |
| US4 | P4 | M4 | What-If Replay |

---

## Phase 1: Setup

**Purpose**: Project structure and contract copying

- [ ] T001 [P] Copy contract files from `specs/007-realtime-coaching/contracts/` to `convex/lib/coaching/` for runtime access
- [ ] T002 [P] Create directory structure: `convex/coaching/`, `src/components/coaching/`, `src/hooks/coaching/`, `src/lib/coaching/`
- [ ] T003 [P] Create directory structure: `tests/unit/convex/coaching/`, `tests/e2e/training/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema updates that MUST be complete before any user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Schema Extensions

- [ ] T004 Extend `trainingSessions` table with M2/M6 fields in `convex/schema.ts` (whispersEnabled, whisperLanguage, voiceAnalysisEnabled, voiceFeedbackVisible, aggregated counters)
- [ ] T005 Add `whisperEvents` table to `convex/schema.ts` with all indexes (by_session, by_rule, by_rule_timestamp, by_priority)
- [ ] T006 [P] Add `whisperRules` configuration table to `convex/schema.ts` (15 rules with i18n messages)
- [ ] T007 [P] Add `voiceMetrics` table to `convex/schema.ts` with indexes (by_session, by_session_timestamp)
- [ ] T008 [P] Add `sessionVoiceSummary` table to `convex/schema.ts`
- [ ] T009 [P] Add `branchDecisions` table to `convex/schema.ts` with indexes (by_session, by_session_turn, by_branch_type)
- [ ] T010 [P] Add `whatIfExplorations` table to `convex/schema.ts` with indexes (by_session, by_branch_decision)
- [ ] T011 Run `npx convex dev` to validate schema and generate types

### Seed Data

- [ ] T012 Create seed script for 15 whisper rules in `convex/coaching/_seed.ts` with all 5 languages (fr, en, it, de, es)
- [ ] T013 Run seed script to populate `whisperRules` table in development

**Checkpoint**: Schema complete - user story implementation can now begin

---

## Phase 3: User Story 1 - Real-Time Coaching Whispers (Priority: P1) 🎯 MVP

**Goal**: BDRs receive contextual coaching hints during practice sessions with priority system, cooldowns, and i18n

**Independent Test**: Start a practice session, trigger known conditions (talk ratio >60% for 2min), verify whisper appears in session language

### Tests for User Story 1

- [ ] T014 [P] [US1] Unit test: whisper evaluation pure functions in `tests/unit/convex/coaching/whispers.test.ts`
- [ ] T015 [P] [US1] Unit test: rate limiting (4 per minute, 15s cooldown) in `tests/unit/convex/coaching/whispers.test.ts`
- [ ] T016 [P] [US1] Unit test: priority ordering (RACC > Normal > Positive) in `tests/unit/convex/coaching/whispers.test.ts`
- [ ] T017 [P] [US1] Integration test: whisper flow with mock metrics in `tests/integration/coaching/whisper-flow.test.ts`

### Backend Implementation for User Story 1

- [ ] T018 [US1] Create `convex/coaching/whispers.ts` with `evaluateWhispers` query (uses contract pure functions)
- [ ] T019 [US1] Add `recordWhisperEvent` mutation in `convex/coaching/whispers.ts` (with latency tracking)
- [ ] T020 [US1] Add `getSessionWhispers` query in `convex/coaching/whispers.ts`
- [ ] T021 [US1] Add `getWhisperRules` query in `convex/coaching/whispers.ts` (reads from whisperRules table)
- [ ] T022 [US1] Add graceful degradation logic (FR-010a) when M1/M3 metrics unavailable

### Frontend Implementation for User Story 1

- [ ] T023 [US1] Create `src/hooks/coaching/use-whispers.ts` hook (manages whisper state, cooldowns, evaluation trigger)
- [ ] T024 [US1] Create `src/components/coaching/whisper-overlay.tsx` component (AnimatePresence, priority-based colors)
- [ ] T025 [US1] Add ARIA attributes for accessibility (role="status", aria-live="polite")
- [ ] T026 [US1] Integrate whisper overlay into `src/app/(dashboard)/training/[sessionId]/page.tsx`

### Integration for User Story 1

- [ ] T027 [US1] Connect whisper evaluation to per-turn handler (receives M1 metrics, M3 state, transcript)
- [ ] T028 [US1] Verify 100ms evaluation budget (FR-010) with performance logging
- [ ] T029 [US1] Verify whispers disabled in evaluation mode (FR-005)

**Checkpoint**: US1 complete - whispers appear during practice with correct priority, cooldowns, and i18n

---

## Phase 4: User Story 2 - Voice Delivery Feedback (Priority: P2)

**Goal**: BDRs receive real-time feedback on pace and confidence with client-side audio analysis

**Independent Test**: Speak at various speeds, verify pace indicator updates correctly and low confidence triggers whispers

### Tests for User Story 2

- [ ] T030 [P] [US2] Unit test: voice metric calculation functions in `tests/unit/lib/coaching/voice-analyzer.test.ts`
- [ ] T031 [P] [US2] Unit test: pace status determination (too_slow, good, too_fast) in `tests/unit/lib/coaching/voice-analyzer.test.ts`
- [ ] T032 [P] [US2] Unit test: filler word detection by language in `tests/unit/lib/coaching/voice-analyzer.test.ts`
- [ ] T033 [P] [US2] Unit test: session summary aggregation in `tests/unit/convex/coaching/voice.test.ts`

### Backend Implementation for User Story 2

- [ ] T034 [US2] Create `convex/coaching/voice.ts` with `recordVoiceMetrics` mutation
- [ ] T035 [US2] Add `getRecentVoiceMetrics` query in `convex/coaching/voice.ts` (for whisper trigger evaluation)
- [ ] T036 [US2] Add `generateVoiceSummary` mutation in `convex/coaching/voice.ts` (called at session end)
- [ ] T037 [US2] Add `getSessionVoiceSummary` query in `convex/coaching/voice.ts`

### Frontend Implementation for User Story 2

- [ ] T038 [US2] Create `src/lib/coaching/voice-analyzer.ts` (Web Audio API wrapper, client-side analysis)
- [ ] T039 [US2] Implement confidence calculation (volume/pitch variance, pause frequency)
- [ ] T040 [US2] Implement pace calculation (WPM from transcript timing)
- [ ] T041 [US2] Implement energy calculation (amplitude analysis)
- [ ] T042 [US2] Implement hesitation detection (filler words by language)
- [ ] T043 [US2] Create `src/hooks/coaching/use-voice-analysis.ts` hook (manages AudioContext, 5s intervals)
- [ ] T044 [US2] Create `src/components/coaching/pace-indicator.tsx` component (too_slow/good/too_fast states)
- [ ] T045 [US2] Add accessibility for pace indicator (screen reader support)
- [ ] T046 [US2] Integrate pace indicator into training session page

### Integration for User Story 2

- [ ] T047 [US2] Feed voice metrics to whisper evaluation (confidence < 0.35 for 30s, pace > 180 WPM for 20s)
- [ ] T048 [US2] Add voice metric whisper triggers to evaluation pipeline
- [ ] T049 [US2] Handle microphone permission denial gracefully (fallback to transcript-only whispers)
- [ ] T050 [US2] Verify CPU usage < 5% (SC-003) with performance monitoring
- [ ] T051 [US2] Verify voice indicator hidden in evaluation mode (FR-028)
- [ ] T052 [US2] Add voice timeline visualization to session summary page

**Checkpoint**: US2 complete - pace indicator visible, voice metrics feed whispers, summary shows timeline

---

## Phase 5: User Story 3 - Dynamic Scenario Branching (Priority: P3)

**Goal**: BDR actions have consequences that affect AI prospect behavior during conversation

**Independent Test**: Handle an objection poorly, verify AI prospect becomes more guarded in subsequent turns

### Tests for User Story 3

- [ ] T053 [P] [US3] Unit test: branch detection functions in `tests/unit/convex/coaching/branching.test.ts`
- [ ] T054 [P] [US3] Unit test: branch type determination (positive/negative/neutral) in `tests/unit/convex/coaching/branching.test.ts`
- [ ] T055 [P] [US3] Unit test: emotional shift calculation in `tests/unit/convex/coaching/branching.test.ts`
- [ ] T056 [P] [US3] Unit test: max 5 branches per session limit in `tests/unit/convex/coaching/branching.test.ts`

### Backend Implementation for User Story 3

- [ ] T057 [US3] Create `convex/coaching/branching.ts` with `detectBranchPoint` function (uses contract logic)
- [ ] T058 [US3] Add `recordBranchDecision` mutation in `convex/coaching/branching.ts` (with latency tracking)
- [ ] T059 [US3] Add `getSessionBranches` query in `convex/coaching/branching.ts`
- [ ] T060 [US3] Add `getKeyDecisionPoints` query for session review (3-5 points)

### Frontend Implementation for User Story 3

- [ ] T061 [US3] Create `src/hooks/coaching/use-branch-history.ts` hook (tracks session branch state)
- [ ] T062 [US3] Create `src/components/coaching/branch-summary.tsx` component (shows decision history)
- [ ] T063 [US3] Add branch type visualization (positive=green, negative=red, neutral=gray)
- [ ] T064 [US3] Integrate branch summary into session review page

### Integration for User Story 3

- [ ] T065 [US3] Connect branch detection to per-turn transcript analysis
- [ ] T066 [US3] Feed branch outcome to M3 emotional state machine (from Spec 006)
- [ ] T067 [US3] Update Context Builder (Spec 005) with branch behavior hints
- [ ] T068 [US3] Verify 100ms logging latency (SC-006)
- [ ] T069 [US3] Verify branch decisions logged in evaluation mode (FR-015)

**Checkpoint**: US3 complete - BDR actions influence AI behavior, branch history visible in review

---

## Phase 6: User Story 4 - What-If Replay (Priority: P4)

**Goal**: BDRs can explore alternative responses at key decision points after completing a session

**Independent Test**: Complete a session, select a decision point, enter alternative response, receive consistent AI reply

### Tests for User Story 4

- [ ] T070 [P] [US4] Unit test: What-If availability check (completed sessions only) in `tests/unit/convex/coaching/what-if.test.ts`
- [ ] T071 [P] [US4] Unit test: max 3 explorations limit in `tests/unit/convex/coaching/what-if.test.ts`
- [ ] T072 [P] [US4] Unit test: alternative branch type analysis in `tests/unit/convex/coaching/what-if.test.ts`

### Backend Implementation for User Story 4

- [ ] T073 [US4] Create `convex/coaching/what-if.ts` with `getSessionWhatIfState` query
- [ ] T074 [US4] Add `exploreWhatIf` action in `convex/coaching/what-if.ts` (calls Claude API)
- [ ] T075 [US4] Implement AI prompt building with persona context (temperature 0.3 for consistency)
- [ ] T076 [US4] Add alternative branch type analysis from AI response
- [ ] T077 [US4] Add `getSessionExplorations` query in `convex/coaching/what-if.ts`

### Frontend Implementation for User Story 4

- [ ] T078 [US4] Create `src/hooks/coaching/use-what-if.ts` hook (manages exploration state, limit tracking)
- [ ] T079 [US4] Create `src/components/coaching/what-if-explorer.tsx` component (decision point selection, input, response display)
- [ ] T080 [US4] Add comparison view (original vs alternative response)
- [ ] T081 [US4] Add feedback display (improved/same/worse outcome)
- [ ] T082 [US4] Integrate What-If explorer into session review page

### Integration for User Story 4

- [ ] T083 [US4] Connect What-If explorer to branch decision points from US3
- [ ] T084 [US4] Verify session must be completed before What-If available (FR-022)
- [ ] T085 [US4] Verify original session score unchanged (FR-021)
- [ ] T086 [US4] Add rate limiting for AI API calls

**Checkpoint**: US4 complete - What-If exploration works for completed sessions with persona consistency

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Integration, performance, and quality improvements

### E2E Tests

- [ ] T087 [P] E2E test: whisper display during practice session in `tests/e2e/training/coaching-modules.spec.ts`
- [ ] T088 [P] E2E test: voice indicator visibility in `tests/e2e/training/coaching-modules.spec.ts`
- [ ] T089 [P] E2E test: branch summary in session review in `tests/e2e/training/coaching-modules.spec.ts`
- [ ] T090 [P] E2E test: What-If exploration flow in `tests/e2e/training/coaching-modules.spec.ts`

### Performance & Observability

- [ ] T091 Add performance logging for whisper latency (OBS-001: p50, p95, p99)
- [ ] T092 Add metrics for whisper trigger rates by rule (OBS-002)
- [ ] T093 Add voice analysis performance metrics (OBS-003: processing time, reliability)
- [ ] T094 Add error logging for failures (OBS-004)

### Documentation & Cleanup

- [ ] T095 Update training session page documentation with coaching module integration
- [ ] T096 Run `pnpm typecheck` and fix any TypeScript errors
- [ ] T097 Run `pnpm lint` and fix any ESLint issues
- [ ] T098 Run quickstart.md validation (verify all code examples work)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ← BLOCKS all user stories
    │
    ├──────────────────────────────────────┐
    │                                      │
    ▼                                      ▼
Phase 3 (US1: Whispers)            Phase 4 (US2: Voice) [P]
    │                                      │
    └──────────────────────────────────────┤
                                           │
    ┌──────────────────────────────────────┘
    │
    ▼
Phase 5 (US3: Branching) ← Depends on US1 for whisper integration
    │
    ▼
Phase 6 (US4: What-If) ← Depends on US3 for branch decisions
    │
    ▼
Phase 7 (Polish)
```

### User Story Dependencies

- **US1 (Whispers)**: Can start after Phase 2 - No dependencies on other stories
- **US2 (Voice)**: Can start after Phase 2 - Integrates with US1 whispers but independently testable
- **US3 (Branching)**: Can start after Phase 2 - Requires US1 for whisper triggers from branches
- **US4 (What-If)**: Depends on US3 for branch decision data - Cannot start until US3 complete

### Parallel Opportunities Within Stories

**US1 Parallel Tasks:**
```
T014, T015, T016, T017 - All tests in parallel
T023, T024 - Hook and component in parallel (different files)
```

**US2 Parallel Tasks:**
```
T030, T031, T032, T033 - All tests in parallel
T038, T039, T040, T041, T042 - Voice analyzer internals (sequential in same file)
T043, T044 - Hook and component in parallel (different files)
```

**US3 Parallel Tasks:**
```
T053, T054, T055, T056 - All tests in parallel
T061, T062 - Hook and component in parallel
```

**US4 Parallel Tasks:**
```
T070, T071, T072 - All tests in parallel
T078, T079 - Hook and component in parallel
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (schema + seed)
3. Complete Phase 3: US1 (Whispers)
4. **STOP and VALIDATE**: Test whispers independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Whispers) → Test → Deploy (MVP!)
3. Add US2 (Voice) → Test → Deploy
4. Add US3 (Branching) → Test → Deploy
5. Add US4 (What-If) → Test → Deploy
6. Polish phase → Final deploy

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (Whispers)
   - Developer B: US2 (Voice) - can run in parallel with US1
3. After US1 + US2 complete:
   - Developer A: US3 (Branching)
   - Developer B: Polish tasks from US1/US2
4. After US3 complete:
   - US4 (What-If)

---

## Summary

| Phase | Tasks | Parallel | Story |
|-------|-------|----------|-------|
| Setup | 3 | 3 | - |
| Foundational | 10 | 6 | - |
| US1: Whispers | 16 | 4 | P1 🎯 |
| US2: Voice | 23 | 4 | P2 |
| US3: Branching | 17 | 4 | P3 |
| US4: What-If | 17 | 3 | P4 |
| Polish | 12 | 4 | - |
| **Total** | **98** | **28** | - |

---

## Notes

- Tests use Vitest + convex-test for backend, React Testing Library for components
- E2E tests use Playwright
- All Convex functions must have `requireAuth()` on first line
- Voice analysis runs entirely client-side (Web Audio API) - no raw audio transmitted
- What-If uses Claude 3.5 Haiku at temperature 0.3 for persona consistency
- Data retention: 2-3 years with session data (per clarification)
