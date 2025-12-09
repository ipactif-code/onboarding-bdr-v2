# 🎯 CLAUDE CODE INTEGRATION INSTRUCTIONS
**Task:** T099 - Admin Courses List  
**Source:** Figma Make - CourseListAdmin.tsx  
**Date:** 2025-12-08  
**Project:** Onboarding BDR Team v2 LMS

---

## 📚 SPEC-KIT REFERENCES

Before implementing, read these specification files:

```
specs/001-bdr-lms/contracts/courses.ts  → Course queries/mutations signatures
specs/001-bdr-lms/types/index.ts        → Course, Section types
convex/courses.ts                        → Actual implementation
convex/schema.ts                         → Database schema
```

---

## 📋 CONTEXT

Admin page to manage all courses with:
- Tabs to filter by status (Published, Drafts, Archived)
- Search functionality
- Data table with sortable columns
- Row selection with checkboxes
- Actions menu per row (Edit, Publish/Unpublish, Delete)
- Pagination
- "New Course" button

---

## 🏗️ LAYOUT STRUCTURE (from Figma)

```
┌─────────────────────────────────────────────────────────────────┐
│ Header (breadcrumb) - Already implemented                       │
├─────────────────────────────────────────────────────────────────┤
│  Courses                                        [+ New] button  │
├─────────────────────────────────────────────────────────────────┤
│  [Published] [Drafts] [Archived]           [Search...        ]  │
├─────────────────────────────────────────────────────────────────┤
│  ☐ │ Name          │ Last update │ Created │ Sections │ Status │ ... │
│  ──┼───────────────┼─────────────┼─────────┼──────────┼────────┼─────│
│  ☐ │ Course Name   │ 20 dec 2025 │ ...     │ 5        │ Draft  │ ⋯   │
│  ☐ │ Course Name   │ 20 dec 2025 │ ...     │ 3        │ Published│ ⋯ │
│  ... (10 rows per page)                                         │
├─────────────────────────────────────────────────────────────────┤
│                        [< Previous] [1] [2] [3] ... [Next >]    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 FILES TO CREATE

```
src/app/(dashboard)/admin/courses/
├── page.tsx                    → Server component wrapper
└── courses-list.tsx            → Client component with table

src/components/admin/
├── courses-table.tsx           → DataTable configuration
└── courses-table-columns.tsx   → Column definitions
```

---

## 🔧 IMPLEMENTATION

### File 1: `src/app/(dashboard)/admin/courses/page.tsx`

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CoursesList } from "./courses-list";

export default async function AdminCoursesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // TODO: Add admin role check here
  // const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  // if (user?.role !== "admin") redirect("/");

  return <CoursesList />;
}
```

---

### File 2: `src/app/(dashboard)/admin/courses/courses-list.tsx`

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CoursesTable } from "@/components/admin/courses-table";
import { toast } from "sonner";

type CourseStatus = "published" | "draft" | "archived";

