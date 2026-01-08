# Feature Specification: BDR Performance Scoring & Evaluation System

**Feature Branch**: `009-scoring-evaluation`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "Build the scoring and evaluation system that assesses BDR performance across multiple sales methodologies (SPIN, MEDDIC, BANT, RACC) and provides actionable feedback."

## Clarifications

### Session 2026-01-08

- Q: How long should score records be retained? → A: Retain for 2 years, then auto-archive
- Q: How many sessions might need scoring concurrently? → A: 50 concurrent sessions (medium team, some batching)
- Q: What happens if the scoring engine fails completely? → A: Queue for automatic retry (up to 3 attempts), notify BDR when complete
- Q: Who can view whose scores? → A: BDRs see only their own scores; Team Leads see only their team's scores

## Overview

This system provides automated post-session evaluation of BDR (Business Development Representative) training sessions. It analyzes session transcripts and behavioral data to generate comprehensive scores across six dimensions, identifies key moments, and delivers actionable feedback to help BDRs improve their sales skills.

## Dependencies

- **Spec 004**: Session data, personas, scenarios (session metadata)
- **Spec 005**: Session transcripts (text for analysis)
- **Spec 006**: M1 performance metrics, M3 emotional navigation (adaptive data)
- **Spec 008**: Objection Library (RACC evaluation reference)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Post-Session Scoring (Priority: P1)

As a BDR, I want my training session automatically scored when I finish, so that I get immediate feedback on my performance without waiting.

**Why this priority**: This is the core value proposition - without automatic scoring, BDRs cannot receive feedback. All other features depend on scores being generated first.

**Independent Test**: Can be fully tested by completing a mock training session and verifying that within 30 seconds, an overall score (0-100) appears with expandable dimension breakdowns and 3-5 key moments with timestamps.

**Acceptance Scenarios**:

1. **Given** a BDR has just completed a training session, **When** the session ends, **Then** scoring begins automatically and completes within 30 seconds
2. **Given** scoring is in progress, **When** the BDR views the session results, **Then** they see a "Scoring in progress" indicator with partial results as they become available
3. **Given** scoring has completed, **When** the BDR views results, **Then** they see an overall score (0-100), expandable per-dimension breakdown, and 3-5 key moments with timestamps
4. **Given** a session transcript exists, **When** scoring runs, **Then** the system evaluates all six dimensions: SPIN Quality, MEDDIC Coverage, BANT Qualification, RACC Execution, Behavioral, and Adaptive

---

### User Story 2 - Detailed Feedback Report (Priority: P1)

As a BDR, I want detailed feedback on each scoring dimension, so that I know exactly what I did well and what to improve.

**Why this priority**: Scores without explanation are not actionable. BDRs need specific, contextual feedback to understand their performance and make improvements.

