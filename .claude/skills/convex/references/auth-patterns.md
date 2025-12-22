# Auth Patterns

## Table of Contents

1. [Clerk Integration Setup](#clerk-integration-setup)
2. [Auth Helpers](#auth-helpers)
3. [Role-Based Access](#role-based-access)
4. [User Sync Webhook](#user-sync-webhook)
5. [Common Patterns](#common-patterns)

## Clerk Integration Setup

### auth.config.ts

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
```

### Environment Variables

```bash
# In Convex dashboard, set:
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev
```

## Auth Helpers

### convex/lib/auth.ts

```typescript
import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;

export type User = {
  _id: Id<"users">;
  clerkId: string;
  email: string;
  name: string;
  role: "admin" | "user";
};

/**
 * Get current user or null (for optional auth)
 */
export async function getCurrentUser(ctx: AuthCtx): Promise<User | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user as User | null;
}

/**
 * Require authenticated user - throws if not logged in
 */
export async function requireAuth(ctx: AuthCtx): Promise<User> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Unauthorized: Authentication required");
  }
  return user;
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin(ctx: AuthCtx): Promise<User> {
  const user = await requireAuth(ctx);
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}

/**
 * Check if user owns a resource
 */
export async function requireOwnership(
  ctx: AuthCtx,
  resourceOwnerId: Id<"users">
): Promise<User> {
  const user = await requireAuth(ctx);
  if (user._id !== resourceOwnerId && user.role !== "admin") {
    throw new Error("Forbidden: You don't own this resource");
  }
  return user;
}
```

## Role-Based Access

### Schema with Roles

```typescript
// convex/schema.ts
users: defineTable({
  clerkId: v.string(),
  email: v.string(),
  name: v.string(),
  role: v.union(v.literal("admin"), v.literal("user"), v.literal("instructor")),
})
  .index("by_clerkId", ["clerkId"])
  .index("by_role", ["role"]),
```

### Role-Specific Helpers

```typescript
// convex/lib/auth.ts

export async function requireInstructor(ctx: AuthCtx): Promise<User> {
  const user = await requireAuth(ctx);
  if (user.role !== "instructor" && user.role !== "admin") {
    throw new Error("Forbidden: Instructor access required");
  }
  return user;
}

export async function requireRole(ctx: AuthCtx, roles: string[]): Promise<User> {
  const user = await requireAuth(ctx);
  if (!roles.includes(user.role)) {
    throw new Error(`Forbidden: Required role: ${roles.join(" or ")}`);
  }
  return user;
}
```

### Usage in Functions

```typescript
// Public content - any user
export const listPublishedCourses = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("courses"), title: v.string() })),
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("courses")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
  },
});

// Instructor only
export const createCourse = mutation({
  args: { title: v.string() },
  returns: v.id("courses"),
  handler: async (ctx, args) => {
    const user = await requireInstructor(ctx);
    return await ctx.db.insert("courses", {
      title: args.title,
      creatorId: user._id,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Admin only
export const deleteAnyUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.userId);
    return null;
  },
});
```

## User Sync Webhook

### Webhook Handler

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verify webhook signature (use svix library)
    const payload = await request.json();
    const eventType = payload.type;

    switch (eventType) {
      case "user.created":
        await ctx.runMutation(internal.users.createFromClerk, {
          clerkId: payload.data.id,
          email: payload.data.email_addresses[0]?.email_address ?? "",
          name: `${payload.data.first_name ?? ""} ${payload.data.last_name ?? ""}`.trim(),
        });
        break;

      case "user.updated":
        await ctx.runMutation(internal.users.updateFromClerk, {
          clerkId: payload.data.id,
          email: payload.data.email_addresses[0]?.email_address ?? "",
          name: `${payload.data.first_name ?? ""} ${payload.data.last_name ?? ""}`.trim(),
        });
        break;

      case "user.deleted":
        await ctx.runMutation(internal.users.deleteByClerkId, {
          clerkId: payload.data.id,
        });
        break;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
```

### User Sync Mutations

```typescript
// convex/users.ts
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const createFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      role: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        email: args.email,
        name: args.name,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

export const deleteByClerkId = internalMutation({
  args: { clerkId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (user) {
      await ctx.db.delete(user._id);
    }

    return null;
  },
});
```

## Common Patterns

### Optional Auth (Public + Enhanced for Logged In)

```typescript
export const getPublicProfile = query({
  args: { userId: v.id("users") },
  returns: v.object({
    name: v.string(),
    isFollowing: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx); // Optional
    const profile = await ctx.db.get(args.userId);
    if (!profile) throw new Error("User not found");

    let isFollowing: boolean | undefined;
    if (currentUser) {
      const follow = await ctx.db
        .query("follows")
        .withIndex("by_follower_following", (q) =>
          q.eq("followerId", currentUser._id).eq("followingId", args.userId)
        )
        .first();
      isFollowing = !!follow;
    }

    return {
      name: profile.name,
      isFollowing,
    };
  },
});
```

### Resource Ownership Check

```typescript
export const updateCourse = mutation({
  args: {
    id: v.id("courses"),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.id);
    if (!course) throw new Error("Course not found");

    // Check ownership (also allows admin)
    await requireOwnership(ctx, course.creatorId);

    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });

    return null;
  },
});
```

### Get-or-Create User Pattern

```typescript
export const getOrCreateUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email ?? "",
      name: identity.name ?? "",
      role: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
```
