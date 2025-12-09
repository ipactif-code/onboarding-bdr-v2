# Convex Function Contracts: Progress Tracking

**Module**: `convex/progress.ts`
**Date**: 2025-12-06

## Overview

Progress tracking functions for lesson completion and course progress.
All progress queries are real-time via Convex subscriptions.

---

## Queries

### `api.progress.getForLesson`
Get user's progress on a specific lesson.

```typescript
export const getForLesson = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.union(
    v.object({
      _id: v.id("progress"),
      status: v.union(
        v.literal("not_started"),
        v.literal("in_progress"),
        v.literal("completed")
      ),
      completedAt: v.optional(v.number()),
      lastAccessedAt: v.number(),
      timeSpent: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Current user's progress only

---

### `api.progress.getForCourse`
Get user's progress across all lessons in a course.

```typescript
export const getForCourse = query({
  args: {
    courseId: v.id("courses"),
    userId: v.optional(v.id("users")), // Admin can view other users
  },
  returns: v.object({
    completedLessons: v.number(),
    totalLessons: v.number(),
    percentage: v.number(),
    lessonProgress: v.array(v.object({
      lessonId: v.id("lessons"),
      lessonTitle: v.string(),
      sectionTitle: v.string(),
      status: v.union(
        v.literal("not_started"),
        v.literal("in_progress"),
        v.literal("completed")
      ),
      completedAt: v.optional(v.number()),
      timeSpent: v.number(),
    })),
    lastAccessedLesson: v.optional(v.object({
      lessonId: v.id("lessons"),
      title: v.string(),
      sectionTitle: v.string(),
      lastAccessedAt: v.number(),
    })),
    totalTimeSpent: v.number(),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Self or Admin

---

### `api.progress.getContinueWatching`
Get "Continue where you left off" data for dashboard.

```typescript
export const getContinueWatching = query({
  args: {},
  returns: v.optional(v.object({
    course: v.object({
      _id: v.id("courses"),
      title: v.string(),
      coverImageUrl: v.optional(v.string()),
    }),
    lesson: v.object({
      _id: v.id("lessons"),
      title: v.string(),
      sectionTitle: v.string(),
    }),
    progress: v.object({
      completedLessons: v.number(),
      totalLessons: v.number(),
      percentage: v.number(),
    }),
    lastAccessedAt: v.number(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Current user only

---

### `api.progress.getUserOverview`
Get overall progress stats for a user.

```typescript
export const getUserOverview = query({
  args: {
    userId: v.optional(v.id("users")), // Admin can view other users
  },
  returns: v.object({
    coursesCompleted: v.number(),
    coursesInProgress: v.number(),
    coursesNotStarted: v.number(),
    totalLessonsCompleted: v.number(),
    totalTimeSpent: v.number(),
    averageQuizScore: v.optional(v.number()),
    recentActivity: v.array(v.object({
      courseId: v.id("courses"),
      courseTitle: v.string(),
      lessonId: v.id("lessons"),
      lessonTitle: v.string(),
      action: v.union(v.literal("started"), v.literal("completed")),
      timestamp: v.number(),
    })),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Self or Admin

---

## Mutations

### `api.progress.markStarted`
Mark a lesson as in progress (called when user opens lesson).

```typescript
export const markStarted = mutation({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.id("progress"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user with course access
**Behavior**: Creates progress record if none exists, updates lastAccessedAt

---

### `api.progress.markCompleted`
Mark a lesson as completed.

```typescript
export const markCompleted = mutation({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user with course access
**Side Effects**: Logs activity for analytics

---

### `api.progress.updateTimeSpent`
Update time spent on a lesson (called periodically or on leave).

```typescript
export const updateTimeSpent = mutation({
  args: {
    lessonId: v.id("lessons"),
    additionalSeconds: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Current user only

---

### `api.progress.resetForCourse`
Reset progress for a course (admin function).

```typescript
export const resetForCourse = mutation({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

## Progress Calculation

Course progress is calculated as:
```
percentage = (completedLessons / totalLessons) * 100
```

Each lesson has equal weight regardless of:
- Lesson type (text, embed, quiz, files)
- Estimated duration
- Content length

---

## Status Transitions

```
not_started → in_progress → completed
                   ↑            │
                   └────────────┘ (admin reset)
```

- `not_started`: User has never opened the lesson
- `in_progress`: User has opened but not completed
- `completed`: User has marked as complete (or passed quiz)

---

## Real-Time Updates

All progress queries automatically update in real-time via Convex subscriptions:

```typescript
// Dashboard component
const continueWatching = useQuery(api.progress.getContinueWatching);
// Updates automatically when user completes lessons in another tab
```
