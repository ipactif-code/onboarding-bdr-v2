# Data Model: Onboarding BDR Team v2 LMS

**Date**: 2025-12-06
**Branch**: `001-bdr-lms`
**Database**: Convex

## Convex Schema Overview

Convex uses a document-based model with TypeScript schema definitions. All tables are defined in `convex/schema.ts`.

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    users    │◄──────│ teamMembers │──────►│    teams    │
└─────────────┘       └─────────────┘       └─────────────┘
      │                                            │
      │ ┌──────────────────────────────────────────┘
      │ │
      ▼ ▼
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│courseAssignments│────►│   courses   │◄────│ courseTags  │
└─────────────────┘     └─────────────┘     └─────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │  sections   │
                        └─────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │   lessons   │
                        └─────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │quizConfig│   │embedConfig│   │   files   │
        └──────────┘   └──────────┘   └──────────┘
              │
              ▼
        ┌──────────┐
        │ questions│
        └──────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  progress   │       │quizAttempts │       │  comments   │
└─────────────┘       └─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│conversations│◄──────│  messages   │       │activityLogs │
└─────────────┘       └─────────────┘       └─────────────┘
```

## Convex Schema Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users (synced from Clerk)
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    status: v.union(v.literal("online"), v.literal("offline"), v.literal("away")),
    lastActiveAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  // Teams
  teams: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    leadId: v.optional(v.id("users")),
  })
    .index("by_name", ["name"]),

  // Team membership (many-to-many)
  teamMembers: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_team", ["teamId"])
    .index("by_user_team", ["userId", "teamId"]),

  // Tags for courses
  tags: defineTable({
    name: v.string(),
  })
    .index("by_name", ["name"]),

  // Course-Tag junction
  courseTags: defineTable({
    courseId: v.id("courses"),
    tagId: v.id("tags"),
  })
    .index("by_course", ["courseId"])
    .index("by_tag", ["tagId"]),

  // Courses
  courses: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    creatorId: v.id("users"),
    status: v.union(v.literal("draft"), v.literal("published")),
    visibility: v.union(
      v.literal("all_teams"),
      v.literal("specific_teams"),
      v.literal("specific_users")
    ),
    displayOrder: v.number(),
    viewCount: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_visibility", ["visibility"])
    .index("by_display_order", ["displayOrder"])
    .index("by_creator", ["creatorId"]),

  // Course assignments (visibility targets)
  courseAssignments: defineTable({
    courseId: v.id("courses"),
    teamId: v.optional(v.id("teams")),
    userId: v.optional(v.id("users")),
    assignedAt: v.number(),
  })
    .index("by_course", ["courseId"])
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"]),

  // Sections within courses
  sections: defineTable({
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    displayOrder: v.number(),
  })
    .index("by_course", ["courseId"])
    .index("by_course_order", ["courseId", "displayOrder"]),

  // Lessons within sections
  lessons: defineTable({
    sectionId: v.id("sections"),
    type: v.union(
      v.literal("text"),
      v.literal("embed"),
      v.literal("quiz"),
      v.literal("files")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
    content: v.optional(v.any()), // Plate.js JSON content
    displayOrder: v.number(),
  })
    .index("by_section", ["sectionId"])
    .index("by_section_order", ["sectionId", "displayOrder"]),

  // Embed configuration for embed lessons
  embedConfigs: defineTable({
    lessonId: v.id("lessons"),
    url: v.string(),
    provider: v.union(
      v.literal("youtube"),
      v.literal("vimeo"),
      v.literal("loom"),
      v.literal("figma"),
      v.literal("other")
    ),
  })
    .index("by_lesson", ["lessonId"]),

  // Quiz configuration for quiz lessons
  quizConfigs: defineTable({
    lessonId: v.id("lessons"),
    passingScore: v.number(),
    allowRetry: v.boolean(),
    maxAttempts: v.optional(v.number()), // null = unlimited
    showAnswers: v.boolean(),
  })
    .index("by_lesson", ["lessonId"]),

  // Quiz questions
  quizQuestions: defineTable({
    quizConfigId: v.id("quizConfigs"),
    questionText: v.string(),
    options: v.array(v.object({
      text: v.string(),
      isCorrect: v.boolean(),
    })),
    explanation: v.optional(v.string()),
    points: v.number(),
    displayOrder: v.number(),
  })
    .index("by_quiz", ["quizConfigId"])
    .index("by_quiz_order", ["quizConfigId", "displayOrder"]),

  // File attachments for file lessons
  files: defineTable({
    lessonId: v.id("lessons"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    uploadedAt: v.number(),
  })
    .index("by_lesson", ["lessonId"]),

  // User progress on lessons
  progress: defineTable({
    userId: v.id("users"),
    lessonId: v.id("lessons"),
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    completedAt: v.optional(v.number()),
    lastAccessedAt: v.number(),
    timeSpent: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_lesson", ["lessonId"])
    .index("by_user_lesson", ["userId", "lessonId"]),

  // Quiz attempts
  quizAttempts: defineTable({
    userId: v.id("users"),
    quizConfigId: v.id("quizConfigs"),
    answers: v.any(), // Map of questionId to selected option indices
    score: v.number(),
    maxScore: v.number(),
    passed: v.boolean(),
    attemptNumber: v.number(),
    submittedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_quiz", ["quizConfigId"])
    .index("by_user_quiz", ["userId", "quizConfigId"]),

  // Conversations (for messaging)
  conversations: defineTable({
    type: v.union(v.literal("direct"), v.literal("broadcast")),
    updatedAt: v.number(),
  })
    .index("by_updated", ["updatedAt"]),

  // Conversation participants
  conversationParticipants: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadAt: v.optional(v.number()),
    joinedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_user_conversation", ["userId", "conversationId"]),

  // Messages
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_time", ["conversationId", "createdAt"]),

  // Comments on courses/lessons
  comments: defineTable({
    authorId: v.id("users"),
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
    parentId: v.optional(v.id("comments")),
    content: v.string(),
    isPinned: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_course", ["courseId"])
    .index("by_lesson", ["lessonId"])
    .index("by_parent", ["parentId"])
    .index("by_author", ["authorId"]),

  // Activity logs for analytics
  activityLogs: defineTable({
    userId: v.id("users"),
    actionType: v.union(
      v.literal("login"),
      v.literal("logout"),
      v.literal("lesson_view"),
      v.literal("lesson_complete"),
      v.literal("quiz_start"),
      v.literal("quiz_submit"),
      v.literal("comment_post"),
      v.literal("message_send"),
      v.literal("course_enroll")
    ),
    category: v.union(
      v.literal("user"),
      v.literal("course"),
      v.literal("quiz"),
      v.literal("message"),
      v.literal("system")
    ),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_action", ["actionType"])
    .index("by_category", ["category"])
    .index("by_timestamp", ["timestamp"]),

  // User sessions for analytics
  sessions: defineTable({
    userId: v.id("users"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_started", ["startedAt"]),
});
```

