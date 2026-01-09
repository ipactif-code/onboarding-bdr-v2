# Scheduled Function Contracts: AI Coach Module (M7)

**Feature**: 011-ai-coach
**Date**: 2026-01-09

## Overview

Scheduled functions handle automated tasks including weekly check-in generation, conversation cleanup, and data retention enforcement.

---

## Weekly Check-In Scheduler

### triggerWeeklyCheckins

Runs hourly to trigger Monday check-ins for eligible users.

```typescript
// convex/coach/scheduled.ts

export const triggerWeeklyCheckins = internalMutation({
  args: {},
  returns: v.object({
    checkinsCreated: v.number(),
    usersProcessed: v.number(),
  }),
  handler: async (ctx) => {
    // Only run on Mondays between 8-10 AM UTC
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday
    const hour = now.getUTCHours();

    if (dayOfWeek !== 1 || hour < 8 || hour > 10) {
      return { checkinsCreated: 0, usersProcessed: 0 };
    }

    const weekStart = getWeekStart(Date.now());

    // Get all users who had sessions last week
    const lastWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;
    const lastWeekEnd = weekStart;

    const sessionsLastWeek = await ctx.db
      .query("trainingSessions")
      .filter((q) =>
        q.and(
          q.gte(q.field("completedAt"), lastWeekStart),
          q.lt(q.field("completedAt"), lastWeekEnd)
        )
      )
      .collect();

    // Get unique user IDs
    const userIds = [...new Set(sessionsLastWeek.map((s) => s.userId))];

    let checkinsCreated = 0;

    for (const userId of userIds) {
      // Check if check-in already exists for this week
      const existing = await ctx.db
        .query("weeklyCheckins")
        .withIndex("by_user_week", (q) =>
          q.eq("userId", userId).eq("weekStart", weekStart)
        )
        .first();

      if (!existing) {
        // Create check-in
        const checkinId = await ctx.runMutation(
          internal.coach.mutations.createWeeklyCheckin,
          { userId }
        );

        if (checkinId) {
          checkinsCreated++;

          // Schedule notification (after 1 minute to batch)
          await ctx.scheduler.runAfter(
            60 * 1000,
            internal.notifications.sendCoachCheckinNotification,
            { userId, checkinId }
          );
        }
      }
    }

    return {
      checkinsCreated,
      usersProcessed: userIds.length,
    };
  },
});

// Schedule: runs every hour
// Cron expression: "0 * * * *"
```

---

## Conversation Cleanup Scheduler

### cleanupExpiredConversations

Runs daily to delete conversations past their 90-day retention.

```typescript
export const cleanupExpiredConversations = internalMutation({
  args: {},
  returns: v.object({
    conversationsDeleted: v.number(),
    messagesDeleted: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired conversations (expiresAt < now)
    const expired = await ctx.db
      .query("coachConversations")
      .withIndex("by_expiry")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(100); // Process in batches

    let messagesDeleted = 0;

    for (const conversation of expired) {
      // Delete all messages in conversation
      const messages = await ctx.db
        .query("coachMessages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id)
        )
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
        messagesDeleted++;
      }

      // Delete conversation
      await ctx.db.delete(conversation._id);
    }

    // If there were 100 expired, schedule another run
    if (expired.length === 100) {
      await ctx.scheduler.runAfter(
        1000,
        internal.coach.scheduled.cleanupExpiredConversations,
        {}
      );
    }

    return {
      conversationsDeleted: expired.length,
      messagesDeleted,
    };
  },
});

// Schedule: runs daily at 3 AM UTC
// Cron expression: "0 3 * * *"
```

---

### sendExpirationWarnings

Sends warnings 7 days before conversation deletion.

```typescript
export const sendExpirationWarnings = internalMutation({
  args: {},
  returns: v.object({
    warningsSent: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
    const eightDaysFromNow = now + 8 * 24 * 60 * 60 * 1000;

    // Find conversations expiring in 7-8 days that haven't been warned
    const expiringConversations = await ctx.db
      .query("coachConversations")
      .withIndex("by_expiry")
      .filter((q) =>
        q.and(
          q.gte(q.field("expiresAt"), sevenDaysFromNow),
          q.lt(q.field("expiresAt"), eightDaysFromNow)
        )
      )
      .collect();

    // Filter to those with unviewed messages (user hasn't engaged recently)
    const toWarn = [];
    for (const conv of expiringConversations) {
      const lastMessage = await ctx.db
        .query("coachMessages")
        .withIndex("by_conversation_time", (q) =>
          q.eq("conversationId", conv._id)
        )
        .order("desc")
        .first();

      // Warn if last activity > 30 days ago
      if (lastMessage && conv.updatedAt < now - 30 * 24 * 60 * 60 * 1000) {
        toWarn.push(conv);
      }
    }

    // Send notifications
    for (const conv of toWarn) {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.sendConversationExpiryWarning,
        {
          userId: conv.userId,
          conversationId: conv._id,
          expiresAt: conv.expiresAt,
        }
      );
    }

    return { warningsSent: toWarn.length };
  },
});

// Schedule: runs daily at 9 AM UTC
// Cron expression: "0 9 * * *"
```

---

## Training Plan Progress Tracker

### updatePlanProgressOnSessionComplete

Triggered when a training session completes to update plan progress.

```typescript
export const updatePlanProgressOnSessionComplete = internalMutation({
  args: {
    sessionId: v.id("trainingSessions"),
  },
  returns: v.object({
    planUpdated: v.boolean(),
    achievements: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return { planUpdated: false, achievements: [] };
    }

    // Get session score
    const score = await ctx.db
      .query("sessionScores")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!score) {
      return { planUpdated: false, achievements: [] };
    }

    // Update plan progress
    const result = await ctx.runMutation(
      internal.coach.mutations.updatePlanProgress,
      {
        userId: session.userId,
        sessionId: args.sessionId,
        scenarioId: session.scenario,
        score: score.overallScore,
      }
    );

    const achievements: string[] = [];

    if (result.weekCompleted) {
      achievements.push("week_completed");
      // Trigger congratulations notification
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.sendPlanWeekComplete,
        { userId: session.userId }
      );
    }

    if (result.planCompleted) {
      achievements.push("plan_completed");
      // Trigger plan completion celebration
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.sendPlanComplete,
        { userId: session.userId }
      );
    }

    return { planUpdated: result.planUpdated, achievements };
  },
});
```

---

## Cron Job Configuration

```typescript
// convex/crons.ts

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Weekly check-ins: Every hour (filtered to Monday 8-10 AM in handler)
crons.hourly(
  "trigger-weekly-checkins",
  { hourUTC: 8, minuteUTC: 0 },
  internal.coach.scheduled.triggerWeeklyCheckins
);

// Conversation cleanup: Daily at 3 AM UTC
crons.daily(
  "cleanup-expired-conversations",
  { hourUTC: 3, minuteUTC: 0 },
  internal.coach.scheduled.cleanupExpiredConversations
);

// Expiration warnings: Daily at 9 AM UTC
crons.daily(
  "send-expiration-warnings",
  { hourUTC: 9, minuteUTC: 0 },
  internal.coach.scheduled.sendExpirationWarnings
);

export default crons;
```

---

## Helper Functions

### getWeekStart

Returns Monday 00:00:00 UTC for the given timestamp.

```typescript
function getWeekStart(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}
```

### getStartOfDay

Returns 00:00:00 UTC for the given timestamp.

```typescript
function getStartOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}
```

### getStartOfMonth

Returns first day of month 00:00:00 UTC.

```typescript
function getStartOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}
```
