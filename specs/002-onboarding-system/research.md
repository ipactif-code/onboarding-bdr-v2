# Research: Onboarding System

**Date**: 2026-01-01
**Feature**: 002-onboarding-system
**Status**: Complete

## Executive Summary

This document captures the codebase analysis and technical research for implementing the Onboarding System. The analysis focuses on integration points with existing systems, patterns to follow, and architectural decisions.

## 1. Existing System Analysis

### 1.1 Database Schema (convex/schema.ts)

**Existing Tables Relevant to Onboarding:**

| Table | Purpose | Integration Points |
|-------|---------|-------------------|
| `users` | User records with global role (user/admin) | Link onboardees, validators, creators |
| `teams` | Team entities with leadId | Filter team-level operations |
| `teamMembers` | Team membership (userId, teamId, joinedAt) | **REQUIRES MODIFICATION**: Add `role` field |
| `courses` | LMS courses | Link to course-type tasks |
| `progress` | Lesson completion tracking | Auto-complete course tasks |
| `notificationPreferences` | User notification settings | Respect DND settings |

**teamMembers Current Structure:**
```typescript
teamMembers: defineTable({
  userId: v.id("users"),
  teamId: v.id("teams"),
  joinedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_team", ["teamId"])
  .index("by_user_team", ["userId", "teamId"]),
```

**Modification Needed:**
- Add `role: v.union(v.literal("member"), v.literal("leader"))` field
- This enables team-level Team Leader permissions distinct from global admin

### 1.2 Progress Tracking (convex/progress.ts)

**Key Query: `getForCourse`**

Returns:
```typescript
{
  completedLessons: v.number(),
  totalLessons: v.number(),
  percentage: v.number(),  // 0-100
  lessonProgress: [...],
}
```

**Integration for Course Task Auto-Completion:**
- Subscribe to course progress changes
- When `percentage === 100`, mark corresponding onboarding task as completed
- Use `by_user_course` index for efficient lookup

### 1.3 Team Management (convex/teams.ts)

**Current Functions:**
- `list` - List all teams with member count
- `get` - Get team by ID
- `getForUser` - Get teams for a user
- `getMembers` - Get all members of a team
- `addMember` / `removeMember` - Membership management
- `setLead` - Set team lead

**Key Observations:**
- All mutations require `requireAdmin()` - admin-only
- `setLead` updates `team.leadId` but no membership role field
- Need to add Team Leader permission checks for onboarding operations

### 1.4 Notification System

**Existing Pattern (convex/notificationPreferences.ts):**
- User-level preferences stored in `notificationPreferences` table
- Supports: DND times, desktop/sound settings, channel/DM levels
- Pattern: check preferences before sending notifications

**No Email System Yet:**
- No existing Resend integration found
- Need to implement email sending action
- Pattern: Convex action calling external API

### 1.5 Cron Jobs (convex/crons.ts)

**Existing Pattern:**
```typescript
const crons = cronJobs();
crons.interval("check inactive users", { minutes: 1 }, internal.presence.checkInactiveUsers);
export default crons;
```

**Will Need:**
- Daily cron for overdue task notifications
- Cron for deadline reminder checks (e.g., hourly or daily)

### 1.6 Authentication & Authorization (convex/lib/auth.ts)

**Existing Helpers:**
- `requireAuth(ctx)` - Requires logged-in user, returns user doc
- `requireAdmin(ctx)` - Requires admin role

**New Helpers Needed:**
- `requireTeamLeader(ctx, teamId)` - Check team_leader role at membership level
- `requireAdminOrTeamLeader(ctx, teamId?)` - For operations allowing both

### 1.7 External API Actions (convex/actions/)

**Existing Pattern (convex/actions/linkPreview.ts):**
- Uses `action()` with `"use node"`
- External HTTP calls with error handling
- Rate limiting pattern available

**Will Need for:**
- Microsoft Graph API (Outlook calendar)
- Resend (transactional email)

## 2. New Tables Design

Based on spec requirements and codebase analysis:

### 2.1 Onboarding Templates

