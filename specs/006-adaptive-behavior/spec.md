# Feature Specification: Adaptive Behavior Modules (M1 & M3)

**Feature Branch**: `006-adaptive-behavior`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "Build the adaptive behavior modules M1 (Difficulty Engine) and M3 (Emotional State Machine) that make the AI prospect dynamically adjust to the BDR's performance."

## Overview

This specification covers two core modules that make AI Sales Trainer conversations feel realistic and personalized to each BDR's skill level:

- **Module M1 (Adaptive Difficulty Engine)**: Dynamically adjusts prospect difficulty based on real-time BDR performance, implementing Vygotsky's Zone of Proximal Development (ZPD)
- **Module M3 (Emotional State Machine)**: Manages 6 emotional states with probabilistic transitions based on BDR actions, affecting voice tone and conversation behavior

## Dependencies

- **Spec 004**: Session, Persona, and Scenario data models
- **Spec 005**: Voice pipeline integration (Context Builder, LLM prompts, voice modulation)

---

## Clarifications

### Session 2026-01-08

- Q: How should probabilistic state transitions be determined? → A: Action-weighted model where BDR action quality determines base transition probability and persona configuration modifies it
- Q: What composite score thresholds trigger difficulty changes? → A: Standard band on 0-100 scale: above 70 = performing well (increase), below 55 = struggling (decrease)
- Q: Should the AI prospect ever actually end the call when frustrated? → A: Yes, warning then exit: if frustrated persists 2 more turns after warning, prospect ends call
- Q: How should the missing 10% metric weight be allocated? → A: Add 7th metric closingSignals at 10% (recognizing buying signals, trial closes)
- Q: How should sessions be classified when prospect ends call early? → A: Mark as "ended_by_prospect" - distinct outcome type, neither pass nor fail, captured for learning

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dynamic Difficulty Adjustment (Priority: P1)

As a BDR, I want the AI prospect to become more challenging as I improve, so that I'm always practicing at my edge of ability without becoming overwhelmed or bored.

**Why this priority**: Core value proposition of adaptive training. Without difficulty adjustment, BDRs either plateau on easy prospects or get frustrated on hard ones. This enables personalized skill development.

**Independent Test**: Can be tested by conducting a 10-minute practice session where the BDR intentionally performs well for 3 minutes (using SPIN questions, handling objections), then poorly for 3 minutes (talking too much, ignoring questions). Difficulty level should visibly adjust in response.

**Acceptance Scenarios**:

1. **Given** a BDR is in a practice session at medium difficulty (0.5), **When** they perform well consistently for 2+ minutes (high SPIN quality, good objection handling), **Then** difficulty increases by 0.05-0.1 points.
2. **Given** a BDR is struggling at current difficulty for 2+ minutes, **When** performance metrics drop below threshold, **Then** difficulty decreases by 0.05-0.1 points.
3. **Given** difficulty just changed within the last 60 seconds, **When** another adjustment would be triggered, **Then** the system respects the cooldown and does not adjust.
4. **Given** a BDR is at the persona's maximum difficulty (e.g., 0.85), **When** performance warrants increase, **Then** difficulty remains capped at persona maximum.
5. **Given** a BDR is at the persona's minimum difficulty (e.g., 0.3), **When** performance warrants decrease, **Then** difficulty remains floored at persona minimum.

---

### User Story 2 - Emotional State Feedback (Priority: P1)

As a BDR, I want to hear changes in the prospect's tone when I do well or poorly, so that I learn to read emotional cues and adjust my approach accordingly.

**Why this priority**: Emotional feedback creates the realism that makes training transferable to real calls. BDRs need to practice recognizing and responding to prospect mood shifts.

**Independent Test**: Can be tested by performing specific actions (asking a good SPIN question vs. pitching too early) and listening to the prospect's voice tone change in the subsequent response.

**Acceptance Scenarios**:

