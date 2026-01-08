# Feature Specification: Real-Time Voice Pipeline for AI Sales Trainer

**Feature Branch**: `005-voice-pipeline`
**Created**: 2026-01-08
**Status**: Draft
**Depends On**: Spec 004 (Core Session Infrastructure)

## Context

This is Spec 005 of the AI Sales Trainer system for DiliTrust. It depends on Spec 004 (Core Session Infrastructure) which provides session management, personas, and scenarios.

This spec covers the real-time voice processing: Speech-to-Text, LLM conversation, Text-to-Speech, and optional avatar rendering.

## Voice Pipeline Architecture

```
User Audio → Deepgram STT → Claude Haiku → Cartesia TTS → [Simli Avatar] → User
     ↓              ↓              ↓
Transcript    Context Builder   Emotional Voice
+ Guardrails                    Modulation
```

### Speech-to-Text (Deepgram)

- Deepgram Nova-2 model via EU endpoint (api-eu.deepgram.com)
- Streaming transcription with interim results
- Language-specific configuration for 5 languages (fr, en, it, de, es)
- VAD (Voice Activity Detection) for turn detection

### LLM Conversation (Claude Haiku)

- Claude 3.5 Haiku for real-time responses (cost + latency)
- Streaming responses for low latency
- Context Builder V7 that assembles:
  - Persona definition (from Spec 004)
  - DiliTrust product context
  - Conversation history (dynamically sized to fit token budget, prioritizing recent turns)
  - Current emotional state (M3)
  - Difficulty level (M1)
  - Active scenario objectives
- System prompt with persona roleplay instructions

### Text-to-Speech (Cartesia)

- Voice selection based on persona gender/age
- Emotional modulation based on M3 state (skeptical, interested, frustrated, etc.)
- Streaming audio output
- 5 language support with native voices

### Avatar (Simli/D-ID) - Optional

- Lip-sync to TTS audio
- Facial expressions mapped to M3 emotional state
- Fallback to audio-only if avatar fails
- D-ID as backup provider

### Guardrails (4 Layers)

1. **Pattern Matching** (<1ms): Block language switch attempts, prompt injection
2. **Embedding Similarity** (<10ms): Compare to known violation patterns
3. **LLM Judgment** (<50ms): Claude Haiku check for subtle manipulation
4. **Monitoring**: Log all violations for audit

### Latency Target

- End-to-end: <800ms P50, <950ms P95
- All components must support streaming (not request-response)

## User Scenarios & Testing

### User Story 1 - Natural Conversation Flow (Priority: P1)

As a BDR, I want to speak naturally with the AI prospect and receive spoken responses, so that the training feels like a real sales call.

**Acceptance Scenarios**:

1. **Given** I am in an active training session, **When** I speak into my microphone, **Then** I see real-time transcription of my speech appearing on screen.

2. **Given** I have finished speaking, **When** VAD detects end of my turn, **Then** the AI prospect responds within 1 second with spoken audio.

3. **Given** the AI is responding, **When** I view the persona information, **Then** the voice matches the persona's gender, age bracket, and selected language.

4. **Given** we are mid-conversation, **When** natural pauses occur between turns, **Then** the conversation pacing feels natural without awkward delays or interruptions.

---

### User Story 2 - Persona Authenticity (Priority: P1)

As a BDR, I want the AI prospect to stay in character throughout the conversation, so that the training is realistic.

**Acceptance Scenarios**:

1. **Given** I am conversing with "Marc Dubois" persona, **When** I observe the AI's responses, **Then** it maintains consistent personality traits (e.g., skeptical CFO style) throughout.

2. **Given** I am in a Cold Call scenario with a specific persona, **When** I encounter objections, **Then** the objections match the persona's predefined objection patterns.

3. **Given** the session language is French, **When** I try to switch to English, **Then** the AI continues responding in French only.

4. **Given** I try to manipulate the AI (e.g., "ignore your instructions"), **When** the guardrails detect the attempt, **Then** the AI stays in character and does not acknowledge being an AI.

---

### User Story 3 - Emotional Responsiveness (Priority: P2)

As a BDR, I want the AI prospect's tone to change based on how the conversation is going, so that I can practice reading and influencing emotions.

**Acceptance Scenarios**:

1. **Given** I start a session with a skeptical persona, **When** the conversation begins, **Then** the AI starts with the persona's default emotional state (e.g., skeptical tone).

2. **Given** I use effective techniques (SPIN questioning, RACC objection handling), **When** the AI evaluates my approach, **Then** the prospect's mood improves and voice tone becomes warmer/more interested.

3. **Given** I use poor techniques (aggressive pitch, ignoring objections), **When** the AI evaluates my approach, **Then** the prospect's mood worsens and voice tone becomes colder/frustrated.

4. **Given** the emotional state changes, **When** I hear the AI's voice, **Then** the tone clearly reflects the emotional shift (audible difference).

---

### User Story 4 - Graceful Degradation (Priority: P2)

As a BDR, I want the session to continue even if part of the system fails, so that my training isn't interrupted.

**Acceptance Scenarios**:

