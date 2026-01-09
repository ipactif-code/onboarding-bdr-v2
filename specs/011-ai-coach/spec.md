# Feature Specification: AI Coach Module (M7)

**Feature Branch**: `011-ai-coach`
**Created**: 2026-01-09
**Status**: Draft
**Input**: User description: "Build the AI Coach module M7 that provides personalized post-session coaching, training plan recommendations, and ongoing mentorship based on BDR performance patterns."

## Clarifications

### Session 2026-01-09

- Q: How long should coaching conversations be retained before automatic deletion? → A: 90 days retention, then automatically deleted
- Q: What is the expected response latency for Coach messages? → A: Coach responds within 5 seconds for typical messages

## Overview

The AI Coach ("Alex") is a persistent AI coaching assistant integrated into the AI Sales Trainer system. It transforms raw session scores and performance data into actionable guidance, personalized training paths, and ongoing mentorship for BDRs. The coach operates in multiple modes: immediate post-session debriefs, on-demand training plan generation, weekly progress check-ins, and anytime Q&A support.

### Coach Personality

- **Name**: "Alex" (gender-neutral, works in all 5 supported languages)
- **Tone**: Supportive but direct, like a senior sales mentor
- **Style**: Asks questions to guide discovery rather than lecturing
- **Languages**: French, English, Italian, Spanish, German

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Post-Session Debrief (Priority: P1)

As a BDR who has just completed a training session, I want to have a conversational debrief with my AI Coach so that I understand specifically what I did well and what to improve based on my actual performance.

**Why this priority**: This is the core coaching experience that drives immediate learning. It provides value at the exact moment when feedback is most impactful - right after practice. Every BDR completing a session benefits from this feature.

**Independent Test**: Can be fully tested by completing a scored session and initiating a debrief conversation. Delivers immediate, personalized feedback referencing specific transcript moments.

**Acceptance Scenarios**:

1. **Given** a BDR has completed a scored training session, **When** the session ends, **Then** the Coach debrief option appears immediately with a greeting in the BDR's preferred language.

2. **Given** a BDR initiates a debrief conversation, **When** the Coach responds, **Then** it references at least one specific moment from the session transcript that went well and one area for improvement.

3. **Given** a BDR asks a follow-up question about their performance (e.g., "Why was my objection handling weak?"), **When** the Coach responds, **Then** it provides specific examples from the session transcript and actionable suggestions.

4. **Given** a BDR is in a debrief conversation, **When** they have exchanged 10 messages, **Then** the Coach signals the conversation is concluding and offers a summary.

5. **Given** a BDR wants to exit the debrief early, **When** they dismiss the conversation, **Then** it closes without requiring further interaction and no data is lost.

---

### User Story 2 - Ask the Coach (Priority: P2)

As a BDR, I want to ask my AI Coach questions at any time so that I can get help with sales techniques, practice RACC responses for specific objections, or get scenario recommendations when I need them.

**Why this priority**: Provides on-demand support that helps BDRs between sessions. This is the most flexible coaching mode and drives ongoing engagement with the platform.

**Independent Test**: Can be tested by opening the Coach from any screen, asking questions about techniques or objections, and verifying helpful, context-aware responses.

**Acceptance Scenarios**:

1. **Given** a BDR is on any screen in the application, **When** they tap "Ask Coach", **Then** a coaching conversation interface opens.

2. **Given** a BDR asks about a sales technique (e.g., "How do I handle the 'we already have a solution' objection?"), **When** the Coach responds, **Then** it provides a structured answer with the RACC framework and concrete examples.

3. **Given** a BDR asks for scenario recommendations (e.g., "What should I practice next?"), **When** the Coach responds, **Then** it recommends specific scenarios based on the BDR's recent session performance and skill gaps.

4. **Given** a BDR has an ongoing conversation, **When** they return later, **Then** they can view their conversation history.

5. **Given** a BDR has exchanged 20 messages in a single conversation, **When** they try to send another message, **Then** the Coach indicates the conversation limit is reached and suggests starting a new conversation.

---

### User Story 3 - Personalized Training Plan (Priority: P3)

As a BDR with at least 5 completed sessions, I want to request a customized multi-week training plan so that I can systematically improve my weakest areas with targeted practice.

**Why this priority**: Provides structured long-term improvement paths. Requires sufficient session history to generate meaningful recommendations, so fewer users will initially qualify.

**Independent Test**: Can be tested by a BDR with 5+ sessions requesting a plan and receiving a multi-week training program with specific scenarios, personas, and weekly goals.

**Acceptance Scenarios**:

