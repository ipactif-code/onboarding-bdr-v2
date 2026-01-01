# 🎯 CLAUDE CODE INTEGRATION INSTRUCTIONS
**Task:** User Courses List Page  
**Source:** Figma Make - CourseListUser.tsx, App.tsx  
**Date:** 2025-12-08  
**Project:** Onboarding BDR Team v2 LMS

---

## 📚 SPEC-KIT REFERENCES

Before implementing, read these specification files:

```
specs/001-bdr-lms/contracts/courses.ts    → Course queries
specs/001-bdr-lms/types/index.ts          → Course types
convex/courses.ts                          → Courses implementation
convex/progress.ts                         → User progress tracking
convex/schema.ts                           → Database schema
```

---

## 📋 CONTEXT

Page where Users browse all available courses. Features:
- Search courses by title
- Filter courses (by category, status, etc.)
- Horizontal carousels for different sections
- "My courses to complete" (enrolled with progress)
- "The last courses" (recently added)
- Categories with course counts
- Click card to navigate to course detail

---

## 🏗️ LAYOUT STRUCTURE (from Figma)

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: [◀] | Courses                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Courses                          [Search............] [Filter] │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ My courses to complete                          [◀] [▶]    ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            ││
│  │ │  Image  │ │  Image  │ │  Image  │ │  Image  │  →scroll   ││
│  │ │         │ │         │ │         │ │         │            ││
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘            ││
│  │ Title       Title       Title       Title                  ││
│  │ Description Description Description Description           ││
│  │ ████ 78%    ████ 45%    ████ 90%    ████ 12%              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ The last courses                                [◀] [▶]    ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            ││
│  │ │  Image  │ │  Image  │ │  Image  │ │  Image  │  →scroll   ││
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘            ││
│  │ Title       Title       Title       Title                  ││
│  │ Description Description Description Description           ││
│  │ ████ 78%    ████ 45%    ████ 90%    ████ 12%              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Categories                                      [◀] [▶]    ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            ││
│  │ │  Image  │ │  Image  │ │  Image  │ │  Image  │            ││
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘            ││
│  │ Title       Title       Title       Title                  ││
│  │ Description Description Description Description           ││
│  │ Tools • 32  Sales • 18  Product •15 Support •22            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 FILES TO CREATE

```
src/app/(dashboard)/courses/
├── page.tsx                      → Server component with auth check
└── courses-list.tsx              → Main client component

src/components/courses/
├── course-section.tsx            → Section with title + carousel
├── course-carousel.tsx           → Horizontal scroll container
├── course-card.tsx               → Individual course card (reuse if exists)
├── category-card.tsx             → Category card variant
└── course-filters.tsx            → Filter popover/dropdown
```

---

## 🔧 DETAILED IMPLEMENTATION

### File 1: `src/app/(dashboard)/courses/page.tsx`

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CoursesList } from "./courses-list";

export default async function CoursesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <CoursesList />;
}
```

---

### File 2: `src/app/(dashboard)/courses/courses-list.tsx`

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CourseSection } from "@/components/courses/course-section";
import { CourseFilters } from "@/components/courses/course-filters";
import { Skeleton } from "@/components/ui/skeleton";

export function CoursesList() {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch user's enrolled courses with progress
  const myCoursesData = useQuery(api.courses.listUserCourses, {
    search: search || undefined,
  });

  // Fetch all published courses (recent)
  const recentCoursesData = useQuery(api.courses.listPublished, {
    search: search || undefined,
    limit: 10,
  });

  // Fetch categories with course counts
  const categoriesData = useQuery(api.categories.listWithCounts, {});

  const isLoading =
    myCoursesData === undefined ||
    recentCoursesData === undefined ||
    categoriesData === undefined;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Title + Search + Filter */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">
          Courses
        </h1>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* Filter Button */}
          <CourseFilters
            open={showFilters}
            onOpenChange={setShowFilters}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>
      </div>

      {/* Course Sections */}
      {isLoading ? (
        <CoursesListSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          {/* My courses to complete */}
          {myCoursesData && myCoursesData.length > 0 && (
            <CourseSection
              title="My courses to complete"
              courses={myCoursesData}
              showProgress
            />
          )}

          {/* The last courses */}
          {recentCoursesData && recentCoursesData.length > 0 && (
            <CourseSection
              title="The last courses"
              courses={recentCoursesData}
              showProgress
            />
          )}

          {/* Categories (if available) */}
          {categoriesData && categoriesData.length > 0 && (
            <CourseSection
              title="Browse by category"
              categories={categoriesData}
              variant="category"
            />
          )}

          {/* Empty state */}
          {!myCoursesData?.length &&
            !recentCoursesData?.length &&
            !categoriesData?.length && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-neutral-500">No courses available yet.</p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function CoursesListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Section skeleton */}
      {[1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-px w-full" />
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex flex-col gap-3 w-[278px]">
                <Skeleton className="h-[177px] w-full rounded-xl" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-32" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### File 3: `src/components/courses/course-section.tsx`

```tsx
"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CourseCarousel } from "./course-carousel";
import { Id } from "@/convex/_generated/dataModel";

