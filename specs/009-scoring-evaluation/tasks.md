# Tasks: BDR Performance Scoring & Evaluation System

**Input**: Design documents from `/specs/009-scoring-evaluation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec - test tasks are NOT included. Add tests via separate request if needed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, schema, and shared utilities

- [ ] T001 Add sessionScores, scoringJobs, certificationRecords, teamLeadNotes tables to convex/schema.ts
- [ ] T002 [P] Create Zod validators for scoring output in src/lib/validators/scoring.ts
- [ ] T003 [P] Create scoring prompt constants (rubric, battlecards) in convex/lib/scoring-prompts.ts
- [ ] T004 [P] Create type definitions for scoring dimensions in src/types/scoring.ts
- [ ] T005 Install @anthropic-ai/sdk dependency via pnpm

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create Claude scoring action wrapper in convex/actions/claude-scoring.ts
- [ ] T007 [P] Create job queue mutations (enqueue, processJob, failJob) in convex/scoring/jobs.ts
- [ ] T008 [P] Create storeScore internal mutation in convex/scoring/jobs.ts
- [ ] T009 Create scheduler integration for job processing with exponential backoff in convex/scoring/jobs.ts
- [ ] T010 Create base score retrieval query (getSessionScore) in convex/scoring/results.ts with access control

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Automatic Post-Session Scoring (Priority: P1) MVP

**Goal**: BDR training sessions are automatically scored when they end, with results appearing within 30 seconds

**Independent Test**: Complete a mock training session and verify that within 30 seconds, an overall score (0-100) appears with expandable dimension breakdowns and 3-5 key moments with timestamps.

### Implementation for User Story 1

- [ ] T011 [US1] Implement scoreSession action with full Claude prompt in convex/actions/claude-scoring.ts
- [ ] T012 [US1] Implement weighted score calculation (SPIN 20%, MEDDIC 20%, RACC 20%, BANT 15%, Behavioral 15%, Adaptive 10%) in convex/actions/claude-scoring.ts
- [ ] T013 [US1] Implement Zod validation for Claude response parsing in convex/actions/claude-scoring.ts
- [ ] T014 [US1] Implement getScoringStatus query for real-time progress in convex/scoring/jobs.ts
- [ ] T015 [P] [US1] Create scoring status hook (useScoringStatus) in src/hooks/scoring/use-scoring-status.ts
- [ ] T016 [P] [US1] Create score retrieval hook (useSessionScore) in src/hooks/scoring/use-session-score.ts
- [ ] T017 [US1] Create ScoreOverview component (overall score, dimension pills) in src/components/scoring/score-overview.tsx
- [ ] T018 [US1] Create DimensionCard component (expandable dimension scores) in src/components/scoring/dimension-card.tsx
- [ ] T019 [US1] Create KeyMoments component (timeline with positive/negative markers) in src/components/scoring/key-moments.tsx
- [ ] T020 [US1] Create ScoringProgress component (spinner, progress indicator) in src/components/scoring/scoring-progress.tsx
- [ ] T021 [US1] Create score results page at src/app/(dashboard)/sessions/[sessionId]/score/page.tsx
- [ ] T022 [US1] Implement duplicate transcript detection (FR-053) in convex/scoring/jobs.ts
- [ ] T023 [US1] Implement session-too-short edge case (<2 min or <10 turns) in convex/actions/claude-scoring.ts

**Checkpoint**: User Story 1 should be fully functional - sessions are scored automatically with results displayed

---

## Phase 4: User Story 2 - Detailed Feedback Report (Priority: P1)

**Goal**: Each scoring dimension shows detailed feedback with sub-scores and specific guidance

**Independent Test**: View a scored session and verify each dimension shows a score, specific feedback text, and relevant details (e.g., which SPIN question types were missed, each objection's RACC handling).

### Implementation for User Story 2

- [ ] T024 [US2] Implement getDetailedFeedback query in convex/scoring/results.ts
- [ ] T025 [P] [US2] Create SPINFeedback component (S/P/I/N breakdown with scores) in src/components/scoring/spin-feedback.tsx
- [ ] T026 [P] [US2] Create MEDDICFeedback component (7 sub-dimensions with scores) in src/components/scoring/meddic-feedback.tsx
- [ ] T027 [P] [US2] Create BANTFeedback component (B/A/N/T breakdown) in src/components/scoring/bant-feedback.tsx
- [ ] T028 [P] [US2] Create RACCFeedback component (per-objection R/A/C/C scores) in src/components/scoring/racc-feedback.tsx
- [ ] T029 [P] [US2] Create BehavioralFeedback component (talk ratio %, listening, confidence, pacing) in src/components/scoring/behavioral-feedback.tsx
- [ ] T030 [P] [US2] Create AdaptiveFeedback component (difficulty + emotional navigation) in src/components/scoring/adaptive-feedback.tsx
- [ ] T031 [US2] Implement language detection and feedback localization in convex/actions/claude-scoring.ts
- [ ] T032 [US2] Update DimensionCard to expand into detailed feedback components in src/components/scoring/dimension-card.tsx

**Checkpoint**: User Stories 1 AND 2 should both work - scores with detailed per-dimension feedback

---

## Phase 5: User Story 3 - Strengths and Improvements Summary (Priority: P2)

**Goal**: BDRs see top 3 strengths, top 3 improvements, recommended scenarios, and trend comparison to last 5 sessions

**Independent Test**: Complete multiple sessions and verify the summary shows top 3 strengths, top 3 improvements with advice, recommended practice scenarios, and comparison to last 5 sessions.

### Implementation for User Story 3

- [ ] T033 [US3] Implement getScoreTrend query (last 5 sessions) in convex/scoring/trends.ts
- [ ] T034 [US3] Implement getTrendAnalysis query with dimension-by-dimension comparison in convex/scoring/trends.ts
- [ ] T035 [P] [US3] Create useTrendAnalysis hook in src/hooks/scoring/use-trend-analysis.ts
- [ ] T036 [US3] Create FeedbackSummary component (strengths, improvements, recommendations) in src/components/scoring/feedback-summary.tsx
- [ ] T037 [US3] Create TrendChart component (line chart for last 5 sessions) in src/components/scoring/trend-chart.tsx
- [ ] T038 [US3] Create DimensionTrends component (per-dimension up/down/stable indicators) in src/components/scoring/dimension-trends.tsx
- [ ] T039 [US3] Add trend section to score results page in src/app/(dashboard)/sessions/[sessionId]/score/page.tsx

**Checkpoint**: User Stories 1, 2, AND 3 should work - full scoring with feedback and trends

---

## Phase 6: User Story 4 - Evaluation Mode for Certification (Priority: P2)

**Goal**: Evaluation sessions scored against certification criteria with pass/fail/distinction recommendations and Team Lead notes

**Independent Test**: Conduct an evaluation-mode session and verify stricter thresholds are applied, pass/fail/distinction status is shown with justification, and Team Lead can add notes.

### Implementation for User Story 4

- [ ] T040 [US4] Implement determineEvaluationResult helper (pass/fail/distinction logic) in convex/evaluations/certification.ts
- [ ] T041 [US4] Implement createCertificationRecord mutation in convex/evaluations/certification.ts
- [ ] T042 [US4] Implement getCertificationHistory query in convex/evaluations/certification.ts
- [ ] T043 [US4] Implement getTeamCertifications query (Team Lead only) in convex/evaluations/certification.ts
- [ ] T044 [US4] Implement getTeamCertificationStats query in convex/evaluations/certification.ts
- [ ] T045 [US4] Implement markCertificationReviewed mutation in convex/evaluations/certification.ts
- [ ] T046 [P] [US4] Implement addTeamLeadNotes mutation in convex/evaluations/notes.ts
- [ ] T047 [P] [US4] Implement updateTeamLeadNotes mutation in convex/evaluations/notes.ts
- [ ] T048 [US4] Create EvaluationBadge component (pass/fail/distinction with reason) in src/components/scoring/evaluation-badge.tsx
- [ ] T049 [US4] Create TeamLeadNotes component (add/edit notes form) in src/components/scoring/team-lead-notes.tsx
- [ ] T050 [US4] Create CertificationHistory component (list of past evaluations) in src/components/scoring/certification-history.tsx
- [ ] T051 [US4] Update score results page to show evaluation mode UI when isEvaluation=true in src/app/(dashboard)/sessions/[sessionId]/score/page.tsx
- [ ] T052 [US4] Create Team Lead certification dashboard at src/app/(dashboard)/team/certifications/page.tsx

**Checkpoint**: User Stories 1-4 should work - full scoring including evaluation mode with certifications

---

## Phase 7: User Story 5 - Competitive Response Evaluation (Priority: P3)

**Goal**: Sessions mentioning competitors are evaluated for competitive positioning skills

**Independent Test**: Conduct a session where competitors are mentioned and verify the system detects mentions, evaluates responses against battlecard best practices, and flags any competitor bashing.

### Implementation for User Story 5

- [ ] T053 [US5] Add competitive battlecard constants (Icertis, Diligent, SharePoint) to convex/lib/scoring-prompts.ts
- [ ] T054 [US5] Update Claude prompt to detect competitor mentions and evaluate responses in convex/actions/claude-scoring.ts
- [ ] T055 [US5] Create CompetitorAnalysis component (detected mentions with scores) in src/components/scoring/competitor-analysis.tsx
- [ ] T056 [US5] Create CompetitorMention component (individual mention with feedback) in src/components/scoring/competitor-mention.tsx
- [ ] T057 [US5] Add competitive section to score results page (conditional on mentions) in src/app/(dashboard)/sessions/[sessionId]/score/page.tsx

**Checkpoint**: All 5 user stories should work - complete scoring system with competitive evaluation

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T058 [P] Create SCORING_RUBRIC display component for pre-session visibility (FR-054) in src/components/scoring/scoring-rubric.tsx
- [ ] T059 [P] Implement archive cron job for 2-year-old scores in convex/scoring/archive.ts
- [ ] T060 Add error toast notifications for scoring failures in src/components/scoring/scoring-progress.tsx
- [ ] T061 Add Skeleton loading states to all scoring components
- [ ] T062 Implement keyboard navigation for dimension card expansion
- [ ] T063 Add ARIA labels and accessibility attributes to score display components
- [ ] T064 Run quickstart.md validation scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 and can run in parallel
  - US3 and US4 are both P2 and can run in parallel (after foundational)
  - US5 is P3 and can start after foundational
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Foundation for all other stories
- **User Story 2 (P1)**: Can start after Foundational - Independent of US1 (uses same score data)
- **User Story 3 (P2)**: Can start after Foundational - Requires score data structure from US1
- **User Story 4 (P2)**: Can start after Foundational - Independent evaluation logic
- **User Story 5 (P3)**: Can start after Foundational - Independent competitive analysis

### Within Each User Story

- Backend (Convex) before Frontend (React)
- Queries/Mutations before Actions
- Hooks before Components
- Components before Pages

### Parallel Opportunities

**Phase 1 (Setup)**:
```
T002, T003, T004 can run in parallel (different files)
```

**Phase 2 (Foundational)**:
```
T007, T008 can run in parallel (same file but independent functions)
```

**Phase 3 (US1)**:
```
T015, T016 can run in parallel (different hook files)
```

**Phase 4 (US2)**:
```
T025, T026, T027, T028, T029, T030 can ALL run in parallel (6 independent feedback components)
```

**Phase 6 (US4)**:
```
T046, T047 can run in parallel (notes mutations)
```

---

## Parallel Example: User Story 2 Feedback Components

```bash
# Launch all 6 feedback components together:
Task: "Create SPINFeedback component in src/components/scoring/spin-feedback.tsx"
Task: "Create MEDDICFeedback component in src/components/scoring/meddic-feedback.tsx"
Task: "Create BANTFeedback component in src/components/scoring/bant-feedback.tsx"
Task: "Create RACCFeedback component in src/components/scoring/racc-feedback.tsx"
Task: "Create BehavioralFeedback component in src/components/scoring/behavioral-feedback.tsx"
Task: "Create AdaptiveFeedback component in src/components/scoring/adaptive-feedback.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T010)
3. Complete Phase 3: User Story 1 (T011-T023)
4. **STOP and VALIDATE**: Test automatic scoring end-to-end
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Detailed feedback available → Deploy/Demo
4. Add User Story 3 → Trends and recommendations → Deploy/Demo
5. Add User Story 4 → Evaluation mode for certifications → Deploy/Demo
6. Add User Story 5 → Competitive analysis → Deploy/Demo

### Parallel Team Strategy

With 3 developers after Foundational:

- **Developer A**: User Story 1 (scoring engine core)
- **Developer B**: User Story 2 (feedback components)
- **Developer C**: User Story 4 (evaluation mode)

Then:

- **Developer A**: User Story 3 (trends)
- **Developer B**: User Story 5 (competitive)
- **Developer C**: Polish tasks

---

## Task Counts

| Phase | User Story | Task Count |
|-------|------------|------------|
| 1 | Setup | 5 |
| 2 | Foundational | 5 |
| 3 | US1 - Automatic Scoring | 13 |
| 4 | US2 - Detailed Feedback | 9 |
| 5 | US3 - Trends & Summary | 7 |
| 6 | US4 - Evaluation Mode | 13 |
| 7 | US5 - Competitive | 5 |
| 8 | Polish | 7 |
| **Total** | | **64** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Claude API key must be set in Convex env vars before testing US1