1. **Given** a BDR has completed 5 or more sessions, **When** they request a training plan, **Then** the Coach generates a personalized plan based on analysis of their last 10 sessions (or all sessions if fewer than 10).

2. **Given** a training plan is generated, **When** the BDR views it, **Then** it identifies the top 3 skill gaps, recommends specific scenarios and personas for each week, and includes measurable weekly checkpoints.

3. **Given** a BDR has fewer than 5 sessions, **When** they try to request a training plan, **Then** the system informs them they need more sessions and shows their current count.

4. **Given** a BDR has an existing training plan and completes more sessions, **When** they request an updated plan, **Then** the Coach generates a new plan reflecting their progress.

5. **Given** a training plan has been generated, **When** the BDR views their weekly goals, **Then** they can track which goals are completed and which are pending.

---

### User Story 4 - Weekly Progress Check-In (Priority: P4)

As a BDR, I want to receive weekly coaching check-ins so that I stay motivated, see my progress trends, and keep my training on track.

**Why this priority**: Drives consistent engagement and helps maintain motivation over time. Depends on having accumulated weekly activity data to be meaningful.

**Independent Test**: Can be tested by triggering a Monday notification, entering the check-in conversation, and verifying weekly summary and comparison data.

**Acceptance Scenarios**:

1. **Given** it is Monday and a BDR has completed at least one session in the past week, **When** they open the application, **Then** they receive a notification prompting them to do their weekly check-in.

2. **Given** a BDR enters their weekly check-in, **When** the Coach summarizes their week, **Then** it shows number of sessions completed, average score, and comparison to the previous week (improvement/decline percentage).

3. **Given** a BDR is in a check-in conversation, **When** they have exchanged 5 messages, **Then** the Coach wraps up with an encouraging message and next week's focus.

4. **Given** a BDR doesn't want to do the check-in, **When** they dismiss the notification, **Then** it disappears and doesn't reappear until next Monday.

5. **Given** a BDR has an active training plan, **When** the weekly check-in occurs, **Then** the Coach references progress against the training plan goals.

---

### User Story 5 - Coach Language Preference (Priority: P5)

As a BDR, I want my AI Coach to communicate in my preferred language so that coaching feels natural and I can engage more effectively.

**Why this priority**: Essential for user experience but not blocking core functionality. Language preference is inherited from LMS settings.

**Independent Test**: Can be tested by setting language preference to each supported language and verifying Coach responses use appropriate localized messages.

**Acceptance Scenarios**:

1. **Given** a BDR has set French as their LMS language preference, **When** the Coach initiates any conversation, **Then** all messages use French language templates and the Coach responds in French.

2. **Given** a BDR changes their language preference from English to Spanish, **When** they start a new Coach conversation, **Then** the Coach immediately uses Spanish.

