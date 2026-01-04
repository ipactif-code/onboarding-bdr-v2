# Prisma to Convex Mapping: Knowledge Base

**Analysis Date**: 2026-01-03
**Source**: Potion Template (`~/potion-template/prisma/schema.prisma`)
**Target**: Our Convex Schema (`convex/schema.ts`)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Prisma Models** | 9 (4 applicable) |
| **Convex Tables Required** | 10 |
| **Query Patterns** | 12 documented |
| **Mutation Patterns** | 15 documented |
| **Breaking Differences** | 5 (all manageable) |

---

## 1. Schema Mapping

| Prisma Model | Convex Table | Status | Notes |
|--------------|--------------|--------|-------|
| **User** | `users` (existing) | ✅ Exists | Synced from Clerk |
| **Document** | `kbDocuments` + `kbDocumentContent` | ✅ Mapped | Split: metadata + content |
| **DocumentVersion** | `kbDocumentVersions` | ✅ Mapped | Add versionNumber, versionType |
| **Discussion** | `kbDocumentComments` | ✅ Merged | Use parentId for threading |
| **Comment** | `kbDocumentComments` | ✅ Merged | Same table, recursive |
| **File** | (out of scope) | ⚠️ Later | Use existing file storage |
| **Session** | N/A | ❌ Skip | Clerk handles sessions |
| **Account** | N/A | ❌ Skip | Clerk handles OAuth |
| **Verification** | N/A | ❌ Skip | Clerk handles verification |

---

## 2. Field Type Conversions

| Prisma Type | Convex Type | Example |
|-------------|-------------|---------|
| `String @id` | `v.id("table")` | Auto-generated |
| `String` | `v.string()` | `title: v.string()` |
| `String?` | `v.optional(v.string())` | `description: v.optional(v.string())` |
| `DateTime` | `v.number()` | `createdAt: v.number()` (milliseconds) |
| `Boolean` | `v.boolean()` | `isResolved: v.boolean()` |
| `Boolean?` | `v.optional(v.boolean())` | `isEdited: v.optional(v.boolean())` |
| `Int` | `v.number()` | `wordCount: v.number()` |
| `Json?` | `v.any()` | `content: v.any()` (Plate.js JSON) |
| `Bytes?` | External storage | YJS state → Hocuspocus |
| `enum` | `v.union(v.literal(...))` | `status: v.union(...)` |
| `@relation` | `v.id("table")` + index | Manual joins required |

---

## 3. Query Pattern Conversions

### Get Single Document by ID

**Prisma:**
```typescript
const doc = await prisma.document.findUnique({
  where: { id: input.id, userId: ctx.userId },
  select: { id: true, title: true, contentRich: true },
});
```

**Convex:**
```typescript
const doc = await ctx.db.get(documentId);
if (doc.creatorId !== userId) throw new ConvexError("Not authorized");

// Load content separately
const content = await ctx.db
  .query("kbDocumentContent")
  .withIndex("by_document", (q) => q.eq("documentId", documentId))
  .unique();

return { ...doc, content: content?.content };
```

---

### List Documents with Pagination

**Prisma:**
```typescript
const docs = await prisma.document.findMany({
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: 'desc' },
  take: limit + 1,
  where: { userId: ctx.userId, isArchived: false },
});
```

**Convex:**
```typescript
const results = await ctx.db
  .query("kbDocuments")
  .withIndex("by_folder_status", (q) =>
    q.eq("folderId", folderId).eq("status", "published")
  )
  .order("desc")
  .paginate({ numItems: limit, cursor });

return results; // { isDone, cursor, page }
```

---

### Load Comments with Authors

**Prisma:**
```typescript
const discussions = await prisma.discussion.findMany({
  where: { documentId },
  include: {
    user: { select: { id: true, name: true, image: true } },
    comments: {
      include: { user: { select: { id: true, name: true, image: true } } },
    },
  },
});
```

**Convex:**
```typescript
// No nested includes - must fetch manually
const threads = await ctx.db
  .query("kbDocumentComments")
  .withIndex("by_document_type", (q) =>
    q.eq("documentId", documentId).eq("type", "page")
  )
  .collect();

const result = await Promise.all(
  threads.map(async (thread) => {
    const author = await ctx.db.get(thread.authorId);
    const replies = await ctx.db
      .query("kbDocumentComments")
      .withIndex("by_parent", (q) => q.eq("parentId", thread._id))
      .collect();

    const repliesWithAuthors = await Promise.all(
      replies.map(async (r) => ({
        ...r,
        author: await ctx.db.get(r.authorId),
      }))
    );

    return { ...thread, author, replies: repliesWithAuthors };
  })
);
```

---

### Search Documents

**Prisma:**
```typescript
const docs = await prisma.document.findMany({
  where: {
    title: { contains: search, mode: 'insensitive' },
    userId: ctx.userId,
  },
});
```

