# Role-Based Access Control (RBAC)

## Table of Contents
1. [Role Definitions](#role-definitions)
2. [Convex RBAC Patterns](#convex-rbac-patterns)
3. [Client-Side Role Checks](#client-side-role-checks)
4. [Resource-Based Authorization](#resource-based-authorization)

---

## Role Definitions

### Schema Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Simple two-role system
const userRoles = v.union(v.literal("user"), v.literal("admin"));

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: userRoles,
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),
});
```

### Role Hierarchy

```
admin
  ├── All user permissions
  ├── Manage users (invite, change roles)
  ├── Access admin dashboard
  └── Delete any content

user
  ├── View published content
  ├── Create own content
  ├── Edit own content
  └── Delete own content
```

---

## Convex RBAC Patterns

### Auth Helpers with Role Checks

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export type UserRole = "user" | "admin";

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
    throw new Error("Unauthorized: Authentication required");
  }
  return user;
}

export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  requiredRole: UserRole
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  
  // Admin has all permissions
  if (user.role === "admin") return user;
  
  // Check specific role
  if (user.role !== requiredRole) {
    throw new Error(`Forbidden: ${requiredRole} access required`);
  }
  
  return user;
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}

/**
 * Check if user can access a specific resource
 * Returns the user if authorized, throws if not
 */
export async function requireResourceAccess(
  ctx: QueryCtx | MutationCtx,
  resourceOwnerId: Id<"users">
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  
  // Admin can access any resource
  if (user.role === "admin") return user;
  
  // Owner can access their own resource
  if (user._id === resourceOwnerId) return user;
  
  throw new Error("Forbidden: Cannot access this resource");
}
```

### Protected Mutations

```typescript
// convex/courses.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin, requireResourceAccess } from "./lib/auth";

// Any authenticated user can create
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    return await ctx.db.insert("courses", {
      ...args,
      authorId: user._id,
      isPublished: false,
      createdAt: Date.now(),
    });
  },
});

// Owner or admin can update
export const update = mutation({
  args: {
    id: v.id("courses"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.id);
    if (!course) throw new Error("Course not found");
    
    // Verify access (owner or admin)
    await requireResourceAccess(ctx, course.authorId);
    
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Only admin can publish
export const publish = mutation({
  args: { id: v.id("courses") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    await ctx.db.patch(args.id, {
      isPublished: true,
      publishedAt: Date.now(),
    });
  },
});

// Only admin can delete any course
export const adminDelete = mutation({
  args: { id: v.id("courses") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// Owner can delete their own course
export const deleteMine = mutation({
  args: { id: v.id("courses") },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.id);
    if (!course) throw new Error("Course not found");
    
    const user = await requireAuth(ctx);
    
    // Only owner can delete (not admin through this endpoint)
    if (course.authorId !== user._id) {
      throw new Error("Forbidden: Cannot delete this course");
    }
    
    await ctx.db.delete(args.id);
  },
});
```

### Role-Based Queries

```typescript
// convex/admin.ts
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

// Admin-only dashboard data
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    const users = await ctx.db.query("users").collect();
    const courses = await ctx.db.query("courses").collect();
    
    return {
      totalUsers: users.length,
      adminCount: users.filter((u) => u.role === "admin").length,
      totalCourses: courses.length,
      publishedCourses: courses.filter((c) => c.isPublished).length,
    };
  },
});

// Admin can list all users
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").collect();
  },
});
```

---

## Client-Side Role Checks

### Role Context Provider

```typescript
// src/providers/role-provider.tsx
"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type UserRole = "user" | "admin" | null;

interface RoleContextType {
  role: UserRole;
  isAdmin: boolean;
  isLoading: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
  isAdmin: false,
  isLoading: true,
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const user = useQuery(api.users.getCurrent);
  
  const value: RoleContextType = {
    role: user?.role ?? null,
    isAdmin: user?.role === "admin",
    isLoading: user === undefined,
  };
  
  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
```

### Conditional Rendering

```typescript
// src/components/admin-only.tsx
"use client";

import { useRole } from "@/providers/role-provider";
import { ReactNode } from "react";

interface AdminOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  const { isAdmin, isLoading } = useRole();
  
  if (isLoading) return null;
  if (!isAdmin) return fallback;
  
  return <>{children}</>;
}

// Usage
function CourseActions({ courseId }: { courseId: string }) {
  return (
    <div className="flex gap-2">
      <EditButton courseId={courseId} />
      <AdminOnly>
        <PublishButton courseId={courseId} />
        <DeleteButton courseId={courseId} />
      </AdminOnly>
    </div>
  );
}
```

### Protected Routes (Client)

```typescript
// src/components/require-admin.tsx
"use client";

import { useRole } from "@/providers/role-provider";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useRole();
  const router = useRouter();
  
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isAdmin, isLoading, router]);
  
  if (isLoading) {
    return <LoadingSkeleton />;
  }
  
  if (!isAdmin) {
    return null; // Will redirect
  }
  
  return <>{children}</>;
}

// Usage in admin layout
// src/app/admin/layout.tsx
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAdmin>
      <AdminSidebar />
      <main>{children}</main>
    </RequireAdmin>
  );
}
```

---

## Resource-Based Authorization

### Ownership Checks

```typescript
// convex/lib/permissions.ts
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { getCurrentUser } from "./auth";

export type Permission = "view" | "edit" | "delete" | "publish";

export async function canAccessCourse(
  ctx: QueryCtx | MutationCtx,
  courseId: Id<"courses">,
  permission: Permission
): Promise<boolean> {
  const user = await getCurrentUser(ctx);
  if (!user) return false;
  
  // Admin has all permissions
  if (user.role === "admin") return true;
  
  const course = await ctx.db.get(courseId);
  if (!course) return false;
  
  switch (permission) {
    case "view":
      // Anyone can view published courses, owner can view unpublished
      return course.isPublished || course.authorId === user._id;
      
    case "edit":
    case "delete":
      // Only owner can edit/delete
      return course.authorId === user._id;
      
    case "publish":
      // Only admin can publish (already checked above)
      return false;
      
    default:
      return false;
  }
}

// Usage in mutation
export const updateCourse = mutation({
  args: { id: v.id("courses"), title: v.string() },
  handler: async (ctx, args) => {
    const canEdit = await canAccessCourse(ctx, args.id, "edit");
    if (!canEdit) {
      throw new Error("Forbidden: Cannot edit this course");
    }
    
    await ctx.db.patch(args.id, { title: args.title });
  },
});
```

### Team-Based Access (Extension)

```typescript
// For future: if you need team-based access
// convex/lib/team-permissions.ts

export async function canAccessTeamResource(
  ctx: QueryCtx | MutationCtx,
  resourceTeamId: Id<"teams">,
  permission: Permission
): Promise<boolean> {
  const user = await getCurrentUser(ctx);
  if (!user) return false;
  
  // Admin bypasses team checks
  if (user.role === "admin") return true;
  
  // Check if user is member of the team
  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_user_team", (q) =>
      q.eq("userId", user._id).eq("teamId", resourceTeamId)
    )
    .unique();
    
  if (!membership) return false;
  
  // Check team role permissions
  switch (permission) {
    case "view":
      return true; // All members can view
    case "edit":
      return ["editor", "admin"].includes(membership.teamRole);
    case "delete":
    case "publish":
      return membership.teamRole === "admin";
    default:
      return false;
  }
}
```
