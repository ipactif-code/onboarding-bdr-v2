# Convex Function Contracts: Analytics

**Module**: `convex/analytics.ts`
**Date**: 2025-12-06

## Overview

Analytics and activity logging for the admin dashboard.
Provides user activity, quiz performance, course metrics, and activity logs.

---

## Queries

### `api.analytics.getOverview`
Get dashboard overview stats.

```typescript
export const getOverview = query({
  args: {
    teamId: v.optional(v.id("teams")),
  },
  returns: v.object({
    totalUsers: v.number(),
    activeUsersToday: v.number(),
    totalCourses: v.number(),
    publishedCourses: v.number(),
    completionsToday: v.number(),
    averageProgress: v.number(),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.analytics.getUserActivity`
Get user activity metrics.

```typescript
export const getUserActivity = query({
  args: {
    teamId: v.optional(v.id("teams")),
    limit: v.optional(v.number()), // default: 50
  },
  returns: v.array(v.object({
    user: v.object({
      _id: v.id("users"),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      email: v.string(),
    }),
    status: v.union(v.literal("online"), v.literal("offline"), v.literal("away")),
    currentSessionDuration: v.optional(v.number()), // seconds
    lastActivityAt: v.optional(v.number()),
    overallProgress: v.number(), // percentage
    coursesCompleted: v.number(),
    actionsToday: v.number(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Ordering**: By status (online first), then lastActivityAt descending

---

### `api.analytics.getQuizMetrics`
Get quiz performance metrics.

```typescript
export const getQuizMetrics = query({
  args: {
    teamId: v.optional(v.id("teams")),
    courseId: v.optional(v.id("courses")),
  },
  returns: v.object({
    totalAttempts: v.number(),
    totalPasses: v.number(),
    averageScore: v.number(),
    passRate: v.number(),
    quizzes: v.array(v.object({
      lessonId: v.id("lessons"),
      lessonTitle: v.string(),
      courseTitle: v.string(),
      attempts: v.number(),
      averageScore: v.number(),
      passRate: v.number(),
    })),
    scoreDistribution: v.array(v.object({
      range: v.string(), // "0-10", "11-20", etc.
      count: v.number(),
    })),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.analytics.getCourseMetrics`
Get course popularity and completion metrics.

```typescript
export const getCourseMetrics = query({
  args: {
    teamId: v.optional(v.id("teams")),
  },
  returns: v.object({
    courses: v.array(v.object({
      _id: v.id("courses"),
      title: v.string(),
      viewCount: v.number(),
      enrolledUsers: v.number(),
      completedUsers: v.number(),
      inProgressUsers: v.number(),
      notStartedUsers: v.number(),
      completionRate: v.number(),
      averageTimeSpent: v.number(), // minutes
    })),
    progressBreakdown: v.object({
      notStarted: v.number(),
      inProgress: v.number(),
      completed: v.number(),
    }),
    mostPopular: v.array(v.object({
      _id: v.id("courses"),
      title: v.string(),
      viewCount: v.number(),
    })),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.analytics.getActivityLog`
Get filterable activity log.

```typescript
export const getActivityLog = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    teamId: v.optional(v.id("teams")),
    actionType: v.optional(v.union(
      v.literal("login"),
      v.literal("logout"),
      v.literal("lesson_view"),
      v.literal("lesson_complete"),
      v.literal("quiz_start"),
      v.literal("quiz_submit"),
      v.literal("comment_post"),
      v.literal("message_send"),
      v.literal("course_enroll")
    )),
    category: v.optional(v.union(
      v.literal("user"),
      v.literal("course"),
      v.literal("quiz"),
      v.literal("message"),
      v.literal("system")
    )),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()), // default: 50
  },
  returns: v.object({
    data: v.array(v.object({
      _id: v.id("activityLogs"),
      user: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      actionType: v.string(),
      category: v.string(),
      entityType: v.optional(v.string()),
      entityId: v.optional(v.string()),
      entityName: v.optional(v.string()),
      metadata: v.optional(v.any()),
      timestamp: v.number(),
    })),
    meta: v.object({
      page: v.number(),
      pageSize: v.number(),
      totalItems: v.number(),
      totalPages: v.number(),
    }),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.analytics.getSessionStats`
Get session duration statistics.

```typescript
export const getSessionStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.object({
    totalSessions: v.number(),
    averageSessionDuration: v.number(), // minutes
    totalTimeSpent: v.number(), // minutes
    sessionsPerDay: v.array(v.object({
      date: v.string(), // "2025-12-06"
      count: v.number(),
      averageDuration: v.number(),
    })),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

## Mutations

### `api.analytics.logActivity`
Log a user activity (internal use).

```typescript
export const logActivity = internalMutation({
  args: {
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
  },
  returns: v.id("activityLogs"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Internal only (called from other mutations)

---

### `api.analytics.startSession`
Start a new user session.

```typescript
export const startSession = mutation({
  args: {},
  returns: v.id("sessions"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user
**Side Effects**: Updates user status to "online"

---

### `api.analytics.endSession`
End the current user session.

```typescript
export const endSession = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Session owner only
**Side Effects**: Updates user status to "offline"

---

### `api.analytics.heartbeat`
Keep session alive and update user status.

```typescript
export const heartbeat = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Session owner only
**Behavior**: Called periodically (every 30 seconds) to maintain "online" status

---

## Activity Types

| Type | Category | Description |
|------|----------|-------------|
| login | user | User logged in |
| logout | user | User logged out |
| lesson_view | course | User opened a lesson |
| lesson_complete | course | User completed a lesson |
| quiz_start | quiz | User started a quiz |
| quiz_submit | quiz | User submitted quiz answers |
| comment_post | course | User posted a comment |
| message_send | message | User sent a message |
| course_enroll | course | User was assigned to a course |

---

## Session Management

```typescript
// On app load
const sessionId = await startSession();

// Every 30 seconds
setInterval(() => heartbeat({ sessionId }), 30000);

// On page unload
window.addEventListener("beforeunload", () => {
  navigator.sendBeacon("/api/end-session", { sessionId });
});
```

User status transitions:
- `online`: Active session with recent heartbeat (<1 min)
- `away`: Active session but no heartbeat (1-5 min)
- `offline`: No active session or heartbeat >5 min

---

## Real-Time Dashboard

Analytics queries update in real-time:

```typescript
const overview = useQuery(api.analytics.getOverview);
// Updates when users log in, complete courses, etc.

const userActivity = useQuery(api.analytics.getUserActivity);
// Updates when user status changes
```
