# Mutation Contracts: AI Coach Module (M7)

**Feature**: 011-ai-coach
**Date**: 2026-01-09

## Overview

All mutations require authentication via `requireAuth()`. Mutations enforce business rules including rate limits, conversation limits, and ownership validation.

---

## Conversation Mutations

### startConversation

Starts a new coaching conversation. Closes any existing active conversation.

```typescript
// convex/coach/mutations.ts

export const startConversation = mutation({
  args: {
    type: v.union(
      v.literal("debrief"),
      v.literal("training_plan"),
      v.literal("weekly_checkin"),
      v.literal("ask_coach")
    ),
    sessionId: v.optional(v.id("trainingSessions")),
  },
  returns: v.object({
    conversationId: v.id("coachConversations"),
    closedPreviousConversation: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Validate sessionId for debrief
    if (args.type === "debrief") {
      if (!args.sessionId) {
        throw new Error("sessionId required for debrief conversations");
      }
      const session = await ctx.db.get(args.sessionId);
      if (!session || session.userId !== identity.userId) {
        throw new Error("Session not found or unauthorized");
      }
    }

    // Get user's language preference
    const user = await ctx.db.get(identity.userId);
    const language = user?.preferredLang ?? "en";

    // Close any existing active conversation
    const activeConversation = await ctx.db
      .query("coachConversations")
      .withIndex("by_user_type", (q) => q.eq("userId", identity.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    let closedPrevious = false;
    if (activeConversation) {
      await ctx.db.patch(activeConversation._id, {
        status: "completed",
        updatedAt: Date.now(),
      });
      closedPrevious = true;
    }

    // Create new conversation
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000; // 90 days

    const conversationId = await ctx.db.insert("coachConversations", {
      userId: identity.userId,
      type: args.type,
      sessionId: args.sessionId,
      status: "active",
      messageCount: 0,
      language,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });

    return {
      conversationId,
      closedPreviousConversation: closedPrevious,
    };
  },
});
```

---

### sendMessage

Sends a BDR message to the coach. Triggers AI response via action.

```typescript
export const sendMessage = mutation({
  args: {
    conversationId: v.id("coachConversations"),
    content: v.string(),
  },
  returns: v.object({
    messageId: v.id("coachMessages"),
    limitReached: v.boolean(),
    conversationClosed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Validate ownership
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== identity.userId) {
      throw new Error("Conversation not found");
    }

    if (conversation.status !== "active") {
      throw new Error("Conversation is not active");
    }

    // Validate message length
    if (args.content.length > 2000) {
      throw new Error("Message exceeds 2000 character limit");
    }

    // Check rate limit (30 interactions per day)
    const todayStart = getStartOfDay(Date.now());
    const todayMessages = await countTodayMessages(ctx, identity.userId, todayStart);
    if (todayMessages >= 30) {
      throw new Error("Daily interaction limit reached (30 per day)");
    }

    // Get conversation limit by type
    const limits = {
      debrief: 10,
      weekly_checkin: 5,
      ask_coach: 20,
      training_plan: 1, // Single request
    };
    const limit = limits[conversation.type];

    // Check if limit would be exceeded
    const newMessageCount = conversation.messageCount + 1;
    const limitReached = newMessageCount >= limit;

    // Create BDR message
    const messageId = await ctx.db.insert("coachMessages", {
      conversationId: args.conversationId,
      sender: "bdr",
      content: args.content,
      createdAt: Date.now(),
    });

    // Update conversation
    const updates: Partial<typeof conversation> = {
      messageCount: newMessageCount,
      updatedAt: Date.now(),
    };

    if (limitReached) {
      updates.status = "completed";
    }

    await ctx.db.patch(args.conversationId, updates);

    // Schedule AI response action (handled separately)
    await ctx.scheduler.runAfter(0, internal.coach.actions.generateResponse, {
      conversationId: args.conversationId,
      userMessageId: messageId,
    });

    return {
      messageId,
      limitReached,
      conversationClosed: limitReached,
    };
  },
});
```

---

### endConversation

Manually ends an active conversation.

```typescript
export const endConversation = mutation({
  args: {
    conversationId: v.id("coachConversations"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== identity.userId) {
      throw new Error("Conversation not found");
    }

    if (conversation.status !== "active") {
      throw new Error("Conversation is already closed");
    }

    await ctx.db.patch(args.conversationId, {
      status: "completed",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
```

---

### storeCoachMessage (Internal)

Stores coach's AI-generated response. Called by action after AI response.

