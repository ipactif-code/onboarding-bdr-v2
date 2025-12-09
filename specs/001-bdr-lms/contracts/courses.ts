# Convex Function Contracts: Courses

**Module**: `convex/courses.ts`
**Date**: 2025-12-06

## Overview

Course management functions for creating, editing, and publishing training content.
Courses contain sections which contain lessons of various types.

---

## Queries

### `api.courses.list`
List courses with filtering (respects visibility for non-admins).

```typescript
export const list = query({
  args: {
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
    tagId: v.optional(v.id("tags")),
    search: v.optional(v.string()),
  },
  returns: v.array(v.object({
    _id: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
    visibility: v.union(
      v.literal("all_teams"),
      v.literal("specific_teams"),
      v.literal("specific_users")
    ),
    displayOrder: v.number(),
    viewCount: v.number(),
    sectionCount: v.number(),
    lessonCount: v.number(),
    tags: v.array(v.object({
      _id: v.id("tags"),
      name: v.string(),
    })),
    publishedAt: v.optional(v.number()),
    _creationTime: v.number(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**:
- Admins: See all courses (including drafts)
- Users: See only published courses they have access to

---

### `api.courses.listForUser`
List courses assigned to current user in display order.

```typescript
export const listForUser = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    displayOrder: v.number(),
    tags: v.array(v.object({
      _id: v.id("tags"),
      name: v.string(),
    })),
    progress: v.object({
      completedLessons: v.number(),
      totalLessons: v.number(),
      percentage: v.number(),
      lastAccessedLessonId: v.optional(v.id("lessons")),
      lastAccessedAt: v.optional(v.number()),
    }),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user

---

### `api.courses.get`
Get course details with sections and lessons.

```typescript
export const get = query({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.object({
    _id: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    creator: v.object({
      _id: v.id("users"),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
    }),
    status: v.union(v.literal("draft"), v.literal("published")),
    visibility: v.union(
      v.literal("all_teams"),
      v.literal("specific_teams"),
      v.literal("specific_users")
    ),
    displayOrder: v.number(),
    viewCount: v.number(),
    tags: v.array(v.object({
      _id: v.id("tags"),
      name: v.string(),
    })),
    sections: v.array(v.object({
      _id: v.id("sections"),
      title: v.string(),
      description: v.optional(v.string()),
      displayOrder: v.number(),
      lessons: v.array(v.object({
        _id: v.id("lessons"),
        title: v.string(),
        type: v.union(
          v.literal("text"),
          v.literal("embed"),
          v.literal("quiz"),
          v.literal("files")
        ),
        estimatedDuration: v.optional(v.number()),
        displayOrder: v.number(),
      })),
    })),
    publishedAt: v.optional(v.number()),
    _creationTime: v.number(),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin or user with access

---

### `api.courses.getWithProgress`
Get course with user progress for each lesson.

```typescript
export const getWithProgress = query({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.object({
    // Same as get, plus:
    userProgress: v.object({
      completedLessons: v.number(),
      totalLessons: v.number(),
      percentage: v.number(),
      lessonStatuses: v.array(v.object({
        lessonId: v.id("lessons"),
        status: v.union(
          v.literal("not_started"),
          v.literal("in_progress"),
          v.literal("completed")
        ),
        completedAt: v.optional(v.number()),
      })),
    }),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user with course access

---

## Mutations

### `api.courses.create`
Create a new draft course.

```typescript
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("courses"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**:
- Title: 3-200 characters
- Description: Max 2000 characters
**Defaults**: status="draft", visibility="all_teams", displayOrder=next

---

### `api.courses.update`
Update course details.

```typescript
export const update = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(v.union(
      v.literal("all_teams"),
      v.literal("specific_teams"),
      v.literal("specific_users")
    )),
    displayOrder: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.courses.setCoverImage`
Set course cover image using Convex storage.

```typescript
export const setCoverImage = mutation({
  args: {
    courseId: v.id("courses"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.courses.publish`
Publish a draft course.

```typescript
export const publish = mutation({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**:
- Must have at least one section
- Each section must have at least one lesson
- Quiz lessons must have valid questions

---

### `api.courses.unpublish`
Revert published course to draft.

```typescript
export const unpublish = mutation({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Warning**: Course will be hidden from users

---

### `api.courses.remove`
Delete a course.

```typescript
export const remove = mutation({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Side Effects**:
- Cascades to sections, lessons, files
- Preserves progress history for analytics
- Shows warning if users have started the course

---

### `api.courses.reorder`
Update display order for multiple courses.

```typescript
export const reorder = mutation({
  args: {
    courseOrders: v.array(v.object({
      courseId: v.id("courses"),
      displayOrder: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.courses.incrementViewCount`
Increment course view count (called on course open).

```typescript
export const incrementViewCount = mutation({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any user with access

---

## Tag Management

### `api.courses.addTag`
Add a tag to a course.

```typescript
export const addTag = mutation({
  args: {
    courseId: v.id("courses"),
    tagName: v.string(),
  },
  returns: v.id("tags"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Behavior**: Creates tag if it doesn't exist

---

### `api.courses.removeTag`
Remove a tag from a course.

```typescript
export const removeTag = mutation({
  args: {
    courseId: v.id("courses"),
    tagId: v.id("tags"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

## Assignment Management

### `api.courses.assign`
Assign course to teams or users.

```typescript
export const assign = mutation({
  args: {
    courseId: v.id("courses"),
    teamIds: v.optional(v.array(v.id("teams"))),
    userIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.courses.unassign`
Remove course assignment.

```typescript
export const unassign = mutation({
  args: {
    courseId: v.id("courses"),
    teamId: v.optional(v.id("teams")),
    userId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

## Validation Rules

- Title: 3-200 characters, required
- Description: Max 2000 characters, optional
- Must have at least one section before publishing
- Each section must have at least one lesson before publishing
- displayOrder: Positive integer, unique within published courses
