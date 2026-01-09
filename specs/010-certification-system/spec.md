# Feature Specification: BDR Certification System

**Feature Branch**: `010-certification-system`
**Created**: 2026-01-09
**Status**: Draft
**Input**: Build the certification system that tracks BDR progression through training levels and integrates with the existing LMS course structure.

## Clarifications

### Session 2026-01-09

- Q: Which roles can reset evaluation cooldowns? → A: System Admins and Team Leads (both have direct reset ability)
- Q: What operational signals beyond audit logs? → A: Business metrics + health alerts (certification rates, sync failures, errors)
- Q: Expected scale for initial deployment? → A: Medium (100-500 BDRs, teams of 5-20 members)

## Overview

This specification defines the BDR (Business Development Representative) certification system for the AI Sales Trainer module within DiliTrust's LMS. The system tracks learner progression through four certification levels (Bronze, Silver, Gold, Platinum), gates persona access based on demonstrated competency, awards badges for achievements, and synchronizes progress with the existing LMS infrastructure.

### Dependencies

- **Spec 004**: Sessions, personas, scenarios - provides session completion events
- **Spec 009**: Scoring system - provides evaluation results for pass/fail determination
- **Existing LMS API**: External integration point for progress synchronization

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Certification Progress Tracking (Priority: P1)

As a BDR, I want to see my progress toward the next certification level, so that I know what I need to achieve.

**Why this priority**: This is the core value proposition - BDRs need visibility into their progression path. Without progress tracking, the entire certification system lacks transparency and motivation.

**Independent Test**: Can be fully tested by displaying a dashboard showing current level, progress bar toward next level, and persona unlock status. Delivers immediate value by showing learners where they stand.

**Acceptance Scenarios**:

1. **Given** a BDR with Bronze certification and 1 passed evaluation, **When** they view the certification page, **Then** they see "Silver" as next level with progress "1/2 evaluations passed" and score requirement "70 minimum"
2. **Given** a BDR with no certifications, **When** they view the certification page, **Then** they see Bronze requirements: "Complete onboarding + 3 free practice sessions"
3. **Given** a BDR at any level, **When** they view the personas section, **Then** unlocked personas show as accessible and locked personas display the required certification level
4. **Given** a BDR who just earned a new certification, **When** they view the certification page, **Then** their current level is updated and newly unlocked personas are highlighted

---

### User Story 2 - Certification Evaluation Flow (Priority: P1)

As a BDR, I want to take certification evaluations when ready, so that I can advance to the next level.

**Why this priority**: Evaluations are the mechanism for advancement - without them, progression is impossible. This is tied with US1 as foundational.

**Independent Test**: Can be fully tested by initiating an evaluation, completing a session, and receiving pass/fail result with feedback. Delivers value by enabling actual progression.

**Acceptance Scenarios**:

1. **Given** a BDR with Bronze certification ready to attempt Silver, **When** they start a certification evaluation, **Then** the system assigns an appropriate scenario and marks the session as "evaluation mode"
2. **Given** a BDR who completes an evaluation with score 75, **When** results are processed, **Then** they see "PASSED" with detailed score breakdown and the evaluation counts toward certification
3. **Given** a BDR who completes an evaluation with score 65, **When** results are processed, **Then** they see "NOT PASSED" with feedback on improvement areas and next attempt availability
4. **Given** a BDR who attempted an evaluation 12 hours ago, **When** they try to retake the same scenario, **Then** they see "Cooldown active: 12 hours remaining" and cannot start
5. **Given** a BDR without Bronze certification, **When** they try to start a Silver evaluation, **Then** they see "Prerequisite required: Complete Bronze certification first"

---

### User Story 3 - Persona Access Control (Priority: P2)

As a BDR, I want to access progressively challenging personas as I earn certifications, so that my training difficulty matches my skill level.

**Why this priority**: Persona gating is the primary reward mechanism and ensures appropriate difficulty progression. Depends on certification tracking (US1).