1. **Given** a prospect is in "neutral" state, **When** the BDR asks a well-formed SPIN question, **Then** the prospect may transition toward "interested" and voice tone becomes warmer/more engaged.
2. **Given** a prospect is in "neutral" state, **When** the BDR starts pitching before asking discovery questions, **Then** the prospect may transition toward "skeptical" or "defensive" and voice tone becomes cooler/guarded.
3. **Given** a prospect is in "frustrated" state, **When** this state persists for 2+ turns, **Then** the prospect gives a verbal warning that they may end the call soon.
4. **Given** a prospect transitioned emotional states twice in the last minute, **When** another transition would be triggered, **Then** the system prevents oscillation and maintains current state.
5. **Given** consistent excellent performance over 5+ exchanges, **When** the prospect is in "interested" state, **Then** the prospect may transition to rare "impressed" state.

---

### User Story 3 - Consistent Persona Behavior (Priority: P1)

As a BDR, I want each persona to have a distinct baseline difficulty and emotional pattern, so that practicing with different personas teaches different skills.

**Why this priority**: Varied personas ensure well-rounded training. Each persona type (analytical, executive, negotiator) represents different real-world prospect archetypes with distinct challenges.

**Independent Test**: Can be tested by starting sessions with 3 different personas and verifying each has distinct starting emotional state, difficulty range, and behavior patterns.

**Acceptance Scenarios**:

1. **Given** a "Skeptical Analyst" persona, **When** session starts, **Then** prospect begins in "skeptical" emotional state and requires data/evidence to warm up.
2. **Given** a "Pressured Executive" persona, **When** session starts, **Then** prospect has high time pressure modifier, rewards brevity, and may interrupt verbose responses.
3. **Given** an "Aggressive Negotiator" persona, **When** session starts, **Then** prospect frequently mentions competitors and pushes on pricing/value.
4. **Given** a "CEO" level locked persona, **When** session starts, **Then** difficulty floor is set to 0.7 (Hard minimum) regardless of BDR level.
5. **Given** any persona configuration, **When** behavior modifiers are applied, **Then** they align consistently with the persona's archetype throughout the session.

---

### User Story 4 - Performance Visibility (Priority: P2)

As a BDR in free practice mode, I want to optionally see my real-time performance metrics, so that I understand what's affecting difficulty and can focus on improving specific areas.

**Why this priority**: Educational feedback accelerates learning. Optional visibility respects that some users want heads-up display while others prefer immersive practice.

**Independent Test**: Can be tested by toggling the performance overlay on/off during a free practice session and verifying metrics display correctly and update in real-time.

**Acceptance Scenarios**:

1. **Given** a BDR is in free practice mode with overlay disabled, **When** they enable the performance overlay toggle, **Then** they see current talk ratio, SPIN progress, and difficulty level.
2. **Given** performance overlay is enabled, **When** 10-15 seconds pass, **Then** the displayed metrics refresh with current values.
3. **Given** a BDR is in evaluation mode, **When** they attempt to enable performance overlay, **Then** the toggle is disabled/hidden (no hints during evaluations).
4. **Given** overlay shows talk ratio at 55%, **When** BDR talks significantly more, **Then** overlay updates to reflect increased talk ratio within 15 seconds.

---

### Edge Cases

- What happens when network latency delays metric calculation? System uses last known values and catches up on reconnection without abrupt changes.
- How does system handle a BDR who is silent for extended periods? Talk ratio calculation accounts for prospect speaking time; silence is not penalized as "talking too much."
- What if persona configuration is missing difficulty bounds? System applies sensible defaults (min: 0.3, max: 0.85) and logs warning.
- How does system handle rapid-fire exchanges where multiple state transitions could trigger? Rate limiting (max 2 per minute) prevents oscillation.
- What happens if emotional state reaches "frustrated" at session start due to bad opener? Grace period of 30 seconds before "frustrated" state can be entered.

---

## Requirements *(mandatory)*

### Functional Requirements

#### M1: Adaptive Difficulty Engine

- **FR-001**: System MUST track 7 weighted performance metrics: spinQuality (25%), objectionHandling (25%), talkRatio (10%), responseTiming (10%), questionDepth (10%), valueArticulation (10%), closingSignals (10%)
- **FR-002**: System MUST recalculate difficulty score every 30 seconds during active sessions
- **FR-003**: System MUST adjust difficulty by increments of 0.05-0.1 based on sustained performance trends (2+ minutes) using composite score thresholds: above 70 triggers increase, below 55 triggers decrease (0-100 scale)
- **FR-004**: System MUST enforce a 60-second cooldown between difficulty adjustments
- **FR-005**: System MUST respect persona-specific difficulty bounds (minimum and maximum)
- **FR-006**: System MUST generate behavior modifiers (objection frequency, intensity, interruptions, info reveal, time pressure, competitor mentions) based on current difficulty level
- **FR-007**: System MUST inject difficulty-based behavior modifiers into the Context Builder for LLM prompt generation