**Convex:**
```typescript
// Must use search index
const results = await ctx.db
  .query("kbDocuments")
  .search("search_title", search)
  .filter((q) => q.eq(q.field("creatorId"), userId))
  .collect();
```

---

## 4. Mutation Pattern Conversions

### Create Document

**Prisma:**
```typescript
const doc = await prisma.document.create({
  data: {
    id: nid(),
    title: input.title,
    contentRich: input.content,
    userId: ctx.userId,
  },
});
```

**Convex:**
```typescript
// Create document metadata
const docId = await ctx.db.insert("kbDocuments", {
  title: input.title || "Untitled",
  folderId,
  creatorId: userId,
  status: "draft",
  displayOrder: nextOrder,
  wordCount: 0,
  lastEditedBy: userId,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// Create content separately
await ctx.db.insert("kbDocumentContent", {
  documentId: docId,
  content: input.content,
  contentText: extractText(input.content),
  contentSize: JSON.stringify(input.content).length,
  updatedAt: Date.now(),
});

return docId;
```

---

### Update Document

**Prisma:**
```typescript
await prisma.document.update({
  where: { id: input.id, userId: ctx.userId },
  data: { title: input.title, contentRich: input.content },
});
```

**Convex:**
```typescript
// Verify ownership first
const doc = await ctx.db.get(documentId);
if (doc.creatorId !== userId) throw new ConvexError("Not authorized");

// Update metadata
await ctx.db.patch(documentId, {
  title: input.title,
  lastEditedBy: userId,
  updatedAt: Date.now(),
});

// Update content separately
const contentDoc = await ctx.db
  .query("kbDocumentContent")
  .withIndex("by_document", (q) => q.eq("documentId", documentId))
  .unique();

if (contentDoc) {
  await ctx.db.patch(contentDoc._id, {
    content: input.content,
    contentText: extractText(input.content),
    contentSize: JSON.stringify(input.content).length,
    updatedAt: Date.now(),
  });
}
```

---

### Delete with Cascade

**Prisma:**
```typescript
// Automatic cascade via onDelete: Cascade
await prisma.document.delete({
  where: { id: input.id, userId: ctx.userId },
});
```

**Convex:**
```typescript
// Manual cascade - delete all related records
const doc = await ctx.db.get(documentId);
if (doc.creatorId !== userId) throw new ConvexError("Not authorized");

// 1. Delete comments
const comments = await ctx.db
  .query("kbDocumentComments")
  .withIndex("by_document", (q) => q.eq("documentId", documentId))
  .collect();
for (const c of comments) await ctx.db.delete(c._id);

// 2. Delete versions
const versions = await ctx.db
  .query("kbDocumentVersions")
  .withIndex("by_document", (q) => q.eq("documentId", documentId))
  .collect();
for (const v of versions) await ctx.db.delete(v._id);

// 3. Delete content
const content = await ctx.db
  .query("kbDocumentContent")
  .withIndex("by_document", (q) => q.eq("documentId", documentId))
  .unique();
if (content) await ctx.db.delete(content._id);

// 4. Delete permissions
const perms = await ctx.db
  .query("kbResourcePermissions")
  .withIndex("by_document", (q) => q.eq("documentId", documentId))
  .collect();
for (const p of perms) await ctx.db.delete(p._id);

// 5. Finally delete document
await ctx.db.delete(documentId);
```

---

### Archive Document

**Prisma:**
```typescript
await prisma.document.update({
  where: { id: input.id },
  data: { isArchived: true },
});
```

**Convex:**
```typescript
await ctx.db.patch(documentId, {
  status: "archived",
  archivedAt: Date.now(),
  archivedBy: userId,
  permanentDeleteAt: Date.now() + 90 * 24 * 60 * 60 * 1000, // +90 days
});
```

---

### Create Version

**Prisma:**
```typescript
await prisma.documentVersion.create({
  data: {
    id: nid(),
    documentId,
    contentRich: doc.contentRich,
    title: doc.title,
    userId: ctx.userId,
  },
});
```

**Convex:**
```typescript
const latestVersion = await ctx.db
  .query("kbDocumentVersions")
  .withIndex("by_document", (q) => q.eq("documentId", documentId))
  .order("desc")
  .first();

await ctx.db.insert("kbDocumentVersions", {
  documentId,
  versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
  versionType: "manual",
  content: doc.content,
  contentSize: JSON.stringify(doc.content).length,
  authorId: userId,
  createdAt: Date.now(),
});
```

---

### Create Comment (Thread)

**Prisma:**
```typescript
// Create discussion first, then comment
const discussion = await prisma.discussion.create({
  data: { documentId, userId: ctx.userId },
});
await prisma.comment.create({
  data: { discussionId: discussion.id, content, userId: ctx.userId },
});
```

