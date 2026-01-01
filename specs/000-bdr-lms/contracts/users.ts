# Convex Function Contracts: Users

**Module**: `convex/users.ts`
**Date**: 2025-12-06

## Overview

User management functions for the BDR LMS. Users are synced from Clerk via webhooks.
All functions use Convex's built-in authentication via `ctx.auth`.

---

## Queries

### `api.users.list`
List users with filtering and pagination. Admin only.

```typescript
export const list = query({
  args: {
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
    teamId: v.optional(v.id("teams")),
    search: v.optional(v.string()),
    page: v.optional(v.number()),    // default: 1
    pageSize: v.optional(v.number()), // default: 20
  },
  returns: v.object({
    data: v.array(v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
      status: v.union(v.literal("online"), v.literal("offline"), v.literal("away")),
      lastActiveAt: v.optional(v.number()),
      teamCount: v.number(),
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

**Authorization**: Admin only (checks `ctx.auth` for admin role)

---

### `api.users.get`
Get user details by ID.

```typescript
export const get = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    _id: v.id("users"),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    status: v.union(v.literal("online"), v.literal("offline"), v.literal("away")),
    lastActiveAt: v.optional(v.number()),
    teams: v.array(v.object({
      _id: v.id("teams"),
      name: v.string(),
      isLead: v.boolean(),
    })),
    stats: v.object({
      coursesCompleted: v.number(),
      coursesInProgress: v.number(),
      overallProgress: v.number(),
      totalTimeSpent: v.number(),
    }),
    _creationTime: v.number(),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Self or Admin

---

### `api.users.getByClerkId`
Look up user by Clerk ID (used for auth flow).

```typescript
export const getByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  returns: v.union(v.object({ /* user fields */ }), v.null()),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Internal use (Clerk webhook)

---

### `api.users.search`
Search users for mentions and messaging.

```typescript
export const search = query({
  args: {
    query: v.string(),   // min 2 characters
    limit: v.optional(v.number()), // default: 10
  },
  returns: v.array(v.object({
    _id: v.id("users"),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user

---

### `api.users.getOnlineUsers`
Get list of currently online users for presence display.

```typescript
export const getOnlineUsers = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("users"),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    status: v.union(v.literal("online"), v.literal("offline"), v.literal("away")),
    lastActiveAt: v.optional(v.number()),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user

---

## Mutations

### `api.users.syncFromClerk`
Sync user data from Clerk webhook (internal mutation).

```typescript
export const syncFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Internal only (called from webhook handler)

---

### `api.users.update`
Update user profile.

```typescript
export const update = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Self or Admin
**Validation**: Name min 2 characters

---

### `api.users.updateRole`
Change user role. Admin only.

```typescript
export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.users.updateStatus`
Update user presence status.

```typescript
export const updateStatus = mutation({
  args: {
    status: v.union(v.literal("online"), v.literal("offline"), v.literal("away")),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Self only (updates current user)

---

### `api.users.remove`
Remove user from system. Admin only.

```typescript
export const remove = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Side Effects**: Removes team memberships, preserves progress history

---

## Validation Rules

- Email: Validated by Clerk (synced)
- Name: Minimum 2 characters
- Role: Can only be changed by admins
- Status: Auto-updated on activity, manual override allowed
