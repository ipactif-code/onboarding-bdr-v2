# Authentication Patterns - Clerk + Convex

## Table of Contents
1. [Clerk Middleware Configuration](#clerk-middleware-configuration)
2. [Convex Auth Helpers](#convex-auth-helpers)
3. [Client-Side Auth Patterns](#client-side-auth-patterns)
4. [Server Component Auth](#server-component-auth)

---

## Clerk Middleware Configuration

### Basic Protected Routes

```typescript
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/courses(.*)",
  "/api/protected(.*)",
]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();
  
  if (!userId && isProtectedRoute(req)) {
    return redirectToSignIn();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

### Role-Based Middleware (Optional Layer)

```typescript
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims, redirectToSignIn } = await auth();
  
  if (!userId && isProtectedRoute(req)) {
    return redirectToSignIn();
  }
  
  // Note: middleware is a convenience layer only
  // Always verify roles in Convex functions (Data Access Layer)
  if (isAdminRoute(req) && sessionClaims?.role !== "admin") {
    return Response.redirect(new URL("/dashboard", req.url));
  }
});
```

---

## Convex Auth Helpers

### Core Auth Functions

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

/**
 * Get current authenticated user or null
 * Use when authentication is optional
 */
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

/**
 * Require authenticated user - throws if not authenticated
 * Use for protected endpoints
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Unauthorized: Authentication required");
  }
  return user;
}

/**
 * Require admin role - throws if not admin
 * Use for admin-only endpoints
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}
```

### Usage in Convex Functions

```typescript
// convex/courses.ts
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAdmin } from "./lib/auth";
import { v } from "convex/values";

// Protected query - any authenticated user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx); // Throws if not authenticated
    
    return await ctx.db
      .query("courses")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();
  },
});

// Admin-only mutation
export const publish = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx); // Throws if not admin
    
    await ctx.db.patch(args.courseId, { 
      isPublished: true,
      publishedBy: admin._id,
      publishedAt: Date.now(),
    });
  },
});
```

---

## Client-Side Auth Patterns

### Protected Page Component

```typescript
// src/app/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }
  
  return <DashboardContent />;
}
```

### Client Component with Auth

```typescript
"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function ProtectedContent() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  
  // Convex query will throw if user not authenticated
  const data = useQuery(api.protected.getData);
  
  if (!isLoaded) {
    return <LoadingSkeleton />;
  }
  
  if (!isSignedIn) {
    return <SignInPrompt />;
  }
  
  return <DataDisplay data={data} />;
}
```

---

## Server Component Auth

### Getting User in Server Components

```typescript
// src/app/profile/page.tsx
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function ProfilePage() {
  const { userId, getToken } = await auth();
  const clerkUser = await currentUser();
  
  if (!userId) {
    redirect("/sign-in");
  }
  
  // Get Convex token for server-side queries
  const token = await getToken({ template: "convex" });
  
  const userData = await fetchQuery(
    api.users.getCurrent,
    {},
    { token }
  );
  
  return <ProfileDisplay user={userData} />;
}
```

### API Route Protection

```typescript
// src/app/api/protected/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  // Process authenticated request
  return NextResponse.json({ data: "protected data" });
}
```
