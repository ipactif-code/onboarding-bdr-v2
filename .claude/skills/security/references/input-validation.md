# Input Validation - Zod Patterns

## Table of Contents
1. [Validator File Structure](#validator-file-structure)
2. [Common Schema Patterns](#common-schema-patterns)
3. [Form Integration](#form-integration)
4. [Convex Validation](#convex-validation)
5. [Error Handling](#error-handling)

---

## Validator File Structure

### File Organization

```
src/lib/validators/
├── index.ts          # Re-exports all validators
├── user.ts           # User-related schemas
├── course.ts         # Course-related schemas
├── lesson.ts         # Lesson-related schemas
└── common.ts         # Shared schemas (pagination, etc.)
```

### Standard Validator File Pattern

```typescript
// src/lib/validators/user.ts
import { z } from "zod";

// 1. Define enums first
export const userRoleSchema = z.enum(["user", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

// 2. Define base schemas
export const userBaseSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: userRoleSchema.default("user"),
});

// 3. Define action-specific schemas
export const createUserSchema = userBaseSchema.extend({
  clerkId: z.string().min(1),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = userBaseSchema.partial().extend({
  id: z.string(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// 4. Export index file
// src/lib/validators/index.ts
export * from "./user";
export * from "./course";
export * from "./lesson";
export * from "./common";
```

---

## Common Schema Patterns

### String Validation

```typescript
// Email with custom error
email: z.string().email("Please enter a valid email"),

// Required string with min/max
name: z.string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name cannot exceed 100 characters"),

// Optional string
bio: z.string().optional(),

// String with transform
slug: z.string()
  .toLowerCase()
  .transform((s) => s.replace(/\s+/g, "-")),

// URL validation
url: z.string().url("Please enter a valid URL"),
```

### Number Validation

```typescript
// Positive integer
order: z.number().int().positive(),

// Range validation
percentage: z.number().min(0).max(100),

// Coerce from string (for form inputs)
price: z.coerce.number().positive("Price must be positive"),
```

### Array Validation

```typescript
// Array of strings with min/max
tags: z.array(z.string()).min(1, "At least one tag required").max(10),

// Array of IDs
teamIds: z.array(z.string()).optional().default([]),

// Array with unique constraint (transform)
uniqueTags: z.array(z.string()).transform((arr) => [...new Set(arr)]),
```

### Object Validation

```typescript
// Nested object
metadata: z.object({
  source: z.string(),
  version: z.number(),
}).optional(),

// Record type
settings: z.record(z.string(), z.boolean()),

// Passthrough for unknown fields
config: z.object({
  enabled: z.boolean(),
}).passthrough(),
```

### Date Validation

```typescript
// ISO string date
createdAt: z.string().datetime(),

// Coerce to Date
startDate: z.coerce.date(),

// Date range validation
dateRange: z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
}).refine((data) => data.end > data.start, {
  message: "End date must be after start date",
}),
```

---

## Form Integration

### React Hook Form + Zod + shadcn/ui

```typescript
// src/components/forms/invite-user-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validators";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function InviteUserForm() {
  const invite = useMutation(api.users.invite);
  
  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      role: "user",
      teamIds: [],
    },
  });
  
  async function onSubmit(values: InviteUserInput) {
    try {
      await invite(values);
      form.reset();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to invite",
      });
    }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="user@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Inviting..." : "Invite User"}
        </Button>
      </form>
    </Form>
  );
}
```

---

## Convex Validation

### Validate in Mutations (Defense in Depth)

```typescript
// convex/users.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

// Convex validates types, but add business logic validation
export const invite = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    teamIds: v.optional(v.array(v.id("teams"))),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    
    // Business logic validation (Convex already validated types)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
      
    if (existingUser) {
      throw new Error("User with this email already exists");
    }
    
    // Validate teams exist
    if (args.teamIds) {
      for (const teamId of args.teamIds) {
        const team = await ctx.db.get(teamId);
        if (!team) {
          throw new Error(`Team ${teamId} not found`);
        }
      }
    }
    
    return await ctx.db.insert("users", {
      email: args.email,
      role: args.role,
      teamIds: args.teamIds ?? [],
      invitedBy: admin._id,
      createdAt: Date.now(),
    });
  },
});
```

### Reusing Zod Schemas with Convex

```typescript
// convex/lib/validators.ts
import { z } from "zod";
import { Validator } from "convex/values";

// Helper to convert Zod enum to Convex union
export function zodEnumToConvex<T extends [string, ...string[]]>(
  zodEnum: z.ZodEnum<T>
): Validator<T[number]> {
  const values = zodEnum.options;
  return v.union(...values.map((val) => v.literal(val)));
}

// Usage in mutation
import { userRoleSchema } from "@/lib/validators";

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: zodEnumToConvex(userRoleSchema),
  },
  handler: async (ctx, args) => {
    // ...
  },
});
```

---

## Error Handling

### Custom Error Messages

```typescript
const schema = z.object({
  email: z.string({
    required_error: "Email is required",
    invalid_type_error: "Email must be a string",
  }).email("Please enter a valid email address"),
});
```

### Formatting Zod Errors

```typescript
// src/lib/validators/utils.ts
import { ZodError } from "zod";

export function formatZodError(error: ZodError): string {
  return error.errors
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join(", ");
}

export function getFirstZodError(error: ZodError): string {
  return error.errors[0]?.message ?? "Validation failed";
}

// Usage
try {
  schema.parse(data);
} catch (error) {
  if (error instanceof ZodError) {
    throw new Error(formatZodError(error));
  }
  throw error;
}
```

### Safe Parse Pattern

```typescript
// For API routes where you want to return structured errors
export async function POST(req: Request) {
  const body = await req.json();
  
  const result = createUserSchema.safeParse(body);
  
  if (!result.success) {
    return NextResponse.json(
      { 
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }
  
  // result.data is fully typed
  const user = await createUser(result.data);
  return NextResponse.json(user);
}
```
