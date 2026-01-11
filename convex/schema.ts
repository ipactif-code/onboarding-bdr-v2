import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================================================
  // CORE - Users, Teams, Membership
  // ============================================================================

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

  // ============================================================================
  // LMS - Courses, Lessons, Progress
  // ============================================================================

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

  // ============================================================================
  // MESSAGING - Channels, Conversations, Messages
  // ============================================================================

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

  // LMS course/lesson comments (NOT KB comments)
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

  // ============================================================================
  // ANALYTICS & ACTIVITY LOGS
  // ============================================================================

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
    mutedBy: v.optional(v.id("users")), // Who muted this member
    isBanned: v.boolean(), // Cannot access channel
    bannedAt: v.optional(v.number()), // Timestamp when banned
    bannedBy: v.optional(v.id("users")), // Who banned this member
    // Favorites
    isFavorite: v.optional(v.boolean()), // User has starred this channel
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_channel_user", ["channelId", "userId"])
    .index("by_user_active", ["userId", "leftAt"])
    .index("by_user_favorite", ["userId", "isFavorite"])
    .index("by_channel_muted", ["channelId", "mutedUntil"])
    .index("by_channel_banned", ["channelId", "bannedAt"]),

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

  // Message reactions (NOT KB comment reactions)
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

  // Message mentions (NOT KB comment mentions)
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
    // messageId is optional initially (set when attachment is linked to a message)
    messageId: v.optional(v.id("messages")),
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
      v.literal("link_preview"),
      v.literal("channel_export")
    ),
    windowStart: v.number(), // Start of current window
    count: v.number(), // Count within window
  }).index("by_user_type", ["userId", "type"]),

  // ============================================================================
  // TRANSCRIPTION & AI TRAINING
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

  // ============================================================================
  // KNOWLEDGE BASE - Workspaces, Folders, Documents
  // ============================================================================

  /**
   * Knowledge Base Workspaces - Top-level organizational container for documentation.
   * Acts as the root container for folders and documents.
   */
  kbWorkspaces: defineTable({
    // Identity
    name: v.string(),
    slug: v.string(), // URL-safe identifier
    description: v.optional(v.string()),

    // Appearance
    icon: v.optional(v.string()), // Emoji or icon name
    coverImageId: v.optional(v.id("_storage")),

    // Ownership
    ownerId: v.id("users"),

    // Default permissions for new items
    defaultPermission: v.union(
      v.literal("none"),
      v.literal("read"),
      v.literal("write")
    ),

    // State
    isArchived: v.boolean(),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),

    // Timestamps (milliseconds)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"])
    .index("by_archived", ["isArchived"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["ownerId", "isArchived"],
    }),

  /**
   * Knowledge Base Folders - Hierarchical container within workspaces.
   * Supports unlimited nesting with self-referential parentId.
   */
  kbFolders: defineTable({
    // Identity
    name: v.string(),

    // Hierarchy
    workspaceId: v.id("kbWorkspaces"),
    parentId: v.optional(v.id("kbFolders")), // null = root level

    // Appearance
    icon: v.optional(v.string()),

    // Ordering
    displayOrder: v.number(),

    // State
    isArchived: v.boolean(),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),

    // Timestamps (milliseconds)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_parent", ["parentId"])
    .index("by_workspace_parent", ["workspaceId", "parentId"])
    .index("by_workspace_order", ["workspaceId", "displayOrder"])
    .index("by_archived", ["isArchived"]),

  /**
   * Knowledge Base Documents - Document metadata.
   * Content is stored separately in kbDocumentContent for performance.
   */
  kbDocuments: defineTable({
    // Identity
    title: v.string(),

    // Hierarchy
    folderId: v.id("kbFolders"),

    // Appearance
    icon: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),

    // Ownership
    creatorId: v.id("users"),

    // Status
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
    publishedAt: v.optional(v.number()),

    // Ordering
    displayOrder: v.number(),

    // Metadata
    wordCount: v.optional(v.number()),
    lastEditedBy: v.optional(v.id("users")),

    // State
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    permanentDeleteAt: v.optional(v.number()), // 90 days after archive

    // Timestamps (milliseconds)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_folder", ["folderId"])
    .index("by_creator", ["creatorId"])
    .index("by_status", ["status"])
    .index("by_folder_status", ["folderId", "status"])
    .index("by_folder_order", ["folderId", "displayOrder"])
    .index("by_permanent_delete", ["permanentDeleteAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["folderId", "status", "creatorId"],
    }),

  /**
   * Knowledge Base Document Content - Separated content storage.
   * Plate.js JSON content stored separately for performance and versioning.
   */
  kbDocumentContent: defineTable({
    // Reference
    documentId: v.id("kbDocuments"),

    // Content
    content: v.any(), // Plate.js JSON structure
    contentText: v.optional(v.string()), // Extracted plain text for search

    // Size tracking (10MB limit)
    contentSize: v.number(), // Bytes

    // Timestamps (milliseconds)
    updatedAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .searchIndex("search_content", {
      searchField: "contentText",
      filterFields: ["documentId"],
    }),

  /**
   * Knowledge Base Document Versions - Point-in-time snapshots.
   * Stores version history for documents with auto and manual saves.
   */
  kbDocumentVersions: defineTable({
    // Reference
    documentId: v.id("kbDocuments"),

    // Version info
    versionNumber: v.number(),
    versionType: v.union(
      v.literal("auto"), // Auto-saved every 5 min
      v.literal("manual"), // User-triggered save
      v.literal("restore") // Restored from previous version
    ),
    description: v.optional(v.string()), // For manual versions

    // Content snapshot
    content: v.any(), // Plate.js JSON at this point
    contentSize: v.number(),

    // Author
    authorId: v.id("users"),

    // Retention
    expiresAt: v.optional(v.number()), // For auto-versions (7 days)

    // Timestamps (milliseconds)
    createdAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_version", ["documentId", "versionNumber"])
    .index("by_document_time", ["documentId", "createdAt"])
    .index("by_expires", ["expiresAt"]),

  // ============================================================================
  // KNOWLEDGE BASE - Permissions & Audit
  // ============================================================================

  /**
   * Knowledge Base Resource Permissions - RBAC grants for KB resources.
   * Polymorphic: links to workspaces, folders, or documents.
   */
  kbResourcePermissions: defineTable({
    // Resource reference (polymorphic)
    resourceType: v.union(
      v.literal("workspace"),
      v.literal("folder"),
      v.literal("document")
    ),
    workspaceId: v.optional(v.id("kbWorkspaces")),
    folderId: v.optional(v.id("kbFolders")),
    documentId: v.optional(v.id("kbDocuments")),

    // Grantee (one must be set)
    userId: v.optional(v.id("users")),
    teamId: v.optional(v.id("teams")),

    // Permission level
    level: v.union(
      v.literal("none"),
      v.literal("read"),
      v.literal("write"),
      v.literal("admin")
    ),

    // Source
    isInherited: v.boolean(), // Computed from parent
    inheritedFrom: v.optional(v.string()), // "workspace:xxx" or "folder:xxx"

    // Metadata
    grantedBy: v.id("users"),
    grantedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_folder", ["folderId"])
    .index("by_document", ["documentId"])
    .index("by_user", ["userId"])
    .index("by_team", ["teamId"])
    .index("by_resource_user", ["resourceType", "userId"])
    .index("by_resource_team", ["resourceType", "teamId"]),

  /**
   * Knowledge Base Audit Logs - Permission changes and lifecycle events.
   * Tracks all significant actions for compliance and debugging.
   */
  kbAuditLogs: defineTable({
    // Event type
    eventType: v.union(
      // Lifecycle events
      v.literal("document_created"),
      v.literal("document_published"),
      v.literal("document_archived"),
      v.literal("document_deleted"),
      v.literal("document_restored"),
      v.literal("document_content_updated"), // For rate limiting content updates
      v.literal("folder_created"),
      v.literal("folder_archived"),
      v.literal("workspace_created"),
      v.literal("workspace_archived"),
      // Permission events
      v.literal("permission_granted"),
      v.literal("permission_revoked"),
      v.literal("permission_changed")
    ),

    // Resource reference
    resourceType: v.union(
      v.literal("workspace"),
      v.literal("folder"),
      v.literal("document")
    ),
    resourceId: v.string(), // Convex ID as string
    resourceName: v.string(), // Name at time of event

    // Actor
    actorId: v.id("users"),

    // Event details
    details: v.optional(v.any()), // JSON with event-specific data

    // For permission events
    targetUserId: v.optional(v.id("users")),
    targetTeamId: v.optional(v.id("teams")),
    previousLevel: v.optional(v.string()),
    newLevel: v.optional(v.string()),

    // Timestamps (milliseconds)
    timestamp: v.number(),
  })
    .index("by_resource", ["resourceType", "resourceId"])
    .index("by_actor", ["actorId"])
    .index("by_actor_event", ["actorId", "eventType"]) // For rate limiting queries
    .index("by_event_type", ["eventType"])
    .index("by_timestamp", ["timestamp"])
    .index("by_resource_time", ["resourceType", "resourceId", "timestamp"]),

  // ============================================================================
  // KNOWLEDGE BASE - Comments & Collaboration
  // ============================================================================

  /**
   * Knowledge Base Document Comments - Comment threads on documents.
   * Supports both page-level and inline (text selection) comments.
   */
  kbDocumentComments: defineTable({
    // Reference
    documentId: v.id("kbDocuments"),

    // Comment type
    type: v.union(
      v.literal("page"), // Page-level comment
      v.literal("inline") // Attached to text selection
    ),

    // For inline comments - text selection position
    selectionStart: v.optional(v.number()), // Slate point
    selectionEnd: v.optional(v.number()),
    selectedText: v.optional(v.string()), // Quoted text

    // DEPRECATED: Block-relative fields (kept for backward compatibility with existing data)
    // These fields are no longer used - Yjs marks are now source of truth for positions
    blockId: v.optional(v.string()),
    offsetStart: v.optional(v.number()),
    offsetEnd: v.optional(v.number()),

    // Threading
    parentId: v.optional(v.id("kbDocumentComments")), // Reply to

    // Content - Plate.js rich text Value (array of nodes) or plain string
    content: v.any(),

    // Author
    authorId: v.id("users"),

    // State
    isResolved: v.boolean(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),

    // Edit tracking
    isEdited: v.boolean(),
    editedAt: v.optional(v.number()),

    // Timestamps (milliseconds)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_type", ["documentId", "type"])
    .index("by_parent", ["parentId"])
    .index("by_author", ["authorId"])
    .index("by_resolved", ["documentId", "isResolved"]),

  /**
   * Knowledge Base Comment Mentions - @mentions extracted from comments.
   * Tracks who was mentioned for notification and unread tracking.
   */
  kbCommentMentions: defineTable({
    commentId: v.id("kbDocumentComments"),
    type: v.union(
      v.literal("user"), // @username
      v.literal("here"), // @here (online users)
      v.literal("everyone") // @everyone (all users)
    ),
    mentionedUserId: v.optional(v.id("users")), // For type: "user"
    notifiedAt: v.optional(v.number()), // Read tracking - undefined = unread
    createdAt: v.number(),
  })
    .index("by_comment", ["commentId"])
    .index("by_mentioned_user", ["mentionedUserId"])
    .index("by_user_unread", ["mentionedUserId", "notifiedAt"]),

  /**
   * Knowledge Base Comment Reactions - Emoji reactions on comments.
   * Follows the same pattern as the messaging `reactions` table.
   */
  kbCommentReactions: defineTable({
    commentId: v.id("kbDocumentComments"),
    userId: v.id("users"),
    emoji: v.string(), // Unicode emoji character
    createdAt: v.number(),
  })
    .index("by_comment", ["commentId"])
    .index("by_comment_emoji", ["commentId", "emoji"])
    .index("by_user", ["userId"])
    .index("by_comment_user", ["commentId", "userId"]),

  /**
   * Knowledge Base User Favorites - User-starred documents.
   * Allows users to bookmark frequently accessed documents.
   */
  kbUserFavorites: defineTable({
    userId: v.id("users"),
    documentId: v.id("kbDocuments"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_document", ["userId", "documentId"])
    .index("by_user_time", ["userId", "createdAt"]),

  /**
   * Knowledge Base User Recents - Recently accessed documents.
   * Tracks document access for "Recent Documents" feature.
   */
  kbUserRecents: defineTable({
    userId: v.id("users"),
    documentId: v.id("kbDocuments"),
    accessedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_document", ["userId", "documentId"])
    .index("by_user_time", ["userId", "accessedAt"]),

  /**
   * Knowledge Base Document Collaborators - Real-time presence tracking.
   * Tracks active editors on a document with their cursor positions and selections.
   * Used for live collaboration features (showing who's editing, cursor positions).
   */
  kbDocumentCollaborators: defineTable({
    // Reference
    documentId: v.id("kbDocuments"),
    userId: v.id("users"),

    // Cursor appearance
    cursorColor: v.string(), // Hex color for cursor (e.g., "#FF5733")

    // Cursor position (Slate Point structure)
    cursorPosition: v.optional(v.any()), // Slate Point { path: number[], offset: number }

    // Selection range (Slate Range structure)
    selectionRange: v.optional(v.any()), // Slate Range { anchor: Point, focus: Point }

    // Typing indicator
    isTyping: v.boolean(),

    // Activity tracking (milliseconds)
    lastActiveAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_active", ["documentId", "lastActiveAt"])
    .index("by_user", ["userId"])
    .index("by_document_user", ["documentId", "userId"]),

  /**
   * Knowledge Base Collaboration Sessions - Session tracking for analytics.
   * Records collaboration sessions for usage analytics, connection limits,
   * and auditing who has worked on documents.
   */
  kbCollaborationSessions: defineTable({
    // Reference
    documentId: v.id("kbDocuments"),
    userId: v.id("users"),

    // Connection tracking
    connectionId: v.string(), // Hocuspocus/Y.js connection ID

    // Session timing (milliseconds)
    joinedAt: v.number(),
    leftAt: v.optional(v.number()), // null = active session
    duration: v.optional(v.number()), // Calculated on leave (milliseconds)
  })
    .index("by_document", ["documentId"])
    .index("by_user", ["userId"])
    .index("by_document_active", ["documentId", "leftAt"]) // null leftAt = active
    .index("by_connection", ["connectionId"]),

  // ============================================================================
  // KNOWLEDGE BASE - Search & Embeddings
  // ============================================================================

  /**
   * Knowledge Base Document Embeddings - Vector embeddings for semantic search.
   * Documents are chunked and each chunk is embedded separately for RAG.
   * Uses OpenAI text-embedding-3-small (1536 dimensions).
   */
  kbDocumentEmbeddings: defineTable({
    // Reference
    documentId: v.id("kbDocuments"),

    // Chunking
    chunkIndex: v.number(), // 0-based index for multi-chunk documents

    // Content
    content: v.string(), // The text chunk that was embedded

    // Vector embedding
    embedding: v.array(v.float64()), // 1536 dimensions for text-embedding-3-small

    // Timestamps (milliseconds)
    createdAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["documentId"],
    }),

  /**
   * Knowledge Base Search History - User search queries for analytics.
   * Tracks search queries with mode, filters, and result counts.
   */
  kbSearchHistory: defineTable({
    // User reference
    userId: v.id("users"),

    // Query details
    query: v.string(),
    mode: v.union(v.literal("keyword"), v.literal("semantic")),

    // Filters applied
    filters: v.optional(
      v.object({
        workspaceIds: v.optional(v.array(v.id("kbWorkspaces"))),
        creatorIds: v.optional(v.array(v.id("users"))),
      })
    ),

    // Results
    resultCount: v.number(),

    // Timestamps (milliseconds)
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .searchIndex("search_query", {
      searchField: "query",
    }),
});
