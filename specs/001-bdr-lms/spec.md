# Feature Specification: Onboarding BDR Team v2 LMS

**Feature Branch**: `001-bdr-lms`
**Created**: 2025-12-06
**Status**: Draft
**Input**: User description: "Build Onboarding BDR Team v2, a Learning Management System for training BDR sales teams"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Completes Assigned Course (Priority: P1)

A BDR team member logs into the platform and sees their personalized dashboard with courses assigned to them (both personal assignments and team-based assignments) displayed in an admin-defined order. They select a course, navigate through sections and lessons (text, video embeds, file downloads), complete quizzes, and track their progress to 100% completion.

**Why this priority**: This is the core value proposition of the LMS. Without the ability to consume and complete courses, the entire platform has no purpose. This user journey delivers immediate learning value.

**Independent Test**: Can be fully tested by assigning a single course with multiple lesson types to a user and verifying they can view content, complete lessons, take quizzes, and see their progress bar reach 100%.

**Acceptance Scenarios**:

1. **Given** a user is assigned to a course, **When** they log in, **Then** they see the course on their dashboard in the correct display order
2. **Given** a user opens a course, **When** they view the course overview, **Then** they see all sections with lessons listed and their current progress
3. **Given** a user is viewing a text lesson, **When** they finish reading, **Then** they can mark the lesson as complete
4. **Given** a user is viewing an embed lesson, **When** the video finishes or they manually mark complete, **Then** the lesson is recorded as finished
5. **Given** a user starts a quiz lesson, **When** they submit answers, **Then** they see their score and pass/fail status
6. **Given** a quiz allows retry, **When** the user fails, **Then** they can retake the quiz
7. **Given** a user completes all lessons in a course, **When** they return to the course overview, **Then** they see 100% completion status

---

### User Story 2 - Admin Creates and Publishes a Course (Priority: P1)

An administrator creates a new course with title, description, cover image, and tags. They add sections and lessons of various types (text with rich Plate.js content, video embeds, quizzes, file attachments). They configure course visibility (all teams, specific teams, or specific users), set the display order, and publish the course.

**Why this priority**: Content creation is equally critical as consumption. Admins must be able to populate the LMS with training materials before users can learn.

**Independent Test**: Can be fully tested by an admin creating a course from scratch, adding all four lesson types, setting visibility to a specific team, and publishing it.

**Acceptance Scenarios**:

1. **Given** an admin clicks "New Course", **When** they fill in title and description, **Then** a draft course is created
2. **Given** a draft course exists, **When** the admin uploads a cover image, **Then** the image is displayed on the course card
3. **Given** a course with sections, **When** the admin adds a text lesson, **Then** they can use Plate.js editor with formatting, tables, images, mentions, code blocks, callouts, toggles, and columns
4. **Given** a course, **When** the admin adds an embed lesson with a YouTube/Vimeo/Loom/Figma URL, **Then** the embed type is auto-detected and displayed responsively
5. **Given** a course, **When** the admin creates a quiz lesson, **Then** they can add questions with multiple choice answers, correct answer selection, explanations, points, passing threshold, retry settings, and answer reveal settings
6. **Given** a course, **When** the admin adds a file lesson, **Then** they can attach multiple files (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, images, ZIP)
7. **Given** a course with content, **When** the admin sets visibility to "Specific teams" and selects teams, **Then** only members of those teams see the course
8. **Given** a draft course, **When** the admin clicks "Publish", **Then** the course becomes visible to assigned users

---

### User Story 3 - Admin Manages Teams (Priority: P2)

An administrator creates teams to organize users, assigns team leads, adds/removes members, and assigns courses to entire teams. They can also view team-specific analytics to monitor progress across team members.

**Why this priority**: Teams are the organizational backbone for course assignment and analytics filtering. This enables scalable user management rather than individual assignments.

**Independent Test**: Can be fully tested by creating a team, adding members, assigning a course to the team, and verifying all team members can access the course.

**Acceptance Scenarios**:

1. **Given** an admin navigates to Teams, **When** they click "New Team", **Then** they can enter team name and optional description
2. **Given** a team creation form, **When** the admin searches for users, **Then** they can add members to the team
3. **Given** a team, **When** the admin designates a team lead, **Then** the team lead is displayed for organizational clarity
4. **Given** a user, **When** the admin adds them to multiple teams, **Then** the user sees courses from all assigned teams
5. **Given** a team, **When** the admin assigns a course to the team, **Then** all team members see the course on their dashboard
6. **Given** the analytics section, **When** the admin filters by team, **Then** they see progress metrics only for that team's members