export function CoursesList() {
  const [status, setStatus] = useState<CourseStatus>("published");
  const [search, setSearch] = useState("");

  // Fetch courses with filter
  const courses = useQuery(api.courses.list, { 
    status,
    search: search || undefined,
  });

  // Mutations
  const publishCourse = useMutation(api.courses.publish);
  const unpublishCourse = useMutation(api.courses.unpublish);
  const removeCourse = useMutation(api.courses.remove);

  // Handlers
  const handlePublish = async (courseId: Id<"courses">) => {
    try {
      await publishCourse({ courseId });
      toast.success("Course published");
    } catch (error) {
      toast.error("Failed to publish course");
    }
  };

  const handleUnpublish = async (courseId: Id<"courses">) => {
    try {
      await unpublishCourse({ courseId });
      toast.success("Course unpublished");
    } catch (error) {
      toast.error("Failed to unpublish course");
    }
  };

  const handleDelete = async (courseId: Id<"courses">) => {
    try {
      await removeCourse({ courseId });
      toast.success("Course deleted");
    } catch (error) {
      toast.error("Failed to delete course");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-neutral-950">Courses</h1>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="size-4 mr-2" />
            New
          </Link>
        </Button>
      </div>

      {/* Filters Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Status Tabs */}
        <Tabs value={status} onValueChange={(v) => setStatus(v as CourseStatus)}>
          <TabsList>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="relative w-[373px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {courses === undefined ? (
        <CoursesTableSkeleton />
      ) : (
        <CoursesTable
          courses={courses}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function CoursesTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
```

---

### File 3: `src/components/admin/courses-table-columns.tsx`

```tsx
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Globe, GlobeLock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface CourseRow {
  _id: Id<"courses">;
  title: string;
  status: "draft" | "published" | "archived";
  updatedAt: number;
  createdAt: number;
  sectionsCount: number;
  lessonsCount: number;
}

interface ColumnOptions {
  onPublish: (id: Id<"courses">) => void;
  onUnpublish: (id: Id<"courses">) => void;
  onDelete: (id: Id<"courses">) => void;
}

export function getColumns(options: ColumnOptions): ColumnDef<CourseRow>[] {
  return [
    // Checkbox column
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 32,
    },

    // Name column
    {
      accessorKey: "title",
      header: "Name",
      cell: ({ row }) => (
        <Link
          href={`/admin/courses/${row.original._id}`}
          className="font-medium hover:underline"
        >
          {row.getValue("title")}
        </Link>
      ),
    },

    // Last update column
    {
      accessorKey: "updatedAt",
      header: "Last update",
      cell: ({ row }) => format(new Date(row.getValue("updatedAt")), "dd MMM yyyy"),
    },

    // Creation date column
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => format(new Date(row.getValue("createdAt")), "dd MMM yyyy"),
    },

    // Sections count column
    {
      accessorKey: "sectionsCount",
      header: "Sections",
      cell: ({ row }) => row.getValue("sectionsCount"),
    },

    // Lessons count column
    {
      accessorKey: "lessonsCount",
      header: "Lessons",
      cell: ({ row }) => row.getValue("lessonsCount"),
    },

    // Status column
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const variants: Record<string, { label: string; className: string }> = {
          published: { label: "Published", className: "bg-green-100 text-green-800" },
          draft: { label: "Draft", className: "bg-neutral-100 text-neutral-800" },
          archived: { label: "Archived", className: "bg-red-100 text-red-800" },
        };
        const variant = variants[status] || variants.draft;
        return (
          <Badge variant="secondary" className={variant.className}>
            {variant.label}
          </Badge>
        );
      },
    },

    // Actions column
    {
      id: "actions",
      cell: ({ row }) => {
        const course = row.original;
        const isPublished = course.status === "published";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/courses/${course._id}/edit`}>
                  <Pencil className="size-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              
              {isPublished ? (
                <DropdownMenuItem onClick={() => options.onUnpublish(course._id)}>
                  <GlobeLock className="size-4 mr-2" />
                  Unpublish
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => options.onPublish(course._id)}>
                  <Globe className="size-4 mr-2" />
                  Publish
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-red-600"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete course?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{course.title}" and all its
                      sections and lessons. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => options.onDelete(course._id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 64,
    },
  ];
}
```

---

### File 4: `src/components/admin/courses-table.tsx`

```tsx
"use client";

import { useState } from "react";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Id } from "@/convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CourseRow, getColumns } from "./courses-table-columns";

interface CoursesTableProps {
  courses: CourseRow[];
  onPublish: (id: Id<"courses">) => void;
  onUnpublish: (id: Id<"courses">) => void;
  onDelete: (id: Id<"courses">) => void;
}

export function CoursesTable({
  courses,
  onPublish,
  onUnpublish,
  onDelete,
}: CoursesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const columns = getColumns({ onPublish, onUnpublish, onDelete });

  const table = useReactTable({
    data: courses,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-lg border border-neutral-200">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No courses found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="size-4 mr-1" />
          Previous
        </Button>
        
        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: table.getPageCount() }, (_, i) => i + 1)
            .slice(0, 5) // Show max 5 pages
            .map((page) => (
              <Button
                key={page}
                variant={
                  table.getState().pagination.pageIndex === page - 1
                    ? "outline"
                    : "ghost"
                }
                size="icon"
                className="size-9"
                onClick={() => table.setPageIndex(page - 1)}
              >
                {page}
              </Button>
            ))}
          {table.getPageCount() > 5 && (
            <span className="px-2 text-neutral-400">...</span>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
          <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>

      {/* Selection info */}
      {Object.keys(rowSelection).length > 0 && (
        <div className="text-sm text-neutral-500">
          {Object.keys(rowSelection).length} of {courses.length} row(s) selected
        </div>
      )}
    </div>
  );
}
```

---

## 📦 SHADCN COMPONENTS USED

All already installed:
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `Tabs`, `TabsList`, `TabsTrigger`
- `Button`
- `Input`
- `Checkbox`
- `Badge`
- `DropdownMenu` + items
- `AlertDialog` + items
- `Skeleton`

---

## 🔄 CONVEX API INTEGRATION

```tsx
// Query courses (already exists)
api.courses.list({ status, search })

// Returns:
{
  _id: Id<"courses">,
  title: string,
  status: "draft" | "published" | "archived",
  updatedAt: number,
  createdAt: number,
  sectionsCount: number,
  lessonsCount: number,
}[]

// Mutations (already exist)
api.courses.publish({ courseId })
api.courses.unpublish({ courseId })
api.courses.remove({ courseId })
```

---

## ✅ SUCCESS CRITERIA

- [ ] Page shows at route `/admin/courses`
- [ ] Title "Courses" with "New" button links to `/admin/courses/new`
- [ ] Tabs filter by status: Published, Drafts, Archived
- [ ] Search input filters by course name
- [ ] Table shows columns: checkbox, name, last update, created, sections, lessons, status, actions
- [ ] Row checkboxes allow selection
- [ ] Course name links to edit page
- [ ] Status badges with correct colors
- [ ] Actions dropdown: Edit, Publish/Unpublish, Delete
- [ ] Delete shows confirmation dialog
- [ ] Pagination works with 10 rows per page
- [ ] Loading skeleton while data fetches
- [ ] Empty state when no courses match filters
- [ ] Toast notifications on actions

---

## ⚠️ IMPORTANT NOTES

1. **Sidebar/Header removed** - Already in layout (T028)
2. **TanStack Table** - Already installed, use for sorting/filtering/pagination
3. **date-fns** - Install if not present: `npm install date-fns`
4. **Admin role check** - Add middleware or page-level check
5. **Bulk actions** - Future enhancement: add toolbar when rows selected

---

**End of Instructions**
