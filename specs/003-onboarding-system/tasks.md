# Tasks: Onboarding System

**Input**: Design documents from `/specs/002-onboarding-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests ARE included per project testing requirements (80% coverage target).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and basic project structure

- [ ] T001 Install dependencies: `pnpm add resend @microsoft/microsoft-graph-client @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- [ ] T002 [P] Add environment variables to `.env.local.example`: RESEND_API_KEY, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
- [ ] T003 [P] Create folder structure: `convex/onboarding/`, `src/components/onboarding/`, `src/app/(dashboard)/onboarding/`, `src/app/(dashboard)/admin/onboarding/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and auth helpers that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

### Schema Updates

- [ ] T004 Add 8 new tables to `convex/schema.ts`:
  - onboardingTracks (template definition)
  - onboardingTrackItems (template items)
  - onboardingSubtasks (checklist items for tasks)
  - userOnboardings (assigned tracks)
  - userOnboardingItems (user's items)
  - userOnboardingSubtasks (user's subtasks)
  - onboardingNotifications
  - auditLogs
- [ ] T005 Add `role` field to `teamMembers` table: `role: v.union(v.literal("member"), v.literal("leader"))` with default "member"
- [ ] T006 Add indexes per data-model.md (by_status, by_track, by_user, by_userId, etc.)
- [ ] T007 Deploy schema: `npx convex deploy`

### Permission Helpers

- [ ] T008 Add `requireTeamLeader(ctx, teamId)` helper to `convex/lib/auth.ts`
- [ ] T009 [P] Add `isTeamLeaderOf(ctx, teamId)` query helper to `convex/lib/auth.ts`
- [ ] T010 [P] Add `getTeamsAsLeader(ctx)` helper to `convex/lib/auth.ts`

### Migration

- [ ] T011 Create migration `convex/admin/migrations/setTeamLeaderRoles.ts` to set existing team owners as "leader"
- [ ] T012 Run migration on development deployment

### Shared Internal Helpers

- [ ] T013 Create `convex/onboarding/internals.ts` with:
  - `recalculateProgress(ctx, userOnboardingId)` - updates progressPercentage
  - `createNotification(ctx, params)` - internal notification creation
  - `logAudit(ctx, params)` - internal audit logging

### Tests for Foundational

- [ ] T014 [P] Unit test for `requireTeamLeader` in `tests/unit/convex/onboarding-permissions.test.ts`
- [ ] T015 [P] Unit test for progress calculation in `tests/unit/convex/onboarding-internals.test.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Admin/TL Creates Template (Priority: P1) MVP

**Goal**: Admins and Team Leaders can create onboarding templates with various task types

**Independent Test**: Create a template with 5 items (one of each type), verify CRUD operations

### Tests for User Story 1

- [ ] T016 [P] [US1] Unit test for template CRUD in `tests/unit/convex/onboarding-templates.test.ts`
- [ ] T017 [P] [US1] Unit test for item/subtask CRUD in `tests/unit/convex/onboarding-template-items.test.ts`

### Backend Implementation

- [ ] T018 [US1] Create `convex/onboarding/templates.ts` with queries:
  - `list` (paginated, admin/TL only)
  - `get` (by ID)
- [ ] T019 [US1] Add template mutations to `convex/onboarding/templates.ts`:
  - `create` (with default empty items)
  - `update` (name, description)
  - `archive` / `restore`
  - `duplicate` (deep copy with items/subtasks)
- [ ] T020 [US1] Add item mutations to `convex/onboarding/templates.ts`:
  - `addItem` (all 5 task types: course, task, validation, meeting, document)
  - `updateItem`
  - `removeItem`
  - `reorderItems` (update order fields)
- [ ] T021 [US1] Add subtask mutations to `convex/onboarding/templates.ts`:
  - `addSubtask`
  - `updateSubtask`
  - `removeSubtask`
  - `reorderSubtasks`

### Frontend Implementation

