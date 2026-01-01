# Feature Specification: Onboarding System for BDR LMS

**Feature Branch**: `002-onboarding-system`
**Created**: 2026-01-01
**Status**: Draft
**Input**: User description: "Comprehensive onboarding journey system for new BDR team members with track templates, task types, assignments, and progress tracking"

## Overview

Develop a comprehensive onboarding journey system for new BDR team members. This system enables administrators and Team Leaders to create reusable track templates composed of different task types (courses, simple tasks, validations, meetings, documents), then assign them to new hires with planning based on relative dates.

### Existing Project Context

This system integrates into the existing BDR LMS which already has:
- Authentication system via Clerk
- Convex database with tables: users, teams, teamMembers, courses, sections, lessons, progress, courseAssignments
- Course system with progress tracking (not_started → in_progress → completed)
- Existing roles: "user" and "admin"
- User and admin dashboards
- Messaging system (under development)

### Target Users

1. **Admins**: Create templates, assign tracks to anyone, validate tasks, view all analytics
2. **Team Leaders** (NEW ROLE): Create templates, assign tracks to their team, validate their team's tasks, manage their team members, view global analytics
3. **Onboardees** (Users): View their track, complete tasks, request validations

---

## Clarifications

### Session 2026-01-01

- Q: What are the lifecycle states for an assigned onboarding track (UserOnboarding)? → A: pending, in_progress, completed, paused (4 states - allows temporary suspension)
- Q: Which email delivery approach should be used for notifications? → A: Resend (transactional email API, modern, high deliverability)
- Q: Should the system maintain an audit log for security-sensitive actions? → A: Key actions only (validations, role changes, assignments, template edits)

---

## User Scenarios & Testing

### User Story 1 - Admin/TL Creates an Onboarding Template (Priority: P1)

An administrator or Team Leader creates a new onboarding track template. They define a name, description, target duration in days, and configure reminder delays. They then add tasks of different types (course, simple task, manager validation, meeting, document) with each having a title, description, relative deadline (D+X), and mandatory/optional indicator. For simple tasks, they can add sub-tasks. Task order is configurable via drag & drop.

**Why this priority**: Templates are the foundation of the entire onboarding system. Without the ability to create templates, no tracks can be assigned or executed. This is the core building block.

**Independent Test**: Can be fully tested by having an Admin/TL create a template with at least one task of each type and verify it persists correctly. Delivers value by enabling standardized, reusable onboarding journeys.

**Acceptance Scenarios**:

1. **Given** a logged-in Admin/TL, **When** they click "New template", **Then** a creation form is displayed with fields for name, description, target duration, and reminder delays
2. **Given** the creation form, **When** they fill in the information and add tasks, **Then** the template is saved and appears in the template list
3. **Given** an existing template, **When** they modify it, **Then** the modifications are saved
4. **Given** a template, **When** they add a "course" type task, **Then** they can select from existing LMS courses
5. **Given** a simple task, **When** they click "Add sub-task", **Then** they can create checkable sub-tasks within that task
6. **Given** a task list, **When** they drag & drop a task, **Then** the order is updated and persisted

---

### User Story 2 - Admin/TL Assigns a Track to a New Member (Priority: P1)

An Admin or Team Leader assigns a track template to one or more users. They can do this from the user list, from a template page, or during new member invitation (optional). They choose the start date (today, custom date, or first login for invitations). They can assign multiple tracks to the same user (multiple active tracks). An email notification is sent to the onboardee.

**Why this priority**: Assignment connects templates to users, making the onboarding journey actionable. Without assignment, templates remain unused.

**Independent Test**: Can be fully tested by assigning a template to a test user and verifying the assignment appears in both admin and user views. Delivers value by initiating personalized onboarding journeys.

**Acceptance Scenarios**:

1. **Given** the user list, **When** Admin/TL clicks "Assign track" for a user, **Then** a template selection modal appears with all active templates
2. **Given** a template page, **When** Admin/TL clicks "Assign", **Then** they can select multiple users to receive this track
3. **Given** the invitation form, **When** Admin/TL selects a track (optional), **Then** the track will be assigned when the user first logs in
4. **Given** a user with an already active track, **When** a new track is assigned, **Then** both tracks coexist and are visible
5. **Given** a confirmed assignment, **When** the action is validated, **Then** an email notification is sent to the onboardee

