# Implementation Plan: Real-Time Voice Pipeline

**Branch**: `005-voice-pipeline` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-voice-pipeline/spec.md`
**Depends On**: Spec 004 (Core Session Infrastructure)

## Summary

Build the real-time voice pipeline for the AI Sales Trainer that enables natural conversation between BDRs and AI prospects. The pipeline includes:

- **STT**: Deepgram Nova-2 (EU endpoint) for speech recognition with streaming interim results
- **LLM**: Claude 3.5 Haiku for persona-driven conversation with M3 emotional state tracking
- **TTS**: Cartesia for emotionally-modulated voice synthesis across 5 languages
- **Avatar** (Optional): Simli for lip-sync with D-ID fallback
- **Guardrails**: 4-layer protection (pattern matching, embedding similarity, LLM judgment, monitoring)
- **Target Latency**: <800ms P50, <950ms P95 end-to-end

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**:
- Next.js 15.x (App Router)
- React 19.x
- Convex (real-time serverless database)
- LiveKit (WebRTC infrastructure, EU Frankfurt)
- Deepgram SDK (STT)
- Anthropic SDK (Claude Haiku)
- Cartesia SDK (TTS)
- Simli/D-ID SDK (Avatar - optional)

**Storage**: Convex (EU region) - transcripts, guardrail logs, voice metrics
**Testing**: Vitest (unit), convex-test (integration), Playwright (E2E)
**Target Platform**: Web (Next.js on Vercel)
**Project Type**: Web application (existing brownfield LMS)
**Performance Goals**:
- End-to-end latency <800ms P50, <950ms P95
- STT interim results within 200ms
- LLM first token within 300ms
- TTS first chunk within 200ms

**Constraints**:
- All processing in EU (GDPR)
- <$0.50 per session average for voice services
- No raw audio persistence (transcripts only, 2 years retention)

**Scale/Scope**:
- 500 BDRs across 10 countries
- 5 languages (fr, en, it, de, es)
- Concurrent sessions limited by Spec 004 (10 per org)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| I: Code Quality | strict TypeScript, no any | PASS | All contracts typed |
| II: Testing | 80% coverage, convex-test | PASS | Test strategy defined |
| III: UX | Loading states, error handling | PASS | Graceful degradation spec'd |
| IV: Accessibility | WCAG 2.1 AA | PASS | Transcript display accessible |
| V: Security | requireAuth, Zod validation | PASS | Guardrails defined |
| VI: Performance | <2.5s LCP, bundle <150KB | PASS | Pipeline is streaming, no bundle impact |
| XI: Convex Patterns | withIndex, returns validator | PASS | Schema follows patterns |
| XIV: AI Services | EU endpoints, cost control | PASS | EU endpoints mandatory, <$0.50/session |

## Project Structure

### Documentation (this feature)

```text
specs/005-voice-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── deepgram.ts      # STT service contract
│   ├── anthropic.ts     # LLM service contract
│   ├── cartesia.ts      # TTS service contract
│   ├── guardrails.ts    # Guardrail pipeline contract
│   ├── context-builder.ts # Context assembly contract
│   └── pipeline.ts      # Voice pipeline orchestration
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
convex/
├── schema.ts            # Add: sessionTranscripts, guardrailViolations,
│                        #      guardrailViolationCorpus, voiceMetrics
├── aiTrainer/
│   ├── transcripts.ts   # Transcript CRUD operations
│   ├── guardrails.ts    # Guardrail logging & corpus management
│   └── voiceMetrics.ts  # Cost/latency tracking per session
└── actions/
    └── voice/
        ├── deepgram.ts      # STT action (streaming)
        ├── anthropic.ts     # LLM action (streaming)
        ├── cartesia.ts      # TTS action (streaming)
        ├── simli.ts         # Avatar action (optional)
        └── pipeline.ts      # Orchestration action

src/
├── app/(dashboard)/
│   └── ai-trainer/
│       └── session/
│           └── [sessionId]/
│               └── voice/     # Voice UI components
├── components/
│   └── ai-trainer/
│       ├── VoicePipeline.tsx       # Main pipeline component
│       ├── TranscriptDisplay.tsx   # Real-time transcript
│       ├── EmotionalIndicator.tsx  # M3 state display
│       └── AvatarRenderer.tsx      # Simli/D-ID avatar
├── hooks/
│   └── ai-trainer/
│       ├── useVoicePipeline.ts     # Pipeline orchestration hook
│       ├── useDeepgramSTT.ts       # STT streaming hook
│       ├── useCartesiaTTS.ts       # TTS streaming hook
│       └── useEmotionalState.ts    # M3 state management
└── lib/
    └── ai-trainer/
        ├── context-builder.ts      # Context Builder V7
        ├── guardrails/
        │   ├── pattern-matching.ts # Layer 1
        │   ├── embedding.ts        # Layer 2
        │   └── llm-judgment.ts     # Layer 3
        └── voice-profiles.ts       # Persona-voice mapping

