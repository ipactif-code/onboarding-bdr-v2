# API Adaptation Guide: tRPC to Convex

> **Task**: T000i-j - Map Potion's tRPC API to Convex patterns for the BDR LMS Knowledge Base feature.

## Table of Contents

1. [tRPC Router Inventory](#1-trpc-router-inventory)
2. [Convex Function Equivalents](#2-convex-function-equivalents)
3. [Validator Conversion Reference](#3-validator-conversion-reference)
4. [Code Conversion Examples](#4-code-conversion-examples)
5. [File Organization Plan](#5-file-organization-plan)
6. [Auth Pattern Integration](#6-auth-pattern-integration)

---

## 1. tRPC Router Inventory

### 1.1 Router Structure Overview

```
src/server/api/
  root.ts             # Main router combining all sub-routers
  trpc.ts             # tRPC context and initialization
  middlewares/
    procedures.ts     # protectedProcedure, adminProcedure, superAdminProcedure
    loggedInMiddleware.ts
    authorizationMiddleware.ts
    publicProcedure.ts
    ratelimitMiddleware.ts
    devMiddleware.ts
  routers/
    document.ts       # Core document CRUD
    comment.ts        # Discussions and comments
    version.ts        # Document versioning
    file.ts           # File attachments
    user.ts           # User management
    layout.ts         # App layout data
```

### 1.2 Document Router (`document.ts`)

| Procedure | Type | Auth | Input Schema | Description |
|-----------|------|------|--------------|-------------|
| `document` | Query | Protected | `{ id: string }` | Get single document by ID |
| `documents` | Query | Protected | `{ cursor?, limit?, parentDocumentId?, search? }` | List documents with pagination |
| `trash` | Query | Protected | `{ q?: string }` | List archived documents |
| `create` | Mutation | Protected + Rate limit | `{ title?, contentRich?, parentDocumentId? }` | Create new document |
| `update` | Mutation | Protected | `{ id, title?, content?, contentRich?, coverImage?, icon?, isPublished?, ... }` | Update document fields |
| `archive` | Mutation | Protected | `{ id: string }` | Soft delete (archive) |
| `restore` | Mutation | Protected | `{ id: string }` | Restore from archive |
| `delete` | Mutation | Protected | `{ id: string }` | Permanent delete |

**Validation Constants:**
- `MAX_TITLE_LENGTH`: 256 characters
- `MAX_CONTENT_LENGTH`: 1,000,000 characters (1MB)
- `MAX_ICON_LENGTH`: 100 characters

### 1.3 Comment Router (`comment.ts`)

| Procedure | Type | Auth | Input Schema | Description |
|-----------|------|------|--------------|-------------|
| `discussions` | Query | Protected | `{ documentId: string }` | Get all discussions for a document |
| `createDiscussion` | Mutation | Protected + Rate limit | `{ documentId, documentContent }` | Create discussion thread |
| `createComment` | Mutation | Protected + Rate limit | `{ discussionId, contentRich? }` | Add comment to discussion |
| `createDiscussionWithComment` | Mutation | Protected + Rate limit | `{ documentId, documentContent, contentRich?, discussionId? }` | Create discussion + first comment |
| `updateComment` | Mutation | Protected | `{ id, discussionId, contentRich?, isEdited? }` | Edit comment |
| `deleteComment` | Mutation | Protected | `{ id, discussionId }` | Delete comment |
| `resolveDiscussion` | Mutation | Protected | `{ id }` | Mark discussion resolved |
| `removeDiscussion` | Mutation | Protected | `{ id }` | Delete discussion |

**Validation Constants:**
- `MAX_COMMENT_LENGTH`: 50,000 characters (50KB)
- `MAX_DOCUMENT_CONTENT_LENGTH`: 1,000 characters (highlighted text)

### 1.4 Version Router (`version.ts`)

| Procedure | Type | Auth | Input Schema | Description |
|-----------|------|------|--------------|-------------|
| `documentVersion` | Query | Protected | `{ documentVersionId: string }` | Get single version |
| `documentVersions` | Query | Protected | `{ documentId: string }` | List all versions for document |
| `createVersion` | Mutation | Protected + Rate limit | `{ documentId: string }` | Create snapshot version |
| `restoreVersion` | Mutation | Protected | `{ id: string }` | Restore document to version |
| `deleteVersion` | Mutation | Protected | `{ id: string }` | Delete version |

### 1.5 File Router (`file.ts`)

| Procedure | Type | Auth | Input Schema | Description |
|-----------|------|------|--------------|-------------|
| `createFile` | Mutation | Protected | `{ id, appUrl, documentId, size, type, url }` | Record file upload |

### 1.6 User Router (`user.ts`)

| Procedure | Type | Auth | Input Schema | Description |
|-----------|------|------|--------------|-------------|
| `getSettings` | Query | Protected | None | Get current user settings |
| `getUser` | Query | Protected | `{ id: string }` | Get user by ID |
| `users` | Query | Protected | `{ cursor?, limit?, search? }` | List users with pagination |
| `updateSettings` | Mutation | Protected | `{ name?, email?, image? }` | Update user settings |
| `deleteAccount` | Mutation | Protected | None | Delete user account |

**Validation Constants:**
- `MAX_NAME_LENGTH`: 100 characters
- `MAX_EMAIL_LENGTH`: 255 characters
- `MAX_PROFILE_IMAGE_URL_LENGTH`: 500 characters

### 1.7 Layout Router (`layout.ts`)

| Procedure | Type | Auth | Input Schema | Description |
|-----------|------|------|--------------|-------------|
| `app` | Query | Protected | None | Get app layout data for current user |

---

## 2. Convex Function Equivalents

### 2.1 Mapping Summary

| tRPC Pattern | Convex Equivalent |
|--------------|-------------------|
| `publicProcedure.query()` | `query()` with optional `getCurrentUser(ctx)` |
| `protectedProcedure.query()` | `query()` with `requireAuth(ctx)` |
| `protectedProcedure.mutation()` | `mutation()` with `requireAuth(ctx)` |
| `adminProcedure.mutation()` | `mutation()` with `requireAdmin(ctx)` |
| `superAdminProcedure.*()` | `mutation()` with custom `requireSuperAdmin(ctx)` |
| `.input(z.object({...}))` | `args: { field: v.type() }` |
| `ctx.userId` | `user._id` (from `requireAuth(ctx)`) |
| `prisma.model.findMany()` | `ctx.db.query("table").collect()` |
| `prisma.model.create()` | `ctx.db.insert("table", {...})` |
| `prisma.model.update()` | `ctx.db.patch(id, {...})` |
| `prisma.model.delete()` | `ctx.db.delete(id)` |

### 2.2 Document Functions

```typescript
// convex/knowledge/documents.ts

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

/**
 * Get a single knowledge base document by ID.
 */
export const get = query({
  args: {
    id: v.id("kbDocuments"),
  },
  returns: v.union(
    v.object({
      _id: v.id("kbDocuments"),
      _creationTime: v.number(),
      title: v.optional(v.string()),
      contentRich: v.optional(v.any()),
      coverImage: v.optional(v.string()),
      icon: v.optional(v.string()),
      isArchived: v.boolean(),
      isPublished: v.boolean(),
      parentDocumentId: v.optional(v.id("kbDocuments")),
      ownerId: v.id("users"),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc) return null;

    // Only owner can view their documents
    if (doc.ownerId !== user._id) return null;

    return doc;
  },
});

/**
 * List knowledge base documents with pagination.
 */
export const list = query({
  args: {
    parentDocumentId: v.optional(v.id("kbDocuments")),
    search: v.optional(v.string()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    documents: v.array(v.object({
      _id: v.id("kbDocuments"),
      _creationTime: v.number(),
      title: v.optional(v.string()),
      icon: v.optional(v.string()),
      coverImage: v.optional(v.string()),
      updatedAt: v.number(),
    })),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const limit = args.limit ?? 20;

    let query = ctx.db
      .query("kbDocuments")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id));

    // Note: For search, use Convex search index or filter post-query
    const allDocs = await query.collect();

    // Filter by parent
    let filtered = allDocs.filter(
      (d) => !d.isArchived && d.parentDocumentId === (args.parentDocumentId ?? null)
    );

    // Apply search filter if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filtered = filtered.filter(
        (d) => d.title?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by creation time descending
    filtered.sort((a, b) => b._creationTime - a._creationTime);

    // Paginate
    const startIndex = args.cursor ? parseInt(args.cursor, 10) : 0;
    const paginated = filtered.slice(startIndex, startIndex + limit + 1);

    const hasMore = paginated.length > limit;
    const documents = hasMore ? paginated.slice(0, limit) : paginated;

    return {
      documents: documents.map((d) => ({
        _id: d._id,
        _creationTime: d._creationTime,
        title: d.title,
        icon: d.icon,
        coverImage: d.coverImage,
        updatedAt: d.updatedAt,
      })),
      nextCursor: hasMore ? String(startIndex + limit) : undefined,
    };
  },
});

/**
 * Create a new knowledge base document.
 */
export const create = mutation({
  args: {
    title: v.optional(v.string()),
    contentRich: v.optional(v.any()),
    parentDocumentId: v.optional(v.id("kbDocuments")),
  },
  returns: v.id("kbDocuments"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate title length
    if (args.title && args.title.length > 256) {
      throw new Error("Title must be 256 characters or less");
    }

    const now = Date.now();

    return await ctx.db.insert("kbDocuments", {
      title: args.title,
      contentRich: args.contentRich,
      parentDocumentId: args.parentDocumentId ?? null,
      ownerId: user._id,
      isArchived: false,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a knowledge base document.
 */
export const update = mutation({
  args: {
    id: v.id("kbDocuments"),
    title: v.optional(v.string()),
    contentRich: v.optional(v.any()),
    coverImage: v.optional(v.string()),
    icon: v.optional(v.union(v.string(), v.null())),
    isPublished: v.optional(v.boolean()),
    fullWidth: v.optional(v.boolean()),
    smallText: v.optional(v.boolean()),
    toc: v.optional(v.boolean()),
    lockPage: v.optional(v.boolean()),
    textStyle: v.optional(
      v.union(v.literal("DEFAULT"), v.literal("SERIF"), v.literal("MONO"))
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (doc.ownerId !== user._id) throw new Error("Forbidden");

    // Validate title length
    if (args.title !== undefined && args.title.length > 256) {
      throw new Error("Title must be 256 characters or less");
    }

    // Build updates object (only include defined fields)
    const updates: Partial<typeof doc> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.contentRich !== undefined) updates.contentRich = args.contentRich;
    if (args.coverImage !== undefined) updates.coverImage = args.coverImage;
    if (args.icon !== undefined) updates.icon = args.icon ?? undefined;
    if (args.isPublished !== undefined) updates.isPublished = args.isPublished;
    if (args.fullWidth !== undefined) updates.fullWidth = args.fullWidth;
    if (args.smallText !== undefined) updates.smallText = args.smallText;
    if (args.toc !== undefined) updates.toc = args.toc;
    if (args.lockPage !== undefined) updates.lockPage = args.lockPage;
    if (args.textStyle !== undefined) updates.textStyle = args.textStyle;

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

/**
 * Archive (soft delete) a document.
 */
export const archive = mutation({
  args: { id: v.id("kbDocuments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (doc.ownerId !== user._id) throw new Error("Forbidden");

    await ctx.db.patch(args.id, {
      isArchived: true,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Restore a document from archive.
 */
export const restore = mutation({
  args: { id: v.id("kbDocuments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (doc.ownerId !== user._id) throw new Error("Forbidden");

    await ctx.db.patch(args.id, {
      isArchived: false,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Permanently delete a document.
 */
export const remove = mutation({
  args: { id: v.id("kbDocuments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (doc.ownerId !== user._id) throw new Error("Forbidden");

    await ctx.db.delete(args.id);
    return null;
  },
});

/**
 * List archived (trash) documents.
 */
export const listTrash = query({
  args: { search: v.optional(v.string()) },
  returns: v.object({
    documents: v.array(v.object({
      _id: v.id("kbDocuments"),
      title: v.optional(v.string()),
      icon: v.optional(v.string()),
    })),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const allDocs = await ctx.db
      .query("kbDocuments")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    let archived = allDocs.filter((d) => d.isArchived);

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      archived = archived.filter(
        (d) => d.title?.toLowerCase().includes(searchLower)
      );
    }

    return {
      documents: archived.map((d) => ({
        _id: d._id,
        title: d.title,
        icon: d.icon,
      })),
    };
  },
});
```

### 2.3 Discussion/Comment Functions

```typescript
// convex/knowledge/discussions.ts

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

/**
 * Get all discussions for a document.
 */
export const listByDocument = query({
  args: { documentId: v.id("kbDocuments") },
  returns: v.object({
    discussions: v.array(v.object({
      _id: v.id("kbDiscussions"),
      documentContent: v.string(),
      isResolved: v.boolean(),
      createdAt: v.number(),
      userId: v.id("users"),
      user: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      comments: v.array(v.object({
        _id: v.id("kbComments"),
        contentRich: v.optional(v.any()),
        createdAt: v.number(),
        updatedAt: v.optional(v.number()),
        isEdited: v.boolean(),
        user: v.object({
          _id: v.id("users"),
          name: v.string(),
          avatarUrl: v.optional(v.string()),
        }),
      })),
    })),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const discussions = await ctx.db
      .query("kbDiscussions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const result = await Promise.all(
      discussions.map(async (discussion) => {
        const [user, comments] = await Promise.all([
          ctx.db.get(discussion.userId),
          ctx.db
            .query("kbComments")
            .withIndex("by_discussion", (q) => q.eq("discussionId", discussion._id))
            .collect(),
        ]);

        const commentsWithUsers = await Promise.all(
          comments.map(async (comment) => {
            const commentUser = await ctx.db.get(comment.userId);
            return {
              _id: comment._id,
              contentRich: comment.contentRich,
              createdAt: comment.createdAt,
              updatedAt: comment.updatedAt,
              isEdited: comment.isEdited,
              user: {
                _id: commentUser!._id,
                name: commentUser!.name,
                avatarUrl: commentUser!.avatarUrl,
              },
            };
          })
        );

        // Sort comments by creation time ascending
        commentsWithUsers.sort((a, b) => a.createdAt - b.createdAt);

        return {
          _id: discussion._id,
          documentContent: discussion.documentContent,
          isResolved: discussion.isResolved,
          createdAt: discussion.createdAt,
          userId: discussion.userId,
          user: {
            _id: user!._id,
            name: user!.name,
            avatarUrl: user!.avatarUrl,
          },
          comments: commentsWithUsers,
        };
      })
    );

    // Sort discussions by creation time descending
    result.sort((a, b) => b.createdAt - a.createdAt);

    return { discussions: result };
  },
});

/**
 * Create a discussion with an initial comment.
 */
export const createWithComment = mutation({
  args: {
    documentId: v.id("kbDocuments"),
    documentContent: v.string(),
    contentRich: v.optional(v.array(v.any())),
  },
  returns: v.id("kbDiscussions"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate lengths
    if (args.documentContent.length > 1000) {
      throw new Error("Selected text must be 1000 characters or less");
    }

    const now = Date.now();

    // Create discussion
    const discussionId = await ctx.db.insert("kbDiscussions", {
      documentId: args.documentId,
      documentContent: args.documentContent,
      userId: user._id,
      isResolved: false,
      createdAt: now,
    });

    // Create initial comment if content provided
    if (args.contentRich) {
      await ctx.db.insert("kbComments", {
        discussionId,
        userId: user._id,
        contentRich: args.contentRich,
        isEdited: false,
        createdAt: now,
      });
    }

    return discussionId;
  },
});

/**
 * Add a comment to a discussion.
 */
export const addComment = mutation({
  args: {
    discussionId: v.id("kbDiscussions"),
    contentRich: v.array(v.any()),
  },
  returns: v.id("kbComments"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify discussion exists
    const discussion = await ctx.db.get(args.discussionId);
    if (!discussion) throw new Error("Discussion not found");

    return await ctx.db.insert("kbComments", {
      discussionId: args.discussionId,
      userId: user._id,
      contentRich: args.contentRich,
      isEdited: false,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update a comment.
 */
export const updateComment = mutation({
  args: {
    id: v.id("kbComments"),
    contentRich: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== user._id) throw new Error("Forbidden");

    await ctx.db.patch(args.id, {
      contentRich: args.contentRich,
      isEdited: true,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Delete a comment.
 */
export const deleteComment = mutation({
  args: { id: v.id("kbComments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== user._id) throw new Error("Forbidden");

    await ctx.db.delete(args.id);
    return null;
  },
});

/**
 * Resolve a discussion.
 */
export const resolve = mutation({
  args: { id: v.id("kbDiscussions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const discussion = await ctx.db.get(args.id);
    if (!discussion) throw new Error("Discussion not found");

    await ctx.db.patch(args.id, { isResolved: true });
    return null;
  },
});

/**
 * Delete a discussion and all its comments.
 */
export const remove = mutation({
  args: { id: v.id("kbDiscussions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Delete all comments first
    const comments = await ctx.db
      .query("kbComments")
      .withIndex("by_discussion", (q) => q.eq("discussionId", args.id))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete discussion
    await ctx.db.delete(args.id);
    return null;
  },
});
```

### 2.4 Version Functions

```typescript
// convex/knowledge/versions.ts

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";

/**
 * Get a single document version.
 */
export const get = query({
  args: { id: v.id("kbVersions") },
  returns: v.union(
    v.object({
      _id: v.id("kbVersions"),
      documentId: v.id("kbDocuments"),
      title: v.optional(v.string()),
      contentRich: v.optional(v.any()),
      createdAt: v.number(),
      userId: v.id("users"),
      username: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const version = await ctx.db.get(args.id);
    if (!version) return null;

    const user = await ctx.db.get(version.userId);

    return {
      _id: version._id,
      documentId: version.documentId,
      title: version.title,
      contentRich: version.contentRich,
      createdAt: version.createdAt,
      userId: version.userId,
      username: user?.name,
    };
  },
});

/**
 * List all versions for a document.
 */
export const listByDocument = query({
  args: { documentId: v.id("kbDocuments") },
  returns: v.object({
    versions: v.array(v.object({
      _id: v.id("kbVersions"),
      title: v.optional(v.string()),
      contentRich: v.optional(v.any()),
      createdAt: v.number(),
      userId: v.id("users"),
      username: v.optional(v.string()),
      avatarUrl: v.optional(v.string()),
    })),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const versions = await ctx.db
      .query("kbVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Sort by creation time descending
    versions.sort((a, b) => b.createdAt - a.createdAt);

    const versionsWithUsers = await Promise.all(
      versions.map(async (version) => {
        const user = await ctx.db.get(version.userId);
        return {
          _id: version._id,
          title: version.title,
          contentRich: version.contentRich,
          createdAt: version.createdAt,
          userId: version.userId,
          username: user?.name,
          avatarUrl: user?.avatarUrl,
        };
      })
    );

    return { versions: versionsWithUsers };
  },
});

/**
 * Create a new version snapshot.
 */
export const create = mutation({
  args: { documentId: v.id("kbDocuments") },
  returns: v.id("kbVersions"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.ownerId !== user._id) throw new Error("Forbidden");

    return await ctx.db.insert("kbVersions", {
      documentId: args.documentId,
      title: doc.title,
      contentRich: doc.contentRich,
      userId: user._id,
      createdAt: Date.now(),
    });
  },
});

/**
 * Restore a document to a specific version.
 */
export const restore = mutation({
  args: { id: v.id("kbVersions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const version = await ctx.db.get(args.id);
    if (!version) throw new Error("Version not found");

    const doc = await ctx.db.get(version.documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.ownerId !== user._id) throw new Error("Forbidden");

    await ctx.db.patch(version.documentId, {
      title: version.title,
      contentRich: version.contentRich,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Delete a version.
 */
export const remove = mutation({
  args: { id: v.id("kbVersions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const version = await ctx.db.get(args.id);
    if (!version) throw new Error("Version not found");
    if (version.userId !== user._id) throw new Error("Forbidden");

    await ctx.db.delete(args.id);
    return null;
  },
});
```

---

## 3. Validator Conversion Reference

### 3.1 Zod to Convex Validators

| Zod Validator | Convex Validator | Notes |
|---------------|------------------|-------|
| `z.string()` | `v.string()` | |
| `z.number()` | `v.number()` | |
| `z.boolean()` | `v.boolean()` | |
| `z.string().optional()` | `v.optional(v.string())` | |
| `z.string().nullish()` | `v.optional(v.union(v.string(), v.null()))` | |
| `z.object({...})` | `v.object({...})` | |
| `z.array(z.string())` | `v.array(v.string())` | |
| `z.any()` | `v.any()` | Use sparingly |
| `z.enum(["A", "B"])` | `v.union(v.literal("A"), v.literal("B"))` | |
| `z.string().min(1)` | Validate in handler | `if (!val) throw Error` |
| `z.string().max(N)` | Validate in handler | `if (val.length > N) throw Error` |
| `z.string().email()` | Validate in handler | Use regex or library |
| `z.string().url()` | Validate in handler | Use regex or library |

### 3.2 Input Validation Example

**tRPC (Zod):**
```typescript
.input(
  z.object({
    title: z.string().max(256, 'Title is too long').optional(),
    email: z.string().email().max(255, 'Email is too long'),
    tags: z.array(z.string()).min(1),
  })
)
```

**Convex:**
```typescript
args: {
  title: v.optional(v.string()),
  email: v.string(),
  tags: v.array(v.string()),
},
handler: async (ctx, args) => {
  // Validation in handler
  if (args.title && args.title.length > 256) {
    throw new Error("Title must be 256 characters or less");
  }
  if (args.email.length > 255) {
    throw new Error("Email must be 255 characters or less");
  }
  if (!args.email.includes("@")) {
    throw new Error("Invalid email format");
  }
  if (args.tags.length === 0) {
    throw new Error("At least one tag is required");
  }
  // ... rest of handler
},
```

### 3.3 ID References

| tRPC Pattern | Convex Pattern |
|--------------|----------------|
| `z.string()` (for IDs) | `v.id("tableName")` |
| `input.id` | `args.id` (typed as `Id<"tableName">`) |
| `ctx.userId` | `user._id` |

---

## 4. Code Conversion Examples

### 4.1 Query Conversion

**tRPC:**
```typescript
documents: protectedProcedure
  .input(
    z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      parentDocumentId: z.string().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const documents = await prisma.document.findMany({
      cursor: input.cursor ? { id: input.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      take: input.limit ? input.limit + 1 : undefined,
      where: {
        userId: ctx.userId,
        parentDocumentId: input.parentDocumentId ?? null,
      },
    });

    let nextCursor: string | undefined;
    if (input.limit && documents.length > input.limit) {
      const nextItem = documents.pop();
      nextCursor = nextItem!.id;
    }

    return { documents, nextCursor };
  }),
```

**Convex:**
```typescript
export const list = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    parentDocumentId: v.optional(v.id("kbDocuments")),
  },
  returns: v.object({
    documents: v.array(v.object({...})),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    // Use index for efficient querying
    const allDocs = await ctx.db
      .query("kbDocuments")
      .withIndex("by_owner_parent", (q) =>
        q.eq("ownerId", user._id).eq("parentDocumentId", args.parentDocumentId ?? null)
      )
      .order("desc") // By _creationTime
      .collect();

    // Apply cursor-based pagination
    const startIndex = args.cursor ? parseInt(args.cursor, 10) : 0;
    const paginated = allDocs.slice(startIndex, startIndex + limit + 1);

    const hasMore = paginated.length > limit;
    const documents = hasMore ? paginated.slice(0, limit) : paginated;

    return {
      documents,
      nextCursor: hasMore ? String(startIndex + limit) : undefined,
    };
  },
});
```

### 4.2 Mutation Conversion

**tRPC:**
```typescript
update: protectedProcedure
  .input(
    z.object({
      id: z.string(),
      title: z.string().max(256).optional(),
      isPublished: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    await prisma.document.update({
      data: {
        title: input.title,
        isPublished: input.isPublished,
      },
      where: {
        id: input.id,
        userId: ctx.userId,
      },
    });
  }),
```

**Convex:**
```typescript
export const update = mutation({
  args: {
    id: v.id("kbDocuments"),
    title: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Validate title length
    if (args.title !== undefined && args.title.length > 256) {
      throw new Error("Title must be 256 characters or less");
    }

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (doc.ownerId !== user._id) throw new Error("Forbidden");

    // Build partial update
    const updates: Partial<typeof doc> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.isPublished !== undefined) updates.isPublished = args.isPublished;

    await ctx.db.patch(args.id, updates);
    return null;
  },
});
```

### 4.3 Error Handling Conversion

**tRPC:**
```typescript
import { TRPCError } from '@trpc/server';

if (!user) {
  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Login required',
  });
}

if (content.length > MAX_LENGTH) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Content is too long',
  });
}
```

**Convex:**
```typescript
// Auth errors
if (!user) {
  throw new Error("Unauthorized: Authentication required");
}

// Validation errors
if (content.length > MAX_LENGTH) {
  throw new Error("Content is too long");
}

// Not found errors
if (!doc) {
  throw new Error("Document not found");
}

// Permission errors
if (doc.ownerId !== user._id) {
  throw new Error("Forbidden: You don't have permission to access this resource");
}
```

---

## 5. File Organization Plan

### 5.1 Proposed Convex Structure

```
convex/
  knowledge/
    documents.ts      # Document CRUD (get, list, create, update, archive, restore, remove, listTrash)
    discussions.ts    # Discussions & comments (listByDocument, createWithComment, addComment, ...)
    versions.ts       # Version management (get, listByDocument, create, restore, remove)
    files.ts          # File attachments (create, getByDocument, remove)
    search.ts         # Full-text search (searchDocuments)
    internal.ts       # Internal functions for scheduled jobs
  lib/
    auth.ts           # Auth helpers (existing)
    validators.ts     # Reusable validators
    knowledge.ts      # Knowledge-specific helpers
```

### 5.2 Schema Additions

Add to `convex/schema.ts`:

```typescript
// ============================================================================
// KNOWLEDGE BASE TABLES
// ============================================================================

// Knowledge base documents (Notion-like pages)
kbDocuments: defineTable({
  // Content
  title: v.optional(v.string()),
  contentRich: v.optional(v.any()), // Plate.js JSON
  content: v.optional(v.string()), // Plain text for search

  // Visual
  icon: v.optional(v.string()),
  coverImage: v.optional(v.string()),

  // Hierarchy
  parentDocumentId: v.optional(v.id("kbDocuments")),

  // Ownership
  ownerId: v.id("users"),

  // State
  isArchived: v.boolean(),
  isPublished: v.boolean(),

  // Display preferences
  fullWidth: v.optional(v.boolean()),
  smallText: v.optional(v.boolean()),
  toc: v.optional(v.boolean()),
  lockPage: v.optional(v.boolean()),
  textStyle: v.optional(
    v.union(v.literal("DEFAULT"), v.literal("SERIF"), v.literal("MONO"))
  ),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_parent", ["ownerId", "parentDocumentId"])
  .index("by_owner_archived", ["ownerId", "isArchived"])
  .index("by_parent", ["parentDocumentId"])
  .searchIndex("search_content", {
    searchField: "content",
    filterFields: ["ownerId", "isArchived", "isPublished"],
  }),

// Discussion threads on documents
kbDiscussions: defineTable({
  documentId: v.id("kbDocuments"),
  documentContent: v.string(), // Highlighted text
  userId: v.id("users"),
  isResolved: v.boolean(),
  createdAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_user", ["userId"]),

// Comments within discussions
kbComments: defineTable({
  discussionId: v.id("kbDiscussions"),
  userId: v.id("users"),
  contentRich: v.optional(v.any()), // Plate.js JSON
  isEdited: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_discussion", ["discussionId"])
  .index("by_user", ["userId"]),

// Document version history
kbVersions: defineTable({
  documentId: v.id("kbDocuments"),
  title: v.optional(v.string()),
  contentRich: v.optional(v.any()),
  userId: v.id("users"),
  createdAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_user", ["userId"]),

// File attachments for documents
kbFiles: defineTable({
  documentId: v.id("kbDocuments"),
  storageId: v.optional(v.id("_storage")),
  url: v.string(),
  appUrl: v.string(),
  fileName: v.string(),
  fileSize: v.number(),
  fileType: v.string(),
  userId: v.id("users"),
  createdAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_user", ["userId"]),
```

### 5.3 Index Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| `kbDocuments` | `by_owner` | List user's documents |
| `kbDocuments` | `by_owner_parent` | List children of a document |
| `kbDocuments` | `by_owner_archived` | Filter archived/active |
| `kbDocuments` | `by_parent` | Get all children of any parent |
| `kbDocuments` | `search_content` | Full-text search |
| `kbDiscussions` | `by_document` | Get discussions for document |
| `kbComments` | `by_discussion` | Get comments in discussion |
| `kbVersions` | `by_document` | List version history |
| `kbFiles` | `by_document` | Get document attachments |

---

## 6. Auth Pattern Integration

### 6.1 Auth Helpers (convex/lib/auth.ts)

The project already has auth helpers. Use them consistently:

```typescript
import { requireAuth, requireAdmin, getCurrentUser } from "../lib/auth";

// Protected function (any authenticated user)
export const myQuery = query({
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx); // Throws if not authenticated
    // user._id is available
  },
});

// Admin-only function
export const adminMutation = mutation({
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx); // Throws if not admin
    // admin._id is available
  },
});

// Optional auth (public with optional user context)
export const publicQuery = query({
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx); // Returns null if not authenticated
    if (user) {
      // Personalized response
    } else {
      // Anonymous response
    }
  },
});
```

### 6.2 Authorization Patterns

```typescript
// Owner-only access
export const updateDocument = mutation({
  args: { id: v.id("kbDocuments"), ... },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");

    // Owner check
    if (doc.ownerId !== user._id) {
      throw new Error("Forbidden: You don't own this document");
    }

    await ctx.db.patch(args.id, { ... });
  },
});

// Owner OR admin access (use requireSelfOrAdmin pattern)
export const viewDocument = query({
  args: { id: v.id("kbDocuments") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc) return null;

    // Allow if owner OR admin OR document is published
    const canView =
      doc.ownerId === user._id ||
      user.role === "admin" ||
      doc.isPublished;

    if (!canView) return null;

    return doc;
  },
});
```

### 6.3 tRPC Procedure to Convex Mapping

| tRPC Procedure | Convex Auth Pattern |
|----------------|---------------------|
| `publicProcedure` | `getCurrentUser(ctx)` (returns null if not auth) |
| `protectedProcedure` | `requireAuth(ctx)` (throws if not auth) |
| `adminProcedure` | `requireAdmin(ctx)` (throws if not admin) |
| `superAdminProcedure` | Custom `requireSuperAdmin(ctx)` |

### 6.4 Rate Limiting

tRPC uses middleware for rate limiting. In Convex, implement at the application level:

```typescript
// convex/lib/ratelimit.ts

import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

const RATE_LIMITS = {
  "document/create": { window: 60_000, max: 10 }, // 10 per minute
  "comment/create": { window: 60_000, max: 30 },  // 30 per minute
  "version/create": { window: 60_000, max: 5 },   // 5 per minute
} as const;

export async function checkRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: keyof typeof RATE_LIMITS
): Promise<void> {
  const config = RATE_LIMITS[action];
  const now = Date.now();

  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_type", (q) =>
      q.eq("userId", userId).eq("type", action as any)
    )
    .unique();

  if (!existing) {
    await ctx.db.insert("rateLimits", {
      userId,
      type: action as any,
      windowStart: now,
      count: 1,
    });
    return;
  }

  // Check if window expired
  if (now - existing.windowStart > config.window) {
    await ctx.db.patch(existing._id, {
      windowStart: now,
      count: 1,
    });
    return;
  }

  // Check if limit exceeded
  if (existing.count >= config.max) {
    throw new Error(`Rate limit exceeded. Try again later.`);
  }

  // Increment count
  await ctx.db.patch(existing._id, {
    count: existing.count + 1,
  });
}
```

Usage:
```typescript
export const create = mutation({
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await checkRateLimit(ctx, user._id, "document/create");

    // ... create document
  },
});
```

---

## Summary

This guide maps Potion's tRPC API to Convex patterns for the BDR LMS Knowledge Base feature:

1. **6 tRPC routers** identified with 25+ procedures
2. **Convex file organization**: `convex/knowledge/` with 5 module files
3. **Schema additions**: 5 new tables with appropriate indexes
4. **Auth integration**: Using existing `requireAuth`/`requireAdmin` patterns
5. **Validator conversion**: Zod schemas mapped to Convex validators
6. **Error handling**: Consistent error message patterns

### Next Steps

1. **schema-architect**: Add Knowledge Base tables to `convex/schema.ts`
2. **backend-engineer**: Implement Convex functions in `convex/knowledge/`
3. **frontend-engineer**: Migrate React components to use Convex hooks
4. **test-architect**: Create unit tests for new Convex functions
