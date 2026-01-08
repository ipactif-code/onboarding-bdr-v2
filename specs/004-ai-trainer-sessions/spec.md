# Feature Specification: AI Sales Trainer Session Infrastructure

**Feature Branch**: `004-ai-trainer-sessions`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "Build the foundational session infrastructure for an AI Sales Trainer that enables BDRs to practice sales conversations with an AI prospect."

## Context

This is the FIRST module of a larger AI Sales Trainer system for DiliTrust, a French LegalTech company. DiliTrust trains 500 BDRs across 10 countries in 5 languages (French, English, Italian, German, Spanish). This spec establishes the core data model and session management that ALL other AI Trainer modules will depend on.

This is a BROWNFIELD project - adding to an existing LMS platform.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a Free Practice Session (Priority: P1)

As a BDR, I want to start a new training session by selecting my language, scenario type, and prospect persona, so that I can practice a specific sales situation.

**Why this priority**: This is the core entry point for the entire AI Trainer system. Without the ability to start sessions, no other features can function. This delivers immediate value by enabling BDRs to begin practicing.

**Independent Test**: Can be fully tested by a BDR selecting language/scenario/persona and being connected to a voice room. Delivers the core value of initiating practice sessions.

**Acceptance Scenarios**:

1. **Given** I am a logged-in BDR, **When** I navigate to the AI Trainer section, **Then** I see a session setup interface with language, scenario, and persona selection options.

2. **Given** I am on the session setup interface, **When** I select French language, Cold Call scenario, and "Marc Dubois" persona, **Then** all selections are displayed clearly and a "Start Session" button becomes active.

3. **Given** I have made all required selections, **When** I click "Start Session", **Then** a new session is created with status "pending" and I am connected to a voice communication room.

4. **Given** a session is created with "pending" status, **When** the voice connection is successfully established, **Then** the session status changes to "active" and I can begin the conversation.

5. **Given** I am on the persona selection step, **When** I view the persona list, **Then** I see only personas compatible with my selected scenario, each showing name, role, company, and difficulty level.

6. **Given** I have not completed 5 sessions with lower difficulty levels, **When** I view the persona list, **Then** I do not see the CEO persona (Very Hard difficulty).

---

### User Story 2 - End a Training Session (Priority: P1)

As a BDR, I want to end my training session gracefully, so that my progress is saved and I can review my performance.

**Why this priority**: Session termination is equally critical as session start - without proper ending, session data would be lost, and BDRs would have no closure or feedback loop.

**Independent Test**: Can be tested by ending an active session and verifying status change, duration calculation, and redirect to summary view.

**Acceptance Scenarios**:

1. **Given** I am in an active training session, **When** I click "End Session", **Then** the session status changes to "completed" and the session end time is recorded.

2. **Given** I have ended a session, **When** the session is marked completed, **Then** the total duration is calculated from start to end time and stored with the session.

3. **Given** I have ended a session, **When** processing completes, **Then** I am redirected to a session summary view showing basic session information.

4. **Given** I am in an active session, **When** I lose connection unexpectedly (browser close, network failure), **Then** the system detects inactivity and marks the session as "abandoned" after 2 minutes.

5. **Given** a session is marked "abandoned", **When** I return to the AI Trainer section, **Then** I see the abandoned session in my history with appropriate status indication.

---

### User Story 3 - View Session History (Priority: P2)

As a BDR, I want to see my past training sessions, so that I can track my practice frequency and revisit my performance.

**Why this priority**: While not required for core functionality, session history provides essential feedback and progress tracking that motivates continued practice.

**Independent Test**: Can be tested by viewing a list of past sessions with filters and pagination working correctly.

**Acceptance Scenarios**:

1. **Given** I am a logged-in BDR with past sessions, **When** I navigate to my session history, **Then** I see a list of my sessions sorted by date with newest first.

2. **Given** I am viewing my session history, **When** I look at a session entry, **Then** I see the date, scenario type, persona name, duration, mode (free/evaluation), and status (completed/abandoned).

3. **Given** I have sessions in multiple languages and scenarios, **When** I apply a filter for "Cold Call" scenario, **Then** I see only sessions matching that scenario type.

