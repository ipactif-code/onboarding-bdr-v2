# Query Optimization

## Table of Contents
1. [Index Design Principles](#index-design-principles)
2. [Common Index Patterns](#common-index-patterns)
3. [Pagination Strategies](#pagination-strategies)
4. [N+1 Query Prevention](#n1-query-prevention)
5. [Query Batching](#query-batching)

---

## Index Design Principles

### When Indexes Are Required

| Table Size | Index Required? |
|------------|----------------|
| < 100 docs | Optional (full scan acceptable) |
| 100-1000 docs | Recommended |
| > 1000 docs | **Mandatory** |

### Index Anatomy

```typescript
// schema.ts
defineTable({
  courseId: v.id("courses"),
  userId: v.id("users"),
  status: v.string(),
  completedAt: v.optional(v.number()),
})
  // Single field index
  .index("by_course", ["courseId"])
  
  // Compound index (order matters!)
  .index("by_user_status", ["userId", "status"])
  
  // Index with optional field
  .index("by_course_completed", ["courseId", "completedAt"])
```

### Query Patterns

```typescript
// ✅ GOOD - Index prefix match
.withIndex("by_user_status", (q) => q.eq("userId", userId))

// ✅ GOOD - Full index match
.withIndex("by_user_status", (q) => 
  q.eq("userId", userId).eq("status", "completed")
)

// ❌ BAD - Skipping index prefix
.withIndex("by_user_status", (q) => q.eq("status", "completed"))
// This won't use the index! Must start with "userId"
```

---

## Common Index Patterns

### Pattern 1: Parent-Child Relationship

```typescript
// schema.ts
sections: defineTable({
  courseId: v.id("courses"),
  order: v.number(),
  title: v.string(),
}).index("by_course_order", ["courseId", "order"]),

// query
const sections = await ctx.db
  .query("sections")
  .withIndex("by_course_order", (q) => q.eq("courseId", courseId))
  .order("asc")  // Uses index order
  .collect();
```

### Pattern 2: User-Scoped Data

```typescript
// schema.ts
userProgress: defineTable({
  userId: v.id("users"),
  lessonId: v.id("lessons"),
  completed: v.boolean(),
  completedAt: v.optional(v.number()),
}).index("by_user", ["userId"])
  .index("by_user_lesson", ["userId", "lessonId"]),

// Get single progress record
const progress = await ctx.db
  .query("userProgress")
  .withIndex("by_user_lesson", (q) =>
    q.eq("userId", userId).eq("lessonId", lessonId)
  )
  .unique();

// Get all user progress
const allProgress = await ctx.db
  .query("userProgress")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .collect();
```

### Pattern 3: Status Filtering

```typescript
// schema.ts
courses: defineTable({
  authorId: v.id("users"),
  status: v.string(), // "draft" | "published" | "archived"
  publishedAt: v.optional(v.number()),
}).index("by_author_status", ["authorId", "status"]),

// Get published courses by author
const published = await ctx.db
  .query("courses")
  .withIndex("by_author_status", (q) =>
    q.eq("authorId", authorId).eq("status", "published")
  )
  .collect();
```

---

## Pagination Strategies

### Cursor-Based Pagination (Recommended)

```typescript
// convex/courses.ts
export const listPaginated = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    const results = await ctx.db
      .query("courses")
      .withIndex("by_published", (q) => q.eq("status", "published"))
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems: limit });
    
    return {
      courses: results.page,
      nextCursor: results.continueCursor,
      hasMore: !results.isDone,
    };
  },
});
```

### Client-Side Usage

```tsx
"use client";

function CourseList() {
  const [cursor, setCursor] = useState<string | undefined>();
  const result = useQuery(api.courses.listPaginated, { cursor, limit: 20 });
  
  if (result === undefined) return <CourseListSkeleton />;
  
  return (
    <>
      {result.courses.map(course => <CourseCard key={course._id} course={course} />)}
      
      {result.hasMore && (
        <button onClick={() => setCursor(result.nextCursor)}>
          Load More
        </button>
      )}
    </>
  );
}
```

### Infinite Scroll with usePaginatedQuery

```tsx
"use client";
import { usePaginatedQuery } from "convex/react";

function InfiniteCourseList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.courses.listPaginated,
    {},
    { initialNumItems: 20 }
  );
  
  if (status === "LoadingFirstPage") return <CourseListSkeleton />;
  
  return (
    <>
      {results.map(course => <CourseCard key={course._id} course={course} />)}
      
      {status === "CanLoadMore" && (
        <button onClick={() => loadMore(20)}>Load More</button>
      )}
      {status === "LoadingMore" && <LoadingSpinner />}
    </>
  );
}
```

---

## N+1 Query Prevention

### Problem: N+1 in Loops

```typescript
// ❌ BAD - N+1 queries (1 for courses + N for authors)
export const listWithAuthors = query({
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    
    return Promise.all(
      courses.map(async (course) => ({
        ...course,
        author: await ctx.db.get(course.authorId),  // N queries!
      }))
    );
  },
});
```

### Solution 1: Batch Get

```typescript
// ✅ GOOD - 2 queries total
export const listWithAuthors = query({
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    
    // Get unique author IDs
    const authorIds = [...new Set(courses.map(c => c.authorId))];
    
    // Batch fetch all authors
    const authors = await Promise.all(
      authorIds.map(id => ctx.db.get(id))
    );
    const authorMap = new Map(
      authors.filter(Boolean).map(a => [a!._id, a])
    );
    
    return courses.map(course => ({
      ...course,
      author: authorMap.get(course.authorId),
    }));
  },
});
```

### Solution 2: Denormalization

```typescript
// schema.ts - Store author name directly
courses: defineTable({
  title: v.string(),
  authorId: v.id("users"),
  authorName: v.string(),  // Denormalized
}),

// Update author name when user updates profile
export const updateProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    // Update user
    await ctx.db.patch(userId, { name: args.name });
    
    // Update denormalized fields
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .collect();
    
    await Promise.all(
      courses.map(course =>
        ctx.db.patch(course._id, { authorName: args.name })
      )
    );
  },
});
```

---

## Query Batching

### Parallel Queries in Actions

```typescript
// ✅ GOOD - Parallel fetching
export const getDashboardData = action({
  handler: async (ctx) => {
    const [courses, progress, notifications] = await Promise.all([
      ctx.runQuery(api.courses.listMine),
      ctx.runQuery(api.progress.getSummary),
      ctx.runQuery(api.notifications.getUnread),
    ]);
    
    return { courses, progress, notifications };
  },
});
```

### Client-Side Parallel Queries

```tsx
"use client";

function Dashboard() {
  // These run in parallel automatically
  const courses = useQuery(api.courses.listMine);
  const progress = useQuery(api.progress.getSummary);
  const notifications = useQuery(api.notifications.getUnread);
  
  // Handle loading states
  if (courses === undefined || progress === undefined) {
    return <DashboardSkeleton />;
  }
  
  return <DashboardContent {...{ courses, progress, notifications }} />;
}
```

---

## Checklist

Before deploying queries:

- [ ] All tables > 100 docs have appropriate indexes
- [ ] No `.filter()` on large tables (use `.withIndex()`)
- [ ] Compound indexes ordered by selectivity (most selective first)
- [ ] Pagination implemented for lists > 50 items
- [ ] No N+1 patterns in loops (use batch fetching)
- [ ] Related data fetched in parallel when possible