**Independent Test**: Can be fully tested by attempting to start sessions with different personas and verifying access is granted/denied based on certification level.

**Acceptance Scenarios**:

1. **Given** a BDR with Bronze certification, **When** they select "Enthusiastic Champion" persona, **Then** the session starts successfully
2. **Given** a BDR with Bronze certification, **When** they try to select "Skeptical Analyst" persona, **Then** they see "Requires Silver certification" and cannot start
3. **Given** a BDR who just earned Silver, **When** they view personas, **Then** "Skeptical Analyst" and "Aggressive Negotiator" become accessible
4. **Given** a BDR with Gold certification, **When** they view all personas, **Then** only "CEO ROI-Focused" shows as locked (requires Platinum)

---

### User Story 4 - Badge Achievements (Priority: P2)

As a BDR, I want to earn badges for achievements, so that I feel recognized for my progress.

**Why this priority**: Badges provide immediate positive reinforcement and engagement. Lower priority than core progression but essential for motivation.

**Independent Test**: Can be fully tested by completing actions that trigger badges and verifying notification + profile display.

**Acceptance Scenarios**:

1. **Given** a BDR who completes their first session, **When** the session ends, **Then** they receive "First Session" badge notification
2. **Given** a BDR who earns a badge, **When** they view their profile, **Then** the badge appears with earned date
3. **Given** a BDR who scores 85+ on SPIN dimension for the 3rd time, **When** the evaluation completes, **Then** they receive "SPIN Master" badge
4. **Given** a BDR viewing their badge history, **When** they select a badge, **Then** they see criteria met and date earned

---

### User Story 5 - LMS Progress Synchronization (Priority: P2)

As a BDR, I want my AI Trainer progress to count toward my LMS course completion, so that I don't have duplicate tracking.

**Why this priority**: Integration prevents confusion and ensures the AI Trainer fits seamlessly into existing workflows. Critical for adoption but depends on core certification logic.

**Independent Test**: Can be fully tested by completing AI Trainer lessons and verifying LMS shows updated completion percentage and badges.

**Acceptance Scenarios**:

1. **Given** a BDR who completes "Introduction to AI Training" lesson, **When** the lesson ends, **Then** LMS Module 3 progress updates within 5 seconds
2. **Given** a BDR who earns Silver certification, **When** certification is awarded, **Then** LMS profile shows Silver badge and certification status
3. **Given** a manager viewing LMS reports, **When** they filter by AI Trainer module, **Then** they see all team members' certification levels and scores
4. **Given** a sync failure occurs, **When** retry succeeds, **Then** all pending events are synchronized idempotently (no duplicate progress)

---

### User Story 6 - Team Certification Dashboard (Priority: P3)

As a Team Lead, I want to see my team's certification status, so that I can identify who needs support.

**Why this priority**: Management visibility is valuable but not essential for individual BDR functionality. Depends on all other user stories being functional.

**Independent Test**: Can be fully tested by viewing a dashboard with mock team data showing certification distribution and stalled learners.

**Acceptance Scenarios**:

1. **Given** a Team Lead with 10 team members, **When** they view the team dashboard, **Then** they see certification level distribution (e.g., 3 Bronze, 5 Silver, 2 Gold)
2. **Given** a team member who hasn't progressed in 3 weeks, **When** Team Lead views dashboard, **Then** that member is flagged as "stalled"
3. **Given** a Team Lead, **When** they filter by "close to next level", **Then** they see members within 1 evaluation of advancement
4. **Given** a Team Lead, **When** they select a team member, **Then** they see detailed progress history and recent evaluation scores

---

### Edge Cases

- What happens when a BDR completes an evaluation during a system outage? Events are queued and processed on recovery; no data is lost.
- How does the system handle concurrent evaluation attempts from the same user? Second attempt is rejected with "Evaluation already in progress" message.
- What if scoring service (Spec 009) is unavailable? Evaluation session completes but certification update is deferred until scoring completes; BDR is notified of delay.
- What happens if LMS sync fails repeatedly? Retry with exponential backoff (max 5 attempts); alert operations team; BDR sees "Sync pending" status.
- How are certification requirements handled if they change? Existing certifications are grandfathered; only new attempts follow updated requirements.
- What if a BDR attempts evaluation cooldown bypass via multiple browsers? Cooldown is enforced server-side per user + scenario combination.