```typescript
export const storeCoachMessage = internalMutation({
  args: {
    conversationId: v.id("coachConversations"),
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
  },
  returns: v.id("coachMessages"),
  handler: async (ctx, args) => {
    // Validate conversation exists
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Create coach message
    const messageId = await ctx.db.insert("coachMessages", {
      conversationId: args.conversationId,
      sender: "coach",
      content: args.content,
      transcriptRefs: args.transcriptRefs,
      createdAt: Date.now(),
    });

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});
```

---

## Training Plan Mutations

### generatePlan

Generates a new personalized training plan.

```typescript
export const generatePlan = mutation({
  args: {},
  returns: v.object({
    planId: v.id("trainingPlans"),
    conversationId: v.id("coachConversations"),
  }),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);

    // Check eligibility (5 sessions minimum)
    const sessions = await ctx.db
      .query("trainingSessions")
      .withIndex("by_user", (q) => q.eq("userId", identity.userId))
      .collect();

    if (sessions.length < 5) {
      throw new Error(
        `Insufficient sessions: ${sessions.length}/5 required`
      );
    }

    // Check for existing active plan
    const activePlan = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", identity.userId).eq("status", "active")
      )
      .first();

    if (activePlan) {
      // Abandon current plan
      await ctx.db.patch(activePlan._id, {
        status: "abandoned",
        updatedAt: Date.now(),
      });
    }

    // Check monthly rate limit (5 per month)
    const monthStart = getStartOfMonth(Date.now());
    const monthPlans = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user", (q) => q.eq("userId", identity.userId))
      .filter((q) => q.gte(q.field("createdAt"), monthStart))
      .collect();

    if (monthPlans.length >= 5) {
      throw new Error("Monthly plan generation limit reached (5 per month)");
    }

    // Create placeholder plan (will be populated by action)
    const now = Date.now();
    const planId = await ctx.db.insert("trainingPlans", {
      userId: identity.userId,
      status: "active",
      skillGaps: [],
      weeks: [],
      analyzedSessions: sessions.slice(-10).map((s) => s._id),
      createdAt: now,
      updatedAt: now,
    });

    // Start training plan conversation
    const user = await ctx.db.get(identity.userId);
    const language = user?.preferredLang ?? "en";
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;

    const conversationId = await ctx.db.insert("coachConversations", {
      userId: identity.userId,
      type: "training_plan",
      status: "active",
      messageCount: 0,
      language,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });

    // Schedule AI plan generation
    await ctx.scheduler.runAfter(0, internal.coach.actions.generatePlanContent, {
      planId,
      conversationId,
    });

    return { planId, conversationId };
  },
});
```

---

### updatePlanProgress

Updates training plan progress when a session is completed.

```typescript
export const updatePlanProgress = internalMutation({
  args: {
    userId: v.id("users"),
    sessionId: v.id("trainingSessions"),
    scenarioId: v.string(),
    score: v.number(),
  },
  returns: v.object({
    planUpdated: v.boolean(),
    weekCompleted: v.boolean(),
    planCompleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Find active plan
    const activePlan = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    if (!activePlan) {
      return { planUpdated: false, weekCompleted: false, planCompleted: false };
    }

    // Find matching scenario in weeks
    let weekCompleted = false;
    let planCompleted = false;
    let updated = false;

    const updatedWeeks = activePlan.weeks.map((week) => {
      const updatedScenarios = week.scenarios.map((scenario) => {
        if (
          scenario.scenarioId === args.scenarioId &&
          !scenario.completed &&
          args.score >= scenario.targetScore
        ) {
          updated = true;
          return {
            ...scenario,
            completed: true,
            completedAt: Date.now(),
            actualScore: args.score,
          };
        }
        return scenario;
      });

      // Check if all scenarios in week are completed
      const allCompleted = updatedScenarios.every((s) => s.completed);
      const newStatus = allCompleted
        ? "completed"
        : updatedScenarios.some((s) => s.completed)
        ? "in_progress"
        : week.status;

      if (newStatus === "completed" && week.status !== "completed") {
        weekCompleted = true;
      }

      return {
        ...week,
        scenarios: updatedScenarios,
        status: newStatus,
      };
    });

    // Check if all weeks completed
    planCompleted = updatedWeeks.every((w) => w.status === "completed");

    if (updated) {
      await ctx.db.patch(activePlan._id, {
        weeks: updatedWeeks,
        status: planCompleted ? "completed" : "active",
        updatedAt: Date.now(),
      });
    }

    return { planUpdated: updated, weekCompleted, planCompleted };
  },
});
```

---