- [ ] T022 [P] [US1] Create `src/app/(dashboard)/admin/onboarding/templates/page.tsx` - Template list page
- [ ] T023 [P] [US1] Create `src/components/onboarding/template-list.tsx` - Template cards with actions
- [ ] T024 [US1] Create `src/app/(dashboard)/admin/onboarding/templates/new/page.tsx` - Create template wizard
- [ ] T025 [US1] Create `src/app/(dashboard)/admin/onboarding/templates/[id]/page.tsx` - View/edit template
- [ ] T026 [US1] Create `src/components/onboarding/template-editor/index.tsx` - Main editor component
- [ ] T027 [US1] Create `src/components/onboarding/template-editor/sortable-task-list.tsx` - @dnd-kit drag & drop
- [ ] T028 [US1] Create `src/components/onboarding/template-editor/task-form.tsx` - Form for all 5 task types
- [ ] T029 [US1] Create `src/components/onboarding/template-editor/subtask-editor.tsx` - Subtask list editor
- [ ] T030 [US1] Add template routes to admin sidebar navigation

**Checkpoint**: Templates can be created, edited, and organized with drag & drop

---

## Phase 4: User Story 2 - Admin/TL Assigns Track (Priority: P1) MVP

**Goal**: Admins and Team Leaders can assign onboarding tracks to users

**Independent Test**: Assign a template to a user, verify userOnboarding and userOnboardingItems are created

### Tests for User Story 2

- [ ] T031 [P] [US2] Unit test for assignment in `tests/unit/convex/onboarding-assignments.test.ts`
- [ ] T032 [P] [US2] Unit test for permission check (TL can only assign to team members)

### Backend Implementation

- [ ] T033 [US2] Create `convex/onboarding/assignments.ts` with queries:
  - `getAssignableUsers` (filtered by permission)
  - `canAssignToUser` (permission check)
- [ ] T034 [US2] Add `assign` mutation to `convex/onboarding/assignments.ts`:
  - Create userOnboarding record
  - Create userOnboardingItems from template items
  - Create userOnboardingSubtasks from template subtasks
  - Calculate due dates per item
  - Trigger notification (in-app + email)
- [ ] T035 [US2] Add `pause` and `resume` mutations to `convex/onboarding/assignments.ts`

### Frontend Implementation

- [ ] T036 [US2] Create `src/components/onboarding/assign-track-dialog.tsx` - Assignment modal
- [ ] T037 [US2] Create `src/components/onboarding/user-select.tsx` - Searchable user picker with team filter
- [ ] T038 [US2] Add "Assign" button to template list and template detail pages
- [ ] T039 [P] [US2] Create `src/app/(dashboard)/admin/onboarding/assignments/page.tsx` - Assignment management list

**Checkpoint**: Tracks can be assigned to users with proper permission enforcement

---

## Phase 5: User Story 3 - Onboardee Views/Completes Track (Priority: P1) MVP

**Goal**: Onboardees can view their assigned tracks and complete tasks

**Independent Test**: Logged-in user sees their tracks, completes a simple task, progress updates

### Tests for User Story 3

- [ ] T040 [P] [US3] Unit test for task completion in `tests/unit/convex/onboarding-completion.test.ts`
- [ ] T041 [P] [US3] Unit test for progress recalculation
- [ ] T042 [P] [US3] Unit test for subtask toggle and auto-completion

### Backend Implementation