#### M3: Emotional State Machine

- **FR-008**: System MUST support 6 emotional states: skeptical, neutral, interested, impressed, defensive, frustrated
- **FR-009**: System MUST evaluate potential state transitions after each BDR speaking turn
- **FR-010**: System MUST apply probabilistic transitions where BDR action quality determines base transition probability and persona configuration modifies it (action-weighted model)
- **FR-011**: System MUST enforce maximum 2 state transitions per minute to prevent oscillation
- **FR-012**: System MUST trigger a verbal warning when "frustrated" state persists; if frustrated continues for 2 more turns after warning, prospect ends the call and session is marked as "ended_by_prospect" (distinct outcome, neither pass nor fail, captured for learning)
- **FR-013**: System MUST make "impressed" state rare (requires sustained excellent performance across 5+ exchanges)
- **FR-014**: System MUST pass emotional state to voice synthesis for tone modulation (speed, pitch, emotion tag)
- **FR-015**: System MUST include emotional state in LLM prompt for behavior consistency

#### Integration Requirements

- **FR-016**: System MUST update difficulty and emotional state without adding more than 10ms latency to the voice pipeline per turn
- **FR-017**: System MUST support evaluation mode where difficulty starts at persona default and does not adjust
- **FR-018**: System MUST disable performance overlay in evaluation mode
- **FR-019**: System MUST provide real-time performance overlay (optional toggle) in free practice mode with 10-15 second refresh
- **FR-020**: System MUST apply persona-specific default emotional states at session start

### Key Entities

- **PerformanceMetrics**: Real-time BDR performance data (spinQuality, objectionHandling, talkRatio, responseTiming, questionDepth, valueArticulation, closingSignals scores)
- **DifficultyState**: Current difficulty level (0.1-0.95), last adjustment timestamp, persona bounds, behavior modifiers
- **EmotionalState**: Current state (enum), state history, transition cooldown, voice modulation parameters
- **BehaviorModifiers**: Derived settings (objection frequency %, intensity level, interruption rate, info reveal level, time pressure level, competitor mention frequency)
- **PersonaConfig**: Persona-specific defaults (initial emotional state, difficulty range min/max, archetype behavior overrides)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Difficulty adjusts within 60 seconds of sustained performance change (either improvement or decline lasting 2+ minutes)
- **SC-002**: Emotional transitions feel natural to users (validated by user testing with 80%+ rating transitions as "believable")
- **SC-003**: Different personas feel distinctly different to practice with (validated by user testing: 90%+ can identify persona archetype by behavior)
- **SC-004**: System adds less than 10ms overhead to voice pipeline per turn (measured p95 latency)
- **SC-005**: Performance overlay updates within 15 seconds of metric changes during free practice
- **SC-006**: BDRs practicing with adaptive difficulty show 25% faster skill improvement compared to static difficulty (measured over 4-week pilot)
- **SC-007**: "Frustrated" state warning triggers 100% of the time before prospect ends call prematurely
- **SC-008**: Rate limiting prevents more than 2 emotional state transitions per minute in 100% of sessions

---

## Out of Scope

- Coaching whispers based on M1/M3 analysis (Spec 007)
- Voice sentiment analysis M6 - analyzing BDR's tone (Spec 007)
- Scoring calculations and certification (Spec 009)
- UI for historical performance trends (Phase 2)
- Gamification/leaderboards based on difficulty progression (Phase 2)

---

## Assumptions

- Spec 004 persona definitions include difficulty range fields (minDifficulty, maxDifficulty) and default emotional state
- Spec 005 Context Builder accepts difficulty modifiers and emotional state as inputs
- Spec 005 voice synthesis (Cartesia) supports emotion tags for tone modulation
- Performance metrics (SPIN quality, objection handling, etc.) are calculated by existing session analysis components or will be built alongside this spec
- Talk ratio is calculated as BDR speaking time / total speaking time, with ideal target around 35%
- Response timing ideal is approximately 2 seconds (quick but not interrupting)