---

### User Story 3 - Onboardee Views and Completes Their Track (Priority: P1)

A new hire logs in and sees their onboarding track(s) on their dashboard. They see a chronological view of their tasks organized by week with deadlines (D+X converted to actual dates). They can:
- View overall progress (percentage)
- Continue a linked course (auto-completed at 100%)
- Check off a simple task or its sub-tasks
- Request validation for tasks requiring approval
- Schedule a meeting in Outlook
- Mark a document as read

They receive configurable reminders before deadlines and alerts if overdue.

**Why this priority**: This is the primary user experience for onboardees - the reason the system exists. Users must be able to view and complete their onboarding tasks.

**Independent Test**: Can be fully tested by logging in as an onboardee with an assigned track and completing various task types. Delivers value by guiding new hires through their onboarding journey.

**Acceptance Scenarios**:

1. **Given** an onboardee with assigned track, **When** they log in, **Then** they see their track on the dashboard with a timeline view organized by week
2. **Given** a "course" type task, **When** the linked course reaches 100% completion, **Then** the task is automatically marked completed
3. **Given** a simple task with sub-tasks, **When** they check all sub-tasks, **Then** the parent task is automatically completed
4. **Given** a "validation" type task, **When** they click "Request validation", **Then** the TL/Admin receives a notification
5. **Given** a "meeting" type task, **When** they click "Schedule", **Then** an Outlook calendar event creation flow is initiated
6. **Given** a deadline in 2 days and reminder configured at D-2, **When** the system checks, **Then** they receive an in-app and email notification

---

### User Story 4 - TL/Admin Validates Tasks Requiring Approval (Priority: P1)

A Team Leader or Admin receives a notification when an onboardee requests a validation. They can approve or reject the task. In case of rejection, they must provide a mandatory explanatory comment. The onboardee can then re-submit after corrections. The validator can also proactively approve without waiting for the request.

**Why this priority**: Validation tasks enable quality control and manager involvement in the onboarding process. This is essential for tasks requiring sign-off.

**Independent Test**: Can be fully tested by having an onboardee request validation and having a TL/Admin approve or reject it. Delivers value by ensuring completion quality through manager oversight.

**Acceptance Scenarios**:

1. **Given** a validation request, **When** the TL/Admin receives the notification, **Then** they can see the task details and context
2. **Given** the task to validate, **When** they click "Approve", **Then** the task is marked completed and the onboardee is notified
3. **Given** the task to validate, **When** they click "Reject", **Then** a mandatory comment field appears before confirmation
4. **Given** a rejection with comment, **When** confirmed, **Then** the onboardee is notified with the rejection reason
5. **Given** a rejected task, **When** the onboardee re-submits, **Then** the validator is notified again

---

### User Story 5 - New Team Leader Role (Priority: P1)

The system introduces a new "team_leader" role between "user" and "admin". A Team Leader is defined at the team membership level (a user can be leader of one team and simple member of another). TL permissions include: create onboarding templates, assign tracks to their team members, validate their teams' tasks, manage their team members, access global analytics. The TL cannot create courses, manage teams globally, or modify users outside their teams.

**Why this priority**: The Team Leader role is foundational for permission-based access control and enables delegation of onboarding management to team leads.

**Independent Test**: Can be fully tested by assigning TL role to a user and verifying they can only perform allowed actions for their team. Delivers value by enabling scalable onboarding management.

**Acceptance Scenarios**:

1. **Given** the teamMembers table, **When** a user is added as "leader", **Then** they inherit TL permissions for that team
2. **Given** a TL, **When** they access template management, **Then** they can create/modify their own templates
3. **Given** a TL, **When** they want to assign a track, **Then** only their team members are selectable
4. **Given** a TL, **When** they access analytics, **Then** they see global metrics (not just their team)
5. **Given** a TL, **When** they access course creation, **Then** access is denied (admin only)

---

### User Story 6 - Team Leader Views Their Team's Onboardings (Priority: P2)

A Team Leader accesses a dedicated view showing all onboarding tracks of their team members. They can switch between 3 display modes: List (table with progress and alerts), Kanban (columns by week), Timeline (Gantt view). They clearly see delays and can click on a member to see their track details.