## Tables Reference

### users
Synced from Clerk via webhooks. Contains user profile and status.

| Field | Type | Description |
|-------|------|-------------|
| clerkId | string | Clerk user ID (for lookup) |
| email | string | User email |
| name | string | Display name |
| avatarUrl | string? | Profile image URL |
| role | "user" \| "admin" | User role |
| status | "online" \| "offline" \| "away" | Presence status |
| lastActiveAt | number? | Unix timestamp of last activity |

### teams
Organizational groups for users and course assignment.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Team name |
| description | string? | Optional description |
| leadId | Id<"users">? | Team lead reference |

### courses
Training content containers.

| Field | Type | Description |
|-------|------|-------------|
| title | string | Course title |
| description | string? | Course description |
| coverImageId | Id<"_storage">? | Convex storage ID for cover image |
| creatorId | Id<"users"> | Admin who created |
| status | "draft" \| "published" | Publication status |
| visibility | "all_teams" \| "specific_teams" \| "specific_users" | Access control |
| displayOrder | number | Sort order for users |
| viewCount | number | Total views |
| publishedAt | number? | Unix timestamp of publication |

### lessons
Individual learning content units.

| Field | Type | Description |
|-------|------|-------------|
| sectionId | Id<"sections"> | Parent section |
| type | "text" \| "embed" \| "quiz" \| "files" | Lesson type |
| title | string | Lesson title |
| description | string? | Lesson description |
| estimatedDuration | number? | Duration in minutes |
| content | any? | Plate.js JSON content |
| displayOrder | number | Sort order |

