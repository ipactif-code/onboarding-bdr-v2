# Data Model: Onboarding System

**Date**: 2026-01-01
**Feature**: 002-onboarding-system
**Status**: Complete

## Overview

This document defines the complete data model for the Onboarding System, including new tables and modifications to existing tables.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TEMPLATE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐       ┌──────────────────────┐                        │
│  │ onboardingTracks │──1:N──│ onboardingTrackItems │                        │
│  │                  │       │                      │                        │
│  │ - name           │       │ - title              │                        │
│  │ - description    │       │ - type (5 types)     │                        │
│  │ - targetDuration │       │ - dueDayOffset       │                        │
│  │ - reminderDays[] │       │ - isMandatory        │                        │
│  │ - creatorId ────────────────────────────────────────────► users          │
│  │ - isArchived     │       │ - courseId ──────────────────► courses        │
│  └──────────────────┘       └──────────┬───────────┘                        │
│                                        │                                     │
│                                        │ 1:N (for type="task")              │
│                                        ▼                                     │
│                             ┌──────────────────────┐                        │
│                             │ onboardingSubtasks   │                        │
│                             │ - title              │                        │
│                             │ - displayOrder       │                        │
│                             └──────────────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           INSTANCE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────┐                              │
│  │             userOnboardings               │                              │
│  │                                           │                              │
│  │ - userId ─────────────────────────────────────────────► users            │
│  │ - trackId ────────────────────────────────────────────► onboardingTracks │
│  │ - assignedBy ─────────────────────────────────────────► users            │
│  │ - startDate                               │                              │
│  │ - status (pending/in_progress/completed/paused)                          │
│  │ - progressPercentage                      │                              │
│  └─────────────────┬─────────────────────────┘                              │
│                    │                                                         │
│                    │ 1:N                                                     │
│                    ▼                                                         │
│  ┌───────────────────────────────────────────┐                              │
│  │          userOnboardingItems              │                              │
│  │                                           │                              │
│  │ - userOnboardingId                        │                              │
│  │ - trackItemId ────────────────────────────────────────► onboardingTrackItems
│  │ - status (pending/in_progress/completed/  │                              │
│  │           validation_requested/rejected/  │                              │
│  │           scheduled)                      │                              │
│  │ - validatorId ────────────────────────────────────────► users            │
│  │ - rejectionComment                        │                              │
│  │ - scheduledAt                             │                              │
│  │ - calendarEventId                         │                              │
│  └─────────────────┬─────────────────────────┘                              │
│                    │                                                         │
│                    │ 1:N (for task with subtasks)                           │
│                    ▼                                                         │
│  ┌───────────────────────────────────────────┐                              │
│  │        userOnboardingSubtasks             │                              │
│  │                                           │                              │
│  │ - userOnboardingItemId                    │                              │
│  │ - subtaskId ──────────────────────────────────────────► onboardingSubtasks
│  │ - isChecked                               │                              │
│  │ - checkedAt                               │                              │
│  └───────────────────────────────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUPPORT TABLES                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────┐    ┌────────────────────────────┐           │
│  │  onboardingNotifications   │    │       auditLogs            │           │
│  │                            │    │                            │           │
│  │  - userId ──────► users    │    │  - actorId ──────► users   │           │
│  │  - type                    │    │  - targetUserId ─► users   │           │
│  │  - userOnboardingId        │    │  - action                  │           │
│  │  - userOnboardingItemId    │    │  - entityType              │           │
│  │  - message                 │    │  - entityId                │           │
│  │  - isRead                  │    │  - metadata                │           │
│  │  - emailSent               │    │  - createdAt               │           │
│  └────────────────────────────┘    └────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     EXISTING TABLE MODIFICATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                        teamMembers                                  │     │
│  │                                                                     │     │
│  │  EXISTING:                    │  ADDED:                            │     │
│  │  - userId                     │  - role: "member" | "leader"       │     │
│  │  - teamId                     │                                    │     │
│  │  - joinedAt                   │                                    │     │
│  │                               │                                    │     │
│  │  Index: by_team_role [teamId, role] (NEW)                          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Table Definitions

### 1. onboardingTracks (NEW)

Stores reusable onboarding track templates.

