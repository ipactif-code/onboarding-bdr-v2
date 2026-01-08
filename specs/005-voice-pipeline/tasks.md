# Tasks: Real-Time Voice Pipeline

**Input**: Design documents from `/specs/005-voice-pipeline/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Tests included per project constitution (80% coverage required)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## User Stories (from spec.md)

| Story | Title | Priority |
|-------|-------|----------|
| US1 | Natural Conversation Flow | P1 |
| US2 | Persona Authenticity | P1 |
| US3 | Emotional Responsiveness | P2 |
| US4 | Graceful Degradation | P2 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, schema additions, and environment configuration

- [ ] T001 Add environment variables to .env.local for voice services (DEEPGRAM_API_KEY, ANTHROPIC_API_KEY, CARTESIA_API_KEY, SIMLI_API_KEY)
- [ ] T002 Add sessionTranscripts table to convex/schema.ts per data-model.md
- [ ] T003 [P] Add guardrailViolations table to convex/schema.ts per data-model.md
- [ ] T004 [P] Add guardrailViolationCorpus table to convex/schema.ts per data-model.md
- [ ] T005 [P] Add voiceMetrics table to convex/schema.ts per data-model.md
- [ ] T006 Run `npx convex dev` to deploy schema changes and verify indexes

**Checkpoint**: Schema deployed - backend development can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Guardrail Corpus Seeding

- [ ] T007 Create guardrail seed data types in convex/aiTrainer/guardrails.ts (CorpusEntry interface, categories)
- [ ] T008 Implement seedGuardrailCorpus internal mutation in convex/aiTrainer/guardrails.ts
- [ ] T009 Create 100+ curated seed patterns JSON file at convex/aiTrainer/seedPatterns.json (prompt injection, jailbreak, language switch, character break)
- [ ] T010 Implement getActiveCorpus query in convex/aiTrainer/guardrails.ts with by_active index

### Transcript & Metrics Backend

- [ ] T011 [P] Implement createTranscript mutation in convex/aiTrainer/transcripts.ts per data-model.md
- [ ] T012 [P] Implement getSessionTranscripts query in convex/aiTrainer/transcripts.ts with by_session index
- [ ] T013 [P] Implement createVoiceMetrics mutation in convex/aiTrainer/voiceMetrics.ts per data-model.md
- [ ] T014 [P] Implement updateVoiceMetrics mutation in convex/aiTrainer/voiceMetrics.ts
- [ ] T015 [P] Implement getVoiceMetrics query in convex/aiTrainer/voiceMetrics.ts with by_session index

### Context Builder V7

- [ ] T016 Create context builder types in src/lib/ai-trainer/context-builder.ts per contracts/context-builder.ts
- [ ] T017 Implement buildSystemPrompt function in src/lib/ai-trainer/context-builder.ts with persona, scenario, product templates
- [ ] T018 Implement trimHistory function in src/lib/ai-trainer/context-builder.ts with dynamic token budget (4000 tokens)
- [ ] T019 Implement estimateTokens function in src/lib/ai-trainer/context-builder.ts using cl100k_base approximation
- [ ] T020 Implement buildContext main function in src/lib/ai-trainer/context-builder.ts orchestrating all components

### Voice Profiles

- [ ] T021 Create voice profile types in src/lib/ai-trainer/voice-profiles.ts per contracts/cartesia.ts
- [ ] T022 Implement CARTESIA_VOICES mapping (5 languages × 4 persona types) in src/lib/ai-trainer/voice-profiles.ts
- [ ] T023 Implement getVoiceProfile function in src/lib/ai-trainer/voice-profiles.ts
- [ ] T024 Implement EMOTIONAL_MODULATION mapping in src/lib/ai-trainer/voice-profiles.ts

### Foundational Tests

- [ ] T025 [P] Create context builder unit tests in tests/unit/ai-trainer/context-builder.test.ts (token estimation, history trimming, prompt building)
- [ ] T026 [P] Create voice profiles unit tests in tests/unit/ai-trainer/voice-profiles.test.ts (profile lookup, emotional modulation)
- [ ] T027 [P] Create transcript integration tests in tests/integration/convex/ai-trainer/transcripts.test.ts using convex-test
- [ ] T028 [P] Create voice metrics integration tests in tests/integration/convex/ai-trainer/voice-metrics.test.ts using convex-test

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Natural Conversation Flow (Priority: P1) 🎯 MVP

**Goal**: BDRs can speak naturally and receive spoken responses in real-time

**Independent Test**: Start session → speak into mic → see real-time transcript → hear AI response within 1 second

### Tests for User Story 1

- [ ] T029 [P] [US1] Create Deepgram STT unit tests in tests/unit/ai-trainer/deepgram.test.ts (config validation, mock streaming)
- [ ] T030 [P] [US1] Create Cartesia TTS unit tests in tests/unit/ai-trainer/cartesia.test.ts (voice selection, audio chunking)
- [ ] T031 [P] [US1] Create useVoicePipeline hook tests in tests/unit/ai-trainer/use-voice-pipeline.test.ts (state transitions, event handling)

### Deepgram STT Integration (FR-001 to FR-006a)

- [ ] T032 [US1] Create Deepgram STT action types in convex/actions/voice/deepgram.ts per contracts/deepgram.ts
- [ ] T033 [US1] Implement connectDeepgram action in convex/actions/voice/deepgram.ts (EU endpoint wss://api-eu.deepgram.com/v1/listen)
- [ ] T034 [US1] Implement streamAudio action in convex/actions/voice/deepgram.ts with interim results callback
- [ ] T035 [US1] Implement VAD event handling in convex/actions/voice/deepgram.ts for turn detection
- [ ] T036 [US1] Implement disconnectDeepgram action in convex/actions/voice/deepgram.ts

### Anthropic LLM Integration (FR-007 to FR-012b)

- [ ] T037 [US1] Create Anthropic LLM action types in convex/actions/voice/anthropic.ts per contracts/anthropic.ts
- [ ] T038 [US1] Implement generateResponse action in convex/actions/voice/anthropic.ts with streaming (Claude 3.5 Haiku)
- [ ] T039 [US1] Implement parseStreamingResponse function in convex/actions/voice/anthropic.ts for JSON extraction
- [ ] T040 [US1] Add conversation history assembly using Context Builder V7 in convex/actions/voice/anthropic.ts

### Cartesia TTS Integration (FR-013 to FR-017)

- [ ] T041 [US1] Create Cartesia TTS action types in convex/actions/voice/cartesia.ts per contracts/cartesia.ts
- [ ] T042 [US1] Implement streamAudio action in convex/actions/voice/cartesia.ts with voice profile lookup
- [ ] T043 [US1] Implement cancelStream action in convex/actions/voice/cartesia.ts for barge-in support
- [ ] T044 [US1] Add language-specific voice configuration for 5 languages in convex/actions/voice/cartesia.ts

### Pipeline Orchestration

- [ ] T045 [US1] Create pipeline orchestration types in convex/actions/voice/pipeline.ts per contracts/pipeline.ts
- [ ] T046 [US1] Implement initializePipeline action in convex/actions/voice/pipeline.ts
- [ ] T047 [US1] Implement processTurn action in convex/actions/voice/pipeline.ts (STT → LLM → TTS flow)
- [ ] T048 [US1] Implement handleBargeIn action in convex/actions/voice/pipeline.ts (cancel TTS, process new input)
- [ ] T049 [US1] Add latency tracking (P50 <800ms, P95 <950ms) in convex/actions/voice/pipeline.ts

### Client-Side Hooks

- [ ] T050 [US1] Create useDeepgramSTT hook in src/hooks/ai-trainer/useDeepgramSTT.ts (WebSocket connection, interim results)
- [ ] T051 [US1] Create useCartesiaTTS hook in src/hooks/ai-trainer/useCartesiaTTS.ts (audio playback, cancellation)
- [ ] T052 [US1] Create useVoicePipeline hook in src/hooks/ai-trainer/useVoicePipeline.ts (state machine: idle→listening→processing→responding)
- [ ] T053 [US1] Add barge-in detection in useVoicePipeline (VAD during AI response → cancel TTS)

### UI Components

- [ ] T054 [US1] Create VoicePipeline.tsx component in src/components/ai-trainer/VoicePipeline.tsx (main container)
- [ ] T055 [US1] Create TranscriptDisplay.tsx component in src/components/ai-trainer/TranscriptDisplay.tsx (real-time transcript with interim results)
- [ ] T056 [US1] Add microphone access and audio controls to VoicePipeline.tsx
- [ ] T057 [US1] Add pipeline state indicators (listening, processing, responding) to VoicePipeline.tsx

### Integration Page

- [ ] T058 [US1] Create voice session page at src/app/(dashboard)/ai-trainer/session/[sessionId]/voice/page.tsx
- [ ] T059 [US1] Wire VoicePipeline component to session context (persona, scenario, product)
- [ ] T060 [US1] Add loading skeleton and error boundaries to voice session page

**Checkpoint**: User Story 1 complete - BDRs can have voice conversations with AI

---

## Phase 4: User Story 2 - Persona Authenticity (Priority: P1)

**Goal**: AI stays in character, follows persona traits, respects language lock, blocks manipulation

**Independent Test**: Attempt to make AI break character or switch language → AI maintains persona and language

### Tests for User Story 2

- [ ] T061 [P] [US2] Create guardrail pattern matching tests in tests/unit/ai-trainer/guardrails/pattern-matching.test.ts (all 5 languages)
- [ ] T062 [P] [US2] Create guardrail embedding tests in tests/unit/ai-trainer/guardrails/embedding.test.ts (similarity threshold)
- [ ] T063 [P] [US2] Create guardrail LLM judgment tests in tests/unit/ai-trainer/guardrails/llm-judgment.test.ts
- [ ] T064 [P] [US2] Create guardrail integration tests in tests/integration/convex/ai-trainer/guardrails.test.ts using convex-test

### Layer 1: Pattern Matching (<1ms)

- [ ] T065 [US2] Create pattern matching types in src/lib/ai-trainer/guardrails/pattern-matching.ts per contracts/guardrails.ts
- [ ] T066 [US2] Implement PATTERN_CATEGORIES with regex patterns for all 5 languages in src/lib/ai-trainer/guardrails/pattern-matching.ts
- [ ] T067 [US2] Implement checkPatterns function (client-side, <1ms) in src/lib/ai-trainer/guardrails/pattern-matching.ts
- [ ] T068 [US2] Add language switch detection patterns for fr→en, en→fr, etc. in src/lib/ai-trainer/guardrails/pattern-matching.ts

### Layer 2: Embedding Similarity (<10ms)

- [ ] T069 [US2] Create embedding service types in src/lib/ai-trainer/guardrails/embedding.ts per contracts/guardrails.ts
- [ ] T070 [US2] Implement computeEmbedding action in convex/actions/voice/guardrails.ts (text-embedding-3-small)
- [ ] T071 [US2] Implement cosineSimilarity function in src/lib/ai-trainer/guardrails/embedding.ts
- [ ] T072 [US2] Implement checkEmbeddingSimilarity function in convex/actions/voice/guardrails.ts (threshold 0.85)

### Layer 3: LLM Judgment (<50ms)

- [ ] T073 [US2] Create LLM judgment types in src/lib/ai-trainer/guardrails/llm-judgment.ts per contracts/guardrails.ts
- [ ] T074 [US2] Implement GUARDRAIL_LLM_PROMPT template in src/lib/ai-trainer/guardrails/llm-judgment.ts
- [ ] T075 [US2] Implement checkLLMJudgment action in convex/actions/voice/guardrails.ts (Claude Haiku, temp 0)

### Guardrail Pipeline Integration

- [ ] T076 [US2] Implement checkInput orchestration function in convex/actions/voice/guardrails.ts (cascading layers)
- [ ] T077 [US2] Implement logViolation mutation in convex/aiTrainer/guardrails.ts
- [ ] T078 [US2] Implement promoteToCorpus mutation in convex/aiTrainer/guardrails.ts (admin review workflow)
- [ ] T079 [US2] Add guardrail check to pipeline processTurn action before LLM call in convex/actions/voice/pipeline.ts

### System Prompt Enhancement

- [ ] T080 [US2] Add LANGUAGE_LOCK_TEMPLATE to context builder in src/lib/ai-trainer/context-builder.ts
- [ ] T081 [US2] Add persona consistency rules to system prompt template in src/lib/ai-trainer/context-builder.ts
- [ ] T082 [US2] Add character break prevention instructions to system prompt in src/lib/ai-trainer/context-builder.ts

### UI Feedback

- [ ] T083 [US2] Add guardrail blocked state to TranscriptDisplay.tsx (show "Please rephrase" prompt)
- [ ] T084 [US2] Add guardrail latency indicator (hidden in prod) for debugging in VoicePipeline.tsx

**Checkpoint**: User Story 2 complete - AI maintains character and blocks manipulation

---

## Phase 5: User Story 3 - Emotional Responsiveness (Priority: P2)

**Goal**: AI voice tone changes based on M3 emotional state, BDRs can influence mood through technique quality

**Independent Test**: Use good techniques → hear warmer voice | Use poor techniques → hear colder voice

### Tests for User Story 3

- [ ] T085 [P] [US3] Create emotional state tests in tests/unit/ai-trainer/emotional-state.test.ts (transitions, modulation)
- [ ] T086 [P] [US3] Create TTS emotional modulation tests in tests/unit/ai-trainer/tts-modulation.test.ts (speed, pitch changes)

### Emotional State Management

- [ ] T087 [US3] Create useEmotionalState hook in src/hooks/ai-trainer/useEmotionalState.ts
- [ ] T088 [US3] Implement emotional state tracking (skeptical → neutral → interested → impressed | defensive → frustrated)
- [ ] T089 [US3] Add emotional state to transcript records in convex/aiTrainer/transcripts.ts (emotionalStateBefore, emotionalStateAfter)
- [ ] T090 [US3] Implement updateTranscriptEmotionalState mutation in convex/aiTrainer/transcripts.ts

### Emotional Transition Rules

- [ ] T091 [US3] Add EMOTIONAL_TRANSITION_RULES to system prompt in src/lib/ai-trainer/context-builder.ts
- [ ] T092 [US3] Add EMOTIONAL_STATE_DESCRIPTIONS to context builder in src/lib/ai-trainer/context-builder.ts
- [ ] T093 [US3] Implement max 1 step emotional transition validation in parseStreamingResponse in convex/actions/voice/anthropic.ts

### Voice Modulation

- [ ] T094 [US3] Implement applyEmotionalModulation function in src/lib/ai-trainer/voice-profiles.ts (speed, pitch, emotion params)
- [ ] T095 [US3] Update streamAudio action to apply emotional modulation in convex/actions/voice/cartesia.ts
- [ ] T096 [US3] Add emotional state to TTS request in pipeline processTurn action in convex/actions/voice/pipeline.ts

### UI Visualization

- [ ] T097 [US3] Create EmotionalIndicator.tsx component in src/components/ai-trainer/EmotionalIndicator.tsx (visual state display)
- [ ] T098 [US3] Add emotional state transitions animation to EmotionalIndicator.tsx
- [ ] T099 [US3] Integrate EmotionalIndicator into VoicePipeline.tsx

**Checkpoint**: User Story 3 complete - AI voice reflects emotional state changes

---

## Phase 6: User Story 4 - Graceful Degradation (Priority: P2)

**Goal**: Session continues despite component failures, with appropriate fallbacks

**Independent Test**: Simulate TTS failure → text fallback shown | Simulate STT failure → retry prompt shown

### Tests for User Story 4

- [ ] T100 [P] [US4] Create degradation tests in tests/unit/ai-trainer/degradation.test.ts (fallback scenarios)
- [ ] T101 [P] [US4] Create recovery tests in tests/integration/convex/ai-trainer/recovery.test.ts (transient failure handling)

### Fallback Implementations

- [ ] T102 [US4] Add TTS failure fallback (text display) to VoicePipeline.tsx per contracts/pipeline.ts DEGRADATION_CONFIG
- [ ] T103 [US4] Add STT failure fallback (retry prompt) to VoicePipeline.tsx
- [ ] T104 [US4] Add avatar failure fallback (audio-only mode) to VoicePipeline.tsx
- [ ] T105 [US4] Implement retry logic in useVoicePipeline hook with configurable attempts

### Error Recovery

- [ ] T106 [US4] Add component health tracking to pipeline state in convex/actions/voice/pipeline.ts
- [ ] T107 [US4] Implement recoverFromError function in convex/actions/voice/pipeline.ts
- [ ] T108 [US4] Add failure counters to voiceMetrics (sttFailures, ttsFailures, avatarFailures) in convex/aiTrainer/voiceMetrics.ts
- [ ] T109 [US4] Implement recoveredFromFailure tracking in voiceMetrics

### Cost Budget Management

- [ ] T110 [US4] Implement real-time cost tracking in pipeline actions per contracts/pipeline.ts COST_THRESHOLDS
- [ ] T111 [US4] Add 80% budget alert event emission in convex/actions/voice/pipeline.ts
- [ ] T112 [US4] Add 150% budget hard stop in convex/actions/voice/pipeline.ts
- [ ] T113 [US4] Display cost alert in VoicePipeline.tsx when budget threshold reached

### UI Error States

- [ ] T114 [US4] Add error state indicators to VoicePipeline.tsx (component-specific icons)
- [ ] T115 [US4] Add retry button for STT failures in TranscriptDisplay.tsx
- [ ] T116 [US4] Add text-only mode indicator when TTS degraded in VoicePipeline.tsx

**Checkpoint**: User Story 4 complete - Sessions survive component failures

---

## Phase 7: Optional Avatar Integration

**Purpose**: Lip-sync avatar rendering (Simli/D-ID) - optional enhancement

- [ ] T117 [P] Create Simli avatar action in convex/actions/voice/simli.ts
- [ ] T118 [P] Create D-ID fallback action in convex/actions/voice/did.ts
- [ ] T119 Create AvatarRenderer.tsx component in src/components/ai-trainer/AvatarRenderer.tsx
- [ ] T120 Implement avatar freeze detection (3 second timeout) in AvatarRenderer.tsx
- [ ] T121 Wire avatar to emotional state for facial expressions in AvatarRenderer.tsx
- [ ] T122 Add avatar toggle to VoicePipeline.tsx
- [ ] T123 [P] Create avatar integration tests in tests/integration/ai-trainer/avatar.test.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Performance optimization, E2E tests, documentation

### E2E Tests

- [ ] T124 [P] Create voice conversation E2E test in tests/e2e/ai-trainer/voice-session.spec.ts (full flow)
- [ ] T125 [P] Create barge-in E2E test in tests/e2e/ai-trainer/barge-in.spec.ts
- [ ] T126 [P] Create guardrail E2E test in tests/e2e/ai-trainer/guardrail-blocking.spec.ts
- [ ] T127 [P] Create degradation E2E test in tests/e2e/ai-trainer/degradation.spec.ts

### Performance Optimization

- [ ] T128 Implement latency monitoring dashboard query in convex/aiTrainer/voiceMetrics.ts
- [ ] T129 Add P50/P95 latency calculation to session metrics in convex/aiTrainer/voiceMetrics.ts
- [ ] T130 Optimize context builder token estimation for <1ms execution in src/lib/ai-trainer/context-builder.ts
- [ ] T131 Add WebSocket connection pooling to Deepgram action in convex/actions/voice/deepgram.ts

### Security Hardening

- [ ] T132 Add rate limiting to guardrail corpus promotion in convex/aiTrainer/guardrails.ts
- [ ] T133 Validate all external API responses in voice actions
- [ ] T134 Add audit logging for all guardrail violations in convex/aiTrainer/guardrails.ts

### Documentation & Cleanup

- [ ] T135 Update quickstart.md with actual implementation details
- [ ] T136 Add JSDoc comments to all exported functions in voice pipeline
- [ ] T137 Run full test suite and verify 80%+ coverage
- [ ] T138 Run quickstart.md validation (manual verification of getting started guide)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - core voice flow
- **User Story 2 (Phase 4)**: Depends on Foundational - can parallel with US1
- **User Story 3 (Phase 5)**: Depends on US1 completion (needs voice pipeline)
- **User Story 4 (Phase 6)**: Depends on US1 completion (needs voice pipeline)
- **Avatar (Phase 7)**: Optional, depends on US1 completion
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

```
                    ┌─────────────────┐
                    │  Setup (P1)     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Foundational(P2)│
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
   ┌────────▼────────┐  ┌────▼────┐          │
   │ US1: Voice Flow │  │US2:Guard│          │
   │     (P1)        │  │ rails   │          │
   └────────┬────────┘  └─────────┘          │
            │                                 │
   ┌────────┴────────┐                       │
   │                 │                       │
