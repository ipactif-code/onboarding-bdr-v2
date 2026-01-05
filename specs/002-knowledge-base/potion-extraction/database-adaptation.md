# Database Adaptation: Prisma to Convex

**Feature Branch**: `004-knowledge-base`
**Date**: 2026-01-03
**Status**: Complete

## Overview

This document maps the Potion template's Prisma schema to our Convex schema, providing conversion patterns for queries and mutations. Potion uses Prisma with PostgreSQL; our LMS uses Convex (serverless real-time database).

---

## 1. Schema Mapping Table

### Prisma Models to Convex Tables

| Prisma Model | Convex Table | Notes |
|--------------|--------------|-------|
| `User` | `users` (existing) | Already exists in our LMS; use existing table |
| `Session` | N/A | Handled by Clerk auth |
| `Account` | N/A | Handled by Clerk auth |
| `Verification` | N/A | Handled by Clerk auth |
| `Document` | `kbDocuments` + `kbDocumentContent` | Split metadata from content for performance |
| `DocumentVersion` | `kbDocumentVersions` | Direct mapping with enhancements |
| `Discussion` | `kbDocumentComments` (type: "inline") | Merged into unified comments table |
| `Comment` | `kbDocumentComments` | Unified with discussions |
| `File` | `_storage` (Convex built-in) | Use Convex file storage |

### Unmapped Prisma Models (Auth-Related)

These Prisma models are handled by Clerk in our stack:

```
Session      -> Clerk session management
Account      -> Clerk OAuth providers
Verification -> Clerk email verification
```

---

## 2. Field Type Conversion Reference

### Prisma to Convex Type Mapping

| Prisma Type | Convex Validator | Notes |
|-------------|------------------|-------|
| `String` | `v.string()` | Direct mapping |
| `String?` | `v.optional(v.string())` | Optional field |
| `String @id` | Auto-generated `_id` | Convex generates IDs |
| `Int` | `v.number()` | No int64 needed for small numbers |
| `Boolean` | `v.boolean()` | Direct mapping |
| `DateTime` | `v.number()` | Milliseconds since epoch (`Date.now()`) |
| `DateTime?` | `v.optional(v.number())` | Optional timestamp |
| `Json` | `v.any()` | For Plate.js content |
| `Json?` | `v.optional(v.any())` | Optional JSON |
| `Bytes` | `v.bytes()` | For binary data like YJS snapshots |
| `Bytes?` | `v.optional(v.bytes())` | Optional bytes |
| `@relation` | `v.id("tableName")` | Foreign key reference |
| `enum` | `v.union(v.literal(...))` | Union of literals |

### Enum Conversion

**Prisma:**
```prisma
enum UserRole {
  USER
  ADMIN
  SUPERADMIN
}

enum TextStyle {
  DEFAULT
  SERIF
  MONO
}
```

**Convex:**
```typescript
// In schema.ts - define as validators
const userRoleValidator = v.union(
  v.literal("user"),
  v.literal("admin"),
  v.literal("superadmin")
);

const textStyleValidator = v.union(
  v.literal("default"),
  v.literal("serif"),
  v.literal("mono")
);
```

### Special Cases

| Prisma Pattern | Convex Equivalent |
|----------------|-------------------|
| `@default(now())` | `createdAt: Date.now()` in mutation |
| `@updatedAt` | `updatedAt: Date.now()` in every update |
| `@unique` | Create unique index + check in mutation |
| `@@unique([a, b])` | Composite index + check in mutation |
| `@@index([field])` | `.index("by_field", ["field"])` |
| `onDelete: Cascade` | Manual cascade in mutation |

---

## 3. Detailed Model Mapping

### Document (Prisma) to kbDocuments + kbDocumentContent (Convex)

