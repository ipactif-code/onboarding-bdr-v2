# Implementation Plan: Onboarding System

**Branch**: `002-onboarding-system` | **Date**: 2026-01-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-onboarding-system/spec.md`

## Summary

Implement a comprehensive onboarding journey system for BDR team members. The system enables Admins and Team Leaders to create reusable track templates with 5 task types (course, task, validation, meeting, document), assign them to new hires with relative date planning, and track progress through to completion.

**Technical Approach**: Extend the existing Convex schema with 8 new tables, add Team Leader role at the team membership level, integrate with existing course progress system for auto-completion, and add Resend for email notifications. Microsoft Graph integration for Outlook calendar is P3.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 15 (App Router), React 19, Convex, Clerk, shadcn/ui, Tailwind CSS 4, React Hook Form + Zod, @dnd-kit
**Storage**: Convex (real-time serverless database)
**Testing**: Vitest + convex-test (unit), Playwright (E2E), 80% coverage target
**Target Platform**: Web (responsive, mobile-first)
**Performance Goals**: <2s page load, <500ms mutations, <5 min notification delivery
**Constraints**: Must integrate with existing course progress system, must not break existing team/course functionality
**Scale/Scope**: 100+ concurrent active tracks, 50+ templates, 500+ users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| TypeScript strict mode | ✅ Pass | Using existing project settings |
| Convex patterns | ✅ Pass | Following existing query/mutation structure |
| RBAC implementation | ✅ Pass | Extending existing auth.ts helpers |
| Test coverage | ⚠️ Pending | Target 80%, will verify during implementation |
| Accessibility | ⚠️ Pending | Will use existing shadcn/ui patterns |
| Performance | ⚠️ Pending | Will verify with 100+ tracks load test |

## Project Structure

### Documentation (this feature)

```text
specs/002-onboarding-system/
├── spec.md                  # Feature specification (complete)
├── plan.md                  # This file
├── research.md              # Codebase analysis and integration research
├── data-model.md            # Complete database schema design
├── quickstart.md            # Implementation quick reference
├── contracts/
│   ├── templates.ts         # Template management API
│   ├── assignments.ts       # Track assignment API
│   ├── notifications.ts     # Notification system API
│   ├── analytics.ts         # Statistics and reporting API
│   ├── permissions.ts       # Team Leader role API
│   └── audit.ts             # Audit logging API
├── checklists/
│   └── requirements.md      # Spec quality checklist
└── tasks.md                 # Implementation tasks (next step)
```

### Source Code (repository root)

```text
# Convex Backend
convex/
├── schema.ts                      # Schema update (8 new tables + teamMembers modification)
├── lib/
│   └── auth.ts                    # Add requireTeamLeader, isTeamLeaderOf helpers
├── onboarding/
│   ├── templates.ts               # Template CRUD queries/mutations
│   ├── templateItems.ts           # Task item management
│   ├── assignments.ts             # Assignment and progress management
│   ├── taskCompletion.ts          # Task completion handlers
│   ├── notifications.ts           # In-app notification management
│   ├── analytics.ts               # Statistics queries
│   ├── audit.ts                   # Audit log mutations
│   └── internals.ts               # Internal helpers
├── actions/
│   ├── email.ts                   # Resend integration
│   └── calendar.ts                # Microsoft Graph integration (P3)
└── crons.ts                       # Add deadline/overdue checks

# Next.js Frontend
src/
├── app/(dashboard)/
│   ├── onboarding/
│   │   ├── page.tsx               # Onboardee dashboard
│   │   └── [trackId]/
│   │       └── page.tsx           # Track detail view
│   └── admin/
│       └── onboarding/
│           ├── templates/
│           │   ├── page.tsx       # Template list
│           │   ├── new/
│           │   │   └── page.tsx   # Create template
│           │   └── [id]/
│           │       ├── page.tsx   # View template
│           │       └── edit/
│           │           └── page.tsx # Edit template
│           ├── assignments/
│           │   └── page.tsx       # Manage assignments
│           └── team/
│               └── page.tsx       # Team onboardings (TL view)
├── components/
│   └── onboarding/
│       ├── track-card.tsx
│       ├── track-timeline.tsx
│       ├── track-progress-bar.tsx
│       ├── task-item.tsx
│       ├── task-types/
│       │   ├── course-task.tsx
│       │   ├── simple-task.tsx
│       │   ├── validation-task.tsx
│       │   ├── meeting-task.tsx
│       │   └── document-task.tsx
│       ├── subtask-list.tsx
│       ├── validation-dialog.tsx
│       ├── schedule-meeting-dialog.tsx
│       ├── assign-track-dialog.tsx
│       ├── template-editor/
│       │   ├── index.tsx
│       │   ├── task-form.tsx
│       │   ├── sortable-task-list.tsx
│       │   └── subtask-editor.tsx
│       └── manager-views/
│           ├── team-onboardings-list.tsx
│           ├── team-onboardings-kanban.tsx
│           └── team-onboardings-timeline.tsx
└── hooks/
    ├── use-onboarding-progress.ts
    └── use-can-validate.ts

