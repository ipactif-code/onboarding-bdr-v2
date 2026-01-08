# Quickstart: Real-Time Voice Pipeline

**Feature**: 005-voice-pipeline
**Status**: Ready for Implementation

## Prerequisites

Before starting implementation:

1. **Spec 004 Complete**: Core session infrastructure must be deployed
   - `trainingSessions` table exists
   - `aiTrainerPersonas` table populated
   - `aiTrainerScenarios` table populated
   - LiveKit integration operational

2. **API Keys Provisioned**:
   - Deepgram API key (EU endpoint access)
   - Anthropic API key (Claude 3.5 Haiku)
   - Cartesia API key
   - Simli API key (optional)
   - D-ID API key (optional fallback)

3. **Environment Variables**:
   ```bash
   DEEPGRAM_API_KEY=...
   ANTHROPIC_API_KEY=...
   CARTESIA_API_KEY=...
   SIMLI_API_KEY=...        # Optional
   DID_API_KEY=...          # Optional fallback
   ```

## Implementation Order

### Phase 1: Schema & Backend (Week 1)

1. **Schema Addition** (`convex/schema.ts`)
   - Add `sessionTranscripts` table
   - Add `guardrailViolations` table
   - Add `guardrailViolationCorpus` table
   - Add `voiceMetrics` table
   - Run `npx convex dev` to deploy schema

2. **Guardrail Corpus Seed** (`convex/aiTrainer/guardrails.ts`)
   - Create seed data mutation
   - Load 100+ curated patterns
   - Generate embeddings via OpenAI

3. **Transcript CRUD** (`convex/aiTrainer/transcripts.ts`)
   - `createTranscript` mutation
   - `getSessionTranscripts` query
   - `updateTranscriptMetrics` mutation

4. **Voice Metrics** (`convex/aiTrainer/voiceMetrics.ts`)
   - `createVoiceMetrics` mutation
   - `updateVoiceMetrics` mutation
   - `getVoiceMetrics` query

### Phase 2: External Service Actions (Week 2)

5. **Deepgram STT Action** (`convex/actions/voice/deepgram.ts`)
   - WebSocket connection to EU endpoint
   - Streaming interim results
   - VAD event handling
   - Language configuration

6. **Anthropic LLM Action** (`convex/actions/voice/anthropic.ts`)
   - Streaming response generation
   - Context Builder V7 integration
   - JSON parsing for emotional state

7. **Cartesia TTS Action** (`convex/actions/voice/cartesia.ts`)
   - Voice profile selection
   - Emotional modulation
   - Streaming audio output

8. **Pipeline Orchestration** (`convex/actions/voice/pipeline.ts`)
   - Coordinate STT → Guardrails → LLM → TTS
   - Cost tracking
   - Graceful degradation

### Phase 3: Client-Side Integration (Week 3)

9. **React Hooks** (`src/hooks/ai-trainer/`)
   - `useVoicePipeline.ts` - Main orchestration
   - `useDeepgramSTT.ts` - STT streaming
   - `useCartesiaTTS.ts` - TTS playback
   - `useEmotionalState.ts` - M3 state management

10. **UI Components** (`src/components/ai-trainer/`)
    - `VoicePipeline.tsx` - Main container
    - `TranscriptDisplay.tsx` - Real-time transcript
    - `EmotionalIndicator.tsx` - M3 state visualization

11. **Guardrails Client** (`src/lib/ai-trainer/guardrails/`)
    - `pattern-matching.ts` - Layer 1 (client-side, <1ms)
    - Integration with server-side layers 2-3

### Phase 4: Testing & Polish (Week 4)

12. **Unit Tests** (`tests/unit/ai-trainer/`)
    - Context builder tests
    - Guardrail pattern tests
    - Voice profile tests

13. **Integration Tests** (`tests/integration/convex/ai-trainer/`)
    - Transcript CRUD tests
    - Guardrail logging tests
    - Voice metrics tests

14. **E2E Tests** (`tests/e2e/ai-trainer/`)
    - Full conversation flow
    - Barge-in handling
    - Graceful degradation

## Key Files Reference

| File | Purpose | Priority |
|------|---------|----------|
| `convex/schema.ts` | Add 4 new tables | P0 |
| `convex/aiTrainer/transcripts.ts` | Transcript CRUD | P0 |
| `convex/aiTrainer/guardrails.ts` | Guardrail logging & corpus | P0 |
| `convex/aiTrainer/voiceMetrics.ts` | Cost/latency tracking | P0 |
| `convex/actions/voice/deepgram.ts` | STT streaming | P0 |
| `convex/actions/voice/anthropic.ts` | LLM conversation | P0 |
| `convex/actions/voice/cartesia.ts` | TTS streaming | P0 |
| `convex/actions/voice/pipeline.ts` | Orchestration | P0 |
| `src/hooks/ai-trainer/useVoicePipeline.ts` | Client orchestration | P0 |
| `src/lib/ai-trainer/context-builder.ts` | Context Builder V7 | P0 |
| `src/lib/ai-trainer/guardrails/pattern-matching.ts` | Layer 1 guardrails | P0 |

## Quality Gates

Before merging, verify:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (80%+ coverage)
- [ ] End-to-end latency <800ms P50
- [ ] Guardrails block 99%+ of test attacks
- [ ] Cost per session <$0.50 average
- [ ] All EU data residency requirements met

## Testing Commands

```bash
# Run all tests
pnpm test

# Run voice pipeline tests only
pnpm test -- --grep "voice"

# Run E2E tests
pnpm test:e2e -- tests/e2e/ai-trainer/

# Check latency metrics
# (via Convex dashboard or custom tooling)
```

## Monitoring & Debugging

1. **Convex Dashboard**: View real-time logs, function metrics
2. **Deepgram Console**: STT usage, latency metrics
3. **Anthropic Console**: Token usage, cost tracking
4. **Application Logs**: Pipeline events, errors, degradation

## Common Issues

| Issue | Solution |
|-------|----------|
| STT connection fails | Check Deepgram EU endpoint, API key |
| High latency | Check network, reduce context size |
| Guardrails too aggressive | Adjust embedding threshold |
| TTS voice mismatch | Verify voice ID mapping |
| Cost exceeded | Check token usage, audio duration |

## Next Steps After Voice Pipeline

- **Spec 006**: Avatar Rendering (Simli/D-ID integration)
- **Spec 007**: Coaching Whispers (real-time feedback)
- **Spec 008**: Praiz Pattern Integration
- **Spec 009**: Scoring & Evaluation