---

### User Story 4 - Admin Views Analytics Dashboard (Priority: P2)

An administrator accesses comprehensive analytics including user activity (online status, session duration, progress), quiz performance (scores, pass rates, distributions), course popularity (views, completions, time spent), and a filterable activity log of all system events.

**Why this priority**: Analytics enable admins to identify struggling learners, measure training effectiveness, and make data-driven decisions about content.

**Independent Test**: Can be fully tested by having multiple users complete courses and quizzes, then verifying the admin dashboard shows accurate aggregated metrics and drill-down data.

**Acceptance Scenarios**:

1. **Given** an admin opens Analytics, **When** the dashboard loads, **Then** they see overview stats cards (total users, courses, completions today)
2. **Given** the user activity section, **When** viewing active users, **Then** they see name, avatar, status (online/offline/away), session duration, last activity, overall progress, and action count
3. **Given** the quiz analytics section, **When** viewing quiz data, **Then** they see total completions, average scores, pass rates per quiz, and score distribution charts
4. **Given** the course analytics section, **When** viewing course data, **Then** they see most popular courses, progress breakdown (not started/in progress/completed), and time spent metrics
5. **Given** the activity log, **When** the admin filters by date range, user, or activity type, **Then** they see matching events with timestamp, type, category, user, and related entity
6. **Given** any analytics view, **When** the admin filters by team, **Then** all metrics reflect only that team's data

---

### User Story 5 - Users Exchange Private Messages (Priority: P3)

Users send and receive direct messages with other users through a chat-style interface. Messages are delivered in real-time with read receipts, conversation history is preserved, and users see unread counts in the navigation. Admins can additionally broadcast messages to all users or specific teams.

**Why this priority**: Messaging enables collaboration and support between learners and between admins and learners, enhancing the learning experience beyond passive content consumption.

**Independent Test**: Can be fully tested by two users exchanging messages and verifying real-time delivery, read receipts, and conversation persistence.

**Acceptance Scenarios**:

1. **Given** a user clicks Messages, **When** they click "New Message", **Then** they can search for any user to message
2. **Given** a conversation, **When** the user sends a message, **Then** the recipient sees it in real-time
3. **Given** a message is read, **When** the sender views the conversation, **Then** they see a read receipt indicator
4. **Given** unread messages exist, **When** the user views the sidebar, **Then** they see an unread message count
5. **Given** an admin in Messages, **When** they compose a broadcast, **Then** they can send to all users or select specific teams
6. **Given** a conversation, **When** the user searches within it, **Then** matching messages are highlighted

---

### User Story 6 - Users Post and Reply to Comments (Priority: P3)

Users engage with course and lesson content by posting comments, replying in threads, and editing/deleting their own comments. Admins can moderate (delete any comment, pin important ones) and respond to learner questions.

**Why this priority**: Comments enable peer learning, Q&A with admins, and community building around content. They increase engagement and clarify confusing material.

**Independent Test**: Can be fully tested by a user posting a comment on a lesson, another user replying, and an admin moderating the thread.

**Acceptance Scenarios**:

1. **Given** a user is viewing a course or lesson, **When** they scroll to comments, **Then** they see existing comments with author, avatar, and timestamp
2. **Given** the comments section, **When** a user clicks "Add comment" and submits, **Then** the comment appears in real-time
3. **Given** a comment, **When** a user clicks reply, **Then** they can create a nested threaded response
4. **Given** their own comment, **When** a user edits or deletes it, **Then** the change is reflected immediately
5. **Given** an admin viewing comments, **When** they delete any comment, **Then** it is removed (moderation)
6. **Given** an admin, **When** they pin a comment, **Then** it appears at the top of the comments section

---

### User Story 7 - Responsive Multi-Device Experience (Priority: P3)

Users and admins access the platform from desktop, tablet, and mobile devices with an interface that adapts appropriately: full sidebar on desktop, collapsible sidebar on tablet, and bottom/hamburger navigation on mobile.

**Why this priority**: BDR team members may learn on various devices. A responsive design ensures accessibility without separate apps.

**Independent Test**: Can be fully tested by accessing all major user flows on devices/viewports at 320px, 768px, and 1440px widths.

**Acceptance Scenarios**:

