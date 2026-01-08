# Feature Specification: Real-Time Coaching Modules (M2, M4, M6)

**Feature Branch**: `007-realtime-coaching`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "Build the real-time coaching modules M2 (Whispers), M4 (Scenario Branching), and M6 (Voice Sentiment) that provide live guidance and create dynamic training paths."

## Overview

This specification covers three interconnected coaching modules for the AI Sales Trainer system:

- **Module M2 (Coaching Whispers)**: Real-time micro-advice displayed to BDRs during practice sessions
- **Module M4 (Scenario Branching)**: Dynamic conversation paths with consequences based on BDR decisions
- **Module M6 (Voice Sentiment Analysis)**: Client-side voice analysis for confidence, pace, and delivery feedback

These modules enhance the training experience by providing live guidance without breaking immersion and creating dynamic training paths that adapt to BDR performance.

## Clarifications

### Session 2026-01-08

- Q: How long should WhisperEvent records be retained? → A: Retain with session data (2-3 years, matches training data lifecycle)
- Q: What level of observability is needed for real-time features? → A: Key metrics (whisper latency, trigger rates, voice analysis performance)
- Q: How should coaching modules behave if upstream dependencies are unavailable? → A: Graceful degradation (use available data, skip unavailable triggers)

## Dependencies

This specification depends on:
- **Spec 004**: Session infrastructure (training sessions, modes)
- **Spec 005**: Voice pipeline, transcripts (real-time transcript data)
- **Spec 006**: M1 difficulty metrics (talk ratio, SPIN progression), M3 emotional state

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-Time Coaching Whispers (Priority: P1)

As a BDR in free practice mode, I want to receive subtle coaching hints during my conversation, so that I can improve my sales technique in real-time without breaking the flow of the conversation.

**Why this priority**: Whispers provide immediate, actionable feedback that directly impacts skill development during practice. This is the core coaching feature that differentiates guided practice from simple role-play.

**Independent Test**: Can be fully tested by starting a practice session, triggering known conditions (e.g., talking for >60% of the time), and verifying whispers appear with correct messages in the session language.

**Acceptance Scenarios**:

1. **Given** a BDR is in free practice mode with whispers enabled, **When** they talk for more than 60% of the conversation for 2 minutes, **Then** they see a whisper "You're talking too much. Ask an open question." that fades after 5 seconds

2. **Given** a BDR is in free practice mode, **When** they receive a whisper, **Then** no more than 4 whispers appear within any 60-second window

3. **Given** a BDR is in free practice mode, **When** two whisper triggers occur within 15 seconds, **Then** only the first whisper displays (global cooldown enforced)

4. **Given** a BDR is in evaluation mode, **When** any whisper trigger condition is met, **Then** no whispers are displayed

5. **Given** a BDR's session language is French, **When** a whisper is triggered, **Then** the whisper message displays in French

6. **Given** an objection is detected AND a general whisper trigger occurs simultaneously, **When** the system determines which whisper to show, **Then** the RACC (objection handling) whisper takes priority

---

### User Story 2 - Voice Delivery Feedback (Priority: P2)

As a BDR, I want feedback on my speaking style (pace, confidence) so that I can improve my vocal delivery and presence during sales conversations.

**Why this priority**: Voice delivery significantly impacts sales effectiveness. Real-time feedback on pace and confidence helps BDRs develop better communication habits that transfer to real calls.

**Independent Test**: Can be tested by speaking into the microphone at various speeds and volume levels, verifying the pace indicator updates correctly and that low confidence triggers appropriate whispers.

**Acceptance Scenarios**:

1. **Given** a BDR is in an active practice session, **When** their speaking pace exceeds 180 words per minute for 20 seconds, **Then** they see a "Slow down!" whisper

2. **Given** a BDR is in an active practice session, **When** their voice confidence score drops below 0.35 for 30 seconds, **Then** they see a "Breathe and slow down" whisper

3. **Given** a BDR is in an active practice session, **When** they are speaking, **Then** they see a small indicator showing their current pace status (too fast / good / too slow)

4. **Given** a BDR has completed a practice session, **When** they view the session summary, **Then** they see their voice metrics (average pace, confidence, energy, hesitation rate) over the session duration

5. **Given** a BDR is in evaluation mode, **When** they are speaking, **Then** the voice feedback indicator is hidden

6. **Given** a BDR is in an active session, **When** voice analysis runs, **Then** no raw audio data leaves the browser (only numeric metrics are sent to the backend)

---

### User Story 3 - Dynamic Scenario Branching (Priority: P3)

As a BDR, I want my choices to have consequences in the AI conversation so that I can learn the real impact of different sales approaches.

**Why this priority**: Dynamic branching creates a more realistic training experience where actions have consequences, reinforcing good behaviors and highlighting mistakes without artificial explanations.

**Independent Test**: Can be tested by intentionally missing a buying signal during a practice session and verifying the AI prospect's subsequent responses reflect decreased interest.

**Acceptance Scenarios**:

1. **Given** a BDR handles an objection effectively (detected by transcript analysis), **When** the conversation continues, **Then** the AI prospect becomes more open and may reveal a new opportunity