## Requirements *(mandatory)*

### Functional Requirements

#### Certification Level Management

- **FR-001**: System MUST track four certification levels: Bronze (1), Silver (2), Gold (3), Platinum (4)
- **FR-002**: System MUST enforce level-specific requirements:
  - Bronze: Complete onboarding + 3 free practice sessions
  - Silver: Pass 2 evaluations on different scenarios with score >= 70
  - Gold: Pass 4 evaluations on all scenarios with score >= 75
  - Platinum: Pass 2 evaluations with distinction (score >= 85) + have CEO persona unlocked
- **FR-003**: System MUST prevent certification downgrades - levels can only increase
- **FR-004**: System MUST log all certification changes with timestamp, previous level, new level, and triggering event

#### Evaluation Management

- **FR-005**: System MUST enforce 24-hour cooldown per scenario between evaluation attempts
- **FR-006**: System MUST prevent evaluation attempts without prerequisite certifications
- **FR-007**: System MUST assign scenarios appropriate to the target certification level
- **FR-008**: System MUST provide immediate pass/fail feedback with detailed score breakdown
- **FR-009**: System MUST allow System Admins and Team Leads to reset cooldowns for users (with audit logging including actor, target user, scenario, and reason)

#### Persona Access Control

- **FR-010**: System MUST gate persona access based on certification level:
  - Bronze: Enthusiastic Champion, Political Cautious, Pressured Executive, Technical Detailist
  - Silver: Skeptical Analyst, Aggressive Negotiator (plus Bronze personas)
  - Gold: Risk-Averse Legal (plus Silver personas)
  - Platinum: CEO ROI-Focused (plus Gold personas)
- **FR-011**: System MUST prevent session starts with locked personas
- **FR-012**: System MUST display unlock requirements for locked personas

#### Badge System

- **FR-013**: System MUST award badges based on defined criteria:
  - First Session: Complete 1 session
  - SPIN Master: Score >= 85 on SPIN dimension 3 times
  - Objection Handler: Handle 10 objections with RACC score >= 80
  - Consistent Performer: 5 sessions with overall score >= 70
  - Certification badges: Bronze, Silver, Gold, Platinum (on level achievement)
- **FR-014**: System MUST notify users immediately when badges are earned
- **FR-015**: System MUST display earned badges on user profile with earned date
- **FR-016**: System MUST track badge criteria progress (e.g., "2/3 SPIN scores at 85+")

#### LMS Integration

- **FR-017**: System MUST synchronize session completions to LMS as lesson progress
- **FR-018**: System MUST synchronize certification level changes to LMS profile
- **FR-019**: System MUST synchronize badge awards to LMS badge system
- **FR-020**: System MUST handle sync failures gracefully with retry and idempotent updates
- **FR-021**: System MUST expose AI Trainer progress in LMS reports for manager visibility

#### Team Dashboard

- **FR-022**: System MUST display certification distribution for a manager's team
- **FR-023**: System MUST identify team members with no progress in 2+ weeks as "stalled"
- **FR-024**: System MUST allow filtering by certification level and progress status
- **FR-025**: System MUST show detailed progress view for individual team members

#### Audit & Compliance

- **FR-026**: System MUST log all certification changes, badge awards, and admin actions
- **FR-027**: System MUST record admin cooldown resets with reason
- **FR-028**: System MUST preserve audit history indefinitely (no deletion)

#### Observability

- **FR-029**: System MUST expose business metrics: certification rate by level, badge award rate, evaluation pass/fail ratio, average time-to-certification
- **FR-030**: System MUST track LMS sync health: success rate, failure count, average latency, pending sync queue size
- **FR-031**: System MUST generate alerts for: sync failure rate >5%, evaluation service errors, audit log write failures
- **FR-032**: System MUST provide an operations dashboard showing real-time sync status and error summary

