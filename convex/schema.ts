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
    type: v.union(v.literal("direct"), v.literal("broadcast")),
    updatedAt: v.number(),
  }).index("by_updated", ["updatedAt"]),

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