2. **Given** a BDR misses an obvious buying signal (detected by transcript analysis), **When** the conversation continues, **Then** the AI prospect becomes less engaged and more guarded

3. **Given** a BDR completes a practice session with branch decisions, **When** they view the session summary, **Then** they see a list of which branches (positive/negative/neutral) they took at each decision point

4. **Given** the system detects a branch opportunity during conversation, **When** the BDR responds, **Then** the branch decision is logged within 100ms for later review

5. **Given** a practice session is in progress, **When** branch opportunities occur, **Then** no more than 5 branch decision points are created per session

---

### User Story 4 - What-If Replay (Priority: P4)

As a BDR after a practice session, I want to explore alternative conversation paths at key decision points so that I can learn from my mistakes without redoing the entire session.

**Why this priority**: Post-session reflection with "what-if" scenarios deepens learning by showing consequences of alternative approaches. This is a valuable but non-essential enhancement to the core experience.

**Independent Test**: Can be tested by completing a practice session, selecting a key decision point from the summary, entering an alternative response, and receiving a consistent AI-generated reply.

**Acceptance Scenarios**:

1. **Given** a BDR has completed a practice session, **When** they view the session review, **Then** they see 3-5 key decision points highlighted from the conversation

2. **Given** a BDR is reviewing a completed session, **When** they select a decision point, **Then** they can enter an alternative response and see how the AI would have reacted

3. **Given** a BDR explores a What-If scenario, **When** the AI generates an alternative response, **Then** the response feels consistent with the original AI persona's personality and context

4. **Given** a BDR has already used What-If replay 3 times for a session, **When** they try to explore another alternative, **Then** they are informed they have reached the maximum (3) What-If explorations for this session

5. **Given** a BDR explores a What-If scenario, **When** the alternative response is generated, **Then** their original session score remains unchanged (What-If is not scored)

6. **Given** a practice session is still in progress (not completed), **When** the BDR attempts to access What-If replay, **Then** the feature is unavailable

---

### Edge Cases

- What happens when the microphone permission is denied? (Voice analysis is disabled, user sees a notification to enable it for full experience)
- How does the system handle network latency affecting whisper delivery? (Whispers use optimistic UI updates; if delivery fails, they are not retried)
- What happens if a BDR mutes their microphone mid-session? (Voice metrics show as unavailable; transcript-based whispers continue)
- How does the system handle a prospect speaking very quickly vs BDR speaking slowly? (Talk ratio calculated from transcript with speaker diarization, independent of speech rate)
- What happens when multiple RACC whisper conditions are met simultaneously? (Priority order: missing_reframe > missing_confirm > objection_detected)
- How does the system handle sessions shorter than the minimum threshold for certain whispers? (Whispers with time-based conditions like "5min without questions" are only evaluated after sufficient time has passed)
- What happens if upstream dependencies (transcripts, M1 metrics) are temporarily unavailable? (Graceful degradation: whispers depending on unavailable data are skipped; voice-based and available triggers continue operating; session continues without interruption)

## Requirements *(mandatory)*

### Functional Requirements

#### Module M2: Coaching Whispers

- **FR-001**: System MUST support 15 distinct whisper rules, each with a unique trigger condition, message content (in 5 languages), and individual cooldown period
- **FR-002**: System MUST enforce a maximum of 4 whispers per 60-second rolling window
- **FR-003**: System MUST enforce a 15-second global cooldown between any two whispers
- **FR-004**: System MUST display whispers as a non-blocking overlay that fades out after 5 seconds
- **FR-005**: System MUST completely disable whispers when session mode is "evaluation"
- **FR-006**: System MUST deliver whisper messages in the language matching the session's configured language
- **FR-007**: System MUST prioritize RACC-category whispers over general coaching whispers
- **FR-008**: System MUST prioritize corrective whispers over positive reinforcement whispers
- **FR-009**: System MUST never display two whispers simultaneously
- **FR-010**: System MUST evaluate whisper trigger conditions within 100ms of receiving relevant data
- **FR-010a**: System MUST gracefully degrade when upstream dependencies (transcripts, M1 metrics) are unavailable, skipping affected triggers while continuing to evaluate available ones

#### Module M4: Scenario Branching

- **FR-011**: System MUST support three branch types: positive (opportunity opens), negative (door closes), neutral (default path)
- **FR-012**: System MUST detect and log branch decision points during conversation (max 5 per session)
- **FR-013**: System MUST store branch decisions with timestamp, context, BDR response, and resulting branch type for post-session review
- **FR-014**: System MUST influence AI prospect behavior based on branch type (more open for positive, more guarded for negative)
- **FR-015**: System MUST continue logging branch decisions in evaluation mode (for scoring purposes)
- **FR-016**: System MUST display branch history in session summary showing which path was taken at each decision point

#### Module M4: What-If Replay

- **FR-017**: System MUST identify 3-5 key decision points per completed session for What-If exploration
- **FR-018**: System MUST allow BDRs to enter alternative responses at selected decision points
- **FR-019**: System MUST generate AI responses to alternative inputs that are consistent with the original persona
- **FR-020**: System MUST limit What-If explorations to 3 per session
- **FR-021**: System MUST NOT modify the original session score based on What-If explorations
- **FR-022**: System MUST only enable What-If replay for completed sessions (not in-progress)

