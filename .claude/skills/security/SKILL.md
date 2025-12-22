---
name: security
description: Security patterns and references for Next.js 15 + Convex + Clerk applications. Covers authentication, RBAC authorization, Zod input validation, XSS prevention for rich text (Plate.js), and defensive security practices. Use when working on files like convex/lib/auth.ts, convex/**/*.ts, src/middleware.ts, src/lib/validators/*.ts, or when implementing authentication, protecting routes, validating inputs, sanitizing HTML, or managing user roles. Triggers on keywords like auth, authentication, authorization, RBAC, role, permission, validation, sanitize, XSS, security, Clerk, requireAuth, middleware, DOMPurify.
---

# Security Skill

Security patterns for Next.js 15 + Convex + Clerk stack.

## Quick Start

### Protect a Convex Function

```typescript
// convex/courses.ts
import { mutation } from "./_generated/server";
import { requireAuth, requireAdmin } from "./lib/auth";

// Any authenticated user
export const create = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx); // ← Throws if not authenticated
    return await ctx.db.insert("courses", { ...args, authorId: user._id });
  },
});

// Admin only
export const publish = mutation({
  args: { id: v.id("courses") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx); // ← Throws if not admin
    await ctx.db.patch(args.id, { isPublished: true });
  },
});
```

### Validate Form Input

```typescript
// src/lib/validators/invite.ts
import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email"),
  role: z.enum(["user", "admin"]).default("user"),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

// In form component
const form = useForm<InviteUserInput>({
  resolver: zodResolver(inviteUserSchema),
});
```

### Render Rich Text Safely

```typescript
import { sanitizeHtml } from "@/lib/sanitize";

// ✅ ALWAYS sanitize before dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />

// ❌ NEVER render unsanitized HTML
<div dangerouslySetInnerHTML={{ __html: content }} />
```

---

## Decision Tree

**What security pattern do you need?**

```
Is the user authenticated?
├─ No → Redirect to sign-in (Clerk middleware)
└─ Yes → Check authorization
         │
         Is this admin-only?
         ├─ Yes → Use requireAdmin() in Convex function
         └─ No → Is this resource-specific?
                 ├─ Yes → Check ownership: requireResourceAccess(ctx, ownerId)
                 └─ No → Use requireAuth() for any authenticated user

Is there user input?
├─ Form data → Validate with Zod (client) + Convex validators (server)
├─ Rich text content → Serialize with Plate + sanitize with DOMPurify
└─ URL/query params → Validate with Zod before use

Are you rendering HTML?
├─ From user/database → ALWAYS use sanitizeHtml()
├─ From Plate.js → Use Plate read-only OR sanitizeRichText()
└─ Static content → Safe, no sanitization needed
```

---

## Critical Rules

### Authentication & Authorization

| Rule | Pattern |
|------|---------|
| ALWAYS call `requireAuth()` or `requireAdmin()` in protected Convex functions | `const user = await requireAuth(ctx);` |
| NEVER trust middleware alone for security | Middleware is UX layer, Convex is security layer |
| ALWAYS verify resource ownership before mutations | `if (resource.authorId !== user._id) throw` |

### Input Validation

| Rule | Pattern |
|------|---------|
| ALWAYS validate with Zod on client | `zodResolver(schema)` in useForm |
| ALWAYS re-validate in Convex with `v.*` validators | `args: { email: v.string() }` |
| Validators go in `src/lib/validators/*.ts` | Export types with `z.infer<typeof schema>` |

### XSS Prevention

| Rule | Pattern |
|------|---------|
| NEVER use `dangerouslySetInnerHTML` without sanitization | Always wrap with `sanitizeHtml()` |
| ALWAYS sanitize Plate.js HTML before storage/display | `sanitizeRichText(serializedHtml)` |
| Store Plate content as JSON when possible | JSON is safe, HTML needs sanitization |

### Role System

| Rule | Value |
|------|-------|
| Available roles | `"user"` \| `"admin"` |
| Admin has all permissions | Check with `user.role === "admin"` |
| No role hierarchy | Just two flat roles |

---

## Reference Files

| Topic | File | When to Use |
|-------|------|-------------|
| Authentication | [auth-patterns.md](references/auth-patterns.md) | Clerk middleware, Convex auth helpers, protected routes |
| Input Validation | [input-validation.md](references/input-validation.md) | Zod schemas, form integration, Convex validation |
| XSS Prevention | [xss-prevention.md](references/xss-prevention.md) | DOMPurify config, Plate.js serialization, CSP |
| RBAC | [rbac.md](references/rbac.md) | Role checks, resource permissions, admin patterns |

---

## File Locations

```
convex/
├── lib/
│   └── auth.ts          # getCurrentUser, requireAuth, requireAdmin
├── schema.ts            # User roles in schema
└── *.ts                 # Protected queries/mutations

src/
├── middleware.ts        # Clerk route protection
├── lib/
│   ├── sanitize.ts      # DOMPurify configuration
│   └── validators/
│       ├── index.ts     # Re-exports all validators
│       ├── user.ts      # User-related schemas
│       └── *.ts         # Domain-specific schemas
└── components/
    └── safe-html.tsx    # Sanitized HTML renderer
```

---

## Common Patterns

### Full Protected Mutation Example

```typescript
// convex/lessons.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const update = mutation({
  // 1. Convex type validation
  args: {
    id: v.id("lessons"),
    title: v.string(),
    content: v.string(), // JSON from Plate.js
  },
  handler: async (ctx, args) => {
    // 2. Authentication check
    const user = await requireAuth(ctx);
    
    // 3. Resource existence check
    const lesson = await ctx.db.get(args.id);
    if (!lesson) throw new Error("Lesson not found");
    
    // 4. Authorization check (ownership)
    if (lesson.authorId !== user._id && user.role !== "admin") {
      throw new Error("Forbidden: Cannot edit this lesson");
    }
    
    // 5. Perform update
    await ctx.db.patch(args.id, {
      title: args.title,
      content: args.content,
      updatedAt: Date.now(),
    });
  },
});
```

### Form with Full Validation

```typescript
// Client: src/components/forms/lesson-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { lessonSchema, type LessonInput } from "@/lib/validators";

export function LessonForm() {
  const update = useMutation(api.lessons.update);
  
  const form = useForm<LessonInput>({
    resolver: zodResolver(lessonSchema), // Client validation
  });
  
  async function onSubmit(values: LessonInput) {
    await update(values); // Convex validates again server-side
  }
  
  // ... form JSX
}
```
