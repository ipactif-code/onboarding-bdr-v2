# Data Model: Knowledge Base

**Feature Branch**: `004-knowledge-base`
**Date**: 2026-01-02
**Status**: Complete

## Overview

This document defines the Convex schema extensions for the Knowledge Base feature. All tables are prefixed with `kb` to avoid conflicts with existing tables.

## Entity Relationship Diagram

```
┌─────────────────┐
│   kbWorkspaces  │
│─────────────────│
│ id              │
│ name            │
│ ownerId ────────┼──────────────────────────────────┐
│ defaultPerm     │                                  │
└────────┬────────┘                                  │
         │ 1:N                                       │
         ▼                                           │
┌─────────────────┐                                  │
│   kbFolders     │                                  │
│─────────────────│                                  │
│ id              │                                  │
│ workspaceId ────┼─► kbWorkspaces                   │
│ parentId ───────┼─► kbFolders (self-ref)           │
│ name            │                                  │
└────────┬────────┘                                  │
         │ 1:N                                       │
         ▼                                           │
┌─────────────────┐     ┌──────────────────────┐     │
│   kbDocuments   │     │ kbDocumentContent    │     │
│─────────────────│     │──────────────────────│     │
│ id              │◄────│ documentId           │     │
│ folderId ───────┼─►   │ content (Plate JSON) │     │
│ creatorId ──────┼─────┼──────────────────────┼─────┘
│ title           │     │ contentSize          │     ▼
│ status          │     └──────────────────────┘   users
└────────┬────────┘
         │
         ├─────────────────────────────────────────────────────┐
         │                    │                    │           │
         ▼                    ▼                    ▼           ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│kbDocumentVersions│  │kbDocumentComments│  │kbDocumentLinks  │  │kbDocumentEmbeddings│
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            kbResourcePermissions                                  │
│───────────────────────────────────────────────────────────────────────────────────│
│ Polymorphic: links to kbWorkspaces | kbFolders | kbDocuments                     │
│ Grantee: userId | teamId                                                         │
│ Level: none | read | write | admin                                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            kbAuditLogs                                           │
│───────────────────────────────────────────────────────────────────────────────────│
│ Tracks: permission changes, document lifecycle events                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Schema Definition

### Core Tables

#### kbWorkspaces

Top-level organizational container for documentation.

```typescript
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

  // Timestamps
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
```

#### kbFolders

Hierarchical container within workspaces. Supports unlimited nesting.

```typescript
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

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_workspace", ["workspaceId"])
  .index("by_parent", ["parentId"])
  .index("by_workspace_parent", ["workspaceId", "parentId"])
  .index("by_workspace_order", ["workspaceId", "displayOrder"])
  .index("by_archived", ["isArchived"]),
```

#### kbDocuments

Document metadata (content stored separately for performance).

```typescript
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

  // Timestamps
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
```

#### kbDocumentContent

Separated content storage for performance and versioning.

```typescript
kbDocumentContent: defineTable({
  // Reference
  documentId: v.id("kbDocuments"),

  // Content
  content: v.any(), // Plate.js JSON structure
  contentText: v.optional(v.string()), // Extracted plain text for search

  // Size tracking (10MB limit)
  contentSize: v.number(), // Bytes

  // Timestamps
  updatedAt: v.number(),
})
  .index("by_document", ["documentId"])
  .searchIndex("search_content", {
    searchField: "contentText",
    filterFields: ["documentId"],
  }),
