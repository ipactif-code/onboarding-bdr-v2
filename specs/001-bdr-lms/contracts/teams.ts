# Convex Function Contracts: Teams

**Module**: `convex/teams.ts`
**Date**: 2025-12-06

## Overview

Team management functions for organizing users and course assignments.
Teams enable bulk course assignment and analytics filtering.

---

## Queries

### `api.teams.list`
List all teams with member counts.

```typescript
export const list = query({
  args: {
    search: v.optional(v.string()),
  },
  returns: v.array(v.object({
    _id: v.id("teams"),
    name: v.string(),
    description: v.optional(v.string()),
    lead: v.optional(v.object({
      _id: v.id("users"),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
    })),
    memberCount: v.number(),
    courseCount: v.number(),
    _creationTime: v.number(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.teams.get`
Get team details with members.

```typescript
export const get = query({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.object({
    _id: v.id("teams"),
    name: v.string(),
    description: v.optional(v.string()),
    lead: v.optional(v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      avatarUrl: v.optional(v.string()),
    })),
    members: v.array(v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      avatarUrl: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
      joinedAt: v.number(),
    })),
    courses: v.array(v.object({
      _id: v.id("courses"),
      title: v.string(),
      assignedAt: v.number(),
    })),
    _creationTime: v.number(),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.teams.getForUser`
Get teams for current user (used in dashboard).

```typescript
export const getForUser = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("teams"),
    name: v.string(),
    isLead: v.boolean(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user (returns own teams)

---

### `api.teams.getMembers`
Get team members with optional search.

```typescript
export const getMembers = query({
  args: {
    teamId: v.id("teams"),
    search: v.optional(v.string()),
  },
  returns: v.array(v.object({
    _id: v.id("users"),
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    status: v.union(v.literal("online"), v.literal("offline"), v.literal("away")),
    joinedAt: v.number(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

## Mutations

### `api.teams.create`
Create a new team.

```typescript
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    leadId: v.optional(v.id("users")),
    memberIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**:
- Name: 2-100 characters, unique
- Description: Max 500 characters

---

### `api.teams.update`
Update team details.

```typescript
export const update = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    leadId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**: Same as create

---

### `api.teams.remove`
Delete a team.

```typescript
export const remove = mutation({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Side Effects**:
- Removes all team memberships
- Removes team-based course assignments
- Users retain access to courses they already started

---

### `api.teams.addMember`
Add a user to a team.

```typescript
export const addMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  returns: v.id("teamMembers"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**: User must not already be a member

---

### `api.teams.removeMember`
Remove a user from a team.

```typescript
export const removeMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Side Effects**: User retains access to courses they already started

---

### `api.teams.addMembers`
Bulk add members to a team.

```typescript
export const addMembers = mutation({
  args: {
    teamId: v.id("teams"),
    userIds: v.array(v.id("users")),
  },
  returns: v.array(v.id("teamMembers")),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only

---

### `api.teams.setLead`
Set or change team lead.

```typescript
export const setLead = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.optional(v.id("users")), // null to remove lead
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**: User must be a member of the team (or null)

---

## Validation Rules

- Team name: 2-100 characters, must be unique
- Team description: Max 500 characters
- Team lead: Must be a member of the team
- Users can belong to multiple teams simultaneously
- Deleting a team preserves user progress on assigned courses
