# Mutation Patterns

## Table of Contents

1. [Basic Mutation Structure](#basic-mutation-structure)
2. [CRUD Operations](#crud-operations)
3. [Batch Operations](#batch-operations)
4. [Transactions](#transactions)
5. [Optimistic Updates](#optimistic-updates)

## Basic Mutation Structure

### Standard Mutation

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const create = mutation({
  args: { title: v.string() },
  returns: v.id("courses"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    return await ctx.db.insert("courses", {
      title: args.title,
      creatorId: user._id,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
```

### Admin-Only Mutation

```typescript
import { requireAdmin } from "./lib/auth";

export const publish = mutation({
  args: { id: v.id("courses") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return null;
  },
});
```

### Internal Mutation

```typescript
import { internalMutation } from "./_generated/server";

export const updateLastLogin = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // No auth check - called from other server functions
    await ctx.db.patch(args.userId, {
      lastLoginAt: Date.now(),
    });
    return null;
  },
});
```

## CRUD Operations

### Create

```typescript
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("courses"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    return await ctx.db.insert("courses", {
      title: args.title,
      description: args.description,
      creatorId: user._id,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
```

### Update (Patch)

```typescript
export const update = mutation({
  args: {
    id: v.id("courses"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    const course = await ctx.db.get(args.id);
    if (!course) throw new Error("Course not found");
    if (course.creatorId !== user._id) throw new Error("Unauthorized");
    
    const { id, ...updates } = args;
    
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    await ctx.db.patch(id, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    });
    
    return null;
  },
});
```

### Replace (Full Update)

```typescript
export const replace = mutation({
  args: {
    id: v.id("courses"),
    title: v.string(),
    description: v.string(),
    status: v.union(v.literal("draft"), v.literal("published")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    const course = await ctx.db.get(args.id);
    if (!course) throw new Error("Course not found");
    if (course.creatorId !== user._id) throw new Error("Unauthorized");
    
    await ctx.db.replace(args.id, {
      title: args.title,
      description: args.description,
      status: args.status,
      creatorId: course.creatorId,  // Preserve
      createdAt: course.createdAt,   // Preserve
      updatedAt: Date.now(),
    });
    
    return null;
  },
});
```

### Delete

```typescript
export const remove = mutation({
  args: { id: v.id("courses") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    const course = await ctx.db.get(args.id);
    if (!course) throw new Error("Course not found");
    if (course.creatorId !== user._id) throw new Error("Unauthorized");
    
    await ctx.db.delete(args.id);
    return null;
  },
});
```

### Soft Delete

```typescript
export const archive = mutation({
  args: { id: v.id("courses") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    const course = await ctx.db.get(args.id);
    if (!course) throw new Error("Course not found");
    if (course.creatorId !== user._id) throw new Error("Unauthorized");
    
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return null;
  },
});
```

## Batch Operations

### Batch Insert

```typescript
export const createMany = mutation({
  args: {
    items: v.array(v.object({ title: v.string() })),
  },
  returns: v.array(v.id("courses")),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();
    
    const ids = await Promise.all(
      args.items.map((item) =>
        ctx.db.insert("courses", {
          title: item.title,
          creatorId: user._id,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        })
      )
    );
    
    return ids;
  },
});
```

### Batch Update

```typescript
export const updateMany = mutation({
  args: {
    ids: v.array(v.id("courses")),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    
    await Promise.all(
      args.ids.map((id) =>
        ctx.db.patch(id, {
          status: args.status,
          updatedAt: now,
        })
      )
    );
    
    return null;
  },
});
```

### Batch Delete

```typescript
export const deleteMany = mutation({
  args: { ids: v.array(v.id("courses")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    await Promise.all(args.ids.map((id) => ctx.db.delete(id)));
    return null;
  },
});
```

## Transactions

Convex mutations are automatically transactional. All operations either succeed together or fail together.

### Multi-Table Transaction

```typescript
export const enrollInCourse = mutation({
  args: { courseId: v.id("courses") },
  returns: v.id("courseEnrollments"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    // Check course exists
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");
    if (course.status !== "published") throw new Error("Course not available");
    
    // Check not already enrolled
    const existing = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId)
      )
      .first();
    
    if (existing) throw new Error("Already enrolled");
    
    // Create enrollment
    const enrollmentId = await ctx.db.insert("courseEnrollments", {
      userId: user._id,
      courseId: args.courseId,
      progress: 0,
      enrolledAt: Date.now(),
    });
    
    // Update course enrollment count
    await ctx.db.patch(args.courseId, {
      enrollmentCount: (course.enrollmentCount ?? 0) + 1,
    });
    
    return enrollmentId;
  },
});
```

### Validation Before Write

```typescript
export const transfer = mutation({
  args: {
    fromId: v.id("accounts"),
    toId: v.id("accounts"),
    amount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    
    const from = await ctx.db.get(args.fromId);
    const to = await ctx.db.get(args.toId);
    
    if (!from || !to) throw new Error("Account not found");
    if (from.balance < args.amount) throw new Error("Insufficient balance");
    
    // Both updates are atomic
    await ctx.db.patch(args.fromId, { balance: from.balance - args.amount });
    await ctx.db.patch(args.toId, { balance: to.balance + args.amount });
    
    return null;
  },
});
```

## Optimistic Updates

Handled on the client side with `useMutation`:

```typescript
// Client-side (React component)
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function CourseCard({ course }) {
  const updateCourse = useMutation(api.courses.update);
  
  const handleTitleChange = async (newTitle: string) => {
    // Optimistic: UI updates immediately
    await updateCourse({
      id: course._id,
      title: newTitle,
    });
    // If mutation fails, Convex automatically reverts
  };
}
```