```typescript
onboardingTracks: defineTable({
  // Basic info
  name: v.string(),
  description: v.optional(v.string()),

  // Configuration
  targetDuration: v.number(), // days (e.g., 30, 60, 90)
  reminderDays: v.array(v.number()), // days before deadline to remind (e.g., [2, 5, 7])

  // Ownership
  creatorId: v.id("users"),

  // Lifecycle
  isArchived: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_creator", ["creatorId"])
  .index("by_archived", ["isArchived"])
  .index("by_name", ["name"]),
```

**Field Details:**
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| name | string | 2-100 chars, unique per creator | Template name |
| description | string? | max 1000 chars | Optional description |
| targetDuration | number | > 0 | Expected completion time in days |
| reminderDays | number[] | each > 0 | Days before deadline to send reminders |
| creatorId | Id<"users"> | required | Template creator |
| isArchived | boolean | default: false | Soft delete flag |
| createdAt | number | auto | Unix timestamp ms |
| updatedAt | number | auto | Unix timestamp ms |

### 2. onboardingTrackItems (NEW)

Individual tasks within a template.

```typescript
onboardingTrackItems: defineTable({
  // Parent reference
  trackId: v.id("onboardingTracks"),

  // Basic info
  title: v.string(),
  description: v.optional(v.string()),

  // Task configuration
  type: v.union(
    v.literal("course"),
    v.literal("task"),
    v.literal("validation"),
    v.literal("meeting"),
    v.literal("document")
  ),
  dueDayOffset: v.number(), // D+X (days after start date)
  displayOrder: v.number(), // for sorting/drag-drop
  isMandatory: v.boolean(),

  // Type-specific fields (only one set populated based on type)
  // Course type
  courseId: v.optional(v.id("courses")),

  // Meeting type
  meetingDuration: v.optional(v.number()), // minutes
  meetingContact: v.optional(v.string()), // email address

  // Document type
  documentUrl: v.optional(v.string()),
})
  .index("by_track", ["trackId"])
  .index("by_track_order", ["trackId", "displayOrder"])
  .index("by_course", ["courseId"]),
```

**Task Type Requirements:**
| Type | Required Fields | Optional Fields |
|------|-----------------|-----------------|
| course | courseId | - |
| task | - | (has subtasks) |
| validation | - | - |
| meeting | meetingDuration, meetingContact | - |
| document | documentUrl | - |

### 3. onboardingSubtasks (NEW)

Subtasks for "task" type items.

```typescript
onboardingSubtasks: defineTable({
  trackItemId: v.id("onboardingTrackItems"),
  title: v.string(),
  displayOrder: v.number(),
})
  .index("by_item", ["trackItemId"])
  .index("by_item_order", ["trackItemId", "displayOrder"]),
```

### 4. userOnboardings (NEW)

Track instances assigned to users.

```typescript
userOnboardings: defineTable({
  // Core references
  userId: v.id("users"),
  trackId: v.id("onboardingTracks"),
  assignedBy: v.id("users"),

  // Timeline
  startDate: v.number(), // Unix timestamp ms - when track begins

  // Status
  status: v.union(
    v.literal("pending"),      // Not yet started (waiting for first login or future date)
    v.literal("in_progress"),  // Active
    v.literal("completed"),    // All mandatory tasks done
    v.literal("paused")        // Temporarily suspended
  ),
  progressPercentage: v.number(), // 0-100, calculated from mandatory tasks

  // Completion tracking
  completedAt: v.optional(v.number()),
  pausedAt: v.optional(v.number()),
  pausedReason: v.optional(v.string()),

  // Timestamps
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_status", ["userId", "status"])
  .index("by_track", ["trackId"])
  .index("by_assignee", ["assignedBy"])
  .index("by_status", ["status"]),
```

**Status Transitions:**
```
pending ──► in_progress ──► completed
                │
                ▼
              paused ──► in_progress
```

### 5. userOnboardingItems (NEW)

Individual task progress for assigned tracks.