**Prisma Schema:**
```prisma
model Document {
  id              String    @id
  templateId      String?
  userId          String
  parentDocumentId String?
  title           String?
  content         String?
  contentRich     Json?
  yjsSnapshot     Bytes?
  coverImage      String?
  icon            String?
  isPublished     Boolean   @default(false)
  isArchived      Boolean   @default(false)
  textStyle       TextStyle @default(DEFAULT)
  smallText       Boolean   @default(false)
  fullWidth       Boolean   @default(false)
  lockPage        Boolean   @default(false)
  toc             Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**Convex Schema (kbDocuments - metadata only):**
```typescript
kbDocuments: defineTable({
  // Identity
  title: v.string(),

  // Hierarchy (adapted from parentDocumentId)
  folderId: v.id("kbFolders"),  // We use folders instead of parent docs

  // Appearance
  icon: v.optional(v.string()),
  coverImageId: v.optional(v.id("_storage")),  // Use Convex storage

  // Ownership
  creatorId: v.id("users"),

  // Status (adapted from isPublished + isArchived)
  status: v.union(
    v.literal("draft"),
    v.literal("published"),
    v.literal("archived")
  ),
  publishedAt: v.optional(v.number()),

  // Layout settings (from Potion)
  textStyle: v.optional(v.union(
    v.literal("default"),
    v.literal("serif"),
    v.literal("mono")
  )),
  smallText: v.optional(v.boolean()),
  fullWidth: v.optional(v.boolean()),
  lockPage: v.optional(v.boolean()),
  showToc: v.optional(v.boolean()),

  // Ordering
  displayOrder: v.number(),

  // Metadata
  wordCount: v.optional(v.number()),
  lastEditedBy: v.optional(v.id("users")),

  // State
  archivedAt: v.optional(v.number()),
  archivedBy: v.optional(v.id("users")),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_folder", ["folderId"])
  .index("by_folder_status", ["folderId", "status"])
  .index("by_creator", ["creatorId"])
  .index("by_status", ["status"])
```

**Convex Schema (kbDocumentContent - content separated):**
```typescript
kbDocumentContent: defineTable({
  documentId: v.id("kbDocuments"),
  content: v.any(),  // Plate.js JSON (was contentRich)
  contentText: v.optional(v.string()),  // Extracted for search
  contentSize: v.number(),
  updatedAt: v.number(),
})
  .index("by_document", ["documentId"])
  .searchIndex("search_content", {
    searchField: "contentText",
    filterFields: ["documentId"],
  })
```

**Key Differences:**
1. Content separated from metadata for performance
2. `parentDocumentId` replaced with `folderId` (hierarchical folders)
3. `isPublished`/`isArchived` merged into `status` enum
4. `coverImage` (URL) changed to `coverImageId` (Convex storage)
5. `yjsSnapshot` moved to Hocuspocus persistence (not in Convex)

### DocumentVersion Mapping

**Prisma Schema:**
```prisma
model DocumentVersion {
  id          String   @id
  documentId  String
  userId      String
  title       String?
  contentRich Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Convex Schema:**
```typescript
kbDocumentVersions: defineTable({
  documentId: v.id("kbDocuments"),
  versionNumber: v.number(),  // Added: sequential version
  versionType: v.union(
    v.literal("auto"),
    v.literal("manual"),
    v.literal("restore")
  ),  // Added: distinguish version types
  description: v.optional(v.string()),
  content: v.any(),
  contentSize: v.number(),
  authorId: v.id("users"),  // Renamed from userId
  expiresAt: v.optional(v.number()),  // Added: for auto-cleanup
  createdAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_document_version", ["documentId", "versionNumber"])
  .index("by_expires", ["expiresAt"])
```

### Discussion + Comment Mapping

**Prisma Schema:**
```prisma
model Discussion {
  id               String    @id
  documentId       String
  userId           String
  documentContent  String    // Selected text
  documentContentRich Json?
  isResolved       Boolean   @default(false)
  createdAt        DateTime
  updatedAt        DateTime
  comments         Comment[]
}

model Comment {
  id           String   @id
  userId       String
  discussionId String
  content      String
  contentRich  Json?
  isEdited     Boolean  @default(false)
  createdAt    DateTime
  updatedAt    DateTime
}
```

**Convex Schema (unified):**
```typescript
kbDocumentComments: defineTable({
  documentId: v.id("kbDocuments"),

  // Comment type (replaces Discussion model)
  type: v.union(
    v.literal("page"),    // Page-level comment
    v.literal("inline")   // Was Discussion - attached to selection
  ),

  // For inline comments (from Discussion.documentContent)
  selectionStart: v.optional(v.number()),
  selectionEnd: v.optional(v.number()),
  selectedText: v.optional(v.string()),

  // Threading (replaces discussionId)
  parentId: v.optional(v.id("kbDocumentComments")),

  // Content
  content: v.string(),

  // Author
  authorId: v.id("users"),

  // State (from Discussion.isResolved)
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
```

**Key Differences:**
1. Discussion and Comment merged into single table
2. `type` field distinguishes page vs inline comments
3. Replies use `parentId` instead of `discussionId`
4. Selection stored as positions, not just text

### File Mapping

**Prisma Schema:**
```prisma
model File {
  id         String   @id
  userId     String
  documentId String?
  size       Int
  url        String
  appUrl     String
  type       String
  createdAt  DateTime
  updatedAt  DateTime
}
```

**Convex Approach:**
```typescript
// Use Convex built-in file storage (_storage table)
// Reference files via v.id("_storage") in document tables

kbDocuments: defineTable({
  // ...
  coverImageId: v.optional(v.id("_storage")),
  // ...
})

// File metadata can be retrieved via ctx.storage.getMetadata()
// No separate File table needed
```

---

## 4. Query Pattern Conversions

### findUnique / findUniqueOrThrow

**Prisma:**
```typescript
const document = await prisma.document.findUnique({
  where: { id: input.id },
  select: { id: true, title: true },
});

const document = await prisma.document.findUniqueOrThrow({
  where: { id: input.id },
});
```

**Convex:**
```typescript
// findUnique equivalent - returns null if not found
export const get = query({
  args: { id: v.id("kbDocuments") },
  returns: v.union(v.object({ ... }), v.null()),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.get(args.id);
  },
});

// findUniqueOrThrow equivalent - throws if not found
export const getOrThrow = query({
  args: { id: v.id("kbDocuments") },
  returns: v.object({ ... }),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    return doc;
  },
});
```

### findFirst

**Prisma:**
```typescript
const doc = await prisma.document.findFirst({
  where: { userId: ctx.userId, isArchived: false },
  orderBy: { createdAt: 'desc' },
});
```

**Convex:**
```typescript
export const getFirst = query({
  args: {},
  returns: v.union(v.object({ ... }), v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    return await ctx.db
      .query("kbDocuments")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .filter((q) => q.neq(q.field("status"), "archived"))
      .order("desc")
      .first();
  },
});
```

### findMany with Cursor Pagination

**Prisma:**
```typescript
const documents = await prisma.document.findMany({
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: 'desc' },
  take: limit + 1,
  where: {
    userId: ctx.userId,
    isArchived: false,
    parentDocumentId: parentDocumentId ?? null,
    ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
  },
});

let nextCursor: string | undefined;
if (documents.length > limit) {
  const nextItem = documents.pop();
  nextCursor = nextItem!.id;
}
```

**Convex:**
```typescript
import { paginationOptsValidator } from "convex/server";

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    folderId: v.id("kbFolders"),
    search: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(v.object({ ... })),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // For search, use search index
    if (args.search) {
      return await ctx.db
        .query("kbDocuments")
        .withSearchIndex("search_title", (q) =>
          q.search("title", args.search!)
            .eq("folderId", args.folderId)
            .eq("status", "published")
        )
        .paginate(args.paginationOpts);
    }

    // For regular listing, use composite index
    return await ctx.db
      .query("kbDocuments")
      .withIndex("by_folder_status", (q) =>
        q.eq("folderId", args.folderId).neq("status", "archived")
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

### findMany with Includes (Relations)

**Prisma:**
```typescript
const discussions = await prisma.discussion.findMany({
  where: { documentId: input.documentId },
  select: {
    id: true,
    documentContent: true,
    isResolved: true,
    user: true,
    comments: {
      select: {
        id: true,
        contentRich: true,
        user: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    },
  },
  orderBy: { createdAt: 'desc' },
});
```

**Convex (Manual Joins):**
```typescript
export const getWithComments = query({
  args: { documentId: v.id("kbDocuments") },
  returns: v.array(v.object({
    comment: v.object({ ... }),
    author: v.object({ _id: v.id("users"), name: v.string(), avatarUrl: v.optional(v.string()) }),
    replies: v.array(v.object({ ... })),
  })),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Get root comments (no parentId)
    const rootComments = await ctx.db
      .query("kbDocumentComments")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("parentId"), undefined))
      .order("desc")
      .collect();

    // Batch fetch authors
    const authorIds = [...new Set(rootComments.map((c) => c.authorId))];
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorMap = new Map(authors.filter(Boolean).map((a) => [a!._id, a!]));

    // Fetch replies for each root comment
    const results = await Promise.all(
      rootComments.map(async (comment) => {
        const replies = await ctx.db
          .query("kbDocumentComments")
          .withIndex("by_parent", (q) => q.eq("parentId", comment._id))
          .order("asc")
          .collect();

        return {
          comment,
          author: authorMap.get(comment.authorId)!,
          replies,
        };
      })
    );

    return results;
  },
});
```

### Search with OR Conditions

**Prisma:**
```typescript
const users = await prisma.user.findMany({
  where: {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ],
  },
});
```

**Convex (Search Index):**
```typescript
// In schema.ts
users: defineTable({
  name: v.string(),
  email: v.string(),
})
  .searchIndex("search_name_email", {
    searchField: "name",  // Primary search field
    filterFields: ["email"],
  })