4. **Given** I have sessions in multiple languages, **When** I filter by "French" language, **Then** I see only sessions conducted in French.

5. **Given** I have sessions from different dates, **When** I filter by a date range, **Then** I see only sessions within that range.

6. **Given** I have more than 20 sessions, **When** I view my session history, **Then** I see the first 20 sessions with pagination controls to view more.

---

### User Story 4 - Assign Evaluation Session (Priority: P2)

As a Team Lead, I want to assign an evaluation session to a BDR, so that I can formally assess their skills.

**Why this priority**: Evaluation mode is critical for certification but depends on free practice sessions being functional first.

**Independent Test**: Can be tested by a Team Lead assigning an evaluation and verifying it appears in the BDR's evaluations tab.

**Acceptance Scenarios**:

1. **Given** I am a Team Lead, **When** I navigate to evaluation assignment, **Then** I see a list of BDRs on my team available for assignment.

2. **Given** I am assigning an evaluation, **When** I select a BDR, scenario, persona, and language, **Then** I can optionally set a deadline for completion.

3. **Given** I have configured an evaluation assignment, **When** I confirm the assignment, **Then** the BDR receives a notification about the new evaluation.

4. **Given** an evaluation has been assigned to me, **When** I view my AI Trainer section, **Then** I see the assignment in a dedicated "Evaluations" tab separate from free practice.

5. **Given** an evaluation assignment exists, **When** I view its details, **Then** I see the maximum of 3 attempts allowed and how many I have used.

6. **Given** I have used all 3 attempts on an evaluation, **When** I try to start another attempt, **Then** I am prevented and shown a message that no attempts remain.

---

### User Story 5 - Manage Concurrent Session Limits (Priority: P3)

As a system, I need to enforce session limits to ensure fair resource allocation across the organization.

**Why this priority**: Resource management is important but not blocking for initial functionality.

**Independent Test**: Can be tested by attempting to exceed the concurrent session limit and verifying prevention.

**Acceptance Scenarios**:

1. **Given** my organization has 10 active sessions, **When** another BDR tries to start a session, **Then** they see a message that the maximum concurrent sessions limit has been reached.

2. **Given** a Cold Call session has been active for 60 minutes, **When** the timeout is reached, **Then** the session is automatically ended and marked with a timeout status.

3. **Given** a Discovery session has been active for 90 minutes, **When** the timeout is reached, **Then** the session is automatically ended and marked with a timeout status.

---

### Edge Cases

- What happens when a BDR loses network connectivity mid-session? System detects inactivity after 2 minutes and marks session as "abandoned."
- What happens when a BDR tries to start a session during organization limit? Clear error message shown with retry suggestion.
- What happens when LiveKit room creation fails? Session remains in "pending" status with error displayed; BDR can retry.
- What happens when a Team Lead assigns evaluation to a BDR who already has 3 pending evaluations? Assignment is allowed (limit is per-evaluation, not total).
- What happens when a BDR attempts evaluation within 24-hour cooldown period? Attempt is blocked with message showing when cooldown expires.
- What happens when session auto-expires due to timeout? Session marked as "expired" (distinct from "abandoned"), duration recorded up to timeout point.
- What happens when evaluation deadline passes? Assignment is locked (no new attempts), both BDR and Team Lead notified. Team Lead can extend deadline or close as incomplete.

## Requirements *(mandatory)*

### Functional Requirements

**Session Lifecycle**

- **FR-001**: System MUST create training sessions with initial status of "pending"
- **FR-002**: System MUST transition session status to "active" when voice connection is established
- **FR-003**: System MUST transition session status to "completed" when BDR explicitly ends session
- **FR-004**: System MUST transition session status to "abandoned" after 2 minutes of detected inactivity
- **FR-005**: System MUST transition session status to "expired" when session timeout is reached
- **FR-006**: System MUST record session start time when status becomes "active"
- **FR-007**: System MUST record session end time when session terminates (any terminal status)
- **FR-008**: System MUST calculate and store total session duration in seconds

**Session Configuration**