- [ ] T043 [US3] Add queries to `convex/onboarding/assignments.ts`:
  - `getForUser` (current user's tracks)
  - `getDetail` (single track with all items)
- [ ] T044 [US3] Add task completion mutations:
  - `completeTask` (for task type)
  - `toggleSubtask` (check/uncheck, auto-complete parent if all done)
  - `markDocumentRead` (for document type)
- [ ] T045 [US3] Implement auto-complete track when progressPercentage reaches 100%

### Frontend Implementation

- [ ] T046 [US3] Create `src/app/(dashboard)/onboarding/page.tsx` - My onboarding dashboard
- [ ] T047 [US3] Create `src/components/onboarding/track-card.tsx` - Track summary card
- [ ] T048 [US3] Create `src/components/onboarding/track-progress-bar.tsx` - Visual progress indicator
- [ ] T049 [US3] Create `src/app/(dashboard)/onboarding/[trackId]/page.tsx` - Track detail view
- [ ] T050 [US3] Create `src/components/onboarding/track-timeline.tsx` - Timeline of items by week
- [ ] T051 [US3] Create `src/components/onboarding/task-item.tsx` - Base task item component
- [ ] T052 [P] [US3] Create `src/components/onboarding/task-types/simple-task.tsx` - Checkbox task
- [ ] T053 [P] [US3] Create `src/components/onboarding/task-types/course-task.tsx` - Course link with progress
- [ ] T054 [P] [US3] Create `src/components/onboarding/task-types/document-task.tsx` - Document viewer
- [ ] T055 [US3] Create `src/components/onboarding/subtask-list.tsx` - Subtask checkboxes
- [ ] T056 [US3] Add onboarding link to main dashboard sidebar

### Course Progress Integration

- [ ] T057 [US3] Create internal subscription in `convex/onboarding/courseProgress.ts` to monitor course completion
- [ ] T058 [US3] Auto-complete course-type tasks when linked course reaches 100%

**Checkpoint**: Onboardees can view and complete their onboarding tasks with real-time progress

---

## Phase 6: User Story 4 - TL/Admin Validates Tasks (Priority: P1) MVP

**Goal**: Team Leaders and Admins can validate tasks that require approval

**Independent Test**: Complete a validation task, TL approves/rejects, status updates correctly

### Tests for User Story 4

- [ ] T059 [P] [US4] Unit test for validation workflow in `tests/unit/convex/onboarding-validation.test.ts`
- [ ] T060 [P] [US4] Unit test for proactive validation

### Backend Implementation

- [ ] T061 [US4] Add validation mutations to `convex/onboarding/assignments.ts`:
  - `requestValidation` (onboardee submits for review)
  - `approveValidation` (TL/admin approves)
  - `rejectValidation` (TL/admin rejects with comment)
  - `proactiveValidate` (TL validates without request)
- [ ] T062 [US4] Add `getPendingValidations` query for TL/admin view
- [ ] T063 [US4] Add `canValidateForUser` permission check

### Frontend Implementation

- [ ] T064 [US4] Create `src/components/onboarding/task-types/validation-task.tsx` - Validation task UI
- [ ] T065 [US4] Create `src/components/onboarding/validation-dialog.tsx` - Approve/reject modal
- [ ] T066 [US4] Add validation badge/indicator to track timeline
- [ ] T067 [US4] Show rejection comment and allow re-submission

**Checkpoint**: Validation workflow is complete with approve/reject flow

---

## Phase 7: User Story 5 - Team Leader Role (Priority: P1) MVP

**Goal**: Team Leaders can manage their team members' onboarding

**Independent Test**: Promote user to TL, verify they can only see/manage their team

### Tests for User Story 5

- [ ] T068 [P] [US5] Unit test for TL role management in `tests/unit/convex/onboarding-permissions.test.ts`
- [ ] T069 [P] [US5] Unit test for TL permission boundaries

### Backend Implementation

- [ ] T070 [US5] Create `convex/onboarding/permissions.ts` with:
  - `isTeamLeaderOf` query
  - `getTeamsAsLeader` query
  - `promoteToTeamLeader` mutation (admin only)
  - `demoteFromTeamLeader` mutation (admin only)
  - `getTeamMembersWithRoles` query

### Frontend Implementation

- [ ] T071 [US5] Create `src/app/(dashboard)/admin/teams/[teamId]/members/page.tsx` - Team member management
- [ ] T072 [US5] Add "Promote to Team Leader" / "Demote" actions to team member list
- [ ] T073 [US5] Update user selection in assignment dialog to respect TL boundaries

**Checkpoint**: Team Leader role fully functional with proper permission boundaries

---

## Phase 8: User Story 6 - TL Views Team Onboardings (Priority: P2)

**Goal**: Team Leaders can see a consolidated view of their team's onboarding progress

**Independent Test**: TL sees all team members' tracks, can filter and search

### Tests for User Story 6

- [ ] T074 [P] [US6] Unit test for team onboarding queries in `tests/unit/convex/onboarding-team-view.test.ts`

### Backend Implementation

- [ ] T075 [US6] Add `getForTeam` query to `convex/onboarding/assignments.ts`:
  - Filter by team membership
  - Include progress summaries
  - Support filtering by status
- [ ] T076 [US6] Create `convex/onboarding/analytics.ts` with `getTeamStats` query

### Frontend Implementation

- [ ] T077 [US6] Create `src/app/(dashboard)/admin/onboarding/team/page.tsx` - Team onboardings view
- [ ] T078 [US6] Create `src/components/onboarding/manager-views/team-onboardings-list.tsx` - List view
- [ ] T079 [P] [US6] Create `src/components/onboarding/manager-views/team-onboardings-kanban.tsx` - Kanban by week
- [ ] T080 [P] [US6] Create `src/components/onboarding/manager-views/team-onboardings-timeline.tsx` - Gantt-style timeline
- [ ] T081 [US6] Add view toggle (list/kanban/timeline) to team page

**Checkpoint**: Team Leaders have full visibility into team progress with multiple view options

---

## Phase 9: User Story 7 - Admin/TL Updates Active Track (Priority: P2)

**Goal**: Template updates can optionally sync to active tracks

**Independent Test**: Update template, choose to sync, verify active tracks updated

### Tests for User Story 7

- [ ] T082 [P] [US7] Unit test for template sync in `tests/unit/convex/onboarding-sync.test.ts`

### Backend Implementation

- [ ] T083 [US7] Add `syncWithTemplate` mutation to `convex/onboarding/assignments.ts`:
  - Add new items to userOnboarding
  - Update existing items (title, description)
  - Mark removed items as optional/skipped
  - Preserve completion status
- [ ] T084 [US7] Add `getOutOfSyncTracks` query to detect template changes
- [ ] T085 [US7] Track `templateVersion` on both template and userOnboarding

### Frontend Implementation

- [ ] T086 [US7] Create sync prompt dialog when template is updated
- [ ] T087 [US7] Add "Sync with template" button to individual track view
- [ ] T088 [US7] Show visual indicator for out-of-sync tracks

**Checkpoint**: Templates can be updated and selectively synced to active tracks

---

## Phase 10: User Story 8 - Admin/TL Manages Templates (Priority: P2)

**Goal**: Full template lifecycle management (archive, restore, duplicate)

**Independent Test**: Archive template, verify it's hidden but not deleted, restore it

### Tests for User Story 8

- [ ] T089 [P] [US8] Unit test for template lifecycle in `tests/unit/convex/onboarding-template-lifecycle.test.ts`

### Backend Implementation

- [ ] T090 [US8] Ensure `archive` mutation sets status without deleting
- [ ] T091 [US8] Ensure `restore` mutation brings back archived template
- [ ] T092 [US8] Ensure `duplicate` creates deep copy with new IDs

### Frontend Implementation

- [ ] T093 [US8] Add archive/restore actions to template list
- [ ] T094 [US8] Add "Archived" filter toggle to template list
- [ ] T095 [US8] Add "Duplicate" action with rename dialog
- [ ] T096 [US8] Show usage stats on template (active assignments count)

**Checkpoint**: Full template lifecycle management available

---

## Phase 11: User Story 9 - System Sends Notifications (Priority: P2)

**Goal**: Automated notifications for deadlines, overdue items, and validation events

**Independent Test**: Cron triggers, notifications created and emails sent via Resend

### Tests for User Story 9

- [ ] T097 [P] [US9] Unit test for notification creation in `tests/unit/convex/onboarding-notifications.test.ts`
- [ ] T098 [P] [US9] Unit test for cron deadline check

### Backend Implementation

- [ ] T099 [US9] Create `convex/onboarding/notifications.ts` with queries:
  - `list` (paginated, for current user)
  - `getUnreadCount`
- [ ] T100 [US9] Add notification mutations:
  - `markAsRead`
  - `markAllAsRead`
- [ ] T101 [US9] Add internal `create` mutation for notification creation
- [ ] T102 [US9] Create `convex/actions/email.ts` - Resend integration action
- [ ] T103 [US9] Add cron functions to `convex/crons.ts`:
  - `checkDeadlineReminders` (daily, 3 days before due)
  - `checkOverdueItems` (daily)

### Frontend Implementation

- [ ] T104 [US9] Create `src/components/onboarding/notification-bell.tsx` - Header notification icon with badge
- [ ] T105 [US9] Create `src/components/onboarding/notification-dropdown.tsx` - Notification list dropdown
- [ ] T106 [US9] Add notification bell to dashboard header

**Checkpoint**: Automated notifications working with email delivery

---

## Phase 12: User Story 10 - Outlook Calendar Integration (Priority: P3)

**Goal**: Meeting tasks can be scheduled in Outlook calendar

**Independent Test**: Schedule meeting, verify calendar event created in Outlook

### Tests for User Story 10

- [ ] T107 [P] [US10] Unit test for calendar action in `tests/unit/convex/onboarding-calendar.test.ts`

### Backend Implementation

- [ ] T108 [US10] Create `convex/actions/calendar.ts` - Microsoft Graph integration:
  - OAuth token management
  - `createCalendarEvent` action
  - `updateCalendarEvent` action
  - `deleteCalendarEvent` action
- [ ] T109 [US10] Add meeting mutations to `convex/onboarding/assignments.ts`:
  - `scheduleMeeting` (creates calendar event)
  - `completeMeeting`
- [ ] T110 [US10] Store calendar event IDs in userOnboardingItems

### Frontend Implementation

- [ ] T111 [US10] Create `src/components/onboarding/task-types/meeting-task.tsx` - Meeting task UI
- [ ] T112 [US10] Create `src/components/onboarding/schedule-meeting-dialog.tsx` - Meeting scheduler
- [ ] T113 [US10] Add Microsoft OAuth flow for calendar access
- [ ] T114 [US10] Show calendar event link in meeting task

**Checkpoint**: Meeting tasks integrate with Outlook calendar

---

## Phase 13: Analytics & Audit (Cross-Cutting)

**Purpose**: Admin dashboards and compliance audit trail

### Backend Implementation

- [ ] T115 [P] Add `getGlobalStats` query to `convex/onboarding/analytics.ts`
- [ ] T116 [P] Add `getTemplateStats` query to `convex/onboarding/analytics.ts`
- [ ] T117 [P] Add `getCompletionFunnel` query to `convex/onboarding/analytics.ts`
- [ ] T118 [P] Add `getTimeline` query to `convex/onboarding/analytics.ts`
- [ ] T119 Create `convex/onboarding/audit.ts` with:
  - `list` query (admin only, paginated with filters)
  - `getForEntity` query
  - Internal `log` mutation
- [ ] T120 Add audit logging calls to key mutations (assign, validate, role change)

### Frontend Implementation

- [ ] T121 Create `src/app/(dashboard)/admin/onboarding/analytics/page.tsx` - Analytics dashboard
- [ ] T122 Create `src/app/(dashboard)/admin/onboarding/audit/page.tsx` - Audit log viewer
- [ ] T123 [P] Add charts for completion rates, funnel visualization

### Tests

- [ ] T124 [P] Unit test for analytics queries in `tests/unit/convex/onboarding-analytics.test.ts`
- [ ] T125 [P] Unit test for audit logging in `tests/unit/convex/onboarding-audit.test.ts`

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Integration Tests

- [ ] T126 Integration test for full assignment workflow in `tests/integration/onboarding-workflow.test.ts`
- [ ] T127 [P] Integration test for notification delivery

### E2E Tests

- [ ] T128 [P] E2E test for admin template creation in `tests/e2e/onboarding-admin.spec.ts`
- [ ] T129 [P] E2E test for user task completion in `tests/e2e/onboarding-user.spec.ts`

### Quality

- [ ] T130 Run `pnpm typecheck` - Fix any TypeScript errors
- [ ] T131 Run `pnpm lint` - Fix any ESLint issues
- [ ] T132 Run `pnpm test` - Ensure 80% coverage target
- [ ] T133 Accessibility audit on all new components
- [ ] T134 Performance test: 20+ tasks load < 2s
- [ ] T135 Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────────────────────────────────────────────────────┐
    │                                                                     │
    ▼                                                                     │
Phase 2 (Foundational) ───────────────────────────────────────────────────┤
    │                                                                     │
    ├──► Phase 3 (US1: Templates) ──────────► Phase 8 (US8: Template Mgmt)│
    │         │                                                           │
    │         ▼                                                           │
    ├──► Phase 4 (US2: Assignments) ────────► Phase 9 (US9: Notifications)│
    │         │                                                           │
    │         ▼                                                           │
    ├──► Phase 5 (US3: Completion) ─────────► Phase 7 (US7: Sync)         │
    │         │                                                           │
    │         ▼                                                           │
    ├──► Phase 6 (US4: Validation)                                        │
    │         │                                                           │
    │         ▼                                                           │
    └──► Phase 7 (US5: TL Role) ────────────► Phase 8 (US6: Team View)    │
              │                                                           │
              ▼                                                           │
         Phase 12 (US10: Calendar) ──► P3 only                            │
              │                                                           │
              ▼                                                           │
         Phase 13 (Analytics/Audit)                                       │
              │                                                           │
              ▼                                                           │
         Phase 14 (Polish) ◄──────────────────────────────────────────────┘
```

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|------------|-------------------|
| US1 (Templates) | Foundational | - |
| US2 (Assignments) | US1 | - |
| US3 (Completion) | US2 | US4, US5 |
| US4 (Validation) | US2 | US3, US5 |
| US5 (TL Role) | Foundational | US3, US4 |
| US6 (Team View) | US5 | US7, US8, US9 |
| US7 (Sync) | US1, US2 | US6, US8, US9 |
| US8 (Template Mgmt) | US1 | US6, US7, US9 |
| US9 (Notifications) | US2 | US6, US7, US8 |
| US10 (Calendar) | US2 | All P2 stories |

### Parallel Opportunities

```bash
# After Phase 2 (Foundational):
# Can start US1 (Templates) immediately

# After Phase 4 (US2 Assignments):
# These can run in parallel:
- Phase 5 (US3: Completion)
- Phase 6 (US4: Validation)
- Phase 7 (US5: TL Role)

# After P1 stories complete:
# All P2 stories can run in parallel:
- Phase 8 (US6: Team View)
- Phase 9 (US7: Sync)
- Phase 10 (US8: Template Mgmt)
- Phase 11 (US9: Notifications)

# Models within each story marked [P] can run in parallel
# Tests marked [P] can run in parallel
```

---

## Implementation Strategy

### MVP First (P1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phases 3-7: All P1 User Stories (US1-US5)
4. **STOP and VALIDATE**: All core flows work
5. Deploy MVP

**MVP Scope**: Templates, Assignments, Task Completion, Validation, TL Role

### Incremental Delivery

| Increment | Stories | Value Delivered |
|-----------|---------|-----------------|
| MVP | US1-US5 | Core onboarding workflow |
| +Team Views | US6 | Manager visibility |
| +Sync | US7 | Template updates |
| +Lifecycle | US8 | Template management |
| +Notifications | US9 | Proactive reminders |
| +Calendar | US10 | Outlook integration |

### Parallel Team Strategy

With 3 developers after Foundational phase:

- **Dev A**: US1 (Templates) → US7 (Sync) → US8 (Template Mgmt)
- **Dev B**: US2 (Assignments) → US3 (Completion) → US9 (Notifications)
- **Dev C**: US5 (TL Role) → US4 (Validation) → US6 (Team View)

---

## Task Summary

| Phase | Story | Tasks | Priority |
|-------|-------|-------|----------|
| 1 | Setup | 3 | - |
| 2 | Foundational | 12 | - |
| 3 | US1: Templates | 15 | P1 |
| 4 | US2: Assignments | 9 | P1 |
| 5 | US3: Completion | 19 | P1 |
| 6 | US4: Validation | 9 | P1 |
| 7 | US5: TL Role | 6 | P1 |
| 8 | US6: Team View | 8 | P2 |
| 9 | US7: Sync | 7 | P2 |
| 10 | US8: Template Mgmt | 8 | P2 |
| 11 | US9: Notifications | 10 | P2 |
| 12 | US10: Calendar | 8 | P3 |
| 13 | Analytics/Audit | 11 | P2 |
| 14 | Polish | 10 | - |
| **Total** | | **135** | |

**P1 MVP Tasks**: 70 tasks (Phases 1-7)
**P2 Enhancement Tasks**: 44 tasks (Phases 8-11, 13)
**P3 Nice-to-Have Tasks**: 8 tasks (Phase 12)
**Polish Tasks**: 10 tasks (Phase 14)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