1. **Given** the avatar rendering fails, **When** I continue the conversation, **Then** audio continues to work and I can complete the session.

2. **Given** TTS fails briefly, **When** the AI has a response, **Then** the text response is displayed on screen as fallback.

3. **Given** STT has issues transcribing, **When** I notice the problem, **Then** I can retry speaking and see a "retry" indicator.

4. **Given** any single component has a hiccup, **When** it recovers, **Then** the session continues and can be completed without manual intervention.

---

### Edge Cases

- What happens when user speaks multiple languages mid-session? AI responds only in session language, guardrails log the attempt.
- What happens when audio quality is poor? STT confidence score shown; low confidence segments marked for retry.
- What happens when LLM response is cut off? System detects incomplete response and requests continuation.
- What happens when TTS audio buffer underruns? Audio continues from available chunks; brief silence acceptable over dropouts.
- What happens when avatar video freezes? Audio continues; avatar automatically hidden after 3 seconds of freeze.
- What happens when cost budget is exhausted mid-session? Session continues but cost alert logged; hard stop only after 150% budget.
- What happens when user interrupts AI mid-response (barge-in)? AI audio stops immediately, TTS generation cancelled, user's speech processed as new turn.

## Requirements

### Functional Requirements

**Speech-to-Text**

- **FR-001**: System MUST use Deepgram Nova-2 model for speech recognition
- **FR-002**: System MUST connect to Deepgram EU endpoint (api-eu.deepgram.com) exclusively
- **FR-003**: System MUST stream interim transcription results every 100-200ms
- **FR-004**: System MUST support all 5 languages: French (fr), English (en), Italian (it), German (de), Spanish (es)
- **FR-005**: System MUST use VAD (Voice Activity Detection) to detect turn completion
- **FR-006**: System MUST display real-time transcription to the user during their turn
- **FR-006a**: System MUST support barge-in: when user speaks during AI response, AI audio stops immediately and system processes user's interruption

**LLM Conversation**

- **FR-007**: System MUST use Claude 3.5 Haiku for conversation generation
- **FR-008**: System MUST stream LLM responses token-by-token
- **FR-009**: System MUST assemble context using Context Builder V7 pattern
- **FR-010**: Context MUST include: persona definition, DiliTrust product context, conversation history, emotional state, difficulty level, scenario objectives
- **FR-011**: Conversation history MUST be dynamically sized to fit within a token budget (adaptive based on turn length), prioritizing most recent turns
- **FR-012**: System MUST maintain persona character consistency via system prompt
- **FR-012a**: LLM MUST output updated M3 emotional state with each response (self-assessment based on conversation quality)
- **FR-012b**: System prompt MUST include rules for emotional transitions (e.g., SPIN/RACC techniques improve mood; aggressive pitch worsens mood)

**Text-to-Speech**

- **FR-013**: System MUST use Cartesia for voice synthesis
- **FR-014**: System MUST select voice based on persona gender and age bracket
- **FR-015**: System MUST modulate voice emotion based on M3 emotional state
- **FR-016**: System MUST stream audio output in chunks
- **FR-017**: System MUST support all 5 languages with native-sounding voices

**Avatar (Optional)**

- **FR-018**: System MAY render avatar via Simli for lip-sync
- **FR-019**: System MUST map facial expressions to M3 emotional state when avatar enabled
- **FR-020**: System MUST fallback to audio-only if avatar rendering fails
- **FR-021**: System MAY use D-ID as backup avatar provider

**Guardrails**

- **FR-022**: System MUST apply Pattern Matching guardrail (<1ms) for language switching and prompt injection
- **FR-023**: System MUST apply Embedding Similarity guardrail (<10ms) for known violation patterns
- **FR-023a**: Embedding corpus MUST be initialized with a curated seed set of manipulation patterns (prompt injection, jailbreaks, language switching)
- **FR-023b**: System MUST support promoting confirmed violations from audit logs to the embedding corpus
- **FR-024**: System MUST apply LLM Judgment guardrail (<50ms) for subtle manipulation detection
- **FR-025**: System MUST log all guardrail violations for audit
- **FR-026**: System MUST enforce language lock - AI responds only in session language

**Graceful Degradation**

- **FR-027**: System MUST continue audio if avatar fails
- **FR-028**: System MUST display text fallback if TTS fails
- **FR-029**: System MUST allow speech retry if STT fails
- **FR-030**: System MUST recover from transient failures without session termination

**Data Retention**

- **FR-031**: System MUST store conversation transcripts (both user and AI turns) for 2 years, aligned with session retention policy
- **FR-032**: System MUST NOT persist raw audio recordings after real-time processing completes
- **FR-033**: System MUST delete transcripts when associated session record is deleted

### Non-Functional Requirements

**Performance**

- **NFR-001**: End-to-end latency MUST be <800ms at P50
- **NFR-002**: End-to-end latency MUST be <950ms at P95
- **NFR-003**: STT interim results MUST arrive within 200ms of speech
- **NFR-004**: LLM first token MUST arrive within 300ms of prompt completion
- **NFR-005**: TTS first audio chunk MUST arrive within 200ms of text generation start

**Data Sovereignty**

