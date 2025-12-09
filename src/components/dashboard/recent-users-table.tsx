"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  team?: string;
  coursesCompleted: number;
  totalCourses: number;
  role: "user" | "admin";
}

interface RecentUsersTableProps {
  users: User[];
}

const roleConfig = {
  user: { label: "User", className: "bg-neutral-100 text-neutral-900" },
  admin: { label: "Administrator", className: "bg-neutral-900 text-neutral-50" },
};

export function RecentUsersTable({ users }: RecentUsersTableProps) {
  return (
    <div className="rounded-lg border border-neutral-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teams</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="w-[64px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const progress = user.totalCourses > 0
              ? Math.round((user.coursesCompleted / user.totalCourses) * 100)
              : 0;
            const role = roleConfig[user.role];

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>
                        {user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-neutral-500">{user.email}</TableCell>
                <TableCell className="text-neutral-500">
                  {user.team || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500">{progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("font-semibold", role.className)}>
                    {role.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View profile</DropdownMenuItem>
                      <DropdownMenuItem>Send message</DropdownMenuItem>
                      <DropdownMenuItem>Edit role</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