- **FR-009**: System MUST allow selection of language from: French (fr), English (en), Italian (it), German (de), Spanish (es)
- **FR-010**: System MUST allow selection of scenario type from: Cold Call, Discovery
- **FR-011**: System MUST allow selection of prospect persona from available personas
- **FR-012**: System MUST filter persona list to show only personas compatible with selected scenario
- **FR-013**: System MUST track session mode as either "free" (practice) or "evaluation"
- **FR-014**: System MUST store reference to voice communication room for each session
- **FR-015**: Session language MUST NOT be changeable after session creation

**Session Modes**

- **FR-016**: Free mode sessions MUST allow unlimited retries
- **FR-017**: Evaluation mode sessions MUST be assigned by Team Lead
- **FR-018**: Evaluation mode sessions MUST enforce maximum of 3 attempts per assignment
- **FR-019**: Evaluation mode MUST require prior consent acknowledgment for audio recording
- **FR-020**: System MUST enforce 24-hour cooldown between evaluation attempts for the same scenario

**Prospect Personas**

- **FR-021**: System MUST support 8 predefined prospect personas
- **FR-022**: Each persona MUST have: name, role/title, company context, personality traits, preferred objections, difficulty level
- **FR-023**: Persona difficulty levels MUST be: Easy, Medium, Hard, Very Hard
- **FR-024**: CEO persona (Very Hard) MUST only be available to BDRs who have 5 completed sessions (status = completed) with lower difficulty personas
- **FR-025**: Personas MUST be available in all 5 supported languages with cultural adaptations

**Session Limits**

- **FR-026**: System MUST enforce maximum of 10 concurrent active sessions per organization
- **FR-027**: System MUST auto-expire Cold Call sessions after 60 minutes
- **FR-028**: System MUST auto-expire Discovery sessions after 90 minutes
- **FR-029**: Abandoned sessions MUST NOT count toward certification attempt limits

**Session History**

- **FR-030**: System MUST display user's sessions sorted by date (newest first)
- **FR-031**: System MUST show for each session: date, scenario, persona, duration, mode, status
- **FR-032**: System MUST support filtering by scenario type
- **FR-033**: System MUST support filtering by language
- **FR-034**: System MUST support filtering by date range
- **FR-035**: System MUST paginate session history with 20 sessions per page
- **FR-051**: Team Leads MUST have read-only access to session history for all BDRs on their team
- **FR-052**: Team Leads MUST be able to filter team session history by individual BDR
- **FR-053**: Team Leads MUST NOT be able to modify or delete BDR session records

**Evaluation Assignment**

- **FR-036**: Team Leads MUST be able to select BDRs from their team for evaluation
- **FR-037**: Team Leads MUST be able to configure scenario, persona, and language for evaluation
- **FR-038**: Team Leads MUST be able to set an optional deadline for evaluation completion
- **FR-039**: BDRs MUST receive notification when assigned an evaluation
- **FR-040**: Assigned evaluations MUST appear in a dedicated "Evaluations" section for BDRs
- **FR-047**: System MUST lock evaluation assignments when deadline passes (no new attempts allowed)
- **FR-048**: System MUST notify both BDR and Team Lead when evaluation deadline passes
- **FR-049**: Team Leads MUST be able to extend deadline on locked evaluations
- **FR-050**: Team Leads MUST be able to manually close locked evaluations (mark as incomplete)

**Data Retention**

- **FR-041**: System MUST automatically delete session records older than 2 years
- **FR-042**: System MUST notify organization admins 30 days before scheduled deletion of their data

**Observability**

- **FR-043**: System MUST log structured events for session lifecycle transitions (pending, active, completed, abandoned, expired)
- **FR-044**: Each log event MUST include: session ID, user ID, organization ID, timestamp, event type, and relevant metadata
- **FR-045**: System MUST log evaluation assignment events (created, started, completed, expired)
- **FR-046**: System MUST expose session metrics for monitoring (active sessions per org, session duration distribution, failure rates)

### Key Entities

- **Training Session**: Represents a single practice or evaluation session. Tracks lifecycle status, timing, configuration (language, scenario, persona, mode), voice room reference, and relationship to user and organization.

