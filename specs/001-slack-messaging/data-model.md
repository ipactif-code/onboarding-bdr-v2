# Data Model: BDR Messaging

**Feature**: BDR Messaging — Slack-like Communication Platform
**Date**: 2025-12-18
**Database**: Convex

## Overview

This document defines the complete Convex schema for the messaging platform. It extends the existing schema with new tables while maintaining compatibility with current features.

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │       │    channels     │       │   courses       │
│   (existing)    │◄──────│                 │──────►│   (existing)    │
└────────┬────────┘       └────────┬────────┘       └─────────────────┘
         │                         │
         │    ┌────────────────────┼────────────────────┐
         │    │                    │                    │
         ▼    ▼                    ▼                    ▼
┌─────────────────┐       ┌─────────────────┐  ┌─────────────────┐
│ channelMembers  │       │    messages     │  │ channelAdmins   │
│                 │       │                 │  │                 │
└─────────────────┘       └────────┬────────┘  └─────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   reactions     │       │  voiceMessages  │       │    mentions     │
│                 │       │                 │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│  conversations  │◄──────│ conversationPar │
│   (enhanced)    │       │   ticipants     │
└────────┬────────┘       └─────────────────┘
         │
         ▼
┌─────────────────┐
│    messages     │
│  (polymorphic)  │
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      pins       │       │    bookmarks    │       │ typingIndicators│
└─────────────────┘       └─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ notificationPref│       │   userStatus    │
│   erences       │       │   (in users)    │
└─────────────────┘       └─────────────────┘
```

## Schema Definition

### Extended Users Table

```typescript
// Extends existing users table with presence and status fields
users: defineTable({
  // Existing fields
  clerkId: v.string(),
  email: v.string(),
  name: v.string(),
  avatarUrl: v.optional(v.string()),
  role: v.union(v.literal("user"), v.literal("admin")),

  // Enhanced presence fields
  status: v.union(
    v.literal("online"),
    v.literal("offline"),
    v.literal("away"),
    v.literal("dnd")  // Do Not Disturb - NEW
  ),
  lastActiveAt: v.optional(v.number()),

  // Custom status - NEW
  customStatus: v.optional(v.string()),
  customStatusEmoji: v.optional(v.string()),
  customStatusExpiresAt: v.optional(v.number()),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_email", ["email"])
  .index("by_status", ["status"])
  .index("by_last_active", ["lastActiveAt"]),  // NEW - for inactive user queries
```

### Channels

```typescript
// Channels for group communication
channels: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  topic: v.optional(v.string()),

  type: v.union(
    v.literal("public"),    // Visible to all, anyone can join
    v.literal("private"),   // Invite only
    v.literal("course")     // Auto-created for courses
  ),

  // Course linking (for type: "course")
  courseId: v.optional(v.id("courses")),

  // Ownership
  creatorId: v.id("users"),
  createdAt: v.number(),

  // State
  isArchived: v.boolean(),
  archivedAt: v.optional(v.number()),
  archivedBy: v.optional(v.id("users")),

  // Metadata
  memberCount: v.number(),  // Denormalized for performance
  lastMessageAt: v.optional(v.number()),
})
  .index("by_type", ["type"])
  .index("by_course", ["courseId"])
  .index("by_name", ["name"])
  .index("by_archived", ["isArchived"])
  .index("by_last_message", ["lastMessageAt"]),
```

### Channel Members

```typescript
// Channel membership and read state
channelMembers: defineTable({
  channelId: v.id("channels"),
  userId: v.id("users"),

  // Role within channel
  role: v.union(
    v.literal("owner"),      // Original creator or transferred ownership
    v.literal("admin"),      // Can manage members, settings
    v.literal("moderator"),  // Can moderate messages
    v.literal("member")      // Regular participant
  ),

  // Timestamps
  joinedAt: v.number(),
  leftAt: v.optional(v.number()),  // Soft leave for history access

  // Read state
  lastReadMessageId: v.optional(v.id("messages")),
  lastReadAt: v.optional(v.number()),

  // Notification preferences (per-channel override)
  notificationLevel: v.union(
    v.literal("all"),       // All messages
    v.literal("mentions"),  // Only @mentions
    v.literal("none")       // Muted
  ),

  // Moderation state
  isMuted: v.boolean(),       // Cannot send messages
  mutedUntil: v.optional(v.number()),
  isBanned: v.boolean(),      // Cannot access channel
})
  .index("by_channel", ["channelId"])
  .index("by_user", ["userId"])
  .index("by_channel_user", ["channelId", "userId"])
  .index("by_user_active", ["userId", "leftAt"]),  // For active memberships