```typescript
userOnboardingItems: defineTable({
  // Parent reference
  userOnboardingId: v.id("userOnboardings"),
  trackItemId: v.id("onboardingTrackItems"),

  // Status
  status: v.union(
    v.literal("pending"),              // Not started
    v.literal("in_progress"),          // Started (for courses)
    v.literal("completed"),            // Done
    v.literal("validation_requested"), // Awaiting approval
    v.literal("validation_rejected"),  // Rejected, needs re-submit
    v.literal("scheduled")             // Meeting scheduled
  ),

  // Completion
  completedAt: v.optional(v.number()),

  // Validation (for validation type)
  validatorId: v.optional(v.id("users")),
  validatedAt: v.optional(v.number()),
  rejectionComment: v.optional(v.string()),

  // Meeting (for meeting type)
  scheduledAt: v.optional(v.number()),
  calendarEventId: v.optional(v.string()), // Outlook event ID
})
  .index("by_user_onboarding", ["userOnboardingId"])
  .index("by_status", ["status"])
  .index("by_validator", ["validatorId"])
  .index("by_track_item", ["trackItemId"]),
```

**Status by Task Type:**
| Task Type | Valid Statuses |
|-----------|---------------|
| course | pending, in_progress, completed |
| task | pending, completed |
| validation | pending, validation_requested, validation_rejected, completed |
| meeting | pending, scheduled, completed |
| document | pending, completed |

### 6. userOnboardingSubtasks (NEW)

Subtask completion status.

```typescript
userOnboardingSubtasks: defineTable({
  userOnboardingItemId: v.id("userOnboardingItems"),
  subtaskId: v.id("onboardingSubtasks"),
  isChecked: v.boolean(),
  checkedAt: v.optional(v.number()),
})
  .index("by_item", ["userOnboardingItemId"])
  .index("by_subtask", ["subtaskId"]),
```

### 7. onboardingNotifications (NEW)

In-app and email notifications.

```typescript
onboardingNotifications: defineTable({
  // Target user
  userId: v.id("users"),

  // Notification type
  type: v.union(
    v.literal("track_assigned"),
    v.literal("deadline_reminder"),
    v.literal("overdue"),
    v.literal("validation_requested"),
    v.literal("validation_approved"),
    v.literal("validation_rejected"),
    v.literal("track_completed")
  ),

  // References (optional based on type)
  userOnboardingId: v.optional(v.id("userOnboardings")),
  userOnboardingItemId: v.optional(v.id("userOnboardingItems")),

  // Content
  message: v.string(),

  // Status
  isRead: v.boolean(),
  emailSent: v.boolean(),

  // Timestamp
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_read", ["userId", "isRead"])
  .index("by_created", ["createdAt"])
  .index("by_type", ["type"]),
```

**Notification Type Details:**
| Type | Recipients | Email? | Context |
|------|------------|--------|---------|
| track_assigned | Onboardee | Yes | userOnboardingId |
| deadline_reminder | Onboardee | Yes | userOnboardingItemId |
| overdue | Onboardee + TL | Yes | userOnboardingItemId |
| validation_requested | TL/Admin | Yes | userOnboardingItemId |
| validation_approved | Onboardee | Yes | userOnboardingItemId |
| validation_rejected | Onboardee | Yes | userOnboardingItemId |
| track_completed | Onboardee + TL + Admins | Yes | userOnboardingId |

### 8. auditLogs (NEW)

Audit trail for compliance (FR-047).

```typescript
auditLogs: defineTable({
  // Action performed
  action: v.union(
    v.literal("validation_approved"),
    v.literal("validation_rejected"),
    v.literal("role_changed"),
    v.literal("track_assigned"),
    v.literal("track_paused"),
    v.literal("track_resumed"),
    v.literal("template_created"),
    v.literal("template_modified"),
    v.literal("template_archived")
  ),

  // Actor (who performed the action)
  actorId: v.id("users"),

  // Target user (optional, for user-affecting actions)
  targetUserId: v.optional(v.id("users")),

  // Entity reference
  entityType: v.union(
    v.literal("userOnboarding"),
    v.literal("userOnboardingItem"),
    v.literal("onboardingTrack"),
    v.literal("teamMember")
  ),
  entityId: v.string(), // Convex ID as string

  // Additional context
  metadata: v.optional(v.any()),

  // Timestamp
  createdAt: v.number(),
})
  .index("by_actor", ["actorId"])
  .index("by_target", ["targetUserId"])
  .index("by_entity", ["entityType", "entityId"])
  .index("by_action", ["action"])
  .index("by_created", ["createdAt"]),
```