interface Course {
  _id: Id<"courses">;
  title: string;
  description?: string;
  coverImage?: string;
  progress?: number; // 0-100
}

interface Category {
  _id: Id<"categories">;
  name: string;
  description?: string;
  coverImage?: string;
  courseCount: number;
}

interface CourseSectionProps {
  title: string;
  courses?: Course[];
  categories?: Category[];
  variant?: "course" | "category";
  showProgress?: boolean;
}

export function CourseSection({
  title,
  courses,
  categories,
  variant = "course",
  showProgress = false,
}: CourseSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-neutral-950 tracking-tight">
          {title}
        </h2>

        {/* Navigation arrows */}
        <div className="flex gap-2 px-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            onClick={scrollLeft}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            onClick={scrollRight}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Separator */}
      <Separator />

      {/* Carousel */}
      <CourseCarousel
        ref={scrollRef}
        courses={courses}
        categories={categories}
        variant={variant}
        showProgress={showProgress}
      />
    </div>
  );
}
```

---

### File 4: `src/components/courses/course-carousel.tsx`

```tsx
"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { CourseCard } from "./course-card";
import { CategoryCard } from "./category-card";

interface Course {
  _id: Id<"courses">;
  title: string;
  description?: string;
  coverImage?: string;
  progress?: number;
}

interface Category {
  _id: Id<"categories">;
  name: string;
  description?: string;
  coverImage?: string;
  courseCount: number;
}

interface CourseCarouselProps {
  courses?: Course[];
  categories?: Category[];
  variant?: "course" | "category";
  showProgress?: boolean;
}

export const CourseCarousel = forwardRef<HTMLDivElement, CourseCarouselProps>(
  ({ courses, categories, variant = "course", showProgress = false }, ref) => {
    return (
      <div
        ref={ref}
        className="flex gap-6 overflow-x-auto pb-2 scrollbar-hide"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {variant === "course" &&
          courses?.map((course) => (
            <Link
              key={course._id}
              href={`/courses/${course._id}`}
              className="shrink-0"
            >
              <CourseCard
                title={course.title}
                description={course.description}
                coverImage={course.coverImage}
                progress={showProgress ? course.progress : undefined}
              />
            </Link>
          ))}

        {variant === "category" &&
          categories?.map((category) => (
            <Link
              key={category._id}
              href={`/courses?category=${category._id}`}
              className="shrink-0"
            >
              <CategoryCard
                name={category.name}
                description={category.description}
                coverImage={category.coverImage}
                courseCount={category.courseCount}
              />
            </Link>
          ))}
      </div>
    );
  }
);

CourseCarousel.displayName = "CourseCarousel";
```

---

### File 5: `src/components/courses/course-card.tsx`

```tsx
"use client";

import Image from "next/image";

interface CourseCardProps {
  title: string;
  description?: string;
  coverImage?: string;
  progress?: number; // 0-100, only shown if provided
}