# Tests
tests/
├── unit/
│   └── convex/
│       ├── onboarding-templates.test.ts
│       ├── onboarding-assignments.test.ts
│       ├── onboarding-task-completion.test.ts
│       ├── onboarding-permissions.test.ts
│       └── onboarding-notifications.test.ts
├── integration/
│   ├── onboarding-assignment-workflow.test.ts
│   ├── onboarding-validation-workflow.test.ts
│   └── onboarding-course-integration.test.ts
└── e2e/
    ├── onboarding-admin-template.spec.ts
    ├── onboarding-tl-assignment.spec.ts
    └── onboarding-user-completion.spec.ts
```

**Structure Decision**: Using existing Next.js App Router structure with new route groups under `(dashboard)`. Convex functions organized in a dedicated `onboarding/` module for separation of concerns.

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Onboardee  │  │   Template   │  │  Assignment  │  │   Manager    │     │
│  │   Dashboard  │  │    Editor    │  │    Modal     │  │    Views     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │                 │              │
│         └─────────────────┴─────────────────┴─────────────────┘              │
│                                   │                                          │
│                         ┌─────────┴─────────┐                                │
│                         │   Convex Client   │                                │
│                         │  (useQuery, etc)  │                                │
│                         └─────────┬─────────┘                                │
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │
                                    │ Real-time subscriptions
                                    │
┌───────────────────────────────────┼──────────────────────────────────────────┐
│                             CONVEX BACKEND                                   │
├───────────────────────────────────┼──────────────────────────────────────────┤
│                                   │                                          │
│  ┌────────────────────────────────┴────────────────────────────────────────┐ │
│  │                          Convex Functions                               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │  │  Templates  │  │ Assignments │  │Notifications│  │  Analytics  │    │ │
│  │  │  Queries/   │  │  Queries/   │  │   Queries/  │  │   Queries   │    │ │
│  │  │  Mutations  │  │  Mutations  │  │  Mutations  │  │             │    │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │ │
│  │         │                │                │                │           │ │
│  │         └────────────────┴────────────────┴────────────────┘           │ │
│  │                                   │                                    │ │
│  │                          ┌────────┴────────┐                           │ │
│  │                          │   Convex DB     │                           │ │
│  │                          │  (8 new tables) │                           │ │
│  │                          └────────┬────────┘                           │ │
│  └───────────────────────────────────┼────────────────────────────────────┘ │
│                                      │                                       │
│  ┌────────────────────┐  ┌───────────┴───────────┐  ┌────────────────────┐  │
│  │    Cron Jobs       │  │       Actions         │  │   Integrations     │  │
│  │ - Deadline check   │  │ - sendEmail (Resend)  │  │ - Course Progress  │  │
│  │ - Overdue check    │  │ - createEvent (Graph) │  │ - User Sync        │  │
│  └────────────────────┘  └───────────────────────┘  └────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    │ External APIs
                                    │
┌───────────────────────────────────┼──────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                  │
├───────────────────────────────────┼──────────────────────────────────────────┤
│                                   │                                          │
│  ┌─────────────┐     ┌────────────┴────────────┐     ┌─────────────────────┐ │
│  │    Clerk    │     │         Resend          │     │  Microsoft Graph    │ │
│  │ (Auth/SSO)  │     │  (Transactional Email)  │     │  (Outlook Calendar) │ │
│  └─────────────┘     └─────────────────────────┘     └─────────────────────┘ │
│                                                              (P3)            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Task Completion

```
User clicks "Complete" ──► completeTask mutation
                                   │
                                   ▼
                          Validate permissions
                                   │
                                   ▼
                          Update item status ──► "completed"
                                   │
                                   ▼
                          Recalculate progress %
                                   │
                          ┌────────┴────────┐
                          │  progress = 100? │
                          └────────┬────────┘
                                   │
                      ┌────────────┴────────────┐
                      │ YES                     │ NO
                      ▼                         ▼
               Mark track as              Update progress only
               "completed"
                      │
                      ▼
               Send completion
               notification
                      │
                      ▼
               Log to audit