1. **Given** a desktop viewport (1440px+), **When** viewing any page, **Then** the full sidebar is visible with multi-column layouts
2. **Given** a tablet viewport (768px-1439px), **When** viewing any page, **Then** the sidebar is collapsible with adjusted layouts
3. **Given** a mobile viewport (320px-767px), **When** viewing any page, **Then** navigation uses bottom bar or hamburger menu with single-column layout
4. **Given** any viewport, **When** navigating the application, **Then** all interactive elements are touch-friendly and properly sized

---

### Edge Cases

- What happens when a user is removed from a team with assigned courses? (User retains access to courses they already started; admin can manually revoke if needed)
- What happens when an admin deletes a course that users have partially completed? (Show warning, preserve completion history for records, remove from active dashboards)
- What happens when a quiz has no correct answers set? (Validation prevents publishing; all quizzes must have at least one correct answer)
- What happens when file upload exceeds size limits? (Display clear error message with max file size; standard limit of 50MB per file)
- What happens when embed URL is not from supported providers? (Display generic link with warning that preview is not available)
- What happens when a user tries to message themselves? (Prevent with validation message)
- What happens when network disconnects during quiz submission? (Auto-save progress, allow retry on reconnect, show clear offline indicator)

## Requirements *(mandatory)*

### Functional Requirements

**User Management**
- **FR-001**: System MUST support two user roles: Administrator and User (BDR team member)
- **FR-002**: Administrators MUST be able to invite users, remove users, and change user roles
- **FR-003**: Users MUST be able to belong to multiple teams simultaneously
- **FR-004**: System MUST track user online/offline/away status for activity monitoring

**Team Management**
- **FR-005**: Administrators MUST be able to create, edit, and delete teams
- **FR-006**: Teams MUST support a name, optional description, team lead, members list, and creation date
- **FR-007**: Administrators MUST be able to add and remove members from teams
- **FR-008**: System MUST support assigning courses to: all teams, specific teams, or specific individual users

**Course Management**
- **FR-009**: Administrators MUST be able to create, edit, publish, and delete courses
- **FR-010**: Courses MUST include: title, description, cover image, creator, creation/update dates, and published/draft status
- **FR-011**: Courses MUST support multiple tags for categorization and filtering
- **FR-012**: Administrators MUST be able to set custom display order for how users see courses
- **FR-013**: Courses MUST contain multiple sections; sections MUST contain multiple lessons
- **FR-014**: Sections and lessons MUST be reorderable via drag and drop
- **FR-015**: Sections MUST be collapsible in the user interface

**Lesson Types**
- **FR-016**: All lessons MUST include: title, description, estimated duration, and Plate.js rich text content
- **FR-017**: TEXT lessons MUST support rich formatting including tables, images, @mentions, code blocks, callouts, toggles, and columns
- **FR-018**: EMBED lessons MUST support YouTube, Vimeo, Loom, and Figma URLs with auto-detection and responsive display
- **FR-019**: QUIZ lessons MUST support: questions with multiple choice answers, single or multiple correct answers, per-answer explanations, point values, passing threshold percentage, retry toggle with configurable max attempts (1-10 or unlimited), and answer reveal toggle
- **FR-020**: FILES lessons MUST support multiple file attachments with name, size, type, and download URL for formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, images, and ZIP

**Progress Tracking**
- **FR-021**: System MUST track lesson completion status per user
- **FR-022**: System MUST calculate and display course progress percentage per user as (completed lessons / total lessons), with each lesson weighted equally regardless of type or duration
- **FR-023**: System MUST record quiz scores, pass/fail status, and attempts per user
- **FR-024**: User dashboard MUST display a "Continue where you left off" feature showing last accessed lesson

**Analytics**
- **FR-025**: System MUST track and display: active users, session durations, last activity times, and overall progress
- **FR-026**: System MUST track and display quiz metrics: total completions, average scores, pass rates, score distributions
- **FR-027**: System MUST track and display course metrics: view counts, completion rates, average time spent
- **FR-028**: System MUST maintain an activity log with: timestamp, activity type, category, user, and related entity
- **FR-029**: Activity log MUST be filterable by date range, user, team, and activity type
- **FR-030**: All analytics MUST be filterable by team

**Messaging**
- **FR-031**: All users MUST be able to send direct messages to any other user
- **FR-032**: Messages MUST be delivered in real-time with read/unread status indicators
- **FR-033**: System MUST maintain full conversation history searchable by users
- **FR-034**: System MUST display unread message count in navigation
- **FR-035**: Administrators MUST be able to broadcast messages to all users or specific teams