- **Scenario Type**: Represents a category of sales conversation (Cold Call or Discovery). Defines expected duration range and available personas.

- **Prospect Persona**: Represents an AI character for role-play. Contains identity information, personality traits, objection patterns, difficulty level, scenario compatibility, and language-specific adaptations.

- **Evaluation Assignment**: Represents a Team Lead's formal assignment of an evaluation to a BDR. Tracks assigned configuration, deadline, attempt count, and completion status. Statuses: pending, in_progress, completed, locked (deadline passed), closed (manually terminated).

- **Session Configuration**: Captures the selected language, scenario, persona, and mode for a session. Immutable after session creation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: BDR can complete session setup (language, scenario, persona selection) and see the "Start Session" button become active within 5 seconds of page load
- **SC-002**: Voice communication room connection is established within 3 seconds of clicking "Start Session"
- **SC-003**: 99.5% of sessions complete without technical errors that prevent normal session flow
- **SC-004**: Session history page loads within 1 second for users with fewer than 100 sessions
- **SC-005**: Session history page loads within 3 seconds for users with up to 500 sessions
- **SC-006**: Session status transitions (pending → active, active → completed) occur within 500ms of trigger event
- **SC-007**: Abandoned session detection (2-minute inactivity) triggers status update within 30 seconds of threshold
- **SC-008**: Organization concurrent session limit (10) is enforced with 100% accuracy
- **SC-009**: Session auto-expiration (60/90 minutes) triggers within 1 minute of timeout threshold
- **SC-010**: Evaluation assignment notification reaches BDR within 30 seconds of assignment creation

## Business Rules Summary

| Rule   | Description                                                    |
|--------|----------------------------------------------------------------|
| BR-001 | Maximum 10 concurrent sessions per organization                |
| BR-002 | Cold Call sessions expire after 60 minutes                     |
| BR-003 | Discovery sessions expire after 90 minutes                     |
| BR-004 | Abandoned sessions don't count toward certification attempts   |
| BR-005 | Evaluation mode requires audio recording consent               |
| BR-006 | 24-hour cooldown between evaluation attempts for same scenario |
| BR-007 | Maximum 3 attempts per evaluation assignment                   |
| BR-008 | CEO persona requires 5 completed sessions with lower difficulty |
| BR-009 | Session language cannot change mid-session                     |
| BR-010 | Session records retained for 2 years, then auto-deleted        |

## Assumptions

- The existing LMS platform has user authentication and organization/team structures in place via Clerk
- BDRs and Team Leads are existing user roles in the system with appropriate permissions
- Voice communication infrastructure (LiveKit) will be integrated but voice processing logic is out of scope for this spec
- Notification system exists or will be built to deliver evaluation assignment notifications
- The 8 prospect personas will be defined as static/seed data initially (persona management UI is out of scope)
- Cultural adaptations for personas mean localized names and context-appropriate traits, not full persona redesign per language

## Out of Scope

- Voice processing and transcription (Spec 005)
- AI conversation logic and persona behavior (Spec 005)
- Scoring and evaluation results (Spec 009)
- Certification logic (Spec 010)
- Coaching whispers and real-time feedback (Spec 007)
- Praiz integration (Spec 008)
- Persona management UI (personas are predefined seed data)
- Demo, Negotiation, and Closing scenarios (V2+)

## Dependencies

- **Upstream**: Clerk authentication, existing user/organization/team structures
- **Downstream**: Specs 005 (Voice), 007 (Coaching), 008 (Praiz), 009 (Scoring), 010 (Certification) all depend on this session infrastructure

## Clarifications

### Session 2026-01-08

- Q: How long should session records be retained? → A: 2 years retention, then auto-delete
- Q: What level of logging for session operations? → A: Structured logging (session lifecycle events: create, start, end, abandon)
- Q: What happens when evaluation deadline passes? → A: Lock & notify - no new attempts allowed, Team Lead must extend or close manually
- Q: Can Team Leads view their team's session history? → A: Read-only access to all session history for their team
- Q: What counts toward CEO persona unlock (5 sessions)? → A: 5 completed sessions (status = completed)