#### Module M6: Voice Sentiment Analysis

- **FR-023**: System MUST analyze BDR voice for: confidence (0-1 scale), pace (words per minute), energy (0-1 scale), hesitation rate (percentage)
- **FR-024**: System MUST perform all voice analysis locally in the browser using client-side audio processing
- **FR-025**: System MUST NOT transmit raw audio data from the client (only numeric metrics)
- **FR-026**: System MUST update voice metrics every 5 seconds during active speech
- **FR-027**: System MUST display a real-time pace indicator during practice sessions (too fast / good / too slow)
- **FR-028**: System MUST hide the voice feedback indicator in evaluation mode
- **FR-029**: System MUST provide voice metrics in post-session summary (timeline visualization)
- **FR-030**: System MUST feed voice metrics to M2 whisper trigger evaluation (confidence threshold, pace threshold)

### 15 Whisper Rules Reference

| ID | Trigger | Cooldown | Priority |
|----|---------|----------|----------|
| talk_ratio_high | Talk ratio >60% for 2min | 180s | Normal |
| spin_stuck_situation | 3+ S questions in a row | 120s | Normal |
| spin_missing_implication | 2+ P, 0 I, >3min | 150s | Normal |
| objection_detected | Objection detected | 60s | RACC |
| competitor_mentioned | Competitor mentioned | 90s | Normal |
| buying_signal | Buying signal detected | 120s | Positive |
| voice_confidence_low | M6 confidence <0.35 for 30s | 120s | Normal |
| speaking_too_fast | >180 WPM for 20s | 90s | Normal |
| excellent_spin | SPIN progression >=0.85 | 180s | Positive |
| racc_missing_reframe | Objection without empathy | 60s | RACC |
| racc_missing_confirm | Response without confirm | 60s | RACC |
| silence_too_long | >8s silence from BDR | 45s | Normal |
| price_mentioned_early | Price before value | 120s | Normal |
| no_discovery_questions | 5min without questions | 180s | Normal |
| meeting_not_proposed | >80% call, no next step | 300s | Normal |

### Observability Requirements

- **OBS-001**: System MUST track whisper delivery latency (time from trigger condition to display) with p50, p95, p99 percentiles
- **OBS-002**: System MUST track whisper trigger rates by rule ID per session
- **OBS-003**: System MUST track voice analysis performance metrics (processing time, update reliability)
- **OBS-004**: System MUST log errors for failed whisper deliveries, voice analysis failures, and branch detection timeouts

### Key Entities

- **Whisper**: A coaching message with rule ID, trigger condition, localized messages (5 languages), cooldown duration, priority level, and display duration
- **WhisperEvent**: A record of a whisper shown during a session with timestamp, rule ID, session reference, and context data; retained with session data (2-3 years)
- **BranchPoint**: A decision moment in a conversation with timestamp, context (transcript excerpt), decision type (positive/negative/neutral), and outcome
- **WhatIfExploration**: A post-session exploration with reference to branch point, alternative user input, AI-generated response, and exploration count
- **VoiceSentimentSnapshot**: A periodic capture of voice metrics with timestamp, confidence score, pace (WPM), energy score, and hesitation rate
- **SessionVoiceSummary**: Aggregated voice metrics for a session including averages, trends, and timeline data

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Whispers appear on screen within 200ms of trigger condition being met
- **SC-002**: Greater than 80% of whispers rated as "helpful" by BDRs in post-session feedback surveys
- **SC-003**: Voice analysis operates at less than 5% CPU usage on standard devices
- **SC-004**: What-If AI responses rated as "consistent with persona" by 85% of users
- **SC-005**: BDRs who use whisper-enabled practice improve their sales technique scores 25% faster than those without whispers
- **SC-006**: 90% of branch decisions are logged within 100ms of BDR response
- **SC-007**: Voice metrics update at least every 5 seconds during active speech with 95% reliability
- **SC-008**: What-If replay feature used by at least 50% of BDRs who complete practice sessions

## Assumptions

- BDRs will use modern browsers that support client-side audio processing capabilities
- Microphone access will be granted by users for voice analysis to function
- Transcript data from Spec 005 will be available with speaker diarization (distinguishing BDR vs. AI prospect)
- M1 metrics (talk ratio, SPIN analysis) from Spec 006 will be available in real-time or near-real-time
- Session infrastructure from Spec 004 already tracks session mode (practice vs. evaluation)
- AI persona definitions include sufficient context for generating consistent What-If responses
- Network latency between client and backend will typically be under 100ms for whisper delivery

## Out of Scope

- AI Coach personal training plans (deferred to Spec 011)
- Scoring based on whisper usage (deferred to Spec 009)
- Cohort comparison of voice metrics (Phase 2 enhancement)
- Voice analysis of AI prospect speech (only BDR voice is analyzed)
- Real-time transcription (handled by Spec 005)
- Difficulty adjustment algorithms (handled by Spec 006)
