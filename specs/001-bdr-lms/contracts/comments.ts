# Convex Function Contracts: Comments

**Module**: `convex/comments.ts`
**Date**: 2025-12-06

## Overview

Commenting system for courses and lessons with threaded replies.
All comment queries update in real-time via Convex subscriptions.

---

## Queries

### `api.comments.listForCourse`
Get comments for a course.

```typescript
export const listForCourse = query({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.array(v.object({
    _id: v.id("comments"),
    author: v.object({
      _id: v.id("users"),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
    }),
    content: v.string(),
    isPinned: v.boolean(),
    createdAt: v.number(),
    replyCount: v.number(),
    replies: v.array(v.object({
      _id: v.id("comments"),
      author: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
        role: v.union(v.literal("user"), v.literal("admin")),
      }),
      content: v.string(),
      createdAt: v.number(),
    })),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: User with course access
**Ordering**: Pinned first, then by creation time descending
**Threading**: Max 3 levels deep

---

### `api.comments.listForLesson`
Get comments for a lesson.

```typescript
export const listForLesson = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.array(v.object({
    _id: v.id("comments"),
    author: v.object({
      _id: v.id("users"),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
    }),
    content: v.string(),
    isPinned: v.boolean(),
    createdAt: v.number(),
    replyCount: v.number(),
    replies: v.array(v.object({
      _id: v.id("comments"),
      author: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
        role: v.union(v.literal("user"), v.literal("admin")),
      }),
      content: v.string(),
      createdAt: v.number(),
    })),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: User with course access
**Ordering**: Pinned first, then by creation time descending

---

### `api.comments.getReplies`
Get replies to a comment (for loading more).

```typescript
export const getReplies = query({
  args: {
    commentId: v.id("comments"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.id("comments")),
  },
  returns: v.object({
    replies: v.array(v.object({
      _id: v.id("comments"),
      author: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
        role: v.union(v.literal("user"), v.literal("admin")),
      }),
      content: v.string(),
      createdAt: v.number(),
    })),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.id("comments")),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: User with course access

---

## Mutations

### `api.comments.create`
Create a new comment on a course or lesson.

```typescript
export const create = mutation({
  args: {
    courseId: v.optional(v.id("courses")),
    lessonId: v.optional(v.id("lessons")),
    content: v.string(),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: User with course access
**Validation**:
- Content: 1-5000 characters
- Must specify either courseId or lessonId

---

### `api.comments.reply`
Reply to an existing comment.

```typescript
export const reply = mutation({
  args: {
    parentId: v.id("comments"),
    content: v.string(),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: User with course access
**Validation**:
- Content: 1-5000 characters
- Max nesting depth: 3 levels

---

### `api.comments.update`
Edit own comment.

```typescript
export const update = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Comment author only
**Validation**: Content 1-5000 characters

---

### `api.comments.remove`
Delete a comment.

```typescript
export const remove = mutation({
  args: {
    commentId: v.id("comments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Comment author or Admin
**Side Effects**: Cascades to all replies

---

### `api.comments.pin`
Pin a comment to the top (admin only).

```typescript
export const pin = mutation({
  args: {
    commentId: v.id("comments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.comments.unpin`
Unpin a comment (admin only).

```typescript
export const unpin = mutation({
  args: {
    commentId: v.id("comments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

## Real-Time Updates

```typescript
// Comments update automatically
const comments = useQuery(api.comments.listForLesson, { lessonId });
// New comments appear within 1 second
```

---

## Threading Rules

```
Root comment (level 0)
└── Reply (level 1)
    └── Reply (level 2)
        └── Reply (level 3) ← max depth
```

- Maximum nesting depth: 3 levels
- Replies beyond level 3 are added at level 3 (flat)
- Deleting a parent deletes all children

---

## Validation Rules

- Content: 1-5000 characters, required
- Must have either courseId or lessonId (not both, not neither)
- Max nesting depth: 3 levels
- Only author can edit, author or admin can delete
- Only admins can pin/unpin

---

## Moderation

Admins can:
- Delete any comment (including all replies)
- Pin important comments to top
- Unpin comments

Pinned comments:
- Appear at top of list before other comments
- Multiple pins allowed, ordered by pin time