```typescript
// Template definitions
onboardingTracks: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  targetDuration: v.number(), // days
  reminderDays: v.array(v.number()), // e.g., [2, 5, 7] for D-2, D-5, D-7
  creatorId: v.id("users"),
  isArchived: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_creator", ["creatorId"])
  .index("by_archived", ["isArchived"]),

onboardingTrackItems: defineTable({
  trackId: v.id("onboardingTracks"),
  title: v.string(),
  description: v.optional(v.string()),
  type: v.union(
    v.literal("course"),
    v.literal("task"),
    v.literal("validation"),
    v.literal("meeting"),
    v.literal("document")
  ),
  dueDayOffset: v.number(), // D+X
  displayOrder: v.number(),
  isMandatory: v.boolean(),
  // Type-specific fields
  courseId: v.optional(v.id("courses")), // for type="course"
  meetingDuration: v.optional(v.number()), // minutes, for type="meeting"
  meetingContact: v.optional(v.string()), // email, for type="meeting"
  documentUrl: v.optional(v.string()), // for type="document"
})
  .index("by_track", ["trackId"])
  .index("by_track_order", ["trackId", "displayOrder"]),

onboardingSubtasks: defineTable({
  trackItemId: v.id("onboardingTrackItems"),
  title: v.string(),
  displayOrder: v.number(),
})
  .index("by_item", ["trackItemId"])
  .index("by_item_order", ["trackItemId", "displayOrder"]),
```

### 2.2 User Onboarding Assignments

```typescript
userOnboardings: defineTable({
  userId: v.id("users"),
  trackId: v.id("onboardingTracks"),
  assignedBy: v.id("users"),
  startDate: v.number(), // timestamp
  status: v.union(
    v.literal("pending"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("paused")
  ),
  progressPercentage: v.number(), // 0-100
  completedAt: v.optional(v.number()),
  pausedAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_status", ["userId", "status"])
  .index("by_track", ["trackId"])
  .index("by_assignee", ["assignedBy"]),

userOnboardingItems: defineTable({
  userOnboardingId: v.id("userOnboardings"),
  trackItemId: v.id("onboardingTrackItems"),
  status: v.union(
    v.literal("pending"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("validation_requested"),
    v.literal("validation_rejected"),
    v.literal("scheduled") // for meetings
  ),
  completedAt: v.optional(v.number()),
  validatorId: v.optional(v.id("users")),
  validatedAt: v.optional(v.number()),
  rejectionComment: v.optional(v.string()),
  // For meetings
  scheduledAt: v.optional(v.number()),
  calendarEventId: v.optional(v.string()), // Outlook event ID
})
  .index("by_user_onboarding", ["userOnboardingId"])
  .index("by_status", ["status"])
  .index("by_validator", ["validatorId"]),

userOnboardingSubtasks: defineTable({
  userOnboardingItemId: v.id("userOnboardingItems"),
  subtaskId: v.id("onboardingSubtasks"),
  isChecked: v.boolean(),
  checkedAt: v.optional(v.number()),
})
  .index("by_item", ["userOnboardingItemId"]),
```

### 2.3 Notifications & Audit

```typescript
onboardingNotifications: defineTable({
  userId: v.id("users"),
  type: v.union(
    v.literal("track_assigned"),
    v.literal("deadline_reminder"),
    v.literal("overdue"),
    v.literal("validation_requested"),
    v.literal("validation_approved"),
    v.literal("validation_rejected"),
    v.literal("track_completed")
  ),
  userOnboardingId: v.optional(v.id("userOnboardings")),
  userOnboardingItemId: v.optional(v.id("userOnboardingItems")),
  message: v.string(),
  isRead: v.boolean(),
  emailSent: v.boolean(),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_read", ["userId", "isRead"])
  .index("by_created", ["createdAt"]),

auditLogs: defineTable({
  action: v.union(
    v.literal("validation_approved"),
    v.literal("validation_rejected"),
    v.literal("role_changed"),
    v.literal("track_assigned"),
    v.literal("template_created"),
    v.literal("template_modified"),
    v.literal("template_archived")
  ),
  actorId: v.id("users"),
  targetUserId: v.optional(v.id("users")),
  entityType: v.union(
    v.literal("userOnboarding"),
    v.literal("userOnboardingItem"),
    v.literal("onboardingTrack"),
    v.literal("teamMember")
  ),
  entityId: v.string(), // Convex ID as string
  metadata: v.optional(v.any()), // Additional context
  createdAt: v.number(),
})
  .index("by_actor", ["actorId"])
  .index("by_target", ["targetUserId"])
  .index("by_entity", ["entityType", "entityId"])
  .index("by_created", ["createdAt"]),
```