// In query - search index supports one field
// For multi-field search, run parallel queries and merge
export const search = query({
  args: { query: v.string() },
  returns: v.array(v.object({ ... })),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const byName = await ctx.db
      .query("users")
      .withSearchIndex("search_name", (q) => q.search("name", args.query))
      .take(20);

    const byEmail = await ctx.db
      .query("users")
      .withSearchIndex("search_email", (q) => q.search("email", args.query))
      .take(20);

    // Merge and dedupe
    const seen = new Set<string>();
    const results = [];
    for (const user of [...byName, ...byEmail]) {
      if (!seen.has(user._id)) {
        seen.add(user._id);
        results.push(user);
      }
    }
    return results.slice(0, 20);
  },
});
```

---

## 5. Mutation Pattern Conversions

### create

**Prisma:**
```typescript
return await prisma.document.create({
  data: {
    id: nid(),
    contentRich: input.contentRich,
    parentDocumentId: input.parentDocumentId ?? null,
    title: input.title,
    userId: ctx.userId,
  },
  select: { id: true },
});
```

**Convex:**
```typescript
export const create = mutation({
  args: {
    folderId: v.id("kbFolders"),
    title: v.optional(v.string()),
    content: v.optional(v.any()),
  },
  returns: v.id("kbDocuments"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    // Validate folder exists
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("Folder not found");

    // Get display order (last position)
    const lastDoc = await ctx.db
      .query("kbDocuments")
      .withIndex("by_folder_order", (q) => q.eq("folderId", args.folderId))
      .order("desc")
      .first();

    const displayOrder = (lastDoc?.displayOrder ?? 0) + 1;

    // Create document
    const docId = await ctx.db.insert("kbDocuments", {
      folderId: args.folderId,
      title: args.title ?? "Untitled",
      creatorId: user._id,
      status: "draft",
      displayOrder,
      createdAt: now,
      updatedAt: now,
    });

    // Create content (separated table)
    if (args.content) {
      const contentSize = JSON.stringify(args.content).length;
      await ctx.db.insert("kbDocumentContent", {
        documentId: docId,
        content: args.content,
        contentSize,
        updatedAt: now,
      });
    }

    return docId;
  },
});
```

### update (Partial)

**Prisma:**
```typescript
await prisma.document.update({
  data: {
    content: input.content,
    contentRich: input.contentRich,
    title: input.title,
    // ... other fields
  },
  where: {
    id: input.id,
    userId: ctx.userId,  // Auth check in where clause
  },
});
```

**Convex:**
```typescript
export const update = mutation({
  args: {
    id: v.id("kbDocuments"),
    title: v.optional(v.string()),
    icon: v.optional(v.string()),
    fullWidth: v.optional(v.boolean()),
    // ... other fields
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get document and verify ownership
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (doc.creatorId !== user._id) {
      throw new Error("Not authorized to edit this document");
    }

    // Build update object (only defined fields)
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(cleanUpdates).length > 0) {
      await ctx.db.patch(args.id, {
        ...cleanUpdates,
        lastEditedBy: user._id,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});
```

### delete with Cascade

**Prisma:**
```prisma
// In schema - automatic cascade
@relation(fields: [documentId], references: [id], onDelete: Cascade)
```

**Convex (Manual Cascade):**
```typescript
export const remove = mutation({
  args: { id: v.id("kbDocuments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (doc.creatorId !== user._id) {
      throw new Error("Not authorized to delete this document");
    }

    // Manual cascade: delete related records first

    // 1. Delete content
    const content = await ctx.db
      .query("kbDocumentContent")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .first();
    if (content) {
      await ctx.db.delete(content._id);
    }

    // 2. Delete versions
    const versions = await ctx.db
      .query("kbDocumentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    await Promise.all(versions.map((v) => ctx.db.delete(v._id)));

    // 3. Delete comments
    const comments = await ctx.db
      .query("kbDocumentComments")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    await Promise.all(comments.map((c) => ctx.db.delete(c._id)));

    // 4. Delete the document
    await ctx.db.delete(args.id);

    return null;
  },
});
```

### Soft Delete (Archive)

**Prisma:**
```typescript
await prisma.document.update({
  data: { isArchived: true },
  where: { id: input.id, userId: ctx.userId },
});
```

**Convex:**
```typescript
export const archive = mutation({
  args: { id: v.id("kbDocuments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (doc.creatorId !== user._id) {
      throw new Error("Not authorized");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "archived",
      archivedAt: now,
      archivedBy: user._id,
      permanentDeleteAt: now + (90 * 24 * 60 * 60 * 1000), // 90 days
      updatedAt: now,
    });

    return null;
  },
});
```

### Transaction (Multi-Table Update)

**Prisma:**
```typescript
// Create discussion with first comment
const discussion = await prisma.discussion.create({
  data: {
    id: nid(),
    documentContent: input.documentContent,
    documentId: input.documentId,
    userId: ctx.userId,
  },
});

await prisma.comment.create({
  data: {
    id: nid(),
    content,
    discussionId: discussion.id,
    userId: ctx.userId,
  },
});
```

**Convex (Atomic by Default):**
```typescript
export const createWithComment = mutation({
  args: {
    documentId: v.id("kbDocuments"),
    selectedText: v.string(),
    content: v.string(),
  },
  returns: v.id("kbDocumentComments"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    // Create root comment (was Discussion)
    const rootCommentId = await ctx.db.insert("kbDocumentComments", {
      documentId: args.documentId,
      type: "inline",
      selectedText: args.selectedText,
      parentId: undefined,
      content: "", // Root has no content, only selection
      authorId: user._id,
      isResolved: false,
      isEdited: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create first reply (was Comment)
    await ctx.db.insert("kbDocumentComments", {
      documentId: args.documentId,
      type: "inline",
      parentId: rootCommentId,
      content: args.content,
      authorId: user._id,
      isResolved: false,
      isEdited: false,
      createdAt: now,
      updatedAt: now,
    });

    // Both inserts are atomic - if one fails, both are rolled back
    return rootCommentId;
  },
});
```

---

## 6. Index Strategy for Convex

### Required Indexes by Table

#### kbDocuments

| Index Name | Fields | Use Case |
|------------|--------|----------|
| `by_folder` | `[folderId]` | List docs in folder |
| `by_folder_status` | `[folderId, status]` | List non-archived docs |
| `by_folder_order` | `[folderId, displayOrder]` | Ordered listing |
| `by_creator` | `[creatorId]` | User's documents |
| `by_status` | `[status]` | Filter by status |
| `by_permanent_delete` | `[permanentDeleteAt]` | Cleanup job |
| `search_title` | Search index on `title` | Title search |

#### kbDocumentContent

| Index Name | Fields | Use Case |
|------------|--------|----------|
| `by_document` | `[documentId]` | Get content for doc |
| `search_content` | Search index on `contentText` | Full-text search |

#### kbDocumentVersions

| Index Name | Fields | Use Case |
|------------|--------|----------|
| `by_document` | `[documentId]` | List versions |
| `by_document_version` | `[documentId, versionNumber]` | Get specific version |
| `by_document_time` | `[documentId, createdAt]` | Version history |
| `by_expires` | `[expiresAt]` | Cleanup expired auto-versions |

#### kbDocumentComments

| Index Name | Fields | Use Case |
|------------|--------|----------|
| `by_document` | `[documentId]` | All comments for doc |
| `by_document_type` | `[documentId, type]` | Filter by comment type |
| `by_parent` | `[parentId]` | Get replies |
| `by_author` | `[authorId]` | User's comments |
| `by_resolved` | `[documentId, isResolved]` | Open discussions |

### Index Selection Guidelines

1. **Always use `.withIndex()`** for queries on tables > 100 rows
2. **Create composite indexes** for common filter combinations
3. **Order index fields** by selectivity (most selective first)
4. **Use search indexes** for text search, not regular indexes

---

## 7. Migration Checklist

### Phase 1: Core Documents
- [ ] Create `kbDocuments` table with indexes
- [ ] Create `kbDocumentContent` table with search index
- [ ] Implement CRUD mutations
- [ ] Add content size validation (10MB limit)

### Phase 2: Versions
- [ ] Create `kbDocumentVersions` table
- [ ] Implement version creation (auto + manual)
- [ ] Implement version restore
- [ ] Add cleanup cron for expired auto-versions

### Phase 3: Comments
- [ ] Create `kbDocumentComments` table
- [ ] Migrate Discussion + Comment patterns
- [ ] Implement threading with `parentId`
- [ ] Add resolve/unresolve functionality

### Phase 4: Files
- [ ] Use Convex `_storage` for file uploads
- [ ] Implement `generateUploadUrl` action
- [ ] Store `v.id("_storage")` references in documents
- [ ] Implement file deletion cleanup

---

## 8. Key Differences Summary

| Aspect | Prisma (Potion) | Convex (Our LMS) |
|--------|-----------------|------------------|
| **Auth** | Custom `userId` checks | `requireAuth(ctx)` helper |
| **IDs** | Custom `nid()` generation | Auto-generated `_id` |
| **Relations** | `@relation` with includes | Manual joins with indexes |
| **Cascade** | `onDelete: Cascade` | Manual cascade in mutations |
| **Transactions** | `prisma.$transaction()` | Mutations are atomic |
| **Search** | `contains` with `mode: 'insensitive'` | Search indexes |
| **Pagination** | Cursor with `take: limit + 1` | `paginate(paginationOpts)` |
| **Files** | URL strings | `v.id("_storage")` |
| **Real-time** | WebSocket (Hocuspocus) | Built-in reactivity |
| **Timestamps** | `DateTime` | `v.number()` (ms) |

---

**Database Adaptation Status**: COMPLETE
**Ready for**: Implementation by backend-engineer