### populatePlanContent (Internal)

Populates training plan with AI-generated content.

```typescript
export const populatePlanContent = internalMutation({
  args: {
    planId: v.id("trainingPlans"),
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
          })
        ),
        weeklyGoal: v.string(),
        status: v.literal("pending"),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.planId, {
      skillGaps: args.skillGaps,
      weeks: args.weeks,
      updatedAt: Date.now(),
    });

    return null;
  },
});
```

---

## Weekly Check-In Mutations

### createWeeklyCheckin (Internal)

Creates a weekly check-in record. Called by scheduled function.

```typescript
export const createWeeklyCheckin = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(v.id("weeklyCheckins"), v.null()),
  handler: async (ctx, args) => {
    const weekStart = getWeekStart(Date.now());

    // Check if already exists
    const existing = await ctx.db
      .query("weeklyCheckins")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", args.userId).eq("weekStart", weekStart)
      )
      .first();

    if (existing) {
      return null; // Already created
    }

    // Get sessions from this week
    const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
    const sessions = await ctx.db
      .query("trainingSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.gte(q.field("completedAt"), weekStart),
          q.lt(q.field("completedAt"), weekEnd)
        )
      )
      .collect();

    if (sessions.length === 0) {
      return null; // No check-in if no sessions
    }

    // Get scores for sessions
    const scores = await Promise.all(
      sessions.map((s) =>
        ctx.db
          .query("sessionScores")
          .withIndex("by_session", (q) => q.eq("sessionId", s._id))
          .first()
      )
    );

    const validScores = scores.filter(Boolean).map((s) => s!.overallScore);
    const averageScore =
      validScores.reduce((a, b) => a + b, 0) / validScores.length;

    // Get previous week for comparison
    const prevWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;
    const prevCheckin = await ctx.db
      .query("weeklyCheckins")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", args.userId).eq("weekStart", prevWeekStart)
      )
      .first();

    const previousWeekScore = prevCheckin?.averageScore ?? 0;
    const change = averageScore - previousWeekScore;
    const trend =
      change > 2 ? "up" : change < -2 ? "down" : ("stable" as const);

    // Get active plan progress
    const activePlan = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    let planProgress;
    if (activePlan) {
      const totalGoals = activePlan.weeks.reduce(
        (sum, w) => sum + w.scenarios.length,
        0
      );
      const completedGoals = activePlan.weeks.reduce(
        (sum, w) => sum + w.scenarios.filter((s) => s.completed).length,
        0
      );
      planProgress = {
        planId: activePlan._id,
        goalsCompleted: completedGoals,
        totalGoals,
      };
    }

    return await ctx.db.insert("weeklyCheckins", {
      userId: args.userId,
      weekStart,
      sessionCount: sessions.length,
      averageScore,
      comparison: {
        previousWeek: previousWeekScore,
        change,
        trend,
      },
      planProgress,
      createdAt: Date.now(),
    });
  },
});
```

---

### markCheckinViewed

Marks a weekly check-in as viewed.

```typescript
export const markCheckinViewed = mutation({
  args: {
    checkinId: v.id("weeklyCheckins"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const checkin = await ctx.db.get(args.checkinId);
    if (!checkin || checkin.userId !== identity.userId) {
      throw new Error("Check-in not found");
    }

    if (!checkin.viewedAt) {
      await ctx.db.patch(args.checkinId, {
        viewedAt: Date.now(),
      });
    }

    return { success: true };
  },
});
```

---

### linkCheckinConversation

Links a conversation to a weekly check-in.

```typescript
export const linkCheckinConversation = internalMutation({
  args: {
    checkinId: v.id("weeklyCheckins"),
    conversationId: v.id("coachConversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.checkinId, {
      conversationId: args.conversationId,
    });
    return null;
  },
});
```

---

## Cleanup Mutations (Scheduled)

### cleanupExpiredConversations

Deletes expired conversations and their messages.

```typescript
export const cleanupExpiredConversations = internalMutation({
  args: {},
  returns: v.object({
    deletedConversations: v.number(),
    deletedMessages: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired conversations
    const expired = await ctx.db
      .query("coachConversations")
      .withIndex("by_expiry")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    let deletedMessages = 0;

    for (const conversation of expired) {
      // Delete messages
      const messages = await ctx.db
        .query("coachMessages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id)
        )
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
        deletedMessages++;
      }

      // Delete conversation
      await ctx.db.delete(conversation._id);
    }

    return {
      deletedConversations: expired.length,
      deletedMessages,
    };
  },
});
```
