---
name: performance
description: >
  Performance optimization patterns for Next.js 15 + React 19 + Convex applications.
  Covers Core Web Vitals (LCP, INP, CLS), bundle optimization, Convex query optimization
  with indexes, and caching strategies. Use when working on files in next.config.ts,
  convex/**/*.ts, app/**/*.tsx. Use when asked to optimize, improve performance, reduce
  bundle, speed up. Triggers on keywords - performance, Core Web Vitals, LCP, CLS, INP,
  bundle size, lazy loading, index, withIndex, slow, lent.
---

# Performance Optimization

## Quick Start

### Constitution VI - Performance Thresholds

| Metric | Target | Critical |
|--------|--------|----------|
| LCP | < 2.5s | > 4s |
| INP | < 200ms | > 500ms |
| CLS | < 0.1 | > 0.25 |
| Bundle | < 150KB gzipped | > 250KB |

### Audit Commands

```bash
# Bundle analysis
npx @next/bundle-analyzer

# Lighthouse CLI
npx lighthouse http://localhost:3000 --view

# Convex query performance
npx convex dashboard  # Check "Functions" tab for slow queries
```

## Decision Tree: Server vs Client Component

```
Start
  │
  ├─ Does component need interactivity (onClick, useState, useEffect)?
  │   ├─ NO → Server Component (default, no directive needed)
  │   └─ YES → Continue
  │
  ├─ Can interactivity be isolated to a small child?
  │   ├─ YES → Server Component parent + Client child
  │   └─ NO → "use client" directive
  │
  └─ Does component use Convex hooks (useQuery, useMutation)?
      ├─ YES → "use client" required
      └─ NO → Prefer Server Component
```

**Pattern: Server Component with Client Island**

```tsx
// app/courses/page.tsx - Server Component (default)
export default async function CoursesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  
  return (
    <div>
      <h1>Courses</h1>
      <CoursesList /> {/* Client component for Convex reactivity */}
    </div>
  );
}

// components/courses-list.tsx
"use client";
export function CoursesList() {
  const courses = useQuery(api.courses.list);
  if (courses === undefined) return <CoursesListSkeleton />;
  // ...
}
```

## Strict Rules

### Rule 1: Skeleton Loading (Mandatory)

Every component using `useQuery` MUST handle the undefined state with a skeleton:

```tsx
// ✅ REQUIRED pattern
function Component() {
  const data = useQuery(api.data.get);
  
  if (data === undefined) {
    return <ComponentSkeleton />;
  }
  
  return <ActualContent data={data} />;
}

// Skeleton component pattern
function ComponentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
```

### Rule 2: Convex Indexes (Mandatory for tables > 100 docs)

```typescript
// schema.ts - Define indexes
export default defineSchema({
  sections: defineTable({
    courseId: v.id("courses"),
    order: v.number(),
    title: v.string(),
  }).index("by_course_order", ["courseId", "order"]),
});

// ✅ REQUIRED - Use withIndex
const sections = await ctx.db
  .query("sections")
  .withIndex("by_course_order", (q) => q.eq("courseId", args.courseId))
  .collect();

// ❌ FORBIDDEN - Full table scan
const sections = await ctx.db
  .query("sections")
  .filter((q) => q.eq(q.field("courseId"), args.courseId))
  .collect();
```

### Rule 3: Image Optimization (Mandatory)

```tsx
// ✅ REQUIRED - next/image with sizing
import Image from "next/image";

<Image
  src={course.imageUrl}
  alt={course.title}
  width={400}
  height={225}
  className="rounded-lg"
  priority={isAboveTheFold}  // Only for LCP images
/>

// ❌ FORBIDDEN - Native img tag
<img src={course.imageUrl} alt={course.title} />
```

## Reference Guides

Load these references when deeper optimization is needed:

- **Bundle too large?** → See [references/bundle-optimization.md](references/bundle-optimization.md) for code splitting, lazy loading, tree shaking
- **Slow queries?** → See [references/query-optimization.md](references/query-optimization.md) for Convex indexes, pagination, N+1 prevention
- **Caching strategy?** → See [references/caching-strategies.md](references/caching-strategies.md) for ISR, cache headers, Convex reactivity

## Common Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| `"use client"` at page level | Extract interactive parts to child components |
| `useQuery` without skeleton | Add `if (data === undefined) return <Skeleton />` |
| `.filter()` on Convex queries | Add index and use `.withIndex()` |
| Large component imports | Use `dynamic()` with `ssr: false` for heavy components |
| Inline SVGs in bundles | Move to `/public` or use sprite sheet |
