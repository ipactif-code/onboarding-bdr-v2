# Server Components Reference

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Data Fetching Patterns](#data-fetching-patterns)
3. [Authentication Pattern](#authentication-pattern)
4. [Composition Patterns](#composition-patterns)
5. [Common Mistakes](#common-mistakes)

## Core Concepts

Server Components are the default in Next.js 15 App Router. They:
- Run only on the server
- Have zero client-side JavaScript bundle impact
- Can directly access server resources (databases, file system, env vars)
- Cannot use hooks, event handlers, or browser APIs

### When to Use Server Components

| Use Case | Server Component? |
|----------|-------------------|
| Fetching data | ✅ Yes |
| Auth checks | ✅ Yes |
| Accessing backend resources | ✅ Yes |
| Rendering static content | ✅ Yes |
| Interactive UI | ❌ No (use Client) |
| Using hooks | ❌ No (use Client) |
| Browser APIs | ❌ No (use Client) |

## Data Fetching Patterns

### Direct Async Component

```tsx
// src/app/(dashboard)/users/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchUsers } from "@/lib/api/users";
import { UsersView } from "./users-view";

export default async function UsersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  
  // Direct data fetching - no useEffect needed
  const users = await fetchUsers();
  
  return <UsersView initialUsers={users} />;
}
```

### Parallel Data Fetching

```tsx
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  
  // Parallel fetching for better performance
  const [stats, recentActivity, notifications] = await Promise.all([
    fetchStats(userId),
    fetchRecentActivity(userId),
    fetchNotifications(userId),
  ]);
  
  return (
    <DashboardView 
      stats={stats}
      recentActivity={recentActivity}
      notifications={notifications}
    />
  );
}
```

### Streaming with Suspense

```tsx
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default async function CoursePage({ params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  
  return (
    <div className="space-y-6">
      {/* Immediate render */}
      <CourseHeader courseId={params.id} />
      
      {/* Streamed - doesn't block initial render */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <CourseContent courseId={params.id} />
      </Suspense>
      
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <CourseComments courseId={params.id} />
      </Suspense>
    </div>
  );
}

// This component can be async and will stream
async function CourseContent({ courseId }: { courseId: string }) {
  const content = await fetchCourseContent(courseId); // Slow query
  return <ContentRenderer content={content} />;
}
```

## Authentication Pattern

### Standard Auth Check

```tsx
// Always use this pattern in pages
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }
  
  // userId is now guaranteed to exist
  return <ProtectedContent userId={userId} />;
}
```

### Role-Based Access

```tsx
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.role === "admin";
  
  if (!isAdmin) {
    redirect("/dashboard"); // Redirect non-admins
  }
  
  return <AdminDashboard />;
}
```

## Composition Patterns

### Server Component Wrapping Client Component

```tsx
// page.tsx (Server Component)
import { auth } from "@clerk/nextjs/server";
import { fetchCourseData } from "@/lib/api";
import { CourseEditor } from "./course-editor"; // Client Component

export default async function EditCoursePage({ params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  
  // Fetch data on server
  const course = await fetchCourseData(params.id);
  
  // Pass serializable data to Client Component
  return <CourseEditor initialData={course} courseId={params.id} />;
}
```

### Children Pattern

```tsx
// layout.tsx (Server Component)
import { Sidebar } from "./sidebar"; // Client Component

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar /> {/* Client Component */}
      <main className="flex-1">
        {children} {/* Can be Server or Client Components */}
      </main>
    </div>
  );
}
```

## Common Mistakes

### ❌ Using Hooks in Server Components

```tsx
// WRONG - will error
export default async function Page() {
  const [state, setState] = useState([]); // ❌ Cannot use hooks
  const data = useQuery(api.items.list); // ❌ Cannot use hooks
}
```

### ❌ Event Handlers in Server Components

```tsx
// WRONG - will error
export default async function Page() {
  return (
    <button onClick={() => console.log("click")}> {/* ❌ No event handlers */}
      Click me
    </button>
  );
}
```

### ❌ Passing Functions to Client Components

```tsx
// WRONG - functions are not serializable
export default async function Page() {
  const handleClick = () => console.log("click");
  return <ClientComponent onClick={handleClick} />; // ❌ Will error
}

// CORRECT - pass only serializable data
export default async function Page() {
  const data = await fetchData();
  return <ClientComponent data={data} />; // ✅ Data is serializable
}
```

### ✅ Correct Pattern Summary

```tsx
// page.tsx (Server Component)
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FeatureView } from "./feature-view";

export default async function FeaturePage() {
  // 1. Auth check
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  
  // 2. Optional: Server-side data fetching
  // const data = await fetchData();
  
  // 3. Render Client Component (View)
  return <FeatureView /* initialData={data} */ />;
}
```
