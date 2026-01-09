# Query Contracts: AI Coach Module (M7)

**Feature**: 011-ai-coach
**Date**: 2026-01-09

## Overview

All queries require authentication via `requireAuth()`. BDRs can only access their own data.

---

## Conversation Queries

### getActiveConversation

Returns the current active coaching conversation for the authenticated user.

```typescript
// convex/coach/queries.ts

export const getActiveConversation = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("coachConversations"),
      type: v.union(
        v.literal("debrief"),
        v.literal("training_plan"),
        v.literal("weekly_checkin"),
        v.literal("ask_coach")
      ),
      sessionId: v.optional(v.id("trainingSessions")),
      status: v.literal("active"),
      messageCount: v.number(),
      language: v.string(),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);

    return await ctx.db
      .query("coachConversations")
      .withIndex("by_user_type", (q) => q.eq("userId", identity.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});
```

---

### getConversationMessages

Returns paginated messages for a conversation.

```typescript
export const getConversationMessages = query({
  args: {
    conversationId: v.id("coachConversations"),
    limit: v.optional(v.number()), // Default: 20
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    messages: v.array(
      v.object({
        _id: v.id("coachMessages"),
        sender: v.union(v.literal("coach"), v.literal("bdr")),
        content: v.string(),
        transcriptRefs: v.optional(
          v.array(
            v.object({
              start: v.number(),
              end: v.number(),
              text: v.string(),
            })
          )
        ),
        createdAt: v.number(),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Verify ownership
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== identity.userId) {
      throw new Error("Conversation not found");
    }

    const limit = args.limit ?? 20;
    // Implementation: paginate by createdAt desc
  },
});
```

---

### getConversationHistory

Returns past conversations for the authenticated user.

```typescript
export const getConversationHistory = query({
  args: {
    type: v.optional(
      v.union(
        v.literal("debrief"),
        v.literal("training_plan"),
        v.literal("weekly_checkin"),
        v.literal("ask_coach")
      )
    ),
    limit: v.optional(v.number()), // Default: 10
  },
  returns: v.array(
    v.object({
      _id: v.id("coachConversations"),
      type: v.string(),
      sessionId: v.optional(v.id("trainingSessions")),
      status: v.string(),
      messageCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
      // Include session info for debriefs
      sessionInfo: v.optional(
        v.object({
          scenario: v.string(),
          persona: v.string(),
          score: v.optional(v.number()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    let query = ctx.db
      .query("coachConversations")
      .withIndex("by_user", (q) => q.eq("userId", identity.userId));

    if (args.type) {
      query = ctx.db
        .query("coachConversations")
        .withIndex("by_user_type", (q) =>
          q.eq("userId", identity.userId).eq("type", args.type)
        );
    }

    // Order by updatedAt desc, take limit
  },
});
```

---

## Training Plan Queries

### getActivePlan

Returns the current active training plan.

```typescript
export const getActivePlan = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("trainingPlans"),
      status: v.literal("active"),
      skillGaps: v.array(
        v.object({
          dimension: v.string(),
          score: v.number(),
          priority: v.number(),
        })
      ),
      weeks: v.array(
        v.object({
          weekNumber: v.number(),
          focus: v.string(),
          targetDimension: v.string(),
          scenarios: v.array(
            v.object({
              scenarioId: v.string(),
              personaId: v.string(),
              targetScore: v.number(),
              completed: v.boolean(),
              completedAt: v.optional(v.number()),
              actualScore: v.optional(v.number()),
            })
          ),
          weeklyGoal: v.string(),
          status: v.union(
            v.literal("pending"),
            v.literal("in_progress"),
            v.literal("completed")
          ),
        })
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);

    return await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", identity.userId).eq("status", "active")
      )
      .first();
  },
});
```

---

### getPlanHistory

Returns past training plans.

```typescript
export const getPlanHistory = query({
  args: {
    limit: v.optional(v.number()), // Default: 5
  },
  returns: v.array(
    v.object({
      _id: v.id("trainingPlans"),
      status: v.string(),
      skillGaps: v.array(
        v.object({
          dimension: v.string(),
          score: v.number(),
          priority: v.number(),
        })
      ),
      completionRate: v.number(), // Calculated: completed scenarios / total
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    return await ctx.db
      .query("trainingPlans")
      .withIndex("by_user", (q) => q.eq("userId", identity.userId))
      .order("desc")
      .take(args.limit ?? 5);
  },
});
```

---

### canGeneratePlan

Checks if user is eligible to generate a training plan.

```typescript
export const canGeneratePlan = query({
  args: {},
  returns: v.object({
    eligible: v.boolean(),
    sessionCount: v.number(),
    requiredSessions: v.number(), // 5
    hasActivePlan: v.boolean(),
    remainingGenerations: v.number(), // 5 per month rate limit
  }),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);

    // Count completed sessions
    const sessions = await ctx.db
      .query("trainingSessions")
      .withIndex("by_user", (q) => q.eq("userId", identity.userId))
      .collect();

    // Check for active plan
    const activePlan = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", identity.userId).eq("status", "active")
      )
      .first();

    // Check monthly rate limit (5 per month)
    // Implementation: count plans created this month

    return {
      eligible: sessions.length >= 5 && !activePlan,
      sessionCount: sessions.length,
      requiredSessions: 5,
      hasActivePlan: !!activePlan,
      remainingGenerations: /* calculated */,
    };
  },
});
```