```

### Version History

#### kbDocumentVersions

Point-in-time snapshots of document content.

```typescript
kbDocumentVersions: defineTable({
  // Reference
  documentId: v.id("kbDocuments"),

  // Version info
  versionNumber: v.number(),
  versionType: v.union(
    v.literal("auto"),   // Auto-saved every 5 min
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

  // Timestamps
  createdAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_document_version", ["documentId", "versionNumber"])
  .index("by_document_time", ["documentId", "createdAt"])
  .index("by_expires", ["expiresAt"]),
```

### Permissions

#### kbResourcePermissions

RBAC grants for workspaces, folders, and documents.

```typescript
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
```

### Comments & Discussions

#### kbDocumentComments

Comment threads on documents.

```typescript
kbDocumentComments: defineTable({
  // Reference
  documentId: v.id("kbDocuments"),

  // Comment type
  type: v.union(
    v.literal("page"),   // Page-level comment
    v.literal("inline")  // Attached to text selection
  ),

  // For inline comments
  selectionStart: v.optional(v.number()), // Slate point
  selectionEnd: v.optional(v.number()),
  selectedText: v.optional(v.string()), // Quoted text

  // Threading
  parentId: v.optional(v.id("kbDocumentComments")), // Reply to

  // Content
  content: v.string(),

  // Author
  authorId: v.id("users"),

  // State
  isResolved: v.boolean(),
  resolvedAt: v.optional(v.number()),
  resolvedBy: v.optional(v.id("users")),

  // Edit tracking
  isEdited: v.boolean(),
  editedAt: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_document_type", ["documentId", "type"])
  .index("by_parent", ["parentId"])
  .index("by_author", ["authorId"])
  .index("by_resolved", ["documentId", "isResolved"]),
```

#### kbCommentMentions

@mentions in comments.

```typescript
kbCommentMentions: defineTable({
  // Reference
  commentId: v.id("kbDocumentComments"),

  // Mentioned user
  mentionedUserId: v.id("users"),

  // Notification
  notifiedAt: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
})
  .index("by_comment", ["commentId"])
  .index("by_user", ["mentionedUserId"])
  .index("by_user_unread", ["mentionedUserId", "notifiedAt"]),
```

#### kbCommentReactions

Emoji reactions on comments.

```typescript
kbCommentReactions: defineTable({
  // Reference
  commentId: v.id("kbDocumentComments"),

  // Reaction
  userId: v.id("users"),
  emoji: v.string(), // Unicode emoji

  // Timestamps
  createdAt: v.number(),
})
  .index("by_comment", ["commentId"])
  .index("by_comment_emoji", ["commentId", "emoji"])
  .index("by_user", ["userId"]),
```

### Search & AI

#### kbDocumentEmbeddings

Vector embeddings for semantic search.

```typescript
kbDocumentEmbeddings: defineTable({
  // Reference
  documentId: v.id("kbDocuments"),

  // Embedding
  embedding: v.array(v.float64()), // 1536 dimensions (text-embedding-3-small)
  model: v.string(), // "text-embedding-3-small"

  // Source tracking
  contentHash: v.string(), // MD5 of content for change detection

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_document", ["documentId"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["documentId"],
  }),
```

### User Engagement

#### kbUserFavorites

User-starred documents.

```typescript
kbUserFavorites: defineTable({
  userId: v.id("users"),
  documentId: v.id("kbDocuments"),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_document", ["userId", "documentId"])
  .index("by_user_time", ["userId", "createdAt"]),
```

#### kbUserRecents

Recently accessed documents.

```typescript
kbUserRecents: defineTable({
  userId: v.id("users"),
  documentId: v.id("kbDocuments"),
  accessedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_document", ["userId", "documentId"])
  .index("by_user_time", ["userId", "accessedAt"]),
```

### LMS Integration

#### kbDocumentLinks

Bidirectional links between documents and LMS content.

```typescript
kbDocumentLinks: defineTable({
  // Document reference
  documentId: v.id("kbDocuments"),

  // LMS reference (one must be set)
  courseId: v.optional(v.id("courses")),
  lessonId: v.optional(v.id("lessons")),

  // Link type
  linkType: v.union(
    v.literal("reference"),    // General reference
    v.literal("supplement"),   // Supplementary material
    v.literal("prerequisite")  // Required reading
  ),

  // Metadata
  createdBy: v.id("users"),
  createdAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_course", ["courseId"])
  .index("by_lesson", ["lessonId"]),
```

### Audit & Compliance

#### kbAuditLogs

Permission changes and lifecycle events.

```typescript
kbAuditLogs: defineTable({
  // Event type
  eventType: v.union(
    // Lifecycle events
    v.literal("document_created"),
    v.literal("document_published"),
    v.literal("document_archived"),
    v.literal("document_deleted"),
    v.literal("document_restored"),
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

  // Timestamps
  timestamp: v.number(),
})
  .index("by_resource", ["resourceType", "resourceId"])
  .index("by_actor", ["actorId"])
  .index("by_event_type", ["eventType"])
  .index("by_timestamp", ["timestamp"])
  .index("by_resource_time", ["resourceType", "resourceId", "timestamp"]),
```

### AI Usage Tracking

#### kbAIUsage

Track AI feature usage for rate limiting and budgeting.

```typescript
kbAIUsage: defineTable({
  // User
  userId: v.id("users"),

  // Period
  month: v.string(), // "YYYY-MM"

  // Usage counts
  commandsUsed: v.number(),      // Summarize, translate, etc. (limit: 100/month)
  generationsUsed: v.number(),   // Content generation (limit: 50/month)
  searchesUsed: v.number(),      // Semantic searches (limit: 500/month)

  // Cost tracking (cents)
  commandsCostCents: v.number(),
  generationsCostCents: v.number(),
  searchesCostCents: v.number(),

  // Timestamps
  updatedAt: v.number(),
})
  .index("by_user_month", ["userId", "month"])
  .index("by_month", ["month"]),
```

## Indexes Summary

| Table | Index Name | Purpose |
|-------|------------|---------|
| kbWorkspaces | by_owner | List user's workspaces |
| kbWorkspaces | by_slug | Lookup by URL |
| kbWorkspaces | search_name | Full-text search |
| kbFolders | by_workspace_parent | Tree navigation |
| kbFolders | by_workspace_order | Ordered listing |
| kbDocuments | by_folder_status | List docs in folder |
| kbDocuments | by_creator | User's documents |
| kbDocuments | by_permanent_delete | Cleanup job |
| kbDocuments | search_title | Title search |
| kbDocumentContent | search_content | Full-text search |
| kbDocumentVersions | by_document_time | Version history |
| kbDocumentVersions | by_expires | Cleanup job |
| kbResourcePermissions | by_resource_user | Permission check |
| kbDocumentEmbeddings | by_embedding | Vector search |
| kbUserRecents | by_user_time | Recent documents |

## Migration Strategy

### Phase 1: Core Tables
1. `kbWorkspaces`
2. `kbFolders`
3. `kbDocuments`
4. `kbDocumentContent`

### Phase 2: Collaboration
5. `kbResourcePermissions`
6. `kbDocumentComments`
7. `kbCommentMentions`
8. `kbCommentReactions`

### Phase 3: History & Engagement
9. `kbDocumentVersions`
10. `kbUserFavorites`
11. `kbUserRecents`

### Phase 4: Search & AI
12. `kbDocumentEmbeddings`
13. `kbAIUsage`

### Phase 5: Integration & Audit
14. `kbDocumentLinks`
15. `kbAuditLogs`

## Constraints & Validation

| Constraint | Table | Field | Rule |
|------------|-------|-------|------|
| Size limit | kbDocumentContent | contentSize | ≤ 10MB (10,485,760 bytes) |
| Items per container | kbFolders | by_parent count | ≤ 1000 per parent |
| Items per container | kbDocuments | by_folder count | ≤ 1000 per folder |
| Concurrent editors | (Hocuspocus room) | participants | ≤ 25 |
| Archive retention | kbDocuments | permanentDeleteAt | createdAt + 90 days |
| Version retention | kbDocumentVersions | expiresAt | 7 days (auto), unlimited (manual) |
| AI rate limit | kbAIUsage | commandsUsed | ≤ 100/user/month |
| AI rate limit | kbAIUsage | generationsUsed | ≤ 50/user/month |
| AI rate limit | kbAIUsage | searchesUsed | ≤ 500/user/month |

---

**Data Model Status**: COMPLETE
**Ready for**: API Contracts Definition
