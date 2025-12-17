"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Id } from "../../../../convex/_generated/dataModel";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "@/components/ui/alert-dialog";

export interface UserRow {
  _id: Id<"users">;
  clerkId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "user" | "admin";
  teamCount: number;
  overallProgress: number;
}

interface ColumnOptions {
  onDelete: (id: Id<"users">, clerkId: string) => void;
  currentClerkId: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Extracted Actions Cell Component to enable useState for controlled AlertDialog
interface UserActionsCellProps {
  user: UserRow;
  currentClerkId: string;
  onDelete: (id: Id<"users">, clerkId: string) => void;
}

function UserActionsCell({
  user,
  currentClerkId,
  onDelete,
}: UserActionsCellProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // User cannot delete themselves
  const canDelete = user.clerkId !== currentClerkId;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8" />
          }
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Pencil className="size-4" data-icon="inline-start" />
            Edit
          </DropdownMenuItem>

          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600"
              >
                <Trash2 className="size-4" data-icon="inline-start" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canDelete && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{user.name}&quot; and remove
                all team associations. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(user._id, user.clerkId)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

export function getColumns(options: ColumnOptions): ColumnDef<UserRow>[] {
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

    // User column (Avatar + Name)
    {
      accessorKey: "name",
      header: "User",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={row.original.avatarUrl} />
            <AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },

    // Email column
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue("email")}</span>
      ),
    },

    // Teams column
    {
      accessorKey: "teamCount",
      header: "Teams",
      cell: ({ row }) => {
        const count = row.getValue("teamCount") as number;
        return (
          <span className="text-muted-foreground">
            {count} {count === 1 ? "team" : "teams"}
          </span>
        );
      },
    },

    // Progress column
    {
      accessorKey: "overallProgress",
      header: "Progress",
      cell: ({ row }) => {
        const progress = row.getValue("overallProgress") as number;
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-sm text-muted-foreground w-10 text-right">
              {progress}%
            </span>
          </div>
        );
      },
    },

    // Role column
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.getValue("role") as string;
        return (
          <Badge variant={role === "admin" ? "default" : "secondary"}>
            {role === "admin" ? "Admin" : "User"}
          </Badge>
        );
      },
    },

    // Actions column - using extracted component for controlled AlertDialog
    {
      id: "actions",
      cell: ({ row }) => (
        <UserActionsCell
          user={row.original}
          currentClerkId={options.currentClerkId}
          onDelete={options.onDelete}
        />
      ),
      size: 64,
    },
  ];
}