```

### Permission Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERMISSION HIERARCHY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         GLOBAL ADMIN                                 │   │
│   │                      (users.role = "admin")                          │   │
│   │                                                                      │   │
│   │   ✓ All template operations                                         │   │
│   │   ✓ Assign to any user                                              │   │
│   │   ✓ Validate any task                                               │   │
│   │   ✓ View all analytics                                              │   │
│   │   ✓ Manage Team Leader roles                                        │   │
│   │   ✓ View audit logs                                                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        TEAM LEADER                                   │   │
│   │              (teamMembers.role = "leader" for team X)                │   │
│   │                                                                      │   │
│   │   ✓ Create/edit OWN templates                                       │   │
│   │   ✓ View all templates (read-only for others')                      │   │
│   │   ✓ Duplicate any template                                          │   │
│   │   ✓ Assign to TEAM X members only                                   │   │
│   │   ✓ Validate TEAM X members' tasks only                             │   │
│   │   ✓ View global analytics (read-only)                               │   │
│   │   ✗ Cannot create courses                                           │   │
│   │   ✗ Cannot manage other teams                                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         REGULAR USER                                 │   │
│   │                  (default, or teamMembers.role = "member")           │   │
│   │                                                                      │   │
│   │   ✓ View own assigned tracks                                        │   │
│   │   ✓ Complete own tasks                                              │   │
│   │   ✓ Request validation                                              │   │
│   │   ✓ Schedule own meetings                                           │   │
│   │   ✗ No template access                                              │   │
│   │   ✗ No assignment capabilities                                      │   │
│   │   ✗ No analytics access                                             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Foundation (P1 - Core) - 14 days

**Goal**: Enable core workflow - create template, assign, complete tasks

| Task | Domain | Deps | Size |
|------|--------|------|------|
| Schema update (8 tables + teamMembers) | Backend | - | M |
| Permission helpers (requireTeamLeader, etc) | Backend | Schema | S |
| teamMembers role migration | Backend | Schema | S |
| Template CRUD queries/mutations | Backend | Schema | M |
| Template item/subtask management | Backend | Templates | M |
| Assignment mutation | Backend | Templates, Permissions | M |
| Task completion handlers (all types) | Backend | Assignments | L |
| Progress calculation | Backend | Completion | S |
| Course progress integration | Backend | Completion | M |
| Onboardee dashboard page | Frontend | Queries | L |
| Track timeline component | Frontend | Dashboard | M |
| Task components (5 types) | Frontend | Timeline | L |
| Template list page | Frontend | Queries | M |
| Template editor | Frontend | Template CRUD | L |
| Assignment dialog | Frontend | Assignment mutation | M |
| Unit tests (templates, assignments) | Testing | All above | L |

### Phase 2: Enhanced Features (P2) - 10 days

**Goal**: Add notifications, manager views, template sync

| Task | Domain | Deps | Size |
|------|--------|------|------|
| In-app notification system | Backend | Phase 1 | M |
| Resend email action | Backend | Notifications | M |
| Notification triggers in mutations | Backend | Notifications | M |
| Cron jobs (deadline, overdue) | Backend | Notifications | M |
| Team onboardings list view | Frontend | Queries | M |
| Team onboardings kanban view | Frontend | List view | M |
| Team onboardings timeline view | Frontend | Kanban | L |
| Template update sync | Backend | Template editor | L |
| Template sync UI | Frontend | Sync mutation | M |
| Audit logging | Backend | All mutations | M |
| Audit log viewer | Frontend | Audit queries | M |
| Analytics queries | Backend | All data | L |
| Analytics dashboard | Frontend | Analytics queries | L |

### Phase 3: Nice-to-Have (P3) - 5 days

**Goal**: Outlook calendar integration

| Task | Domain | Deps | Size |
|------|--------|------|------|
| Azure AD OAuth flow | Frontend | - | L |
| Microsoft Graph action | Backend | OAuth | M |
| Schedule meeting UI | Frontend | Graph action | M |
| Meeting completion flow | Backend/Frontend | Schedule | S |
| Calendar error handling | Backend/Frontend | All above | S |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Microsoft Graph OAuth complexity | Defer to P3, use mock for initial dev/testing |
| Performance with 100+ tracks | Use proper indexes, paginate queries, test early |
| Course progress sync race | Use optimistic updates with reconciliation, add retry |
| Email deliverability | Use Resend (high reputation), implement queue |
| Template sync edge cases | Preserve completed tasks, handle deleted courses gracefully |

## Quality Gates

### Pre-Merge Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (80%+ coverage)
- [ ] All acceptance scenarios manually verified
- [ ] Performance validated (<2s page load, <500ms mutations)
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Security review completed (RBAC, input validation)

### Success Criteria Verification

| Criteria | Verification Method | Target |
|----------|--------------------| -------|
| SC-001 | E2E test with timer | <10 min template creation |
| SC-002 | Click path analysis | <3 clicks to complete |
| SC-003 | Cron + Resend metrics | <5 min notification |
| SC-004 | Manual verification | TL sees all team tracks |
| SC-005 | Performance test | <2s for 20+ tasks |
| SC-006 | Graph error rate | 95% calendar success |
| SC-007 | Performance test | <10s for 10 track sync |
| SC-008 | Load test | 100+ concurrent tracks |
| SC-009 | Analytics query | 80% on-time completion |

## Related Documents

- [Feature Specification](./spec.md) - Complete requirements and user stories
- [Research](./research.md) - Codebase analysis and integration points
- [Data Model](./data-model.md) - Database schema design
- [Quickstart](./quickstart.md) - Implementation quick reference
- [API Contracts](./contracts/) - Convex function signatures

## Next Steps

1. Run `/speckit.tasks` to generate actionable task list
2. Review and estimate tasks
3. Begin Phase 1 implementation
