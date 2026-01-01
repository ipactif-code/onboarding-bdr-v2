# Quickstart: Onboarding System

**Date**: 2026-01-01
**Feature**: 002-onboarding-system

## Prerequisites

Before implementation, ensure:

1. **Environment Variables** (add to `.env.local` and Convex dashboard):
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxx
   AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   AZURE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

2. **Dependencies** (add to `package.json`):
   ```bash
   pnpm add resend @microsoft/microsoft-graph-client @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```

3. **Database Migration**: Run the teamMembers role migration after schema update

## Implementation Order

### Phase 1: Foundation (P1 - Core)

Execute in this order:

1. **Schema Update** (Day 1)
   - Add 8 new tables to `convex/schema.ts`
   - Modify `teamMembers` table (add role field)
   - Deploy schema: `npx convex deploy`

2. **Permission Helpers** (Day 1)
   - Add `requireTeamLeader()` to `convex/lib/auth.ts`
   - Add `isTeamLeaderOf()` helper
   - Run migration: set existing team leads as "leader"

3. **Template CRUD** (Days 2-3)
   - Create `convex/onboarding/templates.ts`
   - Implement: list, get, create, update, archive, duplicate
   - Implement item/subtask CRUD

4. **Assignment System** (Days 3-4)
   - Create `convex/onboarding/assignments.ts`
   - Implement: assign, pause, resume
   - Create userOnboardingItems on assignment

5. **Task Completion** (Days 4-5)
   - Implement: completeTask, toggleSubtask, markDocumentRead
   - Progress recalculation on item completion
   - Auto-complete track when 100% progress

6. **Validation Workflow** (Day 5)
   - Implement: requestValidation, approveValidation, rejectValidation
   - Add proactiveValidate

7. **Course Progress Integration** (Day 6)
   - Add subscription to progress changes
   - Auto-complete course tasks at 100%

8. **Onboardee Dashboard UI** (Days 7-10)
   - Create `/onboarding/page.tsx`
   - Create track timeline component
   - Create task components (all 5 types)

9. **Template Editor UI** (Days 10-13)
   - Create `/admin/onboarding/templates/page.tsx`
   - Implement drag & drop with @dnd-kit
   - Task form with type-specific fields

10. **Assignment UI** (Days 13-14)
    - Assignment modal/dialog
    - User selection (filtered by permission)

### Phase 2: Enhanced Features (P2)

11. **Notifications** (Days 15-17)
    - Create `convex/onboarding/notifications.ts`
    - Implement in-app notifications
    - Create Resend action for email

12. **Cron Jobs** (Day 17)
    - Add deadline reminder check
    - Add overdue notification check

13. **Manager Views** (Days 18-20)
    - Team onboardings list view
    - Kanban view (by week)
    - Timeline/Gantt view

14. **Template Update Sync** (Days 21-22)
    - Detect template changes
    - Prompt for sync choice
    - Implement syncWithTemplate

15. **Audit Logging** (Day 22)
    - Create `convex/onboarding/audit.ts`
    - Add audit calls to key mutations
    - Admin audit log viewer

16. **Analytics** (Days 23-24)
    - Global stats query
    - Team stats query
    - Template effectiveness stats

### Phase 3: Nice-to-Have (P3)

17. **Outlook Calendar Integration** (Days 25-27)
    - Create `convex/actions/calendar.ts`
    - OAuth flow for Microsoft Graph
    - Create calendar events

## Key Files to Create

### Backend (convex/)

```
convex/
├── onboarding/
│   ├── templates.ts        # Template CRUD
│   ├── assignments.ts      # Assignment management
│   ├── notifications.ts    # In-app notifications
│   ├── analytics.ts        # Statistics queries
│   ├── audit.ts            # Audit logging
│   └── internals.ts        # Internal helpers
├── actions/
│   ├── email.ts            # Resend integration
│   └── calendar.ts         # Microsoft Graph (P3)
└── lib/
    └── auth.ts             # Update with TL helpers
```

### Frontend (src/)

```
src/
├── app/(dashboard)/
│   ├── onboarding/
│   │   ├── page.tsx                    # My onboarding dashboard
│   │   └── [trackId]/page.tsx          # Track detail view
│   └── admin/
│       └── onboarding/
│           ├── templates/
│           │   ├── page.tsx            # Template list
│           │   ├── new/page.tsx        # Create template
│           │   └── [id]/
│           │       ├── page.tsx        # View/edit template
│           │       └── edit/page.tsx   # Edit mode
│           ├── assignments/page.tsx    # Assignment management
│           └── team/
│               └── page.tsx            # Team onboardings view
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
    └── use-onboarding-progress.ts
```

### Tests (tests/)

```
tests/
├── unit/
│   └── convex/
│       ├── onboarding-templates.test.ts
│       ├── onboarding-assignments.test.ts
│       ├── onboarding-permissions.test.ts
│       └── onboarding-notifications.test.ts
├── integration/
│   └── onboarding-workflow.test.ts
└── e2e/
    ├── onboarding-admin.spec.ts
    └── onboarding-user.spec.ts
```

## Quick Verification Commands

```bash
# After schema update
pnpm typecheck
npx convex deploy

# After each phase
pnpm test
pnpm lint

# E2E validation
pnpm test:e2e
```

## Testing Checklist

### Unit Tests (80% coverage target)

- [ ] Template CRUD operations
- [ ] Permission checks (admin, TL, user)
- [ ] Progress calculation
- [ ] Validation state machine
- [ ] Subtask auto-completion
- [ ] Course progress integration

### Integration Tests

- [ ] Full assignment workflow
- [ ] Template update sync
- [ ] Notification delivery

### E2E Tests

- [ ] Admin creates template with all task types
- [ ] TL assigns track to team member
- [ ] Onboardee completes various tasks
- [ ] Validation approve/reject cycle

## Success Criteria Verification

| Criteria | How to Verify |
|----------|---------------|
| SC-001: Template in <10 min | Manual E2E test with timer |
| SC-002: Complete task in <3 clicks | Click path analysis |
| SC-003: Notifications <5 min | Cron interval + Resend metrics |
| SC-004: TL consolidated view | Manual verification |
| SC-005: 20+ tasks load <2s | Performance test |
| SC-006: Calendar 95% success | Resend/Graph error rate |
| SC-007: 10 tracks sync <10s | Performance test |
| SC-008: 100+ concurrent tracks | Load test |
| SC-009: 80% on-time completion | Analytics query |
