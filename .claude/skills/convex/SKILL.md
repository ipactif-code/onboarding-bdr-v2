---
name: convex
description: "Convex backend patterns and best practices for the LMS project. Provides schema definition, queries, mutations, actions, Clerk authentication, and file storage patterns. Use when working on files in convex/**/*.ts, when creating queries, mutations, actions, modifying schema, adding tables, or managing files. Triggers on keywords: Convex, schema, query, mutation, action, ctx.db, requireAuth, internal."
---

# Convex Backend Patterns

## Stack

- Convex ^1, TypeScript 5.x (strict), Clerk integration via auth.config.ts

## Quick Start

### Query with Auth

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const list = query({
  args: { search: v.optional(v.string()) },
  returns: v.array(v.object({ _id: v.id("tags"), name: v.string() })),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.query("tags").collect();
  },
});
```

### Mutation with Validation

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

export const create = mutation({
  args: { title: v.string() },
  returns: v.id("courses"),
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);
    return await ctx.db.insert("courses", {
      title: args.title,
      creatorId: user._id,
    });
  },
});
```

### Internal Function

```typescript
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const processInternal = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // No auth check needed - internal only
    await ctx.db.patch(args.userId, { lastProcessed: Date.now() });
    return null;
  },
});
```

## Decision Tree

### Query vs Mutation vs Action?

```
Does it modify data in the database?
├─ NO → Does it need external API calls?
│   ├─ NO → QUERY (read-only, cached, reactive)
│   └─ YES → ACTION (side effects, no DB access)
└─ YES → MUTATION (writes, transactional)
```

### When to use Internal functions?

```
Is this called directly from the client?
├─ YES → Public function (query/mutation/action)
│   └─ MUST have requireAuth/requireAdmin
└─ NO → Internal function (internalQuery/internalMutation/internalAction)
    └─ Called via ctx.scheduler or other server functions
```

### Index vs Filter?

```
Filtering data from a table?
├─ Field is indexed → .withIndex("by_field", q => q.eq("field", value))
└─ Field not indexed
    ├─ Frequent query → Add index to schema, use .withIndex()
    └─ Rare query, small dataset → .filter() acceptable (not recommended)
```

## Strict Rules

| Context | Rule |
|---------|------|
| Auth | ALWAYS call `requireAuth(ctx)` or `requireAdmin(ctx)` as first line in handler |
| Queries | Use `.withIndex()` instead of `.filter()` for performance |
| Returns | ALWAYS use `returns: validator` for type safety |
| Internal | ONLY internal functions can skip auth validation |
| Helpers | NEVER use `ctx.runQuery`/`ctx.runMutation` in queries/mutations - use TypeScript helpers |
| Indexes | Name pattern: `by_[field]` or `by_[field1]_[field2]` |
| Timestamps | Use `Date.now()` (milliseconds) |
| Null returns | Use `returns: v.null()` and `return null` for void functions |

## Auth Helpers (convex/lib/auth.ts)

| Helper | Use Case |
|--------|----------|
| `requireAuth(ctx)` | Any authenticated user required |
| `requireAdmin(ctx)` | Admin role required |
| `getCurrentUser(ctx)` | Returns user or null (for optional auth) |

## References

Load these as needed for detailed patterns:

- **Schema**: [references/schema-patterns.md](references/schema-patterns.md) - Table definitions, validators, indexes
- **Queries**: [references/queries.md](references/queries.md) - Query patterns, pagination, filtering
- **Mutations**: [references/mutations.md](references/mutations.md) - CRUD operations, transactions
- **Actions**: [references/actions.md](references/actions.md) - External APIs, scheduling, side effects
- **Auth**: [references/auth-patterns.md](references/auth-patterns.md) - Clerk integration, role-based access
- **Files**: [references/file-storage.md](references/file-storage.md) - Upload, download, image handling