**Why this priority**: Provides managers with visibility into their team's onboarding progress, enabling proactive intervention when needed.

**Independent Test**: Can be fully tested by having a TL access the team onboarding view and switch between display modes. Delivers value by giving managers actionable visibility into team progress.

**Acceptance Scenarios**:

1. **Given** a logged-in TL, **When** they access "My team > Onboardings", **Then** they see all tracks for their team members
2. **Given** the list view, **When** they consult it, **Then** they see name, track name, progress percentage, and delay alerts
3. **Given** the kanban view, **When** they consult it, **Then** they see members organized by onboarding week
4. **Given** the timeline view, **When** they consult it, **Then** they see a Gantt-style view with progress bars
5. **Given** a member behind schedule, **When** displayed, **Then** a red visual indicator signals the delay
6. **Given** a click on a member, **When** performed, **Then** their detailed track view is displayed

---

### User Story 7 - Admin/TL Updates an Active Track (Priority: P2)

An Admin or TL modifies a template that has active tracks. The system asks if they want to apply changes only to new tracks or update active tracks. If update is chosen: new tasks are added (status "pending"), deleted tasks are removed (unless already completed), modified tasks keep their progress but content is updated.

**Why this priority**: Enables continuous improvement of onboarding templates while respecting in-progress journeys.

**Independent Test**: Can be fully tested by modifying a template with active assignments and choosing each update option. Delivers value by allowing template evolution without disrupting active onboardings.

**Acceptance Scenarios**:

1. **Given** a template with 3 active tracks, **When** Admin/TL modifies it, **Then** a choice modal appears asking about propagation
2. **Given** the choice "New tracks only", **When** confirmed, **Then** active tracks remain unchanged
3. **Given** the choice "Update active tracks", **When** confirmed, **Then** active tracks are synchronized with template changes
4. **Given** a new task added to template, **When** updating tracks, **Then** the task appears with "pending" status in active tracks
5. **Given** an already completed task, **When** it's deleted from template, **Then** it remains visible in active tracks (preserved for history)

---

### User Story 8 - Admin/TL Manages Templates (Priority: P2)