**Comments**
- **FR-036**: Users MUST be able to post comments on courses and individual lessons
- **FR-037**: Comments MUST support threaded replies (nested conversations)
- **FR-038**: Users MUST be able to edit and delete their own comments
- **FR-039**: Comments MUST display author name, avatar, and timestamp
- **FR-040**: Administrators MUST be able to delete any comment and pin comments to the top
- **FR-041**: Comments MUST update in real-time when new comments appear

**User Interface**
- **FR-042**: System MUST provide a collapsible sidebar navigation
- **FR-043**: System MUST provide breadcrumb navigation for location awareness
- **FR-044**: System MUST provide global search for courses, lessons, and users
- **FR-045**: Admin dashboard MUST display overview stats, quick actions, recent activity, and charts
- **FR-046**: User dashboard MUST display assigned courses in admin-defined order with progress indicators

**Responsive Design**
- **FR-047**: System MUST be fully functional on desktop (1440px+), tablet (768px-1439px), and mobile (320px-767px) viewports
- **FR-048**: Mobile interface MUST use bottom navigation or hamburger menu with single-column layouts

### Key Entities

- **User**: A person using the system; has role (admin/user), profile (name, avatar, email), team memberships, course assignments, progress records, messages, and activity history
- **Team**: An organizational group of users; has name, description, lead, members, creation date, and assigned courses
- **Course**: A collection of training content; has title, description, cover image, tags, sections, visibility settings, display order, and published/draft status
- **Section**: A grouping of lessons within a course; has title, optional description, display order, and contains lessons
- **Lesson**: A single piece of learning content; has common fields (title, description, duration, rich text content) plus type-specific fields (embed URL, quiz questions, file attachments)
- **Quiz Attempt**: A record of a user's quiz submission; has user, quiz lesson, answers, score, pass/fail status, and timestamp
- **Progress Record**: A record of lesson completion; has user, lesson, completion status, and timestamp
- **Message**: A private communication between users; has sender, recipient, content, timestamp, and read status
- **Conversation**: A thread of messages between two users or a broadcast; has participants and message history
- **Comment**: User-generated discussion content; has author, content, parent comment (for threads), target (course or lesson), pinned status, and timestamp
- **Activity Log Entry**: A system event record; has user, action type, category, related entity, and timestamp
- **Tag**: A categorization label for courses; has name

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete course enrollment to 100% completion in a single session without errors
- **SC-002**: Administrators can create a complete course (with all four lesson types) and publish it within 30 minutes
- **SC-003**: System supports 500 concurrent users with p95 response time < 500ms for queries and < 1000ms for mutations, measured via Convex dashboard metrics
- **SC-004**: Quiz results display to users within 2 seconds of submission
- **SC-005**: Messages are delivered to recipients within 1 second of sending (real-time)
- **SC-006**: Page navigation completes within 1 second on standard broadband connections
- **SC-007**: All primary features are accessible within 3 clicks from dashboard, verified by navigation audit (sidebar → page → action)
- **SC-008**: Course search returns relevant results within 500 milliseconds
- **SC-009**: All interactive elements are accessible via keyboard navigation
- **SC-010**: Color contrast meets WCAG 2.1 AA standards (minimum 4.5:1 ratio)
- **SC-011**: Mobile users can complete all critical user flows (course viewing, quiz taking, messaging) on a 320px viewport
- **SC-012**: Admin analytics dashboard loads with data visualizations within 3 seconds
- **SC-013**: File uploads up to 50MB complete within 30 seconds on standard connections
- **SC-014**: User activity status updates within 30 seconds of status change

## Clarifications

### Session 2025-12-06

- Q: When quiz retry is enabled, are retries unlimited or capped? → A: Admin sets max retries per quiz (1-10 or unlimited)
- Q: How is course progress calculated when lessons have different types/durations? → A: Equal weight per lesson (completed lessons / total lessons)

## Assumptions

- Authentication via Clerk with email/password and MFA support (TOTP, SMS, or email) - no custom auth implementation required (per constitution security requirements)
- Standard session-based authentication managed by Clerk for web application
- File storage uses Convex built-in storage with automatic CDN delivery
- Real-time features use Convex reactive queries (WebSocket transport handled automatically)
- Data retention follows standard enterprise practices (7 years for compliance)
- Single timezone display (user's local timezone) for all timestamps
- English is the primary language; internationalization is out of scope for initial release
- Plate.js is the designated rich text editor per user requirements
- Team leaderboard (gamification) is optional and can be deferred to a future release
