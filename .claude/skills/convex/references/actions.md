# Action Patterns

## Table of Contents

1. [When to Use Actions](#when-to-use-actions)
2. [Basic Action Structure](#basic-action-structure)
3. [External API Calls](#external-api-calls)
4. [Scheduling](#scheduling)
5. [Action + Mutation Pattern](#action--mutation-pattern)

## When to Use Actions

Actions are for **side effects** that cannot run in queries/mutations:

- External API calls (HTTP requests, third-party services)
- File system operations
- Sending emails/notifications
- Long-running computations
- Anything non-deterministic

**Key limitations:**
- Actions CANNOT read/write to the database directly
- Use `ctx.runMutation()` / `ctx.runQuery()` to interact with data

## Basic Action Structure

### Standard Action

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const sendWelcomeEmail = action({
  args: { userId: v.id("users") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    
    // Get user data via query
    const user = await ctx.runQuery(internal.users.getById, { id: args.userId });
    if (!user) throw new Error("User not found");
    
    // External API call
    const response = await fetch("https://api.email.service/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: user.email,
        template: "welcome",
      }),
    });
    
    return { success: response.ok };
  },
});
```

### Internal Action

```typescript
import { internalAction } from "./_generated/server";

export const processWebhook = internalAction({
  args: { payload: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // No auth check - internal only
    // Process webhook payload...
    return null;
  },
});
```

## External API Calls

### Simple HTTP Request

```typescript
export const fetchExternalData = action({
  args: { url: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    
    const response = await fetch(args.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    return await response.json();
  },
});
```

### With Error Handling

```typescript
export const callThirdPartyAPI = action({
  args: { data: v.object({ key: v.string() }) },
  returns: v.union(
    v.object({ success: v.literal(true), data: v.any() }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    
    try {
      const response = await fetch("https://api.example.com/endpoint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        body: JSON.stringify(args.data),
      });
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});
```

### With Retry Logic

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status >= 500) throw new Error(`Server error: ${response.status}`);
      return response; // Client error, don't retry
    } catch (error) {
      lastError = error as Error;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i))); // Exponential backoff
    }
  }
  
  throw lastError;
}
```

## Scheduling

### Schedule from Mutation

```typescript
// In mutations file
import { internal } from "./_generated/api";

export const createOrder = mutation({
  args: { items: v.array(v.string()) },
  returns: v.id("orders"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    const orderId = await ctx.db.insert("orders", {
      items: args.items,
      userId: user._id,
      status: "pending",
      createdAt: Date.now(),
    });
    
    // Schedule action to run immediately
    await ctx.scheduler.runAfter(0, internal.orders.processPayment, { orderId });
    
    return orderId;
  },
});
```

### Delayed Execution

```typescript
export const scheduleReminder = mutation({
  args: { 
    userId: v.id("users"), 
    message: v.string(),
    delayMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    
    // Schedule to run after delay
    await ctx.scheduler.runAfter(
      args.delayMs,
      internal.notifications.sendReminder,
      { userId: args.userId, message: args.message }
    );
    
    return null;
  },
});
```

### Scheduled at Specific Time

```typescript
export const scheduleMeeting = mutation({
  args: { 
    meetingId: v.id("meetings"), 
    startTime: v.number(), // timestamp in ms
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    
    const now = Date.now();
    const delayMs = args.startTime - now - 15 * 60 * 1000; // 15 min before
    
    if (delayMs > 0) {
      await ctx.scheduler.runAfter(
        delayMs,
        internal.notifications.sendMeetingReminder,
        { meetingId: args.meetingId }
      );
    }
    
    return null;
  },
});
```

### Cron Jobs

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every day at midnight UTC
crons.daily(
  "daily-cleanup",
  { hourUTC: 0, minuteUTC: 0 },
  internal.maintenance.cleanupOldData
);

// Run every hour
crons.interval(
  "hourly-sync",
  { hours: 1 },
  internal.sync.syncExternalData
);

// Cron expression (every Monday at 9am UTC)
crons.cron(
  "weekly-report",
  "0 9 * * 1",
  internal.reports.generateWeeklyReport
);

export default crons;
```

## Action + Mutation Pattern

Actions cannot directly access the database. Use this pattern:

```typescript
// Internal mutation for DB operations
export const markEmailSent = internalMutation({
  args: { userId: v.id("users"), emailType: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLogs", {
      userId: args.userId,
      emailType: args.emailType,
      sentAt: Date.now(),
    });
    return null;
  },
});

// Internal query for reading data
export const getUserEmail = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.email ?? null;
  },
});

// Action orchestrates everything
export const sendEmail = internalAction({
  args: { userId: v.id("users"), emailType: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // 1. Read from DB via query
    const email = await ctx.runQuery(internal.users.getUserEmail, {
      userId: args.userId,
    });
    
    if (!email) return { success: false };
    
    // 2. External API call
    const response = await fetch("https://api.email.service/send", {
      method: "POST",
      body: JSON.stringify({ to: email, template: args.emailType }),
    });
    
    // 3. Write to DB via mutation
    if (response.ok) {
      await ctx.runMutation(internal.users.markEmailSent, {
        userId: args.userId,
        emailType: args.emailType,
      });
    }
    
    return { success: response.ok };
  },
});
```
