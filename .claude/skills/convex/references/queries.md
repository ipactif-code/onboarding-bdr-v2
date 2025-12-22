# Query Patterns

## Table of Contents

1. [Basic Query Structure](#basic-query-structure)
2. [Filtering with Indexes](#filtering-with-indexes)
3. [Pagination](#pagination)
4. [Aggregations](#aggregations)
5. [Joins and Relations](#joins-and-relations)
6. [Search](#search)

## Basic Query Structure

### Standard Query

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const list = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("courses"),
    title: v.string(),
    status: v.string(),
  })),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.query("courses").collect();
  },
});
```

### Query with Arguments

```typescript
export const getById = query({
  args: { id: v.id("courses") },
  returns: v.union(
    v.object({ _id: v.id("courses"), title: v.string() }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.get(args.id);
  },
});
```

### Internal Query (No Auth)

```typescript
import { internalQuery } from "./_generated/server";

export const getByIdInternal = internalQuery({
  args: { id: v.id("courses") },
  returns: v.union(v.object({ _id: v.id("courses"), title: v.string() }), v.null()),
  handler: async (ctx, args) => {
    // No auth check - internal only
    return await ctx.db.get(args.id);
  },
});
```

## Filtering with Indexes

### Single Field Filter

```typescript
export const getByStatus = query({
  args: { status: v.string() },
  returns: v.array(v.object({ _id: v.id("courses"), title: v.string() })),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("courses")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});
```

### Composite Index Filter

```typescript
export const getByCreatorAndStatus = query({
  args: { 
    creatorId: v.id("users"), 
    status: v.optional(v.string()) 
  },
  returns: v.array(v.object({ _id: v.id("courses"), title: v.string() })),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    
    let q = ctx.db
      .query("courses")
      .withIndex("by_creator_status", (q) => q.eq("creatorId", args.creatorId));
    
    if (args.status) {
      q = ctx.db
        .query("courses")
        .withIndex("by_creator_status", (q) => 
          q.eq("creatorId", args.creatorId).eq("status", args.status)
        );
    }
    
    return await q.collect();
  },
});
```

### Range Query

```typescript
export const getRecent = query({
  args: { 
    since: v.number(),  // timestamp in ms
  },
  returns: v.array(v.object({ _id: v.id("courses"), title: v.string() })),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("courses")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", args.since))
      .order("desc")
      .collect();
  },
});
```

## Pagination

### Cursor-Based Pagination

```typescript
import { paginationOptsValidator } from "convex/server";

export const listPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(v.object({ _id: v.id("courses"), title: v.string() })),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("courses")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

### Manual Limit

```typescript
export const getTop10 = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("courses"), title: v.string() })),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("courses")
      .withIndex("by_createdAt")
      .order("desc")
      .take(10);
  },
});
```

## Aggregations

### Count

```typescript
export const countByStatus = query({
  args: { status: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const items = await ctx.db
      .query("courses")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
    return items.length;
  },
});
```

### Sum/Average (Manual)

```typescript
export const getAverageProgress = query({
  args: { courseId: v.id("courses") },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const enrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    
    if (enrollments.length === 0) return 0;
    
    const total = enrollments.reduce((sum, e) => sum + e.progress, 0);
    return total / enrollments.length;
  },
});
```

## Joins and Relations

### Manual Join (One-to-Many)

```typescript
export const getCourseWithLessons = query({
  args: { courseId: v.id("courses") },
  returns: v.union(
    v.object({
      course: v.object({ _id: v.id("courses"), title: v.string() }),
      lessons: v.array(v.object({ _id: v.id("lessons"), title: v.string() })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    
    const course = await ctx.db.get(args.courseId);
    if (!course) return null;
    
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    
    return { course, lessons };
  },
});
```

### Batch Lookup Helper

```typescript
// Helper function (not a Convex function)
async function batchGetUsers(ctx: QueryCtx, userIds: Id<"users">[]) {
  const uniqueIds = [...new Set(userIds)];
  const users = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
  return new Map(users.filter(Boolean).map((u) => [u!._id, u!]));
}

export const getCoursesWithCreators = query({
  args: {},
  returns: v.array(v.object({
    course: v.object({ _id: v.id("courses"), title: v.string() }),
    creator: v.object({ _id: v.id("users"), name: v.string() }),
  })),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    
    const courses = await ctx.db.query("courses").collect();
    const creatorIds = courses.map((c) => c.creatorId);
    const creatorsMap = await batchGetUsers(ctx, creatorIds);
    
    return courses.map((course) => ({
      course,
      creator: creatorsMap.get(course.creatorId)!,
    }));
  },
});
```

## Search

### Full-Text Search (requires search index)

```typescript
// In schema.ts
courses: defineTable({
  title: v.string(),
  description: v.string(),
}).searchIndex("search_title", { searchField: "title" }),

// Query
export const search = query({
  args: { query: v.string() },
  returns: v.array(v.object({ _id: v.id("courses"), title: v.string() })),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("courses")
      .withSearchIndex("search_title", (q) => q.search("title", args.query))
      .collect();
  },
});
```
