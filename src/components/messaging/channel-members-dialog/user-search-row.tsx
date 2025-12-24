"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OnlineIndicator } from "../online-indicator";

import type { UserSearchResult } from "./types";
import { getInitials } from "./helpers";

interface UserSearchRowProps {
  user: UserSearchResult;
  onSelect: () => void;
}

export function UserSearchRow({ user, onSelect }: UserSearchRowProps): React.ReactElement {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label={`Add ${user.name} to channel`}
    >
      <div className="relative">
        <Avatar className="size-9">
          <AvatarImage src={user.avatarUrl} alt={user.name} />
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <OnlineIndicator status={user.status} size="sm" showAsBadge />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{user.name}</p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
    </button>
  );
}
