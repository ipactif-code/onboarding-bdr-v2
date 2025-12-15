"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Pencil,
  Globe,
  GlobeLock,
  Trash2,
} from "lucide-react";
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
  description?: string;
  coverImageUrl?: string;
  status: "draft" | "published";
  visibility: "all_teams" | "specific_teams" | "specific_users";
  displayOrder: number;
  viewCount: number;
  sectionCount: number;
  lessonCount: number;
  tags: Array<{ _id: Id<"tags">; name: string }>;
  publishedAt?: number;
  _creationTime: number;
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

    // Published date column
    {
      accessorKey: "publishedAt",
      header: "Published",
      cell: ({ row }) => {
        const publishedAt = row.getValue("publishedAt") as number | undefined;
        return publishedAt
          ? format(new Date(publishedAt), "dd MMM yyyy")
          : "—";
      },
    },

    // Creation date column
    {
      accessorKey: "_creationTime",
      header: "Created",
      cell: ({ row }) =>
        format(new Date(row.getValue("_creationTime")), "dd MMM yyyy"),
    },

    // Sections count column
    {
      accessorKey: "sectionCount",
      header: "Sections",
      cell: ({ row }) => row.getValue("sectionCount"),
    },

    // Lessons count column
    {
      accessorKey: "lessonCount",
      header: "Lessons",
      cell: ({ row }) => row.getValue("lessonCount"),
    },

    // Status column
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const variants: Record<string, { label: string; className: string }> = {
          published: {
            label: "Published",
            className: "bg-green-100 text-green-800",
          },
          draft: { label: "Draft", className: "bg-muted text-foreground" },
        };
        const variant = variants[status] ?? variants.draft;
        return (
          <Badge variant="secondary" className={variant?.className}>
            {variant?.label}
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
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Open menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/admin/courses/${course._id}`} />}>
                <Pencil className="size-4" data-icon="inline-start" />
                Edit
              </DropdownMenuItem>

              {isPublished ? (
                <DropdownMenuItem onClick={() => options.onUnpublish(course._id)}>
                  <GlobeLock className="size-4" data-icon="inline-start" />
                  Unpublish
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => options.onPublish(course._id)}>
                  <Globe className="size-4" data-icon="inline-start" />
                  Publish
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <AlertDialog>
                <AlertDialogTrigger render={<DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600" />}>
                  <Trash2 className="size-4" data-icon="inline-start" />
                  Delete
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete course?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &quot;{course.title}&quot; and
                      all its sections and lessons. This action cannot be undone.
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