An Admin or TL can see all existing templates (theirs and others'). They can duplicate any template to create their own. They can only modify their own templates. They can archive their templates (soft delete). Archived templates no longer appear in selection lists but active tracks continue.

**Why this priority**: Template management enables template reuse, organization, and lifecycle management.

**Independent Test**: Can be fully tested by viewing templates, duplicating one, and archiving a template. Delivers value by enabling template library management and reuse.

**Acceptance Scenarios**:

1. **Given** the template list, **When** Admin/TL consults it, **Then** they see all templates with their creator's name
2. **Given** another creator's template, **When** they click "Duplicate", **Then** a copy is created with them as owner
3. **Given** their own template, **When** they click "Modify", **Then** the template editor opens
4. **Given** another's template, **When** they want to modify, **Then** the modify button is not available (read-only view)
5. **Given** their own template, **When** they click "Archive", **Then** the template becomes archived and disappears from selection lists

---

### User Story 9 - System Sends Notifications (Priority: P2)

The system sends in-app and email notifications at key moments: track assigned, reminder before deadline (delays configurable in template), deadline exceeded (daily), validation requested/approved/rejected, track completed. In-app notifications integrate with the existing system. Emails use a professional template.

**Why this priority**: Notifications ensure users are informed of important events and deadlines, driving engagement and completion.

**Independent Test**: Can be fully tested by triggering each notification type and verifying delivery through in-app and email channels. Delivers value by keeping all stakeholders informed and driving timely action.

**Acceptance Scenarios**:

1. **Given** an assigned track, **When** assignment is confirmed, **Then** in-app + email notification is sent to onboardee
2. **Given** a task with D+7 deadline and D-2 reminder, **When** at D+5, **Then** in-app + email notification is sent
3. **Given** an overdue task, **When** it exceeds deadline, **Then** daily notification is sent until completion
4. **Given** an approved validation, **When** validator confirms, **Then** in-app + email notification is sent to onboardee
5. **Given** all tasks completed, **When** track reaches 100%, **Then** in-app + email notification is sent to onboardee + TL + Admin

---

### User Story 10 - Outlook Calendar Integration (Priority: P3)

For "meeting" type tasks, the onboardee can schedule an appointment directly from the interface. The system uses Microsoft Graph API to create an event in the onboardee's Outlook calendar and send an invitation to the contact specified in the task. The task status changes to "Scheduled" with the date/time.

**Why this priority**: Calendar integration enhances user experience for meeting tasks but is not essential for core onboarding functionality.

**Independent Test**: Can be fully tested by scheduling a meeting from a meeting task and verifying the calendar event appears. Delivers value by streamlining meeting scheduling within the onboarding flow.

**Acceptance Scenarios**:

1. **Given** a meeting task, **When** onboardee clicks "Schedule", **Then** a date/time selection modal appears
2. **Given** the scheduling modal, **When** they choose a slot and confirm, **Then** the calendar event is created
3. **Given** the created event, **When** successful, **Then** invitation is sent to the contact and task status is updated to "Scheduled"
4. **Given** the created event, **When** onboardee checks Outlook, **Then** the appointment appears in their calendar
5. **Given** a calendar service error, **When** failure occurs, **Then** explicit error message is shown with retry option

---

### Edge Cases

1. **User deleted during onboarding**: Track becomes "orphan" and remains visible in analytics but without action capability
2. **Template deleted (archived) with active tracks**: Tracks continue with template snapshot from archival time
3. **Team Leader loses their status**: Their assigned tracks remain valid, but they lose ability to validate/assign for that team
4. **Course deleted linked to a task**: Task becomes "unavailable" with explanatory message to the user
5. **Calendar service failure**: Automatic retry up to 3 times, then error notification with manual scheduling option
6. **Assignment to user without email**: Blocked with explicit error message before assignment completes
7. **Track assigned at "first login" but user already connected**: startDate defaults to current date/time
8. **Sub-tasks partially completed then parent task deleted from template**: Task remains visible with its progress (history preserved)

---

## Requirements

### Functional Requirements

#### Onboarding Templates

- **FR-001**: System MUST allow Admins and Team Leaders to create onboarding templates
- **FR-002**: Templates MUST have: name, description, target duration (days), and configurable reminder delays
- **FR-003**: Templates MUST support 5 task types: course, task, validation, meeting, document
- **FR-004**: Tasks MUST have: title, description, due day offset (D+X), display order, and mandatory flag
- **FR-005**: Task type "task" MUST support sub-tasks (checklist within checklist)
- **FR-006**: Task type "course" MUST link to existing LMS courses
- **FR-007**: Task type "validation" MUST require approval from TL or Admin
- **FR-008**: Task type "meeting" MUST store: duration and contact person
- **FR-009**: Task type "document" MUST store: external URL
- **FR-010**: Tasks MUST be reorderable via drag & drop interface
- **FR-011**: Templates MUST be archivable (soft delete)
- **FR-012**: Archived templates MUST NOT appear in selection lists but existing assignments continue

#### Track Assignment

- **FR-013**: Admins MUST be able to assign tracks to any user
- **FR-014**: Team Leaders MUST only assign tracks to members of their teams
- **FR-015**: Assignment MUST be possible from: user list, template page, and invitation form (optional)
- **FR-016**: Assignment MUST specify: start date (today, custom date, or first login for invitations)
- **FR-017**: Users MUST be able to have multiple active tracks simultaneously
- **FR-018**: Assignment MUST trigger email notification to assignee

#### Progress and Completion

- **FR-019**: Course tasks MUST auto-complete when linked course reaches 100%
- **FR-020**: Simple tasks MUST be completable by the onboardee
- **FR-021**: Sub-tasks completion MUST automatically complete parent task when all sub-tasks are checked
- **FR-022**: Validation tasks MUST support request/approve/reject workflow
- **FR-023**: Rejection MUST require mandatory explanatory comment
- **FR-024**: Rejected tasks MUST allow re-submission by onboardee
- **FR-025**: Document tasks MUST be completable via "mark as read" checkbox
- **FR-026**: Meeting tasks MUST integrate with Outlook via Microsoft Graph API
- **FR-027**: Progress percentage MUST be calculated as completed mandatory tasks / total mandatory tasks

#### Notifications

- **FR-028**: System MUST send in-app notifications for all key events
- **FR-029**: System MUST send email notifications for all key events
- **FR-030**: Reminder delays MUST be configurable per template
- **FR-031**: Overdue tasks MUST trigger daily notifications until completed
- **FR-032**: Track completion MUST notify: onboardee, team leader, and admins

#### Views and Interfaces

- **FR-033**: Onboardee dashboard MUST show active tracks with timeline view organized by week
- **FR-034**: Manager view MUST support 3 display modes: List, Kanban, and Timeline (Gantt)
- **FR-035**: Template editor MUST support drag & drop task ordering
- **FR-036**: All dates MUST be calculated from startDate + dueDayOffset

#### Roles and Permissions

- **FR-037**: System MUST introduce "team_leader" role
- **FR-038**: Team Leader role MUST be defined at team membership level (not global user role)
- **FR-039**: User CAN be leader of one team and regular member of another
- **FR-040**: Team Leaders MUST be able to: create templates, assign to their teams, validate their teams' tasks, manage their team members, view global analytics
- **FR-041**: Team Leaders MUST NOT be able to: create courses, manage teams globally, modify users outside their teams

#### Active Track Updates

- **FR-042**: Template modification with active tracks MUST prompt for update choice
- **FR-043**: Update choice options: "new tracks only" or "update active tracks"
- **FR-044**: Updated tracks: new tasks added as "pending", modified tasks keep progress but content is updated, deleted completed tasks remain visible (history)

#### History and Audit

- **FR-045**: Completed tracks MUST be preserved indefinitely
- **FR-046**: Track history MUST include: all tasks, completion dates, validators, and notes
- **FR-047**: System MUST maintain audit log for key actions: validation approvals/rejections, role changes (TL assignment), track assignments, and template modifications (with actor, timestamp, and action details)

---

### Key Entities

- **OnboardingTemplate**: Reusable track template with configuration (name, description, target duration, reminder delays, creator, archived status)
- **TemplateItem**: Template element with 5 possible types (course, task, validation, meeting, document) including type-specific attributes
- **TemplateSubtask**: Sub-task of a "task" type TemplateItem (title, order)
- **UserOnboarding**: Track instance assigned to a user (template reference, user, start date, status [pending|in_progress|completed|paused], progress percentage)
- **UserOnboardingItem**: Progress on a specific item (status, completion date, validator if applicable)
- **UserOnboardingSubtask**: Progress on a sub-task (checked status)
- **TeamMember (modified)**: Addition of role field (member/leader) at team membership level

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: An Admin can create a complete template with all 5 task types in under 10 minutes
- **SC-002**: An onboardee can view their progress and complete a simple task in under 3 clicks from dashboard
- **SC-003**: 100% of critical notifications (assignment, validation, overdue) are delivered within 5 minutes of trigger event
- **SC-004**: A Team Leader can view the state of all their team's onboardings in a single consolidated view
- **SC-005**: Tracks with more than 20 tasks load and display in under 2 seconds
- **SC-006**: Calendar integration works successfully in 95% of scheduling attempts
- **SC-007**: Updating a template with 10 active tracks completes in under 10 seconds
- **SC-008**: System supports 100+ simultaneous active tracks without performance degradation
- **SC-009**: 80% of onboardees complete their track within the target duration defined in the template

---

## Assumptions

1. Clerk already supports webhooks for user synchronization (for first-login assignment trigger)
2. Microsoft Graph API access will be configured for Outlook calendar integration
3. Resend will be used for transactional email delivery (notifications, reminders, validation requests)
4. Existing courses already have a functional progress tracking system that can report 100% completion
5. In-app notification system will be integrated with existing messaging or created if nonexistent
6. GDPR: Onboarding data follows same retention policy as LMS (90 days for sensitive operational data, indefinite for completion records)

---

## Out of Scope (V2)

- Automatic assignment by team (default track per team)
- Gamification (points, badges, leaderboard)
- Task dependencies (conditional blocking between tasks)
- Google Calendar integration (Outlook only in V1)
- SMS reminders
- PDF export of completed track
- Multi-language templates