### quizConfigs
Configuration for quiz lessons.

| Field | Type | Description |
|-------|------|-------------|
| lessonId | Id<"lessons"> | Parent lesson |
| passingScore | number | Passing threshold (0-100) |
| allowRetry | boolean | Retry enabled |
| maxAttempts | number? | Max retries (null = unlimited) |
| showAnswers | boolean | Show correct answers after |

### progress
User progress tracking per lesson.

| Field | Type | Description |
|-------|------|-------------|
| userId | Id<"users"> | User reference |
| lessonId | Id<"lessons"> | Lesson reference |
| status | "not_started" \| "in_progress" \| "completed" | Progress status |
| completedAt | number? | Completion timestamp |
| lastAccessedAt | number | Last access timestamp |
| timeSpent | number | Seconds spent |

### messages
Chat messages in conversations.

| Field | Type | Description |
|-------|------|-------------|
| conversationId | Id<"conversations"> | Conversation reference |
| senderId | Id<"users"> | Sender reference |
| content | string | Message text |
| createdAt | number | Message timestamp |

### comments
User comments on courses and lessons.

| Field | Type | Description |
|-------|------|-------------|
| authorId | Id<"users"> | Author reference |
| courseId | Id<"courses">? | Course (if course comment) |
| lessonId | Id<"lessons">? | Lesson (if lesson comment) |
| parentId | Id<"comments">? | Parent (for threads) |
| content | string | Comment text |
| isPinned | boolean | Pinned status |
| createdAt | number | Comment creation timestamp |
| updatedAt | number? | Last edit timestamp |

### activityLogs
System event tracking for analytics.

| Field | Type | Description |
|-------|------|-------------|
| userId | Id<"users"> | User who performed action |
| actionType | enum | Action type (login, lesson_view, etc.) |
| category | enum | Category (user, course, quiz, etc.) |
| entityType | string? | Related entity type |
| entityId | string? | Related entity ID |
| metadata | any? | Additional context |
| timestamp | number | When action occurred |

## Validation Rules

### User
- Email synced from Clerk (validated there)
- Name minimum 2 characters
- Role can only be changed by admins

### Course
- Title minimum 3 characters, maximum 200
- Description maximum 2000 characters
- Must have at least one section before publishing
- Each section must have at least one lesson before publishing

### Lesson
- Title minimum 3 characters, maximum 200
- Estimated duration must be positive integer
- Quiz type must have at least one question with at least one correct answer

### Quiz
- Passing score between 1-100
- Max attempts between 1-10 (or null for unlimited)
- Each question must have 2-6 options

### File
- Maximum 50MB per file (Convex storage limit)
- Allowed extensions: pdf, doc, docx, xls, xlsx, ppt, pptx, jpg, jpeg, png, gif, zip

### Comment
- Content minimum 1 character, maximum 5000
- Maximum nesting depth: 3 levels

### Message
- Content minimum 1 character, maximum 10000

## Convex Indexes

All indexes are defined in the schema above. Key patterns:

- **Lookup by ID**: All tables have automatic `_id` index
- **Foreign key lookups**: `by_user`, `by_course`, `by_lesson`, etc.
- **Composite indexes**: `by_user_lesson`, `by_user_team`, etc. for efficient joins
- **Ordering**: `by_course_order`, `by_section_order` for display order queries

## Real-time Subscriptions

Convex provides automatic real-time updates for all queries. Key subscription patterns:

```typescript
// These all update in real-time automatically:
useQuery(api.messages.list, { conversationId })
useQuery(api.comments.list, { lessonId })
useQuery(api.users.getOnlineUsers)
useQuery(api.progress.getCourseProgress, { courseId, userId })
```
