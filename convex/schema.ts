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
    // Enhanced presence fields
    status: v.union(
      v.literal("online"),
      v.literal("offline"),
      v.literal("away"),
      v.literal("dnd") // Do Not Disturb
    ),
    lastActiveAt: v.optional(v.number()),
    // Custom status
    customStatus: v.optional(v.string()),
    customStatusEmoji: v.optional(v.string()),
    customStatusExpiresAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_last_active", ["lastActiveAt"]),

  // Teams
  teams: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    leadId: v.optional(v.id("users")),
  }).index("by_name", ["name"]),

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
  }).index("by_name", ["name"]),

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
  }).index("by_lesson", ["lessonId"]),

  // Quiz configuration for quiz lessons
  quizConfigs: defineTable({
    lessonId: v.id("lessons"),
    passingScore: v.number(),
    allowRetry: v.boolean(),
    maxAttempts: v.optional(v.number()), // null = unlimited
    showAnswers: v.boolean(),
  }).index("by_lesson", ["lessonId"]),

  // Quiz questions
  quizQuestions: defineTable({
    quizConfigId: v.id("quizConfigs"),
    questionText: v.string(),
    options: v.array(
      v.object({
        text: v.string(),
        isCorrect: v.boolean(),
      })
    ),
    explanation: v.optional(v.string()),
    points: v.number(),
    displayOrder: v.number(),
  })
    .index("by_quiz", ["quizConfigId"])
    .index("by_quiz_order", ["quizConfigId", "displayOrder"]),

  // File attachments for file lessons
  files: defineTable({
    lessonId: v.id("lessons"),
    storageId: v.optional(v.id("_storage")), // Optional for backward compatibility
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    downloadUrl: v.optional(v.string()), // UploadThing URL stored directly
    uploadedAt: v.number(),
  }).index("by_lesson", ["lessonId"]),

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
    type: v.union(
      v.literal("direct"), // 1:1 DM
      v.literal("group"), // Group DM (2-8 participants)
      v.literal("broadcast") // Admin broadcasts (existing)
    ),
    // For group DMs
    name: v.optional(v.string()),
    // Timestamps
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
    lastMessageAt: v.optional(v.number()),
    // State
    isActive: v.optional(v.boolean()),
  })
    .index("by_type", ["type"])
    .index("by_updated", ["updatedAt"])
    .index("by_last_message", ["lastMessageAt"]),

  // Conversation participants
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
    notificationLevel: v.optional(
      v.union(v.literal("all"), v.literal("mentions"), v.literal("none"))
    ),
    // For group DMs - who added this user
    addedBy: v.optional(v.id("users")),
    // Favorites
    isFavorite: v.optional(v.boolean()), // User has starred this conversation
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_user_conversation", ["userId", "conversationId"])
    .index("by_user_active", ["userId", "leftAt"])
    .index("by_user_favorite", ["userId", "isFavorite"]),

  // Messages - works for both channels and DMs
  messages: defineTable({
    // Container reference (one must be set)
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
    // Sender
    senderId: v.id("users"),
    // Content
    content: v.string(),
    contentType: v.optional(
      v.union(
        v.literal("text"),
        v.literal("voice"),
        v.literal("file"),
        v.literal("system")
      )
    ),
    // Threading
    parentId: v.optional(v.id("messages")),
    threadReplyCount: v.optional(v.number()),
    threadLastReplyAt: v.optional(v.number()),
    // Lesson linking (for course channel threads)
    lessonId: v.optional(v.id("lessons")),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    // Edit history
    isEdited: v.optional(v.boolean()),
    editHistory: v.optional(
      v.array(
        v.object({
          content: v.string(),
          editedAt: v.number(),
        })
      )
    ),
    // Deletion state
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    anonymizedAt: v.optional(v.number()),
    // Engagement metrics (denormalized)
    reactionCount: v.optional(v.number()),
    // Delivery status
    status: v.optional(
      v.union(v.literal("sending"), v.literal("sent"), v.literal("failed"))
    ),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_time", ["channelId", "createdAt"])
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_time", ["conversationId", "createdAt"])
    .index("by_parent", ["parentId"])
    .index("by_parent_time", ["parentId", "createdAt"])
    .index("by_lesson", ["lessonId"])
    .index("by_lesson_channel", ["lessonId", "channelId"])
    .index("by_sender", ["senderId"])
    .index("by_sender_time", ["senderId", "createdAt"])
    .index("by_deleted", ["deletedAt"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["channelId", "conversationId", "senderId", "contentType"],
    }),

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

  // ============================================================================
  // MESSAGING SYSTEM TABLES
  // ============================================================================

  // Channels for group communication
  channels: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    topic: v.optional(v.string()),
    type: v.union(
      v.literal("public"), // Visible to all, anyone can join
      v.literal("private"), // Invite only
      v.literal("course") // Auto-created for courses
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
    memberCount: v.number(),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_type", ["type"])
    .index("by_course", ["courseId"])
    .index("by_name", ["name"])
    .index("by_archived", ["isArchived"])
    .index("by_last_message", ["lastMessageAt"]),

  // Channel membership and read state
  channelMembers: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    // Role within channel
    role: v.union(
      v.literal("owner"), // Original creator or transferred ownership
      v.literal("admin"), // Can manage members, settings
      v.literal("moderator"), // Can moderate messages
      v.literal("member") // Regular participant
    ),
    // Timestamps
    joinedAt: v.number(),
    leftAt: v.optional(v.number()), // Soft leave for history access
    // Read state
    lastReadMessageId: v.optional(v.id("messages")),
    lastReadAt: v.optional(v.number()),
    // Notification preferences (per-channel override)
    notificationLevel: v.union(
      v.literal("all"), // All messages
      v.literal("mentions"), // Only @mentions
      v.literal("none") // Muted
    ),
    // Moderation state
    isMuted: v.boolean(), // Cannot send messages
    mutedUntil: v.optional(v.number()),
    isBanned: v.boolean(), // Cannot access channel
    // Favorites
    isFavorite: v.optional(v.boolean()), // User has starred this channel
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_channel_user", ["channelId", "userId"])
    .index("by_user_active", ["userId", "leftAt"])
    .index("by_user_favorite", ["userId", "isFavorite"]),

  // Additional admin access for course channels (instructors)
  channelAdmins: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    grantedAt: v.number(),
    grantedBy: v.id("users"),
    reason: v.union(
      v.literal("course_instructor"),
      v.literal("global_admin"),
      v.literal("manual_grant")
    ),
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_channel_user", ["channelId", "userId"]),

  // Voice message metadata
  voiceMessages: defineTable({
    messageId: v.id("messages"),
    // Storage
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
    // Audio metadata
    duration: v.number(), // Seconds
    waveformData: v.array(v.number()), // Amplitude samples for visualization
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

  // Emoji reactions on messages
  reactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(), // Unicode emoji character
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_emoji", ["messageId", "emoji"])
    .index("by_user", ["userId"])
    .index("by_message_user", ["messageId", "userId"]),

  // @mentions extracted from messages
  mentions: defineTable({
    messageId: v.id("messages"),
    // Mention type
    type: v.union(
      v.literal("user"), // @username
      v.literal("here"), // @here (online members)
      v.literal("everyone") // @everyone (all members)
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

  // Pinned messages per channel or conversation (DM)
  pins: defineTable({
    channelId: v.optional(v.id("channels")), // For channel pins
    conversationId: v.optional(v.id("conversations")), // For DM pins
    messageId: v.id("messages"),
    pinnedBy: v.id("users"),
    pinnedAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_time", ["channelId", "pinnedAt"])
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_time", ["conversationId", "pinnedAt"])
    .index("by_message", ["messageId"]),

  // Personal bookmarks
  bookmarks: defineTable({
    userId: v.id("users"),
    messageId: v.id("messages"),
    note: v.optional(v.string()), // Personal note about bookmark
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_time", ["userId", "createdAt"])
    .index("by_message", ["messageId"])
    .index("by_user_message", ["userId", "messageId"]),

  // Ephemeral typing state (DMs only in v1)
  typingIndicators: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    expiresAt: v.number(), // Auto-expire after 3 seconds
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_expires", ["expiresAt"]),

  // Global notification preferences per user
  notificationPreferences: defineTable({
    userId: v.id("users"),
    // Global settings
    enablePush: v.boolean(),
    enableSound: v.boolean(),
    enableDesktop: v.boolean(),
    // Do Not Disturb
    dndEnabled: v.boolean(),
    dndStart: v.optional(v.string()), // "22:00" format
    dndEnd: v.optional(v.string()), // "08:00" format
    // Default notification level for new channels/DMs
    defaultChannelLevel: v.union(
      v.literal("all"),
      v.literal("mentions"),
      v.literal("none")
    ),
    defaultDmLevel: v.union(v.literal("all"), v.literal("none")),
    // Keyword alerts
    keywords: v.array(v.string()), // Notify when these words appear
  }).index("by_user", ["userId"]),

  // File attachments on messages
  messageAttachments: defineTable({
    messageId: v.id("messages"),
    // Storage (either Convex Storage or UploadThing)
    storageId: v.optional(v.id("_storage")),
    downloadUrl: v.optional(v.string()),
    // File metadata
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(), // MIME type
    // For images - thumbnail
    thumbnailUrl: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    uploadedAt: v.number(),
  }).index("by_message", ["messageId"]),

  // Rate limit tracking
  rateLimits: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("text_message"),
      v.literal("voice_message"),
      v.literal("link_preview")
    ),
    windowStart: v.number(), // Start of current window
    count: v.number(), // Count within window
  }).index("by_user_type", ["userId", "type"]),

  // ============================================================================
  // TRANSCRIPTION COST CONTROL
  // ============================================================================

  // Daily transcription usage per user
  transcriptionUsage: defineTable({
    userId: v.id("users"),
    date: v.string(), // "YYYY-MM-DD"
    dailyMinutesUsed: v.number(),
    dailyTranscriptionCount: v.number(),
    estimatedCostCents: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_date", ["date"]),

  // Monthly global budget tracking
  transcriptionBudget: defineTable({
    month: v.string(), // "YYYY-MM"
    totalMinutesUsed: v.number(),
    totalTranscriptionCount: v.number(),
    totalCostCents: v.number(),
    budgetCents: v.number(), // Default 200000 ($2000)
    alertSentAt80Percent: v.optional(v.number()),
    alertSentAt100Percent: v.optional(v.number()),
    isDisabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_month", ["month"]),

  // ============================================================================
  // AI TRAINING CORPUS
  // ============================================================================

  // Anonymized messages for AI training
  aiTrainingCorpus: defineTable({
    sourceMessageHash: v.string(),
    sourceType: v.union(v.literal("text"), v.literal("voice_transcription")),
    anonymizedContent: v.string(),
    metadata: v.object({
      wordCount: v.number(),
      characterCount: v.number(),
      hasCodeBlock: v.boolean(),
      hasLinks: v.boolean(),
      channelType: v.optional(
        v.union(v.literal("public"), v.literal("private"), v.literal("course"))
      ),
      isThreadReply: v.boolean(),
      isLessonDiscussion: v.boolean(),
      detectedLanguage: v.optional(v.string()),
      reactionCount: v.number(),
      wasEdited: v.boolean(),
    }),
    category: v.optional(
      v.union(
        v.literal("question"),
        v.literal("answer"),
        v.literal("discussion"),
        v.literal("announcement"),
        v.literal("feedback"),
        v.literal("other")
      )
    ),
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

  // Tracks deleted messages for retention compliance
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

  // Thread read status - tracks when users last read each thread
  threadReadStatus: defineTable({
    userId: v.id("users"),
    parentMessageId: v.id("messages"), // The thread's parent message ID
    lastReadAt: v.number(), // Timestamp of last read
  })
    .index("by_user", ["userId"])
    .index("by_user_thread", ["userId", "parentMessageId"]),

  // Search history for user search queries
  searchHistory: defineTable({
    userId: v.id("users"),
    query: v.string(),
    resultCount: v.number(),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_recent", ["userId", "timestamp"]),

  // GDPR data export and deletion requests
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
});
