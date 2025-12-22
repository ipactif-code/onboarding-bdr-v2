# Caching Strategies

## Table of Contents
1. [Convex Reactivity (Built-in Cache)](#convex-reactivity-built-in-cache)
2. [Next.js Data Cache](#nextjs-data-cache)
3. [ISR (Incremental Static Regeneration)](#isr-incremental-static-regeneration)
4. [Client-Side Caching](#client-side-caching)
5. [Image and Asset Caching](#image-and-asset-caching)

---

## Convex Reactivity (Built-in Cache)

Convex provides automatic real-time caching. Queries are cached and automatically invalidated when underlying data changes.

### How It Works

```tsx
"use client";

function CourseProgress() {
  // This query is:
  // 1. Cached automatically
  // 2. Re-run when progress table changes
  // 3. Shared across components using same query
  const progress = useQuery(api.progress.get, { courseId });
  
  // No manual cache invalidation needed!
}
```

### Optimizing Convex Cache

```typescript
// ✅ GOOD - Fine-grained query (only re-runs when this course changes)
export const getCourseProgress = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("progress")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
  },
});

// ❌ BAD - Coarse query (re-runs when ANY progress changes)
export const getAllProgress = query({
  handler: async (ctx) => {
    return ctx.db.query("progress").collect();
  },
});
```

### Skip Queries When Not Needed

```tsx
// Query only runs when courseId is defined
const progress = useQuery(
  api.progress.get,
  courseId ? { courseId } : "skip"
);
```

---

## Next.js Data Cache

### Static Data Fetching

```tsx
// app/courses/[id]/page.tsx
export async function generateStaticParams() {
  // Pre-generate popular course pages at build time
  const popularCourses = await getPopularCourses();
  return popularCourses.map(course => ({ id: course._id }));
}

export default async function CoursePage({ params }: { params: { id: string } }) {
  // This fetch is cached at build time
  const course = await fetchCourseDetails(params.id);
  return <CourseDetails course={course} />;
}
```

### Revalidation Strategies

```tsx
// Option 1: Time-based revalidation
export const revalidate = 3600; // Revalidate every hour

// Option 2: On-demand revalidation
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const { path, tag } = await request.json();
  
  if (path) {
    revalidatePath(path);
  }
  if (tag) {
    revalidateTag(tag);
  }
  
  return Response.json({ revalidated: true });
}
```

### Cache Tags

```tsx
// Fetch with cache tag
async function getCourse(id: string) {
  const response = await fetch(`${API_URL}/courses/${id}`, {
    next: { tags: [`course-${id}`] },
  });
  return response.json();
}

// Revalidate specific course
await revalidateTag(`course-${courseId}`);
```

---

## ISR (Incremental Static Regeneration)

### When to Use ISR

| Content Type | Strategy | Revalidation |
|--------------|----------|--------------|
| Marketing pages | ISR | 1 hour |
| Course catalog | ISR | 15 minutes |
| Course content | ISR + On-demand | On publish |
| User dashboard | Dynamic (no ISR) | Real-time |

### ISR Configuration

```tsx
// app/courses/page.tsx
export const revalidate = 900; // 15 minutes

export default async function CoursesPage() {
  const courses = await getPublishedCourses();
  return <CourseGrid courses={courses} />;
}
```

### On-Demand ISR with Convex

```typescript
// convex/courses.ts
export const publish = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.courseId, { status: "published" });
    
    // Trigger Next.js revalidation
    await ctx.scheduler.runAfter(0, api.revalidation.triggerRevalidate, {
      path: `/courses/${args.courseId}`,
    });
  },
});

// convex/revalidation.ts
export const triggerRevalidate = action({
  args: { path: v.string() },
  handler: async (ctx, args) => {
    await fetch(`${process.env.NEXT_PUBLIC_URL}/api/revalidate`, {
      method: "POST",
      body: JSON.stringify({ path: args.path }),
    });
  },
});
```

---

## Client-Side Caching

### Stable Query Keys

```tsx
// ✅ GOOD - Stable object reference
const queryArgs = useMemo(
  () => ({ courseId, filters }),
  [courseId, filters]
);
const data = useQuery(api.courses.list, queryArgs);

// ❌ BAD - New object every render
const data = useQuery(api.courses.list, { courseId, filters });
```

### Prefetching

```tsx
"use client";
import { preloadQuery } from "convex/react";

function CourseCard({ course }: { course: Course }) {
  // Prefetch course details on hover
  const prefetchDetails = () => {
    preloadQuery(api.courses.getDetails, { courseId: course._id });
  };
  
  return (
    <Link 
      href={`/courses/${course._id}`}
      onMouseEnter={prefetchDetails}
    >
      {course.title}
    </Link>
  );
}
```

### Optimistic Updates

```tsx
"use client";

function LessonCheckbox({ lessonId, completed }: Props) {
  const [optimisticCompleted, setOptimisticCompleted] = useState(completed);
  const markComplete = useMutation(api.progress.markComplete);
  
  const handleToggle = async () => {
    // Optimistic update
    setOptimisticCompleted(!optimisticCompleted);
    
    try {
      await markComplete({ lessonId });
    } catch {
      // Rollback on error
      setOptimisticCompleted(completed);
    }
  };
  
  return (
    <Checkbox 
      checked={optimisticCompleted} 
      onCheckedChange={handleToggle} 
    />
  );
}
```

---

## Image and Asset Caching

### Next.js Image Optimization

```tsx
import Image from "next/image";

// Images are automatically:
// 1. Optimized (WebP/AVIF)
// 2. Lazy loaded
// 3. Cached at edge

<Image
  src={course.thumbnailUrl}
  alt={course.title}
  width={400}
  height={225}
  placeholder="blur"
  blurDataURL={course.blurDataUrl}  // Pre-generated blur hash
/>
```

### Image Loader for Convex Storage

```tsx
// lib/image-loader.ts
export function convexImageLoader({ src, width, quality }: ImageLoaderProps) {
  // Convex storage URLs are already CDN-optimized
  return src;
}

// next.config.ts
const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
    ],
  },
};
```

### Static Asset Headers

```typescript
// next.config.ts
const config: NextConfig = {
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};
```

---

## Caching Decision Matrix

| Data Type | Strategy | TTL | Invalidation |
|-----------|----------|-----|--------------|
| User-specific data | Convex reactivity | Real-time | Automatic |
| Course content | ISR + Convex | 15 min | On publish |
| Marketing pages | ISR | 1 hour | On deploy |
| Static assets | Immutable cache | 1 year | File hash |
| API responses | Next.js cache | Varies | On-demand |

---

## Checklist

- [ ] Convex queries are fine-grained (avoid "get all" queries)
- [ ] `useQuery` uses stable args (with useMemo if needed)
- [ ] Public pages use ISR with appropriate revalidation
- [ ] On-demand revalidation configured for content updates
- [ ] Images use next/image with proper sizing
- [ ] Static assets have immutable cache headers
- [ ] Optimistic updates for interactive elements
