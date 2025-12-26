"use client";

import * as React from "react";
import {
  MoreVertical,
  UserMinus,
  ShieldCheck,
  Shield,
  User,
  Crown,
  Check,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OnlineIndicator } from "../online-indicator";

import type { ChannelRole, MemberInfo } from "./types";
import { getRoleBadgeVariant, getRoleLabel, getInitials, canManageMember, canChangeRoles } from "./helpers";

interface MemberRowProps {
  member: MemberInfo;
  userRole?: ChannelRole;
  isActionInProgress: boolean;
  onRemove: () => void;
  onChangeRole: (newRole: "admin" | "moderator" | "member") => void;
}

export function MemberRow({
  member,
  userRole,
  isActionInProgress,
  onRemove,
  onChangeRole,
}: MemberRowProps): React.ReactElement {
  const showActions = canManageMember(userRole, member.role);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2",
        "hover:bg-accent/50 transition-colors"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="size-9">
          <AvatarImage src={member.userAvatarUrl} alt={member.userName} />
          <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
        </Avatar>
        <OnlineIndicator status={member.userStatus} size="sm" showAsBadge />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{member.userName}</p>
          {member.role !== "member" && (
            <Badge variant={getRoleBadgeVariant(member.role)} className="shrink-0 text-xs">
              {member.role === "owner" && <Crown className="mr-1 size-3" aria-hidden="true" />}
              {getRoleLabel(member.role)}
            </Badge>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">{member.userEmail}</p>
      </div>

      {showActions && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
            disabled={isActionInProgress}
            aria-label={`Manage ${member.userName}`}
          >
            {isActionInProgress ? (
              <Loader2 className="size-4 animate-spin" aria-label="Processing action" />
            ) : (
              <MoreVertical className="size-4" aria-hidden="true" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canChangeRoles(userRole) && (
              <>
                <DropdownMenuItem onClick={() => onChangeRole("admin")} disabled={member.role === "admin"}>
                  <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
                  Make Admin
                  {member.role === "admin" && <Check className="ml-auto size-4" aria-hidden="true" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChangeRole("moderator")} disabled={member.role === "moderator"}>
                  <Shield className="mr-2 size-4" aria-hidden="true" />
                  Make Moderator
                  {member.role === "moderator" && <Check className="ml-auto size-4" aria-hidden="true" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChangeRole("member")} disabled={member.role === "member"}>
                  <User className="mr-2 size-4" aria-hidden="true" />
                  Make Member
                  {member.role === "member" && <Check className="ml-auto size-4" aria-hidden="true" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
              <UserMinus className="mr-2 size-4" aria-hidden="true" />
              Remove from channel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
