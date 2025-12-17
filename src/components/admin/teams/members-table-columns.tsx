"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Id } from "../../../../convex/_generated/dataModel";
import { format } from "date-fns";
import { MoreHorizontal, Trash2, UserCheck, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export interface MemberRow {
  _id: Id<"users">;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "user" | "admin";
  status: "online" | "offline" | "away";
  joinedAt: number;
  isLead: boolean;
}

interface ColumnOptions {
  onSetLead: (id: Id<"users">) => void;
  onRemove: (id: Id<"users">) => void;
  currentLeadId?: Id<"users">;
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
interface MemberActionsCellProps {
  member: MemberRow;
  onSetLead: (id: Id<"users">) => void;
  onRemove: (id: Id<"users">) => void;
}

function MemberActionsCell({
  member,
  onSetLead,
  onRemove,
}: MemberActionsCellProps) {
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

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
          {!member.isLead && (
            <DropdownMenuItem onClick={() => onSetLead(member._id)}>
              <UserCheck className="size-4" data-icon="inline-start" />
              Make Team Lead
            </DropdownMenuItem>
          )}

          {!member.isLead && <DropdownMenuSeparator />}

          <DropdownMenuItem
            onClick={() => setShowRemoveDialog(true)}
            className="text-red-600"
          >
            <Trash2 className="size-4" data-icon="inline-start" />
            Remove from Team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{member.name}&quot; from the team.
              {member.isLead && " They are currently the team lead."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onRemove(member._id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function getColumns(options: ColumnOptions): ColumnDef<MemberRow>[] {
  return [
    // Member column (Avatar + Name)
    {
      accessorKey: "name",
      header: "Member",
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="size-9">
                <AvatarImage src={member.avatarUrl} alt={member.name} />
                <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
              </Avatar>
              {/* Status indicator */}
              <span
                className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white ${
                  member.status === "online"
                    ? "bg-green-500"
                    : member.status === "away"
                      ? "bg-yellow-500"
                      : "bg-muted"
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {member.name}
                </span>
                {member.isLead && (
                  <Badge variant="secondary" className="text-xs">
                    <Crown className="size-3 mr-1" />
                    Lead
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {member.email}
              </span>
            </div>
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
          <Badge variant={role === "admin" ? "default" : "outline"}>
            {role === "admin" ? "Admin" : "User"}
          </Badge>
        );
      },
    },

    // Status column
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                status === "online"
                  ? "bg-green-500"
                  : status === "away"
                    ? "bg-yellow-500"
                    : "bg-muted"
              }`}
            />
            <span className="text-muted-foreground capitalize">{status}</span>
          </div>
        );
      },
    },

    // Joined date column
    {
      accessorKey: "joinedAt",
      header: "Joined",
      cell: ({ row }) => {
        const joinedAt = row.getValue("joinedAt") as number;
        return (
          <span className="text-muted-foreground">
            {format(new Date(joinedAt), "MMM d, yyyy")}
          </span>
        );
      },
    },

    // Actions column - using extracted component for controlled AlertDialog
    {
      id: "actions",
      cell: ({ row }) => (
        <MemberActionsCell
          member={row.original}
          onSetLead={options.onSetLead}
          onRemove={options.onRemove}
        />
      ),
      size: 64,
    },
  ];
}