**Convex:**
```typescript
// Single insert - comments are self-threading
await ctx.db.insert("kbDocumentComments", {
  documentId,
  type: "page", // or "inline"
  parentId: undefined, // Top-level = thread starter
  content: input.content,
  authorId: userId,
  isResolved: false,
  isEdited: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
```

---

## 5. Key Differences

| Aspect | Prisma | Convex | Migration Strategy |
|--------|--------|--------|-------------------|
| **Cascading Deletes** | Automatic | Manual | Implement in mutations |
| **Nested Includes** | Supported | Not supported | Manual joins with Promise.all |
| **Unique Constraints** | Enforced | Index only | Validate in mutations |
| **Counting** | `.count()` | None | Use `.collect().length` |
| **String Search** | `.contains()` | Search index | Use `.search()` |
| **Transactions** | `$transaction` | Implicit | Mutations are atomic |
| **Default Values** | `@default(now())` | None | Set explicitly |
| **Timestamps** | Auto-managed | Manual | Set in every mutation |

---

## 6. Index Requirements

### Required Indexes for Queries

```typescript
// kbDocuments
.index("by_folder", ["folderId"])
.index("by_creator", ["creatorId"])
.index("by_status", ["status"])
.index("by_folder_status", ["folderId", "status"])
.index("by_folder_order", ["folderId", "displayOrder"])
.searchIndex("search_title", { searchField: "title" })

// kbDocumentContent
.index("by_document", ["documentId"])
.searchIndex("search_content", { searchField: "contentText" })

// kbDocumentVersions
.index("by_document", ["documentId"])
.index("by_document_version", ["documentId", "versionNumber"])

// kbDocumentComments
.index("by_document", ["documentId"])
.index("by_document_type", ["documentId", "type"])
.index("by_parent", ["parentId"])
.index("by_author", ["authorId"])
```

---

## 7. Auth Pattern Migration

| Potion Pattern | Convex Pattern |
|----------------|----------------|
| `ctx.userId` (string) | `await requireAuth(ctx)` returns userId |
| `where: { userId }` | Fetch + check `doc.creatorId === userId` |
| `protectedProcedure` | `requireAuth()` on first line |
| `publicProcedure` | `query()` without auth check |

---

## 8. Real-Time Collaboration

### Potion (YJS in Database)
```
Document.yjsSnapshot (Bytes) → Stored in Prisma
```

### Our Approach (YJS in Hocuspocus)
```
Document → metadata in Convex
Content → kbDocumentContent in Convex
YJS state → Hocuspocus server (external)
```

**Key Point**: Don't migrate yjsSnapshot. Hocuspocus maintains real-time state separately.

---

## 9. Migration Checklist

### T000f: Schema Mapping
- [x] Document → kbDocuments + kbDocumentContent
- [x] DocumentVersion → kbDocumentVersions
- [x] Discussion/Comment → kbDocumentComments (merged)
- [x] Field type conversions documented
- [x] Index requirements identified

### T000g: Query Patterns
- [x] findUnique → db.get() + manual auth
- [x] findMany → db.query().withIndex().paginate()
- [x] Nested includes → Promise.all() joins
- [x] Search → .search() with index
- [x] Count → .collect().length

### T000h: Mutation Patterns
- [x] create → db.insert() (metadata + content)
- [x] update → db.patch() (verify auth first)
- [x] delete → Manual cascade + db.delete()
- [x] archive → db.patch() with status change
- [x] createVersion → db.insert() with version number
- [x] createComment → Single insert with parentId

---

## 10. Implementation Tips

### 1. Always Verify Auth First
```typescript
export const updateDocument = mutation({
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (doc.creatorId !== userId) {
      throw new ConvexError("Not authorized");
    }
    // ... proceed with update
  },
});
```

### 2. Set Timestamps Explicitly
```typescript
await ctx.db.patch(docId, {
  title: newTitle,
  updatedAt: Date.now(), // Always set!
});
```

### 3. Use Index for Lookups
```typescript
// ❌ Wrong - full table scan
const docs = await ctx.db.query("kbDocuments")
  .filter((q) => q.eq(q.field("folderId"), folderId))
  .collect();

// ✅ Correct - uses index
const docs = await ctx.db.query("kbDocuments")
  .withIndex("by_folder", (q) => q.eq("folderId", folderId))
  .collect();
```

### 4. Batch Related Lookups
```typescript
// Load all authors in parallel
const authorsMap = new Map();
const authorIds = [...new Set(comments.map(c => c.authorId))];
const authors = await Promise.all(authorIds.map(id => ctx.db.get(id)));
authors.forEach((a, i) => authorsMap.set(authorIds[i], a));

// Then map comments to authors
const result = comments.map(c => ({
  ...c,
  author: authorsMap.get(c.authorId),
}));
```

---

*Generated by Explore Agent | T000f-h Database Mapping*
