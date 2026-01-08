# Feature Specification: Praiz Video Processing Pipeline

**Feature Branch**: `008-praiz-pipeline`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "Build the Praiz video processing pipeline that extracts winning sales patterns, objections, and RACC responses from real DiliTrust sales calls to enrich AI prospect personas."

## Overview

This specification covers the batch processing of Praiz video recordings (DiliTrust's call recording platform) to extract actionable sales intelligence. The pipeline analyzes real sales calls to build an Objection Library with RACC-structured responses that makes AI training personas more realistic.

**Pattern Extraction Focus**:
- **Winning Phrases**: Sentences that led to positive prospect reactions
- **Objection Patterns**: Real objections prospects raise in sales calls
- **RACC Responses**: How top performers handle objections (Reframe, Address, Confirm, Close)
- **Buying Signals**: Phrases indicating prospect interest
- **Failure Patterns**: What NOT to do (from lost deals)

**Processing Segmentation by Outcome**:
- Won deals: Extract winning patterns
- Lost deals: Extract failure patterns (what to avoid)
- Stalled deals: Extract unresolved objections

## Clarifications

### Session 2026-01-08

- Q: What is the monthly processing budget for video analysis? → A: $500/month (~1,000 videos at $0.50 each)
- Q: How long should extracted patterns and processing logs be retained? → A: Patterns indefinitely with freshness flags; logs for 12 months
- Q: Who can validate (approve/edit/reject) extracted objections? → A: Admins and sales enablement managers
- Q: What operational metrics should be tracked for pipeline health? → A: Key metrics (throughput, error rates, cost per video, queue depth)

## Dependencies

This specification depends on:
- **Spec 004**: Session infrastructure and persona data to enrich
- **Spec 005**: Context Builder to inject Praiz patterns into AI conversations

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Batch Video Processing (Priority: P1)

As a system administrator, I want to process Praiz video batches, so that the objection library stays current with real sales interactions.

**Why this priority**: The pipeline is the foundation that populates the objection library. Without processing videos, no patterns exist for other features to use.

**Independent Test**: Can be tested by triggering a batch process for a date range of videos and verifying extracted patterns appear in the processing log with confidence scores.

**Acceptance Scenarios**:

1. **Given** I am an admin with Praiz access, **When** I trigger processing for a date range (e.g., last 30 days), **Then** the system queues all videos in that range for processing

2. **Given** videos are in the processing queue, **When** the batch processor runs, **Then** each video is transcribed, analyzed, and patterns are extracted with confidence scores

3. **Given** a video is in French or English (priority languages), **When** it is processed, **Then** patterns are extracted in the original language

4. **Given** pattern extraction fails for a video, **When** the error occurs, **Then** the failure is logged with video ID and error details for review

5. **Given** the system has processed 50 videos in the current hour, **When** more videos are queued, **Then** processing waits until the next hour (rate limiting)

6. **Given** the monthly budget is at 80% utilization, **When** new processing is requested, **Then** an alert is sent to administrators

---

### User Story 2 - Objection Library Management (Priority: P2)

As a sales enablement manager, I want to review and validate extracted objections, so that only quality patterns are used in training.

**Why this priority**: Human validation ensures quality. Without validation, low-confidence or incorrect patterns could degrade training quality.

**Independent Test**: Can be tested by viewing the validation queue, approving/editing/rejecting entries, and verifying status changes.

**Acceptance Scenarios**:

1. **Given** patterns have been extracted from videos, **When** I view the validation queue, **Then** I see unvalidated objections sorted by extraction date

2. **Given** I am reviewing an objection entry, **When** I approve it, **Then** it becomes available for AI personas to use

3. **Given** I am reviewing an objection entry, **When** I reject it, **Then** it is marked as rejected and excluded from the library

4. **Given** an objection lacks a RACC response, **When** I edit it, **Then** I can add the complete RACC structure (Reframe, Address, Confirm, Close)

5. **Given** an objection has a partial RACC response, **When** I edit it, **Then** I can improve or complete the missing components

6. **Given** an objection has confidence score above 0.85, **When** it is extracted, **Then** it is auto-approved but flagged for optional review

7. **Given** an objection has confidence score between 0.7 and 0.85, **When** it is extracted, **Then** it requires manual validation before approval

8. **Given** an objection has confidence score below 0.7, **When** it is extracted, **Then** it is auto-rejected and logged for prompt improvement

---

### User Story 3 - Pattern Injection in Training (Priority: P3)

As a BDR in a training session, I want the AI prospect to use real objections from our sales calls, so that my practice reflects actual customer concerns.

**Why this priority**: This delivers the user-facing value of realistic training. Depends on US1 and US2 to populate and validate the library.

**Independent Test**: Can be tested by starting a training session and observing that the AI prospect raises objections that match the persona type, DiliTrust module, and scenario context.

**Acceptance Scenarios**:

1. **Given** validated objections exist in the library, **When** an AI persona needs to raise an objection, **Then** it selects from the library based on context matching

2. **Given** a training session is for CLM module with a skeptical persona, **When** the AI raises an objection, **Then** the objection matches CLM context and skeptical persona type

3. **Given** the library contains objections with varying effectiveness scores, **When** the AI selects an objection, **Then** higher effectiveness objections are weighted more heavily

4. **Given** an objection was validated today, **When** a training session starts tomorrow, **Then** the new objection is available for the AI to use (within 24 hours)

5. **Given** the library has objections in multiple languages, **When** a session is in French, **Then** only French objections are used

---

### User Story 4 - Effectiveness Tracking (Priority: P4)

As a sales enablement manager, I want to see which objection responses are most effective, so that I can improve our sales playbook.

**Why this priority**: Analytics and reporting enhance the system but are not required for core training functionality.

**Independent Test**: Can be tested by viewing usage statistics for objections and verifying metrics match actual usage in training sessions.

**Acceptance Scenarios**:

1. **Given** objections have been used in training sessions, **When** I view the analytics dashboard, **Then** I see usage count per objection

2. **Given** training sessions have outcomes recorded, **When** I view RACC response effectiveness, **Then** I see which responses correlate with positive session outcomes

3. **Given** I have identified top-performing patterns, **When** I export the data, **Then** I receive a formatted export suitable for sales training materials

4. **Given** an objection was validated over 12 months ago, **When** I view the library, **Then** it is flagged for freshness review

5. **Given** a new quarter has started, **When** I view usage data, **Then** quarterly usage counters have been reset for relevance tracking

---

### Edge Cases

- What happens when a Praiz video has no transcript available? (Video is skipped and logged; admin can manually trigger re-processing later)
- What happens when a video contains only one speaker? (Marked as non-sales-call; excluded from pattern extraction)
- How does the system handle videos with multiple languages spoken? (Primary language is detected; secondary language segments are noted but not processed in V1)
- What happens when PII is detected in extracted patterns? (Anonymization runs automatically; customer names and company names are replaced with placeholders)
- What happens when the Praiz API is unavailable? (Processing pauses; retries with exponential backoff; admin alerted after 3 failures)
- How does the system handle duplicate objections? (Verbatim variants are grouped under a single objection entry; duplicates increase confidence)

## Requirements *(mandatory)*

### Functional Requirements

#### Batch Processing

- **FR-001**: System MUST process Praiz videos in configurable batches, not in real-time
- **FR-002**: System MUST enforce a rate limit of 50 videos per hour to control costs
- **FR-003**: System MUST alert administrators when monthly budget ($500/month default) reaches 80% utilization ($400)
- **FR-004**: System MUST log all processing attempts with video ID, status, and any errors
- **FR-005**: System MUST support scheduling batch processing for specific date ranges

#### Transcription & Analysis

- **FR-006**: System MUST retrieve video transcripts from Praiz API or generate transcription if unavailable
- **FR-007**: System MUST detect the primary language of each video from metadata or content analysis
- **FR-008**: System MUST support French and English as priority languages for V1
- **FR-009**: System MUST support Italian, Spanish, and German as secondary languages for V1
- **FR-010**: System MUST use AI model for pattern extraction and analysis

#### Pattern Extraction

- **FR-011**: System MUST extract objection patterns with verbatim text and variant phrasings
- **FR-012**: System MUST categorize objections into defined categories (existing_solution, price, timing, competition, complexity, authority, budget, security, integration)
- **FR-013**: System MUST associate extracted patterns with context (DiliTrust module, persona type, scenario type)
- **FR-014**: System MUST extract RACC-structured responses when present in transcripts
- **FR-015**: System MUST assign confidence scores (0-1) to all extracted patterns
- **FR-016**: System MUST link every pattern to its source video with timestamp

#### Privacy & Compliance

- **FR-017**: System MUST NOT store PII in extracted patterns
- **FR-018**: System MUST anonymize customer names and company names in all extractions
- **FR-019**: System MUST maintain source attribution for audit purposes (video ID, timestamp)

#### Validation Workflow

- **FR-020**: System MUST auto-approve patterns with confidence above 0.85 (flagged for review)
- **FR-021**: System MUST require manual validation for patterns with confidence between 0.7 and 0.85
- **FR-022**: System MUST auto-reject patterns with confidence below 0.7
- **FR-023**: System MUST allow admins and sales enablement managers to approve, edit, or reject pending objections
- **FR-024**: System MUST allow admins and sales enablement managers to add or improve RACC responses on any objection
- **FR-025**: System MUST make approved objections immediately available for AI personas

#### Library Management

- **FR-026**: System MUST flag objections older than 12 months for freshness review
- **FR-027**: System MUST reset quarterly usage counters at the start of each quarter
- **FR-028**: System MUST track usage count and effectiveness score per objection
- **FR-029**: System MUST support filtering library by language, category, module, and persona type
- **FR-029a**: System MUST retain objection patterns indefinitely (with 12-month freshness flags per FR-026)
- **FR-029b**: System MUST retain processing logs and extraction logs for 12 months, then auto-archive or delete

#### Integration

- **FR-030**: System MUST integrate with Spec 005 Context Builder to inject patterns into AI conversations
- **FR-031**: System MUST provide objection selection weighted by effectiveness score
- **FR-032**: System MUST match objections to training context (module, persona type, scenario type, language)

#### Observability

- **FR-033**: System MUST track processing throughput metrics (videos processed per hour, per day, per batch)
- **FR-034**: System MUST track error rates per processing job and aggregate error rates over time
- **FR-035**: System MUST track cost per video processed and cumulative monthly cost
- **FR-036**: System MUST track queue depth for pending videos and processing backlog

### Key Entities

- **PraizVideo**: Source video record with ID, URL, language, deal outcome (won/lost/stalled), processing status, and metadata
- **ProcessingJob**: Batch job record with date range, status, videos processed, errors, and cost tracking
- **ObjectionEntry**: Central library record containing verbatim objection text, variants, category, context metadata, RACC response, source attribution, confidence score, validation status, usage count, and effectiveness score
- **ExtractionLog**: Record of each extraction attempt with video ID, extracted patterns, confidence scores, and any errors
- **ValidationAction**: Audit trail of validation decisions (approve/edit/reject) with user, timestamp, and changes

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Greater than 80% of extracted objections are validated as accurate by human reviewers
- **SC-002**: Average processing cost is less than $0.50 per video
- **SC-003**: Objection library reaches 100+ validated entries within 4 weeks of deployment
- **SC-004**: Greater than 75% of BDRs report AI objections feel "realistic" in post-session surveys
- **SC-005**: Pattern extraction completes within 5 minutes per video on average
- **SC-006**: System processes 50 videos per hour without errors during peak batch runs
- **SC-007**: New validated objections are available in training sessions within 24 hours

## Assumptions

- Praiz API provides access to video transcripts or raw video for transcription
- Videos have reliable speaker diarization (BDR vs. prospect identified)
- Deal outcome (won/lost/stalled) is available in Praiz metadata or can be manually tagged
- AI analysis API is available with sufficient rate limits for batch processing
- Existing AI personas (from Spec 004) have defined persona types that match extraction categories
- Context Builder (Spec 005) can accept injected objection patterns

## Out of Scope

- Real-time Praiz webhook processing (deferred to Phase 2)
- Video playback within validation UI (links to Praiz only)
- Automatic RACC response generation (human-validated only for V1)
- Integration with call recording platforms other than Praiz
- Voice/tone analysis of recordings (transcript-based analysis only)
- Winning phrases and buying signals extraction (focus on objections for V1)