## 3. Permission Model

### 3.1 Role Hierarchy

```
Global Admin (users.role === "admin")
    ├── Full access to all templates and tracks
    ├── Can assign to any user
    ├── Can validate any task
    └── Can manage all teams

Team Leader (teamMembers.role === "leader")
    ├── Can create/edit own templates
    ├── Can assign to their team members only
    ├── Can validate their team's tasks
    ├── Can view global analytics (read-only)
    └── CANNOT create courses or manage other teams

Regular User (default)
    ├── Can view their own tracks
    ├── Can complete tasks
    ├── Can request validations
    └── Can schedule meetings
```

### 3.2 Permission Helpers

```typescript
// New helper needed in convex/lib/auth.ts
export async function requireTeamLeader(
  ctx: QueryCtx | MutationCtx,
  teamId: Id<"teams">
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);

  // Global admins always have access
  if (user.role === "admin") return user;

  // Check team membership with leader role
  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_user_team", (q) =>
      q.eq("userId", user._id).eq("teamId", teamId)
    )
    .unique();

  if (!membership || membership.role !== "leader") {
    throw new Error("Team Leader access required");
  }

  return user;
}

export async function isTeamLeaderOf(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  targetUserId: Id<"users">
): Promise<boolean> {
  // Find all teams where userId is a leader
  const leaderMemberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("role"), "leader"))
    .collect();

  const teamIds = leaderMemberships.map(m => m.teamId);

  // Check if targetUserId is in any of those teams
  for (const teamId of teamIds) {
    const targetMembership = await ctx.db
      .query("teamMembers")
      .withIndex("by_user_team", (q) =>
        q.eq("userId", targetUserId).eq("teamId", teamId)
      )
      .unique();

    if (targetMembership) return true;
  }

  return false;
}
```

## 4. Integration Points Summary

| Integration | Source | Target | Mechanism |
|-------------|--------|--------|-----------|
| Course progress | `progress` table | Course tasks | Subscription + auto-complete mutation |
| User authentication | Clerk | All operations | `requireAuth()` |
| Team permissions | `teamMembers` | Assignment/validation | New role field + helpers |
| Email notifications | Convex action | Resend API | HTTP calls |
| Calendar | Convex action | Microsoft Graph | OAuth + API calls |
| In-app notifications | `onboardingNotifications` | UI polling/subscription | Real-time query |
| Audit logging | Mutations | `auditLogs` table | Insert on key actions |

## 5. External Dependencies

### 5.1 Resend (Email)

**Required:**
- Resend API key in environment variable
- Email templates for:
  - Track assignment
  - Deadline reminders
  - Overdue alerts
  - Validation requests/responses
  - Track completion

**Pattern:**
```typescript
// convex/actions/email.ts
"use node";
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = action({
  args: { to: v.string(), subject: v.string(), html: v.string() },
  handler: async (ctx, args) => {
    const result = await resend.emails.send({
      from: 'onboarding@yourdomain.com',
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    return result;
  }
});
```

### 5.2 Microsoft Graph API (Outlook Calendar)

**Required:**
- Azure AD app registration
- OAuth 2.0 flow for user consent
- Environment variables:
  - `AZURE_CLIENT_ID`
  - `AZURE_CLIENT_SECRET`
  - `AZURE_TENANT_ID`

**Pattern:**
```typescript
// convex/actions/calendar.ts
"use node";
import { Client } from '@microsoft/microsoft-graph-client';

export const createCalendarEvent = action({
  args: {
    userAccessToken: v.string(),
    subject: v.string(),
    start: v.string(),
    end: v.string(),
    attendees: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const client = Client.init({
      authProvider: (done) => done(null, args.userAccessToken)
    });

    const event = await client.api('/me/events').post({
      subject: args.subject,
      start: { dateTime: args.start, timeZone: 'UTC' },
      end: { dateTime: args.end, timeZone: 'UTC' },
      attendees: args.attendees.map(email => ({
        emailAddress: { address: email },
        type: 'required'
      })),
    });

    return event.id;
  }
});
```