**Independent Test**: Can be fully tested by viewing a scored session and verifying each dimension shows a score, specific feedback text, and relevant details (e.g., which SPIN question types were missed, each objection's RACC handling).

**Acceptance Scenarios**:

1. **Given** a session has been scored, **When** the BDR expands the SPIN dimension, **Then** they see a score (0-100) and feedback indicating which question types (Situation, Problem, Implication, Need-Payoff) were used effectively or missed
2. **Given** a session has been scored, **When** the BDR expands the RACC dimension, **Then** they see a list of each objection encountered with individual Reframe/Address/Confirm/Close scores and specific feedback
3. **Given** a session has been scored, **When** the BDR expands the Behavioral dimension, **Then** they see talk ratio percentage over time, active listening score, voice confidence assessment, and pacing feedback
4. **Given** the session was conducted in French, **When** the BDR views feedback, **Then** all feedback text is displayed in French

---

### User Story 3 - Strengths and Improvements Summary (Priority: P2)

As a BDR, I want a summary of my top strengths and areas for improvement with trend comparison, so that I can focus my practice on what matters most.

**Why this priority**: While detailed feedback is essential, a summary helps BDRs prioritize their learning and track progress over time. This builds on P1 features.

**Independent Test**: Can be fully tested by completing multiple sessions and verifying the summary shows top 3 strengths, top 3 improvements with advice, recommended practice scenarios, and comparison to last 5 sessions.

**Acceptance Scenarios**:

1. **Given** a session has been scored, **When** the BDR views the summary, **Then** they see their top 3 strengths identified from this session with supporting evidence
2. **Given** a session has been scored, **When** the BDR views the summary, **Then** they see top 3 areas for improvement with specific, actionable advice
3. **Given** areas for improvement have been identified, **When** the BDR views recommendations, **Then** they see suggested practice scenarios that target their weaknesses
4. **Given** a BDR has completed at least 2 sessions, **When** they view their latest session, **Then** they see a trend comparison showing performance changes across their last 5 sessions (or fewer if less than 5 exist)

---

### User Story 4 - Evaluation Mode for Certification (Priority: P2)

As a Team Lead, I want evaluation sessions scored against certification criteria with pass/fail recommendations, so that I can make informed certification decisions.

**Why this priority**: Certification assessments require stricter standards and audit trails. This extends the core scoring with additional business rules for formal evaluations.

**Independent Test**: Can be fully tested by conducting an evaluation-mode session and verifying stricter thresholds are applied, pass/fail/distinction status is shown with justification, and Team Lead can add notes.

**Acceptance Scenarios**:

1. **Given** a session was conducted in evaluation mode, **When** scoring completes, **Then** the system applies stricter rubric standards and displays minimum threshold requirements per dimension
2. **Given** evaluation scoring has completed, **When** overall score is 70+ AND no dimension is below 50, **Then** the system shows "PASS" with justification
3. **Given** evaluation scoring has completed, **When** overall score is 85+ AND all dimensions are 70+, **Then** the system shows "DISTINCTION" with justification
4. **Given** evaluation scoring has completed, **When** overall score is below 70 OR any dimension is below 40, **Then** the system shows "FAIL" with justification
5. **Given** evaluation results are displayed, **When** a Team Lead views them, **Then** they can add notes to the record (notes do not change scores)
6. **Given** evaluation results exist, **When** the results are stored, **Then** they are linked to the certification tracking system for audit purposes

---

### User Story 5 - Competitive Response Evaluation (Priority: P3)

As a BDR, I want feedback when I discuss competitors, so that I improve my competitive positioning skills.

**Why this priority**: Competitive handling is a subset of overall performance. While valuable, it only applies to sessions where competitors are mentioned.

**Independent Test**: Can be fully tested by conducting a session where competitors are mentioned and verifying the system detects mentions, evaluates responses against battlecard best practices, and flags any competitor bashing.

**Acceptance Scenarios**:

1. **Given** a session transcript mentions a competitor (Icertis, Diligent, SharePoint, etc.), **When** scoring completes, **Then** the competitive response section shows each mention detected with timestamp
2. **Given** a competitor was mentioned, **When** the BDR responded, **Then** the system evaluates if they acknowledged competitor strengths appropriately
3. **Given** a competitor was mentioned, **When** the BDR responded, **Then** the system evaluates if they differentiated on value (not just features)
4. **Given** a competitor was mentioned, **When** the BDR made negative statements about the competitor, **Then** the system flags this as "competitor bashing" (negative behavior)
5. **Given** the competitive response was weak, **When** feedback is displayed, **Then** the system suggests better positioning based on battlecard knowledge

---

### Edge Cases

- **Empty or very short sessions**: Sessions under 2 minutes or with fewer than 10 transcript turns receive a "Session too short to evaluate" status instead of scores
- **No objections encountered**: If no objections occurred, RACC dimension shows "N/A - No objections in session" with score weighted to other dimensions
- **Missing M1/M3 data**: If adaptive metrics are unavailable (system failure), Adaptive dimension shows "Data unavailable" and score weights redistribute to other dimensions
- **Multi-language sessions**: If session switches languages mid-way, feedback is provided in the session's primary language (>50% of content)
- **Scoring timeout**: If scoring exceeds 30 seconds, partial results are displayed with "Scoring incomplete" indicator and option to retry
- **Identical transcripts**: If the same transcript is submitted twice (duplicate session), the system returns the existing score rather than re-scoring
- **Scoring engine failure**: If the scoring engine fails completely (service unavailable, quota exceeded), system queues session for automatic retry (up to 3 attempts with exponential backoff) and notifies BDR when scoring completes or fails permanently

## Requirements *(mandatory)*

### Functional Requirements

#### Scoring Engine

- **FR-001**: System MUST automatically initiate scoring when a training session ends
- **FR-002**: System MUST evaluate sessions across six dimensions: SPIN Quality (20% weight), MEDDIC Coverage (20%), BANT Qualification (15%), RACC Execution (20%), Behavioral (15%), and Adaptive (10%)
- **FR-003**: System MUST calculate an overall score (0-100) as the weighted average of dimension scores
- **FR-004**: System MUST complete scoring within 30 seconds for 95% of sessions
- **FR-005**: System MUST show scoring progress indicator while evaluation is in progress

#### SPIN Scoring (20% weight, 0-100 scale)

- **FR-006**: System MUST score Situation questions (0-25) based on relevance and appropriate quantity
- **FR-007**: System MUST score Problem questions (0-25) based on pain point identification depth
- **FR-008**: System MUST score Implication questions (0-25) based on impact exploration and quantification
- **FR-009**: System MUST score Need-Payoff questions (0-25) based on solution visualization and commitment

#### MEDDIC Scoring (20% weight, 0-100 scale)

- **FR-010**: System MUST score Metrics discovery (0-15) based on ROI/KPI discussion
- **FR-011**: System MUST score Economic Buyer identification (0-15)
- **FR-012**: System MUST score Decision Criteria discovery (0-15)
- **FR-013**: System MUST score Decision Process understanding (0-15)
- **FR-014**: System MUST score Pain identification and quantification (0-15)
- **FR-015**: System MUST score Champion identification (0-15)
- **FR-016**: System MUST score Competition landscape understanding (0-10)

#### BANT Scoring (15% weight, 0-100 scale)

- **FR-017**: System MUST score Budget discovery based on financial qualification
- **FR-018**: System MUST score Authority identification based on decision-maker discovery
- **FR-019**: System MUST score Need assessment based on requirement understanding
- **FR-020**: System MUST score Timeline discovery based on urgency and timing

#### RACC Scoring (20% weight, per objection 0-100)

- **FR-021**: System MUST identify each objection raised during the session
- **FR-022**: System MUST score Reframe (0-25) based on empathy shown before response
- **FR-023**: System MUST score Address (0-25) based on value-driven, data-supported response
- **FR-024**: System MUST score Confirm (0-25) based on verification of objection resolution
- **FR-025**: System MUST score Close (0-25) based on next step proposal

#### Behavioral Scoring (15% weight, 0-100 scale)

- **FR-026**: System MUST score Talk Ratio (0-25) with ideal range 30-40%, penalizing >60%
- **FR-027**: System MUST score Active Listening (0-25) based on acknowledgments and follow-up questions
- **FR-028**: System MUST score Voice Confidence (0-25) using M6 voice metrics when available
- **FR-029**: System MUST score Pacing (0-25) based on speaking rate and pause appropriateness

#### Adaptive Scoring (10% weight, 0-100 scale)

- **FR-030**: System MUST score Difficulty Progression (0-50) based on whether difficulty increased (positive indicator)
- **FR-031**: System MUST score Emotional Navigation (0-50) based on whether prospect emotional state improved

#### Key Moments

- **FR-032**: System MUST identify 3-5 key moments per session (maximum 5)
- **FR-033**: System MUST categorize key moments as positive (great question, well-handled objection, buying signal captured) or negative (missed opportunity, poor objection handling, talked over prospect)
- **FR-034**: System MUST link key moments to specific transcript timestamps
- **FR-035**: System MUST include at least one positive moment if overall score is 50 or above

#### Feedback Generation

- **FR-036**: System MUST generate specific feedback for each dimension explaining the score
- **FR-037**: System MUST generate feedback in the same language as the session
- **FR-038**: System MUST identify top 3 strengths with supporting evidence from the session
- **FR-039**: System MUST identify top 3 areas for improvement with specific, actionable advice
- **FR-040**: System MUST recommend practice scenarios that address identified weaknesses

#### Trend Analysis

- **FR-041**: System MUST compare current session to the BDR's last 5 sessions (when available)
- **FR-042**: System MUST show dimension-by-dimension trend changes

#### Evaluation Mode

- **FR-043**: System MUST apply stricter rubric for evaluation-mode sessions
- **FR-044**: System MUST determine Pass status when overall score is 70+ AND no dimension below 50
- **FR-045**: System MUST determine Distinction status when overall score is 85+ AND all dimensions 70+
- **FR-046**: System MUST determine Fail status when overall score is below 70 OR any dimension below 40
- **FR-047**: System MUST allow Team Leads to add notes to evaluation results (notes cannot change scores)
- **FR-048**: System MUST store evaluation results for certification tracking

#### Competitive Handling

- **FR-049**: System MUST detect mentions of known competitors (Icertis, Diligent, SharePoint, and others from battlecard library)
- **FR-050**: System MUST evaluate competitive responses against battlecard best practices
- **FR-051**: System MUST flag competitor bashing as a negative behavior
- **FR-052**: System MUST suggest better positioning when competitive response is weak

#### Scoring Integrity

- **FR-053**: System MUST NOT allow re-scoring of the same session
- **FR-054**: System MUST make the full scoring rubric visible to BDRs before sessions
- **FR-055**: System MUST ensure scores are final once generated

#### Access Control

- **FR-056**: System MUST restrict BDRs to viewing only their own scores and feedback
- **FR-057**: System MUST allow Team Leads to view scores only for BDRs on their team
- **FR-058**: System MUST NOT allow BDRs to view other BDRs' scores (no peer visibility)

### Key Entities

- **SessionScore**: The overall evaluation result for a training session. Contains overall score, dimension scores, key moments, feedback, and metadata. Links to a single Session.
- **DimensionScore**: Score for one of the six evaluation dimensions. Contains score value (0-100), sub-scores where applicable, and dimension-specific feedback.
- **KeyMoment**: A significant event during the session. Contains timestamp, type (positive/negative), description, and relevance to scoring.
- **ObjectionEvaluation**: RACC assessment of a single objection. Contains the objection text, BDR response, and individual R/A/C/C scores.
- **CompetitorMention**: Record of a competitor being discussed. Contains timestamp, competitor name, BDR response, and evaluation result.
- **EvaluationResult**: Certification assessment for evaluation-mode sessions. Contains pass/fail/distinction status, justification, and Team Lead notes.
- **TrendData**: Historical comparison data. Contains dimension scores from last 5 sessions and calculated trends.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Scoring completes within 30 seconds for at least 95% of sessions
- **SC-002**: Scoring consistency achieves 90%+ reliability (same transcript produces same score within +/- 5 points)
- **SC-003**: Cost per scored session remains below $0.10
- **SC-004**: BDR satisfaction with feedback quality reaches 80%+ (measured via post-session survey)
- **SC-005**: Team Leads can make certification decisions within 2 minutes of viewing evaluation results
- **SC-006**: BDRs can identify their top improvement area within 30 seconds of viewing results
- **SC-007**: Feedback is provided in the correct session language 100% of the time

## Constraints & Assumptions

### Constraints

- **Cost ceiling**: Scoring cost must stay under $0.10 per session
- **Latency ceiling**: 30-second maximum for scoring completion
- **Language support**: Five languages (English, French, German, Spanish, Italian)
- **Immutable scores**: Once generated, scores cannot be modified
- **Data retention**: Score records retained for 2 years in active storage, then auto-archived
- **Concurrent capacity**: System must handle up to 50 sessions being scored simultaneously

### Assumptions

- Session transcripts are available in text format from Spec 005
- M1 performance metrics and M3 emotional states are accessible from Spec 006
- Objection Library from Spec 008 provides reference data for RACC evaluation
- Battlecard knowledge exists for competitor differentiation guidance
- BDRs have completed at least one session before trend comparison is meaningful

## Out of Scope

- Real-time scoring during active sessions (M1 metrics serve this purpose)
- Peer comparison / leaderboards (planned for Phase 2)
- Custom rubric configuration by Team Leads (planned for Phase 2)
- Video playback with score overlay (planned for Phase 2)
- Gamification elements (badges, achievements)
- Integration with external LMS platforms
