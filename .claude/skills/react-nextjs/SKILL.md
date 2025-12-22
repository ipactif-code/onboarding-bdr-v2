---
name: react-nextjs
description: React 19 and Next.js 15 App Router patterns for the LMS project. Provides Server/Client Component separation, Convex hooks patterns, and form handling with React Hook Form + Zod + shadcn/ui. Use when working on files in src/app/**/*.tsx or src/components/**/*.tsx, when creating pages, components, or forms, or when React, Next.js, Server Component, Client Component, page, layout, or form patterns are needed.
---

# React & Next.js Patterns

## Stack

- Next.js 15.5.7, React 19.2.1, TypeScript 5.x (strict)
- React Hook Form ^7.68.0, Zod ^4.1.13, Convex ^1

## Quick Start

### Page Pattern (Server Component)

```tsx
// src/app/(dashboard)/[feature]/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FeatureView } from "./feature-view";

export default async function FeaturePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <FeatureView />;
}
```

### View Pattern (Client Component)

```tsx
// src/app/(dashboard)/[feature]/feature-view.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";

export function FeatureView() {
  const data = useQuery(api.feature.list);
  if (data === undefined) return <Skeleton className="h-32 w-full" />;
  return (/* JSX */);
}
```

### Validator Pattern

```typescript
// src/lib/validators/[domain].ts
import { z } from "zod";

export const createItemSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
```

## Decision Trees

### Server vs Client Component?

```
Need hooks, events, or browser APIs?
├─ YES → Client Component ("use client")
│   └─ Examples: useQuery, useState, onClick, useEffect
└─ NO → Server Component (default)
    └─ Examples: data fetching, auth checks, static content
```

### When to add "use client"?

```
File uses ANY of these?
├─ React hooks (useState, useEffect, useCallback, useMemo)
├─ Convex hooks (useQuery, useMutation, useAction)
├─ Event handlers (onClick, onChange, onSubmit)
├─ Browser APIs (localStorage, window, document)
└─ YES to any → Add "use client" at line 1
```

### useCallback/useMemo in React 19?

```
React 19 compiler auto-memoizes. Manual memoization needed only when:
├─ Passing callback to native element with expensive re-render → useCallback
├─ Computing value used in dependency array → useMemo
├─ Complex computation (>1ms) on every render → useMemo
└─ Otherwise → Skip memoization, let compiler handle it
```

## Strict Rules

| Context | Rule |
|---------|------|
| Pages | Server Components only. Use `async function`, no hooks. Auth check + redirect + render View. |
| Views | Client Components. `"use client"`, hooks, event handlers. Named export `FeatureView`. |
| Loading | `data === undefined` → render `<Skeleton />` |
| Errors | Use `toast.error()` from sonner. Never `alert()` or `console.error()` for user feedback. |
| Forms | shadcn Form + zodResolver. See [references/forms.md](references/forms.md). |
| Mutations | `useMutation` + `toast.success()`/`toast.error()` in try/catch. |

## Project Conventions

| Category | Convention |
|----------|------------|
| Imports | `@/components/`, `@/hooks/`, `@/lib/` aliases |
| Validators | `src/lib/validators/[domain].ts` |
| Types | `z.infer<typeof schema>` (never manual interfaces for form data) |
| Icons | Lucide React only |
| Toast | sonner only |
| UI | `@/components/ui/*` primitives. Never create new UI primitives. |
| Classnames | `cn()` from `@/lib/utils` for conditional classes |

## References

Load these as needed for detailed patterns:

- **Server Components**: [references/server-components.md](references/server-components.md) - RSC patterns, data fetching, async components
- **App Router**: [references/app-router.md](references/app-router.md) - Layouts, route groups, navigation, metadata
- **Hooks Patterns**: [references/hooks-patterns.md](references/hooks-patterns.md) - Custom hooks with Convex, optimistic updates
- **Forms**: [references/forms.md](references/forms.md) - React Hook Form + Zod + shadcn complete patterns