**Metadata Examples:**
```typescript
// validation_rejected
{ rejectionComment: "Please add more details" }

// role_changed
{ previousRole: "member", newRole: "leader", teamId: "..." }

// template_modified
{ changes: ["added task", "reordered items"] }
```

### 9. teamMembers (MODIFIED)

Add role field to existing table.

```typescript
// EXISTING FIELDS
teamMembers: defineTable({
  userId: v.id("users"),
  teamId: v.id("teams"),
  joinedAt: v.number(),

  // NEW FIELD
  role: v.union(v.literal("member"), v.literal("leader")),
})
  // EXISTING INDEXES
  .index("by_user", ["userId"])
  .index("by_team", ["teamId"])
  .index("by_user_team", ["userId", "teamId"])

  // NEW INDEXES
  .index("by_team_role", ["teamId", "role"]),
```

**Migration Strategy:**
1. Add `role` field with default "member"
2. Run migration to set `role: "leader"` where `team.leadId === member.userId`
3. Update UI to use `teamMembers.role` for TL permissions

## Indexes Summary

| Table | Index Name | Fields | Purpose |
|-------|------------|--------|---------|
| onboardingTracks | by_creator | creatorId | List templates by creator |
| onboardingTracks | by_archived | isArchived | Filter active templates |
| onboardingTracks | by_name | name | Uniqueness check |
| onboardingTrackItems | by_track | trackId | Get items for template |
| onboardingTrackItems | by_track_order | trackId, displayOrder | Ordered retrieval |
| onboardingTrackItems | by_course | courseId | Course deletion check |
| onboardingSubtasks | by_item | trackItemId | Get subtasks |
| onboardingSubtasks | by_item_order | trackItemId, displayOrder | Ordered retrieval |
| userOnboardings | by_user | userId | User's tracks |
| userOnboardings | by_user_status | userId, status | Active/completed filter |
| userOnboardings | by_track | trackId | Find active uses of template |
| userOnboardings | by_assignee | assignedBy | Assigned by this user |
| userOnboardings | by_status | status | Status filtering |
| userOnboardingItems | by_user_onboarding | userOnboardingId | Get items for track |
| userOnboardingItems | by_status | status | Find pending validations |
| userOnboardingItems | by_validator | validatorId | Items validated by user |
| userOnboardingItems | by_track_item | trackItemId | Template update sync |
| userOnboardingSubtasks | by_item | userOnboardingItemId | Get subtasks |
| onboardingNotifications | by_user | userId | User's notifications |
| onboardingNotifications | by_user_read | userId, isRead | Unread count |
| onboardingNotifications | by_created | createdAt | Cleanup/pagination |
| auditLogs | by_actor | actorId | Activity by user |
| auditLogs | by_target | targetUserId | Actions affecting user |
| auditLogs | by_entity | entityType, entityId | Entity history |
| auditLogs | by_action | action | Filter by action type |
| auditLogs | by_created | createdAt | Time-based queries |
| teamMembers | by_team_role | teamId, role | Find team leaders |

## Progress Calculation

Progress percentage is calculated as:

```typescript
function calculateProgress(
  items: UserOnboardingItem[],
  trackItems: OnboardingTrackItem[]
): number {
  // Only mandatory items count
  const mandatoryItems = trackItems.filter(t => t.isMandatory);
  if (mandatoryItems.length === 0) return 100;

  const completedMandatory = items.filter(item => {
    const trackItem = trackItems.find(t => t._id === item.trackItemId);
    return trackItem?.isMandatory && item.status === "completed";
  });

  return Math.round((completedMandatory.length / mandatoryItems.length) * 100);
}
```

## Data Integrity Rules

1. **Template Deletion**: Archived only (soft delete). Active tracks continue.
2. **Course Deletion**: Items with deleted courseId show "unavailable" status.
3. **User Deletion**: UserOnboardings become orphaned, preserved for history.
4. **Team Leader Removal**: Loses validation rights but assigned tracks continue.
5. **Track Item Deletion**: Completed items preserved in active tracks.
6. **Subtask Auto-Complete**: Parent task completes when all subtasks checked.
7. **Course Auto-Complete**: Task completes when linked course reaches 100%.