### Key Entities

- **Certification**: Represents a BDR's current certification level (Bronze/Silver/Gold/Platinum) with earned date, triggering evaluation, and level history
- **EvaluationAttempt**: Records each certification evaluation attempt with scenario, score, pass/fail result, and timestamp
- **PersonaUnlock**: Maps certification levels to accessible personas with unlock requirements
- **Badge**: Defines badge types, criteria, and visual representation
- **BadgeAward**: Records when a specific badge was earned by a user with criteria snapshot
- **CertificationAuditLog**: Immutable record of all certification changes and admin actions
- **LMSSyncEvent**: Tracks synchronization events with LMS (status, retry count, last attempt)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of BDRs achieve Bronze certification within their first 2 weeks of using the AI Trainer
- **SC-002**: Progress synchronization between AI Trainer and LMS completes within 5 seconds of triggering event
- **SC-003**: Zero data inconsistencies between AI Trainer certification records and LMS certification display (measured by daily reconciliation)
- **SC-004**: 70% of earned badges are viewed by the earning user within 24 hours (badge engagement)
- **SC-005**: Team Leads can identify all stalled team members (no progress in 2+ weeks) within 30 seconds of accessing dashboard
- **SC-006**: BDRs complete the certification evaluation flow (start to result) in under 20 minutes average
- **SC-007**: 80% of BDRs who earn Bronze proceed to attempt Silver within 4 weeks (progression engagement)
- **SC-008**: System handles evaluation cooldown correctly with zero bypass incidents

## Business Rules

### BR-001: Evaluation Cooldown
- 24-hour cooldown between evaluation attempts per scenario (not global)
- Cooldown starts when evaluation session ends (regardless of pass/fail)
- System Admins and Team Leads can reset cooldowns for their scope (Team Leads only for their team members); action is logged with mandatory reason field

### BR-002: Certification Persistence
- Certifications never expire once earned
- Certifications never downgrade (only upward movement)
- If certification requirements change, existing certifications are grandfathered
- Learners in progress toward a level at time of change can complete under old requirements for 30 days

### BR-003: Prerequisite Enforcement
- Silver evaluation requires Bronze certification
- Gold evaluation requires Silver certification
- Platinum evaluation requires Gold certification
- LMS Module 3 (AI Sales Trainer) requires Module 2 completion

### BR-004: Scenario Distinctness for Certification
- Silver: 2 evaluations must be on different scenarios
- Gold: 4 evaluations must cover all available scenarios
- Platinum: 2 distinction evaluations can be on any scenarios (repeats allowed)

### BR-005: Badge Award Idempotency
- Each badge can only be earned once per user
- Criteria progress resets after badge is awarded (for badges with counters)
- Badge award triggers LMS sync event

## Assumptions

- Existing LMS API supports the required events (session_completed, certification_earned, badge_awarded)
- Spec 004 (Sessions) provides session completion events that this system consumes
- Spec 009 (Scoring) provides evaluation scores within the same request/response cycle
- Onboarding completion is determined by existing LMS module completion status
- Team Lead role and team membership are defined in existing authentication/authorization system
- All 8 personas defined in the persona unlock table exist and are configured in Spec 004
- **Scale assumptions**: 100-500 concurrent BDRs, teams of 5-20 members, up to 50 concurrent evaluation sessions, ~1000 badge awards per month

## Constraints

- LMS sync must be idempotent to handle network failures and retries
- Certification level changes must be atomic (no partial updates)
- Audit logs must be immutable (append-only)
- Cooldown enforcement must be server-side (client-side can be bypassed)

## Out of Scope

- Custom certification paths per organization (planned for Phase 2)
- External certification exports (PDF certificates)
- Peer-to-peer badge gifting
- Gamification leaderboards (separate spec if needed)
- Integration with external certification bodies
- Mobile push notifications for badges (use in-app notifications only)
