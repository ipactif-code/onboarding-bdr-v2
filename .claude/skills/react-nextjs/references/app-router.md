# App Router Reference

## Table of Contents

1. [File Conventions](#file-conventions)
2. [Route Groups](#route-groups)
3. [Layouts](#layouts)
4. [Navigation](#navigation)
5. [Metadata](#metadata)
6. [Loading & Error States](#loading--error-states)

## File Conventions

### Core Files

| File | Purpose | Component Type |
|------|---------|----------------|
| `page.tsx` | Route UI | Server (async) |
| `layout.tsx` | Shared UI wrapper | Server |
| `loading.tsx` | Loading UI (Suspense) | Server |
| `error.tsx` | Error boundary | Client ("use client") |
| `not-found.tsx` | 404 UI | Server |

### Project Structure

```
src/app/
├── (auth)/                    # Route group (no URL segment)
│   ├── sign-in/
│   │   └── page.tsx          # /sign-in
│   └── sign-up/
│       └── page.tsx          # /sign-up
├── (dashboard)/               # Route group with shared layout
│   ├── layout.tsx            # Shared dashboard layout
│   ├── courses/
│   │   ├── page.tsx          # /courses
│   │   ├── [courseId]/
│   │   │   ├── page.tsx      # /courses/[courseId]
│   │   │   └── course-view.tsx
│   │   └── new/
│   │       └── page.tsx      # /courses/new
│   └── settings/
│       └── page.tsx          # /settings
├── layout.tsx                 # Root layout
└── page.tsx                   # Home page /
```

## Route Groups

Route groups `(folder)` organize routes without affecting URL:

### Authentication vs Dashboard Split

```
src/app/
├── (auth)/                    # No auth required
│   ├── layout.tsx            # Minimal layout (no sidebar)
│   ├── sign-in/page.tsx
│   └── sign-up/page.tsx
├── (dashboard)/               # Auth required
│   ├── layout.tsx            # Full layout (sidebar + header)
│   ├── courses/page.tsx
│   └── settings/page.tsx
```

### Auth Layout (Minimal)

```tsx
// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
```

### Dashboard Layout (Full)

```tsx
// src/app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

## Layouts

### Root Layout (Required)

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LMS Platform",
  description: "Learning Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexClientProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
```

### Nested Layout with Params

```tsx
// src/app/(dashboard)/courses/[courseId]/layout.tsx
import { Tabs } from "@/components/ui/tabs";

export default function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { courseId: string };
}) {
  return (
    <div className="space-y-6">
      <CourseTabs courseId={params.courseId} />
      {children}
    </div>
  );
}
```

## Navigation

### Link Component

```tsx
import Link from "next/link";

// Basic link
<Link href="/courses">Courses</Link>

// Dynamic route
<Link href={`/courses/${courseId}`}>View Course</Link>

// With prefetch disabled (for less important links)
<Link href="/settings" prefetch={false}>Settings</Link>

// Replace history (no back button)
<Link href="/dashboard" replace>Dashboard</Link>
```

### Programmatic Navigation

```tsx
"use client";

import { useRouter } from "next/navigation";

export function NavigationExample() {
  const router = useRouter();
  
  const handleSubmit = async () => {
    await saveData();
    router.push("/courses");      // Navigate
    router.replace("/dashboard"); // Replace (no back)
    router.refresh();             // Refresh current route
    router.back();                // Go back
  };
}
```

### Active Link Pattern

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/courses", label: "Courses" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();
  
  return (
    <nav className="flex gap-4">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "text-muted-foreground hover:text-foreground",
            pathname === item.href && "text-foreground font-medium"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

## Metadata

### Static Metadata

```tsx
// src/app/(dashboard)/courses/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Courses | LMS",
  description: "Browse all available courses",
};

export default async function CoursesPage() {
  // ...
}
```

### Dynamic Metadata

```tsx
// src/app/(dashboard)/courses/[courseId]/page.tsx
import type { Metadata } from "next";

type Props = {
  params: { courseId: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await fetchCourse(params.courseId);
  
  return {
    title: `${course.title} | LMS`,
    description: course.description,
  };
}

export default async function CoursePage({ params }: Props) {
  // ...
}
```

## Loading & Error States

### Loading UI (Automatic Suspense)

```tsx
// src/app/(dashboard)/courses/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function CoursesLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}
```

### Error Boundary

```tsx
// src/app/(dashboard)/courses/error.tsx
"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CoursesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

### Not Found

```tsx
// src/app/(dashboard)/courses/[courseId]/not-found.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CourseNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <h2 className="text-xl font-semibold">Course not found</h2>
      <p className="text-muted-foreground">
        The course you're looking for doesn't exist.
      </p>
      <Button asChild>
        <Link href="/courses">Back to courses</Link>
      </Button>
    </div>
  );
}

// Trigger with notFound() in page.tsx:
import { notFound } from "next/navigation";

export default async function CoursePage({ params }: Props) {
  const course = await fetchCourse(params.courseId);
  if (!course) notFound();
  return <CourseView course={course} />;
}
```
