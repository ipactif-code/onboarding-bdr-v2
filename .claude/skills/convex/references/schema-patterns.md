# Schema Patterns

## Table of Contents

1. [Basic Table Definition](#basic-table-definition)
2. [Validators Reference](#validators-reference)
3. [Index Patterns](#index-patterns)
4. [Relationships](#relationships)
5. [Common Patterns](#common-patterns)

## Basic Table Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  courses: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    creatorId: v.id("users"),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_status", ["status"])
    .index("by_creator_status", ["creatorId", "status"]),
});
```

## Validators Reference

### Primitive Types

```typescript
v.string()           // string
v.number()           // number (use for timestamps with Date.now())
v.boolean()          // boolean
v.null()             // null
v.int64()            // 64-bit integer
v.float64()          // 64-bit float
v.bytes()            // ArrayBuffer
```

### Complex Types

```typescript
v.id("tableName")                    // Reference to another table
v.array(v.string())                  // Array of strings
v.object({ key: v.string() })        // Object with specific shape
v.optional(v.string())               // Optional field
v.union(v.literal("a"), v.literal("b"))  // Union type / enum
```

### Reusable Validators

```typescript
// convex/schema.ts
const statusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived")
);

const timestampsValidator = {
  createdAt: v.number(),
  updatedAt: v.number(),
};

export default defineSchema({
  courses: defineTable({
    title: v.string(),
    status: statusValidator,
    ...timestampsValidator,
  }),
});
```

## Index Patterns

### Naming Convention

```
by_[field]              → Single field index
by_[field1]_[field2]    → Composite index
```

### Single Field Index

```typescript
// Query by one field
.index("by_email", ["email"])

// Usage
ctx.db.query("users").withIndex("by_email", q => q.eq("email", email))
```

### Composite Index

```typescript
// Query by multiple fields (order matters!)
.index("by_creator_status", ["creatorId", "status"])

// Usage - can query by prefix
ctx.db.query("courses").withIndex("by_creator_status", q => 
  q.eq("creatorId", userId)  // First field only
)

ctx.db.query("courses").withIndex("by_creator_status", q => 
  q.eq("creatorId", userId).eq("status", "published")  // Both fields
)
```

### Range Queries

```typescript
.index("by_createdAt", ["createdAt"])

// Usage
ctx.db.query("courses").withIndex("by_createdAt", q => 
  q.gte("createdAt", startDate).lte("createdAt", endDate)
)
```

## Relationships

### One-to-Many

```typescript
// Parent table
courses: defineTable({
  title: v.string(),
}),

// Child table with foreign key
lessons: defineTable({
  courseId: v.id("courses"),  // Foreign key
  title: v.string(),
  order: v.number(),
}).index("by_course", ["courseId"]),
```

### Many-to-Many (Junction Table)

```typescript
// Junction table
courseEnrollments: defineTable({
  courseId: v.id("courses"),
  userId: v.id("users"),
  enrolledAt: v.number(),
  progress: v.number(),
})
  .index("by_course", ["courseId"])
  .index("by_user", ["userId"])
  .index("by_user_course", ["userId", "courseId"]),
```

## Common Patterns

### Soft Delete

```typescript
courses: defineTable({
  title: v.string(),
  deletedAt: v.optional(v.number()),  // null = not deleted
}).index("by_deletedAt", ["deletedAt"]),

// Query non-deleted
ctx.db.query("courses")
  .withIndex("by_deletedAt", q => q.eq("deletedAt", undefined))
```

### Audit Fields

```typescript
const auditFields = {
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.id("users"),
  updatedBy: v.id("users"),
};
```

### Status Enum

```typescript
const statusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived")
);

// Type extraction for TypeScript
type Status = "draft" | "published" | "archived";
```

### File References

```typescript
courses: defineTable({
  title: v.string(),
  thumbnailId: v.optional(v.id("_storage")),  // File storage reference
}),
```
