# Convex Function Contracts: Authentication

**Module**: `convex/auth.ts`
**Date**: 2025-12-06

## Overview

Authentication is handled by Clerk. This module contains webhook handlers
that sync Clerk events to Convex and utility functions for auth checks.

Authentication flow:
1. User authenticates with Clerk (email/password, SSO, MFA)
2. Clerk issues JWT tokens
3. Convex validates tokens via Clerk integration
4. Clerk webhooks sync user data to Convex `users` table

---

## HTTP Actions (Webhook Handlers)

### `http.route({ path: "/clerk-webhook", method: "POST" })`
Handles Clerk webhook events for user sync.

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
    // Verify webhook signature using Clerk SDK
    const payload = await verifyClerkWebhook(request);

    switch (payload.type) {
      case "user.created":
      case "user.updated":
        await ctx.runMutation(internal.users.syncFromClerk, {
          clerkId: payload.data.id,
          email: payload.data.email_addresses[0].email_address,
          name: `${payload.data.first_name} ${payload.data.last_name}`,
          avatarUrl: payload.data.image_url,
        });
        break;
      case "user.deleted":
        await ctx.runMutation(internal.users.removeByClerkId, {
          clerkId: payload.data.id,
        });
        break;
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
```

**Webhook Events Handled**:
- `user.created` - Creates user in Convex
- `user.updated` - Updates user profile in Convex
- `user.deleted` - Removes user from Convex

**Security**: Webhook signature verification using `svix` library

---

## Internal Mutations

### `internal.users.syncFromClerk`
Upsert user from Clerk webhook data.

```typescript
export const syncFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      role: "user", // Default role
      status: "offline",
    });
  },
});
```

---

### `internal.users.removeByClerkId`
Remove user when deleted from Clerk.

```typescript
export const removeByClerkId = internalMutation({
  args: {
    clerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (user) {
      // Clean up team memberships
      const memberships = await ctx.db
        .query("teamMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      for (const membership of memberships) {
        await ctx.db.delete(membership._id);
      }

      await ctx.db.delete(user._id);
    }
    return null;
  },
});
```

---

## Utility Functions

### `getCurrentUser`
Helper to get current authenticated user from context.

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx } from "./_generated/server";

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}
```

---

## Client-Side Integration

### Clerk Provider Setup

```typescript
// src/app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/nextjs";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### Protected Routes

```typescript
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/courses(.*)",
  "/messages(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }
});
```

---

## Environment Variables

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Convex
NEXT_PUBLIC_CONVEX_URL=https://...convex.cloud
CONVEX_DEPLOY_KEY=prod:...
```

---

## Security Notes

- All JWT validation handled by Clerk + Convex integration
- MFA supported via Clerk configuration (TOTP, SMS, email)
- SSO (SAML, OIDC) available through Clerk organization features
- Webhook signatures verified using `svix` to prevent spoofing
- User roles stored in Convex, not Clerk (application-level RBAC)