export function CourseCard({
  title,
  description,
  coverImage,
  progress,
}: CourseCardProps) {
  return (
    <div className="flex flex-col gap-3 w-[278px]">
      {/* Cover Image */}
      <div className="h-[177px] relative rounded-xl overflow-hidden bg-neutral-100">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400">
            <span className="text-4xl">📚</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2">
        {/* Title */}
        <p className="text-sm font-semibold text-neutral-950 line-clamp-1">
          {title}
        </p>

        {/* Description */}
        {description && (
          <p className="text-xs text-neutral-500 leading-4 line-clamp-2">
            {description}
          </p>
        )}

        {/* Progress Bar (optional) */}
        {progress !== undefined && (
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 h-2 w-20 rounded-lg overflow-hidden">
              <div
                className="bg-green-600 opacity-80 h-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <span className="text-xs text-neutral-500">
              {progress}% complete
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### File 6: `src/components/courses/category-card.tsx`

```tsx
"use client";

import Image from "next/image";

interface CategoryCardProps {
  name: string;
  description?: string;
  coverImage?: string;
  courseCount: number;
}

export function CategoryCard({
  name,
  description,
  coverImage,
  courseCount,
}: CategoryCardProps) {
  return (
    <div className="flex flex-col gap-3 w-[278px]">
      {/* Cover Image */}
      <div className="h-[177px] relative rounded-xl overflow-hidden bg-neutral-100">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400">
            <span className="text-4xl">📁</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2">
        {/* Title */}
        <p className="text-sm font-semibold text-neutral-950 line-clamp-1">
          {name}
        </p>

        {/* Description */}
        {description && (
          <p className="text-xs text-neutral-500 leading-4 line-clamp-2">
            {description}
          </p>
        )}

        {/* Category info: Name • Course count */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">{name}</span>
          <svg className="size-2" fill="#737373" viewBox="0 0 8 8">
            <circle cx="4" cy="4" r="2" />
          </svg>
          <span className="text-xs text-neutral-500">
            {courseCount} course{courseCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
```

---

### File 7: `src/components/courses/course-filters.tsx`

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

interface CourseFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CourseFilters({
  open,
  onOpenChange,
  selectedCategory,
  onCategoryChange,
}: CourseFiltersProps) {
  // Fetch categories for filter options
  const categories = useQuery(api.categories.list, {});

  const handleClear = () => {
    onCategoryChange(null);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 gap-2">
          <SlidersHorizontal className="size-4" />
          Filter
          {selectedCategory && (
            <Badge variant="secondary" className="ml-1 rounded-full px-1.5">
              1
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64" align="end">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            {selectedCategory && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-neutral-500"
                onClick={handleClear}
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Category</Label>
            <RadioGroup
              value={selectedCategory || ""}
              onValueChange={(value) =>
                onCategoryChange(value === "" ? null : value)
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="" id="all" />
                <Label htmlFor="all" className="text-sm font-normal">
                  All categories
                </Label>
              </div>
              {categories?.map((category) => (
                <div key={category._id} className="flex items-center space-x-2">
                  <RadioGroupItem value={category._id} id={category._id} />
                  <Label htmlFor={category._id} className="text-sm font-normal">
                    {category.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

## 🔄 CONVEX API INTEGRATION

```tsx
// User's enrolled courses with progress
api.courses.listUserCourses({ search? })
// Returns:
{
  _id: Id<"courses">,
  title: string,
  description?: string,
  coverImage?: string,
  progress: number, // calculated from user's lesson completions
}[]

// All published courses (recent)
api.courses.listPublished({ search?, limit?, categoryId? })
// Returns:
{
  _id: Id<"courses">,
  title: string,
  description?: string,
  coverImage?: string,
}[]

// Categories with course counts
api.categories.listWithCounts({})
// Returns:
{
  _id: Id<"categories">,
  name: string,
  description?: string,
  coverImage?: string,
  courseCount: number,
}[]

// Categories list (for filters)
api.categories.list({})
// Returns:
{
  _id: Id<"categories">,
  name: string,
}[]
```

---

## 📦 SHADCN COMPONENTS USED

All already installed:
- `Button`
- `Input`
- `Separator`
- `Skeleton`
- `Popover`, `PopoverContent`, `PopoverTrigger`
- `RadioGroup`, `RadioGroupItem`
- `Label`
- `Badge`

---

## 🎨 STYLING SPECIFICATIONS

### Course Card (w-[278px])
```css
/* Image container */
h-[177px] rounded-xl overflow-hidden bg-neutral-100

/* Title */
text-sm font-semibold text-neutral-950 line-clamp-1

/* Description */
text-xs text-neutral-500 leading-4 line-clamp-2

/* Progress bar */
h-2 w-20 rounded-lg bg-gray-100
/* Progress fill: bg-green-600 opacity-80 */

/* Progress text */
text-xs text-neutral-500
```

### Section Header
```css
/* Title */
text-2xl font-semibold text-neutral-950 tracking-tight

/* Nav buttons */
size-8 rounded-full (Button variant="outline")
```

### Carousel Container
```css
flex gap-6 overflow-x-auto pb-2
/* Hide scrollbar */
scrollbar-width: none;
-ms-overflow-style: none;
```

---

## ✅ SUCCESS CRITERIA

- [ ] Page accessible at `/courses`
- [ ] Search filters courses by title in real-time
- [ ] "My courses to complete" shows enrolled courses with progress bars
- [ ] "The last courses" shows recently published courses
- [ ] Categories section shows category cards with course counts (if categories exist)
- [ ] Carousel navigation arrows scroll left/right smoothly
- [ ] Course cards link to `/courses/[id]`
- [ ] Category cards filter courses by category
- [ ] Filter popover shows category options
- [ ] Filter badge shows count when filter active
- [ ] Loading skeletons display properly
- [ ] Empty state when no courses
- [ ] Progress bars show correct percentages (green fill)
- [ ] Cards have proper hover states
- [ ] Responsive on different screen sizes

---

## ⚠️ IMPORTANT NOTES

1. **Sidebar removed** - Already in layout (T028)
2. **CourseCard reuse** - May already exist from T051, update if needed
3. **Progress calculation** - Aggregate from completed lessons
4. **Categories** - May not exist yet, section hidden if empty
5. **Horizontal scroll** - Hide scrollbar for cleaner look
6. **Image optimization** - Use Next.js Image component

---

## 🐛 TROUBLESHOOTING

**Issue:** Progress not showing
- **Solution:** Ensure `listUserCourses` returns `progress` field calculated from completions

**Issue:** Carousel arrows not scrolling
- **Solution:** Check `scrollRef` is attached to the correct div

**Issue:** Cards not clickable
- **Solution:** Ensure Link wraps the entire card component

**Issue:** Categories not loading
- **Solution:** Create `api.categories.listWithCounts` query if missing

---

**End of Instructions**