3. **Given** the Coach is in a debrief conversation, **When** it recognizes a strength, **Then** it uses the localized template: "I noticed you handled {moment} really well. That's exactly what you should do." (or equivalent in the BDR's language).

4. **Given** any coaching mode, **When** the Coach provides improvement suggestions, **Then** the personality and tone remain consistent regardless of language (supportive but direct).

---

### Edge Cases

- What happens when a session has no transcript (technical failure)? Coach acknowledges limited data and provides general guidance based on scores only.
- How does the system handle a BDR with no recent sessions asking for recommendations? Coach explains it needs session data and suggests completing a practice session.
- What happens if the Coach AI service is unavailable? Users see a friendly error message with retry option; no partial conversations are saved.
- What happens when a BDR's language preference is not one of the 5 supported languages? Default to English with a notification that their preferred language is not yet supported.
- How does the system handle concurrent coaching conversations (e.g., debrief and ask coach open simultaneously)? Only one conversation type can be active at a time; starting a new conversation closes the previous one with a confirmation prompt.

## Requirements *(mandatory)*

### Functional Requirements

#### Conversation Management

- **FR-001**: System MUST support four distinct coaching modes: Post-Session Debrief, Training Plan Generator, Weekly Progress Check-In, and Ask the Coach.
- **FR-002**: System MUST maintain conversation state across multiple exchanges within a single session.
- **FR-003**: System MUST persist conversation history so BDRs can review past coaching conversations.
- **FR-004**: System MUST enforce conversation exchange limits per mode: Debrief (10), Weekly Check-In (5), Ask Coach (20).
- **FR-005**: System MUST allow only one active coaching conversation at a time per BDR.

#### Context and Personalization

- **FR-006**: System MUST provide the Coach with access to the BDR's last 10 sessions (or all if fewer) including scores and transcripts.
- **FR-007**: System MUST provide the Coach with the BDR's current certification level and progress toward next level.
- **FR-008**: Coach MUST reference specific transcript moments when discussing strengths and improvements in debriefs.
- **FR-009**: System MUST use the BDR's LMS language preference for all Coach communications.

#### Post-Session Debrief

- **FR-010**: System MUST offer a debrief option immediately when a scored session ends.
- **FR-011**: Coach MUST identify at least one strength and one improvement area from each session.
- **FR-012**: BDR MUST be able to ask follow-up questions about their performance.
- **FR-013**: BDR MUST be able to dismiss or save debriefs.

#### Training Plan

- **FR-014**: System MUST only allow training plan generation for BDRs with 5+ completed sessions.
- **FR-015**: Training plan MUST identify top 3 skill gaps based on session analysis.
- **FR-016**: Training plan MUST recommend specific scenarios and personas for practice.
- **FR-017**: Training plan MUST include weekly goals with trackable checkpoints.
- **FR-018**: BDR MUST be able to request updated plans as they progress.

#### Weekly Check-In

- **FR-019**: System MUST trigger weekly check-in notifications on Mondays.
- **FR-020**: BDR MUST be able to dismiss check-in notifications without engaging.
- **FR-021**: Check-in MUST summarize weekly session count, average score, and week-over-week comparison.
- **FR-022**: Check-in MUST complete within 5 exchanges (quick interaction).

#### Ask the Coach

- **FR-023**: "Ask Coach" option MUST be accessible from any screen in the application.
- **FR-024**: Coach MUST answer questions about sales techniques using the RACC framework.
- **FR-025**: Coach MUST help BDRs practice responses to specific objections.
- **FR-026**: Coach MUST recommend scenarios based on BDR questions and performance history.

#### Privacy

- **FR-027**: Coach MUST only access data belonging to the requesting BDR.
- **FR-028**: Team Leads MUST NOT have access to view coaching conversations.
- **FR-029**: Session transcripts used for coaching MUST NOT be shared outside the coaching context.

#### Data Retention

- **FR-030**: System MUST automatically delete coaching conversations after 90 days from creation.
- **FR-031**: System MUST notify BDRs before conversation deletion if they have unviewed summaries.

### Non-Functional Requirements

#### Performance

- **NFR-001**: Coach MUST respond to user messages within 5 seconds for typical interactions (single question/answer exchanges).
- **NFR-002**: Training plan generation MAY take up to 15 seconds due to analysis complexity; system MUST show a progress indicator.

### Key Entities

- **CoachConversation**: A coaching interaction between a BDR and the AI Coach. Contains conversation type (debrief/checkin/ask/plan), message history, timestamps, language, and associated session reference (if debrief).
- **CoachMessage**: An individual message in a conversation. Contains sender (coach/bdr), content, timestamp, and any referenced transcript excerpts.
- **TrainingPlan**: A personalized multi-week training program. Contains skill gaps identified, weekly goals with target scenarios/personas, creation date, and completion status per goal.
- **WeeklyCheckIn**: A record of weekly progress summaries. Contains session count, average score, week comparison data, and any plan progress notes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 70% of BDRs who complete a scored session engage with the post-session debrief within the first month of launch.
- **SC-002**: Training plan user satisfaction rating exceeds 80% (measured via in-app survey after plan generation).
- **SC-003**: Each coaching interaction costs less than $0.05 on average (AI API costs).
- **SC-004**: Coach responses are rated as "personalized" (not generic) by 80%+ of surveyed users.
- **SC-005**: Weekly check-in interactions complete in under 5 minutes on average.
- **SC-006**: 60% of BDRs who receive a training plan complete at least one recommended scenario within 7 days.

## Assumptions

- BDRs have an existing language preference set in their LMS profile.
- Session transcripts are available from Spec 004 and scores from Spec 009.
- Certification level data is available from Spec 010.
- The system will use a cost-effective AI model suitable for conversational coaching.
- Monday check-in timing refers to the BDR's local timezone.
- The RACC framework (for objection handling) is already defined in the organization's sales methodology.

## Dependencies

- **Spec 004 (Session History)**: Required for accessing past session data and transcripts.
- **Spec 006 (M1/M3 Performance Data)**: Required for behavior analysis patterns.
- **Spec 009 (Scoring & Evaluation)**: Required for session scores and skill-level assessments.
- **Spec 010 (Certification System)**: Required for certification level context in coaching tone.

## Out of Scope

- Voice-based coaching conversations (text only for V1).
- Team-wide coaching insights or analytics for managers.
- Integration with external coaching platforms.
- Custom coach personalities or names per organization.
- Real-time coaching during active sessions (covered by Spec 007).