## 6. UI Components Needed

### 6.1 Pages (App Router)

```
src/app/(dashboard)/
├── onboarding/                     # Onboardee view
│   ├── page.tsx                    # My tracks dashboard
│   └── [trackId]/page.tsx          # Track detail view
├── admin/
│   ├── onboarding/                 # Admin/TL template management
│   │   ├── templates/
│   │   │   ├── page.tsx            # Template list
│   │   │   ├── new/page.tsx        # Create template
│   │   │   └── [id]/page.tsx       # Edit template
│   │   └── assignments/page.tsx    # Assignment management
│   └── team/
│       └── onboardings/page.tsx    # TL team view (list/kanban/timeline)
```

### 6.2 Components

```
src/components/onboarding/
├── track-card.tsx                  # Track summary card
├── track-timeline.tsx              # Weekly timeline view
├── task-item.tsx                   # Individual task row
├── task-types/
│   ├── course-task.tsx
│   ├── simple-task.tsx
│   ├── validation-task.tsx
│   ├── meeting-task.tsx
│   └── document-task.tsx
├── subtask-list.tsx                # Checklist for simple tasks
├── validation-dialog.tsx           # Approve/reject dialog
├── schedule-meeting-dialog.tsx     # Outlook integration modal
├── assign-track-dialog.tsx         # Track assignment modal
├── template-editor/
│   ├── index.tsx                   # Main editor
│   ├── task-form.tsx               # Add/edit task
│   ├── sortable-task-list.tsx      # @dnd-kit sortable
│   └── subtask-editor.tsx
└── manager-views/
    ├── team-onboardings-list.tsx
    ├── team-onboardings-kanban.tsx
    └── team-onboardings-timeline.tsx
```

## 7. Testing Strategy

### 7.1 Unit Tests (Vitest + convex-test)

**Focus Areas:**
- Permission checks (admin, team leader, user)
- Progress calculation
- Auto-completion triggers
- Validation workflow state machine

### 7.2 Integration Tests

**Flows:**
- Template CRUD with tasks and subtasks
- Track assignment with email notification
- Task completion (all types)
- Validation request → approve/reject cycle

### 7.3 E2E Tests (Playwright)

**Critical Paths:**
- Admin creates template with all task types
- TL assigns track to team member
- Onboardee completes various task types
- TL validates a pending task
- Email delivery verification (via Resend test mode)

## 8. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Microsoft Graph OAuth complexity | Medium | High | Start with P3 priority, use mock for initial dev |
| Resend rate limits | Low | Medium | Implement queue with retry logic |
| Course progress sync race condition | Medium | Medium | Use optimistic updates with reconciliation |
| Large template with many active tracks | Low | Medium | Paginate, use indexes properly |
| TL role migration for existing data | Medium | Low | Migration script to set all existing as "member" |

## 9. Migration Notes

### 9.1 teamMembers Table Update

**Migration Required:**
1. Add `role` field with default "member"
2. Update existing team leads: set `role: "leader"` where `team.leadId === userId`

```typescript
// Migration mutation (one-time)
export const migrateTeamMemberRoles = internalMutation({
  handler: async (ctx) => {
    // Get all teams
    const teams = await ctx.db.query("teams").collect();

    // Get all team members
    const members = await ctx.db.query("teamMembers").collect();

    for (const member of members) {
      const team = teams.find(t => t._id === member.teamId);
      const isLead = team?.leadId === member.userId;

      await ctx.db.patch(member._id, {
        role: isLead ? "leader" : "member"
      });
    }
  }
});
```

## 10. Conclusion

The onboarding system integrates well with the existing codebase:
- Uses established patterns for auth, notifications, and cron jobs
- Leverages existing progress tracking for course task auto-completion
- Extends teamMembers with role field for TL permissions
- Follows Convex best practices with proper indexing

The main new infrastructure needed:
1. Resend integration for transactional email
2. Microsoft Graph integration for Outlook (P3)
3. New permission helpers for Team Leader role
4. 8 new database tables