┌──▼───┐  ┌──────────▼──────────┐           │
│ US3: │  │ US4: Degradation    │           │
│Emot. │  │      (P2)           │           │
└──────┘  └─────────────────────┘           │
                                            │
                    ┌───────────────────────▼┐
                    │ Avatar (Optional)      │
                    └────────────────────────┘
```

### Parallel Opportunities

**Within Phase 2 (Foundational)**:
```
T011-T015: All CRUD operations can run in parallel
T025-T028: All foundational tests can run in parallel
```

**Within Phase 3 (US1)**:
```
T029-T031: All US1 tests can run in parallel
T032-T036: Deepgram STT (sequential within, but parallel with...)
T041-T044: Cartesia TTS
```

**Within Phase 4 (US2)**:
```
T061-T064: All US2 tests can run in parallel
T065-T068: Layer 1 pattern matching
T069-T072: Layer 2 embedding (parallel after T070)
T073-T075: Layer 3 LLM judgment
```

**Within Phase 5 (US3)**:
```
T085-T086: All US3 tests can run in parallel
```

**Within Phase 6 (US4)**:
```
T100-T101: All US4 tests can run in parallel
```

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T029: "Create Deepgram STT unit tests in tests/unit/ai-trainer/deepgram.test.ts"
Task T030: "Create Cartesia TTS unit tests in tests/unit/ai-trainer/cartesia.test.ts"
Task T031: "Create useVoicePipeline hook tests in tests/unit/ai-trainer/use-voice-pipeline.test.ts"

# Launch STT and TTS implementations in parallel (different services):
Task T032-T036: Deepgram STT (one agent)
Task T041-T044: Cartesia TTS (another agent)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T028)
3. Complete Phase 3: User Story 1 (T029-T060)
4. **STOP and VALIDATE**: Test voice conversation flow independently
5. Deploy/demo if ready - BDRs can have voice conversations!

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP: voice conversation)
3. Add User Story 2 → Test independently → Deploy (+ guardrails)
4. Add User Story 3 → Test independently → Deploy (+ emotional voice)
5. Add User Story 4 → Test independently → Deploy (+ resilience)
6. Add Avatar (optional) → Deploy (+ visual)

### Estimated Cost per Session

| Component | Estimated Cost |
|-----------|----------------|
| STT (Deepgram) | ~$0.065-0.086 |
| LLM (Claude Haiku) | ~$0.048-0.072 |
| TTS (Cartesia) | ~$0.04-0.12 |
| **Total** | **~$0.15-0.28** |

Target: <$0.50/session ✅

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All external APIs use EU endpoints (GDPR compliance)
- Latency target: <800ms P50, <950ms P95 end-to-end