```

### Channel Admins (for Course Channels)

```typescript
// Additional admin access for course channels (instructors)
channelAdmins: defineTable({
  channelId: v.id("channels"),
  userId: v.id("users"),
  grantedAt: v.number(),
  grantedBy: v.id("users"),  // System or admin who granted access
  reason: v.union(
    v.literal("course_instructor"),
    v.literal("global_admin"),
    v.literal("manual_grant")
  ),
})
  .index("by_channel", ["channelId"])
  .index("by_user", ["userId"])
  .index("by_channel_user", ["channelId", "userId"]),
```

### Enhanced Conversations (DMs)

```typescript
// Direct message conversations (enhanced from existing)
conversations: defineTable({
  type: v.union(
    v.literal("direct"),     // 1:1 DM
    v.literal("group"),      // Group DM (2-8 participants)
    v.literal("broadcast")   // Admin broadcasts (existing)
  ),

  // For group DMs
  name: v.optional(v.string()),  // Custom name for group

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
  lastMessageAt: v.optional(v.number()),

  // State
  isActive: v.boolean(),  // False if all participants left
})
  .index("by_type", ["type"])
  .index("by_updated", ["updatedAt"])
  .index("by_last_message", ["lastMessageAt"]),
```

### Enhanced Conversation Participants

```typescript
// Conversation participants (enhanced from existing)
conversationParticipants: defineTable({
  conversationId: v.id("conversations"),
  userId: v.id("users"),

  // Timestamps
  joinedAt: v.number(),
  leftAt: v.optional(v.number()),

  // Read state
  lastReadMessageId: v.optional(v.id("messages")),
  lastReadAt: v.optional(v.number()),

  // Notification preferences
  notificationLevel: v.union(
    v.literal("all"),
    v.literal("mentions"),
    v.literal("none")
  ),

  // For group DMs - who added this user
  addedBy: v.optional(v.id("users")),
})
  .index("by_conversation", ["conversationId"])
  .index("by_user", ["userId"])
  .index("by_user_conversation", ["userId", "conversationId"])
  .index("by_user_active", ["userId", "leftAt"]),
```

### Messages (Polymorphic)

```typescript
// Messages - works for both channels and DMs
messages: defineTable({
  // Container reference (one must be set)
  channelId: v.optional(v.id("channels")),
  conversationId: v.optional(v.id("conversations")),

  // Sender
  senderId: v.id("users"),

  // Content
  content: v.string(),  // Rich text JSON or plain text
  contentType: v.union(
    v.literal("text"),
    v.literal("voice"),
    v.literal("file"),
    v.literal("system")  // System messages (user joined, etc.)
  ),

  // Threading
  parentId: v.optional(v.id("messages")),  // For thread replies
  threadReplyCount: v.number(),  // Denormalized count
  threadLastReplyAt: v.optional(v.number()),

  // Lesson linking (for course channel threads)
  lessonId: v.optional(v.id("lessons")),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),

  // Edit history
  isEdited: v.boolean(),
  editHistory: v.optional(v.array(v.object({
    content: v.string(),
    editedAt: v.number(),
  }))),

  // Deletion state
  deletedAt: v.optional(v.number()),
  deletedBy: v.optional(v.id("users")),
  anonymizedAt: v.optional(v.number()),

  // Engagement metrics (denormalized)
  reactionCount: v.number(),

  // Delivery status
  status: v.union(
    v.literal("sending"),
    v.literal("sent"),
    v.literal("failed")
  ),
})
  .index("by_channel", ["channelId"])
  .index("by_channel_time", ["channelId", "createdAt"])
  .index("by_conversation", ["conversationId"])
  .index("by_conversation_time", ["conversationId", "createdAt"])
  .index("by_parent", ["parentId"])
  .index("by_parent_time", ["parentId", "createdAt"])
  .index("by_lesson", ["lessonId"])
  .index("by_sender", ["senderId"])
  .index("by_sender_time", ["senderId", "createdAt"])
  .index("by_deleted", ["deletedAt"])
  .searchIndex("search_content", {
    searchField: "content",
    filterFields: ["channelId", "conversationId", "senderId"],
  }),