---

## Weekly Check-In Queries

### getCurrentWeekCheckin

Returns the check-in for the current week.

```typescript
export const getCurrentWeekCheckin = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("weeklyCheckins"),
      weekStart: v.number(),
      sessionCount: v.number(),
      averageScore: v.number(),
      comparison: v.object({
        previousWeek: v.number(),
        change: v.number(),
        trend: v.union(
          v.literal("up"),
          v.literal("down"),
          v.literal("stable")
        ),
      }),
      planProgress: v.optional(
        v.object({
          planId: v.id("trainingPlans"),
          goalsCompleted: v.number(),
          totalGoals: v.number(),
        })
      ),
      conversationId: v.optional(v.id("coachConversations")),
      viewed: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);

    const weekStart = getWeekStart(Date.now()); // Monday 00:00:00

    const checkin = await ctx.db
      .query("weeklyCheckins")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", identity.userId).eq("weekStart", weekStart)
      )
      .first();

    return checkin ? { ...checkin, viewed: !!checkin.viewedAt } : null;
  },
});
```

---

### getCheckinHistory

Returns past weekly check-ins.

```typescript
export const getCheckinHistory = query({
  args: {
    limit: v.optional(v.number()), // Default: 12 (3 months)
  },
  returns: v.array(
    v.object({
      _id: v.id("weeklyCheckins"),
      weekStart: v.number(),
      sessionCount: v.number(),
      averageScore: v.number(),
      comparison: v.object({
        previousWeek: v.number(),
        change: v.number(),
        trend: v.string(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    return await ctx.db
      .query("weeklyCheckins")
      .withIndex("by_user", (q) => q.eq("userId", identity.userId))
      .order("desc")
      .take(args.limit ?? 12);
  },
});
```

---

## Context Queries (For Coach AI)

### getCoachingContext

Returns aggregated context for the AI coach. Used internally by actions.

```typescript
export const getCoachingContext = internalQuery({
  args: {
    userId: v.id("users"),
    conversationType: v.union(
      v.literal("debrief"),
      v.literal("training_plan"),
      v.literal("weekly_checkin"),
      v.literal("ask_coach")
    ),
    sessionId: v.optional(v.id("trainingSessions")),
  },
  returns: v.object({
    bdrName: v.string(),
    language: v.string(),
    certificationLevel: v.string(),
    recentSessions: v.array(
      v.object({
        _id: v.id("trainingSessions"),
        scenario: v.string(),
        persona: v.string(),
        overallScore: v.number(),
        spinScore: v.number(),
        raccScore: v.number(),
        completedAt: v.number(),
      })
    ),
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    averageScore: v.number(),
    // For debrief only
    sessionDetails: v.optional(
      v.object({
        transcript: v.string(),
        keyMoments: v.array(
          v.object({
            type: v.string(),
            text: v.string(),
            analysis: v.string(),
          })
        ),
        score: v.number(),
        feedback: v.object({
          strengths: v.array(v.string()),
          improvements: v.array(v.string()),
        }),
      })
    ),
    // For weekly checkin
    weeklyStats: v.optional(
      v.object({
        sessionCount: v.number(),
        averageScore: v.number(),
        previousWeekScore: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    // Aggregate data from:
    // - users table (name, language)
    // - bdrCertifications (current level)
    // - trainingSessions (last 10)
    // - sessionScores (for each session)
    // - scoreFeedback (strengths/weaknesses)
    // - keyMoments (for debrief)
  },
});
```

---

## Rate Limit Queries

### getCoachRateLimits

Returns current rate limit status for the user.

```typescript
export const getCoachRateLimits = query({
  args: {},
  returns: v.object({
    dailyInteractions: v.object({
      used: v.number(),
      limit: v.number(), // 30
      resetsAt: v.number(),
    }),
    monthlyPlanGenerations: v.object({
      used: v.number(),
      limit: v.number(), // 5
      resetsAt: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);

    // Count today's coach messages
    const todayStart = getStartOfDay(Date.now());
    const todayMessages = await ctx.db
      .query("coachMessages")
      .withIndex("by_conversation")
      .filter((q) =>
        q.and(
          q.eq(q.field("sender"), "bdr"),
          q.gte(q.field("createdAt"), todayStart)
        )
      )
      // Join with conversations to filter by userId
      .collect();

    // Count this month's plan generations
    const monthStart = getStartOfMonth(Date.now());
    const monthPlans = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user", (q) => q.eq("userId", identity.userId))
      .filter((q) => q.gte(q.field("createdAt"), monthStart))
      .collect();

    return {
      dailyInteractions: {
        used: todayMessages.length,
        limit: 30,
        resetsAt: todayStart + 24 * 60 * 60 * 1000,
      },
      monthlyPlanGenerations: {
        used: monthPlans.length,
        limit: 5,
        resetsAt: getStartOfNextMonth(Date.now()),
      },
    };
  },
});
```
