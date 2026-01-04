"use client";

import { useState, type ReactElement } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export interface TeamRow {
  _id: Id<"teams">;
  name: string;
  description?: string;
  leadId?: Id<"users">;
  leadName?: string;
  memberCount: number;
}

interface ColumnOptions {
  onDelete: (id: Id<"teams">) => void;
}

// Extracted Actions Cell Component to enable useState for controlled AlertDialog
interface TeamActionsCellProps {
  team: TeamRow;
  onDelete: (id: Id<"teams">) => void;
}

function TeamActionsCell({ team, onDelete }: TeamActionsCellProps): ReactElement {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
          <DropdownMenuItem
            render={<Link href={`/admin/teams/${team._id}`} />}
          >
            <Pencil className="size-4" data-icon="inline-start" />
            Edit
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600"
          >
            <Trash2 className="size-4" data-icon="inline-start" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{team.name}&quot; and remove
              all member associations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(team._id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function getColumns(options: ColumnOptions): ColumnDef<TeamRow>[] {
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

    // Team name column
    {
      accessorKey: "name",
      header: "Team Name",
      cell: ({ row }) => (
        <Link
          href={`/admin/teams/${row.original._id}`}
          className="font-medium hover:underline"
        >
          {row.getValue("name")}
        </Link>
      ),
    },

    // Description column
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const description = row.getValue("description") as string | undefined;
        return (
          <span className="text-muted-foreground line-clamp-1 max-w-[300px]">
            {description || "—"}
          </span>
        );
      },
    },

    // Team lead column
    {
      accessorKey: "leadName",
      header: "Team Lead",
      cell: ({ row }) => {
        const leadName = row.getValue("leadName") as string | undefined;
        return <span className="text-muted-foreground">{leadName || "—"}</span>;
      },
    },

    // Members count column
    {
      accessorKey: "memberCount",
      header: "Members",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Users className="size-4 text-muted-foreground" />
          <span>{row.getValue("memberCount")}</span>
        </div>
      ),
    },

    // Actions column - using extracted component for controlled AlertDialog
    {
      id: "actions",
      cell: ({ row }) => (
        <TeamActionsCell team={row.original} onDelete={options.onDelete} />
      ),
      size: 64,
    },
  ];
}
