"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Id } from "../../../../convex/_generated/dataModel";
import { MoreHorizontal, Crown, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { format } from "date-fns";

export interface MemberRow {
  _id: Id<"users">;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "user" | "admin";
  status: "online" | "offline" | "away";
  isLead: boolean;
  joinedAt: number;
}

interface ColumnOptions {
  onRemove: (userId: Id<"users">) => void;
  onSetLead: (userId: Id<"users">) => void;
  currentLeadId?: Id<"users">;
}

export function getColumns(options: ColumnOptions): ColumnDef<MemberRow>[] {
  return [
    // Member column (avatar + name + email)
    {
      accessorKey: "name",
      header: "Member",
      cell: ({ row }) => {
        const member = row.original;
        const initials = member.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase();

        return (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="size-9">
                <AvatarImage src={member.avatarUrl} alt={member.name} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              {/* Status indicator */}
              <span
                className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white ${
                  member.status === "online"
                    ? "bg-green-500"
                    : member.status === "away"
                    ? "bg-yellow-500"
                    : "bg-neutral-300"
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-900">{member.name}</span>
                {member.isLead && (
                  <Badge variant="secondary" className="text-xs">
                    <Crown className="size-3 mr-1" />
                    Lead
                  </Badge>
                )}
              </div>
              <span className="text-sm text-neutral-500">{member.email}</span>
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
                  : "bg-neutral-300"
              }`}
            />
            <span className="text-neutral-600 capitalize">{status}</span>
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
          <span className="text-neutral-500">
            {format(new Date(joinedAt), "MMM d, yyyy")}
          </span>
        );
      },
    },

    // Actions column
    {
      id: "actions",
      cell: ({ row }) => {
        const member = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!member.isLead && (
                <DropdownMenuItem onClick={() => options.onSetLead(member._id)}>
                  <UserCheck className="size-4 mr-2" />
                  Make Team Lead
                </DropdownMenuItem>
              )}

              {!member.isLead && <DropdownMenuSeparator />}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-red-600"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Remove from Team
                  </DropdownMenuItem>
                </AlertDialogTrigger>
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
                      onClick={() => options.onRemove(member._id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Remove
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