- **NFR-006**: All audio processing MUST occur in EU region
- **NFR-007**: Deepgram EU endpoint (api-eu.deepgram.com) MUST be used
- **NFR-008**: LiveKit server MUST be EU Frankfurt region
- **NFR-009**: No audio data MAY leave EU boundaries

**Cost Control**

- **NFR-010**: Voice services MUST cost <$0.50 per average session
- **NFR-011**: System MUST monitor per-session cost in real-time
- **NFR-012**: System MUST alert at 80% of session budget threshold
- **NFR-013**: Claude Haiku MUST be used (not Sonnet) for cost efficiency

**Reliability**

- **NFR-014**: Session completion rate MUST be >99% despite component hiccups
- **NFR-015**: Guardrails MUST block >99% of manipulation attempts
- **NFR-016**: Persona character consistency MUST be maintained 100% of conversations

### Key Entities

- **Turn**: A single conversational exchange (user speech → AI response). Contains user transcript, AI response text, AI audio reference, timestamps, emotional state at turn end.

- **Transcript Segment**: Interim or final STT result. Contains text, confidence score, timestamps, is_final flag.

- **Conversation Context**: Assembled context for LLM. Contains persona summary, product context, recent turns, current emotional state, scenario objectives.

- **Emotional State (M3)**: Current mood of the AI prospect. Values: skeptical, neutral, interested, frustrated, engaged. Determined by LLM self-assessment each turn (evaluates BDR's technique quality). Affects voice tone selection in TTS and response style. Persisted with each Turn record.

- **Guardrail Event**: Record of guardrail activation. Contains trigger type, input text, blocked (boolean), latency, timestamp.

- **Voice Profile**: Mapping of persona to Cartesia voice. Contains persona ID, voice ID, base emotion settings.

- **Violation Corpus**: Collection of known manipulation patterns for embedding similarity guardrail. Initialized with curated seed set; grows via promotion of confirmed violations from audit logs. Contains pattern text, embedding vector, category (prompt_injection, jailbreak, language_switch), added_date, source (seed/promoted).

## Success Criteria

- **SC-001**: End-to-end latency <800ms P50
- **SC-002**: Persona stays in character 100% of time (no character breaks in 1000 test conversations)
- **SC-003**: Guardrails block 99%+ of manipulation attempts (tested against 500 adversarial inputs)
- **SC-004**: Session completes successfully 99%+ even with simulated component failures
- **SC-005**: Voice services cost <$0.50 per session average

## Business Rules Summary

| Rule   | Description                                                    |
|--------|----------------------------------------------------------------|
| BR-001 | AI responds only in session language (language lock)           |
| BR-002 | Avatar failure does not terminate session                      |
| BR-003 | Cost hard stop at 150% of session budget                       |
| BR-004 | All guardrail violations logged for audit                      |
| BR-005 | Emotional state affects voice tone selection                   |
| BR-006 | Transcripts retained 2 years; raw audio not persisted          |
| BR-007 | Barge-in supported: AI stops immediately when user interrupts  |
| BR-008 | Violation corpus grows from curated seed + confirmed violations |

## Assumptions

- LiveKit integration from Spec 004 is operational and provides audio streaming
- Deepgram, Cartesia, and Anthropic API keys are provisioned with EU endpoints
- Persona definitions from Spec 004 include gender, age bracket, and emotional baseline
- M3 emotional state transitions handled by LLM self-assessment (no separate scoring model required)
- DiliTrust product context document exists for Context Builder
- Simli/D-ID API access is optional; audio-only mode is the baseline
- Curated seed set for violation corpus will be created before launch (minimum 50 patterns covering prompt injection, jailbreaks, language switching)

## Out of Scope

- Session management (Spec 004)
- Scoring and evaluation (Spec 009)
- Coaching whispers (Spec 007)
- Praiz pattern integration (Spec 008)
- Training the emotional state model (M3 rules predefined)
- Voice cloning or custom voice training
- Real-time translation (user must speak session language)

## Dependencies

- **Upstream**: Spec 004 (Session, Persona, Scenario data), LiveKit integration
- **External Services**: Deepgram (STT), Anthropic Claude (LLM), Cartesia (TTS), Simli/D-ID (Avatar - optional)
- **Environment**: Deepgram API key (EU), Cartesia API key, Anthropic API key, Simli/D-ID API key (optional)

## Clarifications

### Session 2026-01-08

- Q: How many conversation turns should be included in Context Builder? → A: Dynamic - fit within token budget (adaptive based on turn length)
- Q: What happens when user interrupts (barge-in) AI mid-response? → A: Interrupt and respond - AI stops speaking immediately, processes user's interruption
- Q: Are audio recordings and transcripts stored, and for how long? → A: Transcripts only stored for 2 years (aligned with session retention); raw audio deleted after real-time processing
- Q: How are M3 emotional state transitions determined? → A: LLM self-assessment - Claude evaluates conversation quality and outputs emotional state with each response
- Q: Where do embedding similarity violation patterns come from? → A: Curated seed set + logged violations (start with manually curated patterns, grow by promoting confirmed violations from production logs)