```

### Voice Messages

```typescript
// Voice message metadata
voiceMessages: defineTable({
  messageId: v.id("messages"),

  // Storage
  storageId: v.id("_storage"),
  fileSize: v.number(),
  mimeType: v.string(),  // audio/webm or audio/mp4

  // Audio metadata
  duration: v.number(),  // Seconds
  waveformData: v.array(v.number()),  // Amplitude samples for visualization

  // Transcription
  transcription: v.optional(v.string()),
  transcriptionStatus: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  ),
  transcriptionError: v.optional(v.string()),
  transcriptionCompletedAt: v.optional(v.number()),

  // User corrections
  transcriptionEdited: v.boolean(),
  originalTranscription: v.optional(v.string()),
})
  .index("by_message", ["messageId"])
  .index("by_transcription_status", ["transcriptionStatus"]),
```

### Reactions

```typescript
// Emoji reactions on messages
reactions: defineTable({
  messageId: v.id("messages"),
  userId: v.id("users"),
  emoji: v.string(),  // Unicode emoji character
  createdAt: v.number(),
})
  .index("by_message", ["messageId"])
  .index("by_message_emoji", ["messageId", "emoji"])
  .index("by_user", ["userId"])
  .index("by_message_user", ["messageId", "userId"]),
```

### Mentions

```typescript
// @mentions extracted from messages
mentions: defineTable({
  messageId: v.id("messages"),

  // Mention type
  type: v.union(
    v.literal("user"),     // @username
    v.literal("here"),     // @here (online members)
    v.literal("everyone")  // @everyone (all members)
  ),

  // For user mentions
  mentionedUserId: v.optional(v.id("users")),

  // Context
  channelId: v.optional(v.id("channels")),
  conversationId: v.optional(v.id("conversations")),

  // Notification delivery
  notifiedAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_message", ["messageId"])
  .index("by_mentioned_user", ["mentionedUserId"])
  .index("by_channel", ["channelId"])
  .index("by_user_unnotified", ["mentionedUserId", "notifiedAt"]),
```

### Pins

```typescript
// Pinned messages per channel
pins: defineTable({
  channelId: v.id("channels"),
  messageId: v.id("messages"),
  pinnedBy: v.id("users"),
  pinnedAt: v.number(),
})
  .index("by_channel", ["channelId"])
  .index("by_channel_time", ["channelId", "pinnedAt"])
  .index("by_message", ["messageId"]),
```

### Bookmarks

```typescript
// Personal bookmarks
bookmarks: defineTable({
  userId: v.id("users"),
  messageId: v.id("messages"),
  note: v.optional(v.string()),  // Personal note about bookmark
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_time", ["userId", "createdAt"])
  .index("by_message", ["messageId"])
  .index("by_user_message", ["userId", "messageId"]),
```

### Typing Indicators

```typescript
// Ephemeral typing state (DMs only in v1)
typingIndicators: defineTable({
  conversationId: v.id("conversations"),
  userId: v.id("users"),
  expiresAt: v.number(),  // Auto-expire after 3 seconds
})
  .index("by_conversation", ["conversationId"])
  .index("by_conversation_user", ["conversationId", "userId"])
  .index("by_expires", ["expiresAt"]),  // For cleanup
```

### Notification Preferences

```typescript
// Global notification preferences per user
notificationPreferences: defineTable({
  userId: v.id("users"),

  // Global settings
  enablePush: v.boolean(),
  enableSound: v.boolean(),
  enableDesktop: v.boolean(),

  // Do Not Disturb
  dndEnabled: v.boolean(),
  dndStart: v.optional(v.string()),  // "22:00" format
  dndEnd: v.optional(v.string()),    // "08:00" format

  // Default notification level for new channels/DMs
  defaultChannelLevel: v.union(
    v.literal("all"),
    v.literal("mentions"),
    v.literal("none")
  ),
  defaultDmLevel: v.union(
    v.literal("all"),
    v.literal("none")
  ),

  // Keyword alerts
  keywords: v.array(v.string()),  // Notify when these words appear
})
  .index("by_user", ["userId"]),
```

### File Attachments

```typescript
// File attachments on messages
messageAttachments: defineTable({
  messageId: v.id("messages"),

  // Storage (either Convex Storage or UploadThing)
  storageId: v.optional(v.id("_storage")),
  downloadUrl: v.optional(v.string()),

  // File metadata
  fileName: v.string(),
  fileSize: v.number(),
  fileType: v.string(),  // MIME type

  // For images - thumbnail
  thumbnailUrl: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),

  uploadedAt: v.number(),
})
  .index("by_message", ["messageId"]),
```

### Rate Limiting

```typescript
// Rate limit tracking
rateLimits: defineTable({
  userId: v.id("users"),
  type: v.union(
    v.literal("text_message"),
    v.literal("voice_message")
  ),
  windowStart: v.number(),  // Start of current window
  count: v.number(),        // Count within window
})
  .index("by_user_type", ["userId", "type"]),
```

// ============================================================================
// TRANSCRIPTION COST CONTROL
// ============================================================================

/**
 * Daily transcription usage per user.
 * Resets at midnight UTC.
 *
 * Limits: 30 min/user/day, $2000/month global
 */
transcriptionUsage: defineTable({
  userId: v.id("users"),
  date: v.string(),  // "YYYY-MM-DD"
  dailyMinutesUsed: v.number(),
  dailyTranscriptionCount: v.number(),
  estimatedCostCents: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user_date", ["userId", "date"])
  .index("by_date", ["date"]),

/**
 * Monthly global budget tracking.
 * One record per month.
 */
transcriptionBudget: defineTable({
  month: v.string(),  // "YYYY-MM"
  totalMinutesUsed: v.number(),
  totalTranscriptionCount: v.number(),
  totalCostCents: v.number(),
  budgetCents: v.number(),  // Default 200000 ($2000)
  alertSentAt80Percent: v.optional(v.number()),
  alertSentAt100Percent: v.optional(v.number()),
  isDisabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_month", ["month"]),

// ============================================================================
// AI TRAINING CORPUS
// ============================================================================

/**
 * Anonymized messages for AI training.
 *
 * Added when messages are anonymized (90 days after deletion).
 * Used for future course assistant chatbot.
 */
aiTrainingCorpus: defineTable({
  sourceMessageHash: v.string(),
  sourceType: v.union(v.literal("text"), v.literal("voice_transcription")),
  anonymizedContent: v.string(),
  metadata: v.object({
    wordCount: v.number(),
    characterCount: v.number(),
    hasCodeBlock: v.boolean(),
    hasLinks: v.boolean(),
    channelType: v.optional(v.union(
      v.literal("public"),
      v.literal("private"),
      v.literal("course")
    )),
    isThreadReply: v.boolean(),
    isLessonDiscussion: v.boolean(),
    detectedLanguage: v.optional(v.string()),
    reactionCount: v.number(),
    wasEdited: v.boolean(),
  }),
  category: v.optional(v.union(
    v.literal("question"),
    v.literal("answer"),
    v.literal("discussion"),
    v.literal("announcement"),
    v.literal("feedback"),
    v.literal("other")
  )),
  isProcessed: v.boolean(),
  processedAt: v.optional(v.number()),
  originalCreatedAt: v.number(),
  anonymizedAt: v.number(),
})
  .index("by_source_hash", ["sourceMessageHash"])
  .index("by_type", ["sourceType"])
  .index("by_category", ["category"])
  .index("by_unprocessed", ["isProcessed"])
  .index("by_anonymized_date", ["anonymizedAt"]),

// ============================================================================
// GDPR & MESSAGE RETENTION
// ============================================================================

/**
 * Tracks deleted messages for retention compliance.
 * Enables admin recovery within 90 days.
 */
messageRetention: defineTable({
  messageId: v.id("messages"),
  deletedAt: v.number(),
  deletedBy: v.id("users"),
  deletionReason: v.union(
    v.literal("user_deleted"),
    v.literal("admin_moderation"),
    v.literal("gdpr_request"),
    v.literal("user_account_deleted")
  ),
  anonymizationScheduledFor: v.number(),
  anonymizedAt: v.optional(v.number()),
  addedToCorpus: v.boolean(),
  corpusEntryId: v.optional(v.id("aiTrainingCorpus")),
  gdprRequestId: v.optional(v.string()),
  encryptedContentBackup: v.optional(v.string()),
  backupExpiresAt: v.optional(v.number()),
})
  .index("by_message", ["messageId"])
  .index("by_scheduled_anonymization", ["anonymizationScheduledFor"])
  .index("by_deleted_by", ["deletedBy"])
  .index("by_gdpr_request", ["gdprRequestId"]),

/**
 * GDPR data export and deletion requests.
 */
gdprRequests: defineTable({
  userId: v.id("users"),
  type: v.union(v.literal("export"), v.literal("deletion")),
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  ),
  requestedAt: v.number(),
  processedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  exportFileId: v.optional(v.id("_storage")),
  exportExpiresAt: v.optional(v.number()),
  messagesDeleted: v.optional(v.number()),
  reactionsDeleted: v.optional(v.number()),
  mentionsAnonymized: v.optional(v.number()),
  error: v.optional(v.string()),
  retryCount: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_status", ["status"])
  .index("by_requested", ["requestedAt"]),

## Indices Summary

| Table | Index | Purpose |
|-------|-------|---------|
| users | by_last_active | Find inactive users for auto-away |
| channels | by_course | Link channels to courses |
| channels | by_last_message | Sort channels by activity |
| channelMembers | by_user_active | Get user's active memberships |
| messages | by_channel_time | Paginate channel messages |
| messages | by_parent_time | Load thread replies |
| messages | search_content | Full-text search |
| voiceMessages | by_transcription_status | Process pending transcriptions |
| mentions | by_user_unnotified | Deliver pending notifications |
| typingIndicators | by_expires | Clean up expired indicators |
| transcriptionUsage | by_user_date | Daily usage lookup |
| transcriptionBudget | by_month | Monthly budget check |
| aiTrainingCorpus | by_unprocessed | Training batch processing |
| messageRetention | by_scheduled_anonymization | Anonymization cron job |
| gdprRequests | by_status | Process pending requests |

## Migration Strategy

### Phase 1: Add New Tables
1. Create all new tables with no data
2. Update schema.ts with new definitions
3. Deploy schema changes

### Phase 2: Enhance Existing Tables
1. Add new fields to `users` table (customStatus, etc.)
2. Add new fields to `conversations` table (lastMessageAt, etc.)
3. Backfill defaults for new required fields

### Phase 3: Data Migration
1. If needed, migrate existing `messages` to new structure
2. Generate channelMembers from existing data
3. Initialize notification preferences for existing users

## Data Integrity Rules

1. **Message Container**: Every message must have exactly one of `channelId` or `conversationId`
2. **Thread Depth**: Threads are single-level (no nested threads)
3. **Membership**: Users can only access messages in channels/conversations they're members of
4. **Course Channels**: One channel per course, auto-created on publish
5. **Group DM Size**: 2-8 participants maximum
6. **Voice Duration**: 1-300 seconds (enforced at upload)
7. **Message Length**: 4000 characters maximum