tests/
├── unit/
│   └── ai-trainer/
│       ├── context-builder.test.ts
│       ├── guardrails.test.ts
│       └── voice-profiles.test.ts
├── integration/
│   └── convex/
│       └── ai-trainer/
│           ├── transcripts.test.ts
│           ├── guardrails.test.ts
│           └── voice-metrics.test.ts
└── e2e/
    └── ai-trainer/
        └── voice-session.spec.ts
```

**Structure Decision**: Follows existing LMS folder conventions. Voice pipeline code lives under `convex/actions/voice/` for external API calls (Convex actions required), with frontend hooks under `src/hooks/ai-trainer/`. Guardrail logic split across client-side (pattern matching) and server-side (embedding, LLM judgment) for latency optimization.

## Complexity Tracking

No constitution violations requiring justification. Design follows all established patterns.

---

## Phase 0: Research Summary

### R1: LiveKit Agent Integration Pattern

**Decision**: Use LiveKit Agents SDK for voice pipeline orchestration
**Rationale**: LiveKit Agents provide:
- Built-in STT/TTS plugin architecture
- Automatic voice activity detection (VAD)
- Barge-in support out of the box
- Room-level event handling
**Alternatives Rejected**:
- Custom WebSocket implementation → Too complex, reinventing wheel
- Direct browser MediaRecorder → No streaming, high latency

### R2: Deepgram Streaming Pattern

**Decision**: Use Deepgram WebSocket streaming with interim results
**Rationale**:
- Nova-2 model provides best accuracy for multi-language
- EU endpoint (api-eu.deepgram.com) mandatory for GDPR
- Interim results enable real-time transcript display
**Configuration**: Language-specific VAD settings, punctuation enabled, smart formatting

### R3: Claude Haiku Streaming Pattern

**Decision**: Use Anthropic streaming API with structured JSON output
**Rationale**:
- Haiku provides best cost/latency ratio for real-time conversation
- Structured output (response + emotional_state) parseable mid-stream
- Token-by-token streaming enables TTS to start before full response
**Configuration**: Temperature 0.3, max_tokens 500, streaming enabled

### R4: Cartesia Voice Selection

**Decision**: Pre-mapped voice profiles per persona × language × gender × age
**Rationale**:
- Cartesia provides native voices for all 5 languages
- Emotional modulation via speed/pitch/emotion parameters
- Streaming audio chunks enable <200ms first audio
**Configuration**: See CARTESIA_VOICES and EMOTIONAL_VOICE_STYLES in spec context

### R5: Guardrail Architecture

**Decision**: 3-layer cascading guardrails with monitoring
**Rationale**:
- Layer 1 (Pattern): Client-side, <1ms, blocks obvious attacks
- Layer 2 (Embedding): Server-side, <10ms, catches variations
- Layer 3 (LLM): Server-side, <50ms, catches subtle manipulation
- Total budget: <60ms added latency
**Corpus**: Start with ~100 curated patterns, grow via promotion

### R6: Barge-In Implementation

**Decision**: LiveKit audio track interruption with TTS cancellation
**Rationale**:
- LiveKit provides track-level control
- When user audio detected during AI response:
  1. Cancel TTS stream immediately
  2. Stop audio playback
  3. Process user's new turn
**Implementation**: VAD on user track triggers interrupt callback

### R7: M3 Emotional State Management

**Decision**: LLM self-assessment with structured output
**Rationale**:
- No separate scoring model needed (reduces latency & cost)
- Emotional state output with each response
- System prompt includes transition rules
**States**: skeptical, neutral, interested, impressed, defensive, frustrated

---

## Phase 1: Design Artifacts

Design artifacts generated:
- [data-model.md](./data-model.md) - Database schema additions
- [contracts/](./contracts/) - Service interface contracts
- [quickstart.md](./quickstart.md) - Getting started guide

### Key Design Decisions

1. **Schema Additions**: 4 new tables for voice pipeline
   - `sessionTranscripts` - Conversation turns
   - `guardrailViolations` - Blocked attempts log
   - `guardrailViolationCorpus` - Pattern library
   - `voiceMetrics` - Cost/latency tracking

2. **Pipeline Architecture**: LiveKit Agent orchestrates flow
   - Audio → Deepgram (STT) → Guardrails → Claude (LLM) → Cartesia (TTS) → Audio
   - Streaming throughout for <800ms latency

3. **Context Builder V7**: Dynamic token budget
   - System prompt: ~1500 tokens (persona, product, scenario)
   - History: ~4000 tokens (most recent turns that fit)
   - Current turn + output format: ~500 tokens

4. **Graceful Degradation**: Fallback chain
   - Avatar fails → Audio only
   - TTS fails → Text display
   - STT fails → Retry prompt
   - Session continues through single-component failures

---

## Post-Design Constitution Re-Check

| Article | Pre-Design | Post-Design | Change |
|---------|------------|-------------|--------|
| I: Code Quality | PASS | PASS | Contracts typed |
| II: Testing | PASS | PASS | Test files specified |
| V: Security | PASS | PASS | Guardrails detailed |
| VI: Performance | PASS | PASS | Latency budgets met |
| XIV: AI Services | PASS | PASS | EU endpoints confirmed |

**All gates pass. Ready for Phase 2 task generation.**

---

## Next Steps

Run `/speckit.tasks` to generate implementation tasks from this plan.
