"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { Search, Users } from "lucide-react";

import type { Id } from "../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  MemberModerationActions,
  type ChannelRole,
} from "./member-moderation-actions";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../convex/_generated/api").api;

// ============================================================================
// Types
// ============================================================================

export interface ChannelMembersPanelProps {
  /**
   * The channel ID.
   */
  channelId: Id<"channels">;
  /**
   * Whether the panel is open.
   */
  open: boolean;
  /**
   * Callback when the open state changes.
   */
  onOpenChange: (open: boolean) => void;
}

interface ChannelMember {
  _id: Id<"channelMembers">;
  userId: Id<"users">;
  role: string;
  joinedAt: number;
  isMuted: boolean;
  mutedUntil?: number;
  isBanned: boolean;
  bannedAt?: number;
  user: {
    name: string;
    imageUrl?: string;
  };
}

interface MembersQueryResult {
  members: ChannelMember[];
  nextCursor?: string;
  hasMore: boolean;
}

// Role display configuration
const ROLE_CONFIG: Record<
  ChannelRole,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  owner: { label: "Owner", variant: "default" },
  admin: { label: "Admin", variant: "default" },
  moderator: { label: "Mod", variant: "secondary" },
  member: { label: "Member", variant: "outline" },
};

// ============================================================================
// ChannelMembersPanel Component
// ============================================================================

/**
 * Sheet panel for managing channel members.
 *
 * Features:
 * - Search members by name
 * - Paginated member list
 * - Role badges
 * - Mute/Ban status indicators
 * - Moderation actions dropdown
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <Button onClick={() => setOpen(true)}>
 *   Manage Members
 * </Button>
 *
 * <ChannelMembersPanel
 *   channelId={channelId}
 *   open={open}
 *   onOpenChange={setOpen}
 * />
 * ```
 */
export function ChannelMembersPanel({
  channelId,
  open,
  onOpenChange,
}: ChannelMembersPanelProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCursor(undefined); // Reset pagination on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch members with pagination
  const membersResult = useQuery(
    api.channels.moderation.getChannelMembersWithPagination,
    open
      ? {
          channelId,
          limit: 20,
          cursor,
          searchQuery: debouncedSearch || undefined,
        }
      : "skip"
  ) as MembersQueryResult | undefined;

  // Get current user for permission checks
  const currentUser = useQuery(api.users.me);

  // Get viewer's role in the channel
  const channel = useQuery(
    api.channels.get,
    open ? { channelId } : "skip"
  );

  const isLoading =
    membersResult === undefined ||
    currentUser === undefined ||
    channel === undefined;

  const viewerRole = channel?.membership?.role as ChannelRole | undefined;
  const isGlobalAdmin = currentUser?.role === "admin";

  // Load more members
  const loadMore = useCallback(() => {
    if (membersResult?.nextCursor) {
      setCursor(membersResult.nextCursor);
    }
  }, [membersResult?.nextCursor]);

  // Reset state when panel closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setDebouncedSearch("");
      setCursor(undefined);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="size-5" aria-hidden="true" />
            Manage Members
          </SheetTitle>
          <SheetDescription>
            View and manage channel members, including muting and banning.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4 overflow-hidden h-[calc(100%-8rem)]">
          {/* Search input */}
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search members"
            />
          </div>

          {/* Member list */}
          <div
            className="flex-1 overflow-y-auto"
            role="list"
            aria-label="Channel members"
          >
            {isLoading ? (
              <MemberListSkeleton />
            ) : membersResult.members.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {debouncedSearch
                  ? "No members found matching your search."
                  : "No members in this channel."}
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  {membersResult.members.map((member) => (
                    <MemberRow
                      key={member._id}
                      member={member}
                      channelId={channelId}
                      viewerRole={
                        isGlobalAdmin
                          ? "owner"
                          : viewerRole || ("member" as ChannelRole)
                      }
                    />
                  ))}
                </div>

                {/* Load more button */}
                {membersResult.hasMore && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMore}
                      disabled={!membersResult.nextCursor}
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// MemberRow Component
// ============================================================================

interface MemberRowProps {
  member: ChannelMember;
  channelId: Id<"channels">;
  viewerRole: ChannelRole;
}

function MemberRow({
  member,
  channelId,
  viewerRole,
}: MemberRowProps): React.ReactElement {
  const roleConfig = ROLE_CONFIG[member.role as ChannelRole] || ROLE_CONFIG.member;

  // Format mute time remaining
  const getMuteTimeRemaining = (): string | null => {
    if (!member.isMuted || !member.mutedUntil) return null;
    const remaining = member.mutedUntil - Date.now();
    if (remaining <= 0) return null;

    const minutes = Math.ceil(remaining / (60 * 1000));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.ceil(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.ceil(hours / 24);
    return `${days}d`;
  };

  const muteTimeRemaining = getMuteTimeRemaining();

  // Get user initials for avatar fallback
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      role="listitem"
      data-slot="member-row"
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50",
        member.isBanned && "opacity-60"
      )}
    >
      {/* Avatar */}
      <Avatar size="default">
        {member.user.imageUrl ? (
          <AvatarImage
            src={member.user.imageUrl}
            alt={member.user.name}
          />
        ) : null}
        <AvatarFallback>{getInitials(member.user.name)}</AvatarFallback>
      </Avatar>

      {/* Name and status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">
            {member.user.name}
          </span>
          <Badge variant={roleConfig.variant} className="shrink-0">
            {roleConfig.label}
          </Badge>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-2 mt-0.5">
          {member.isBanned && (
            <span className="text-xs text-destructive">Banned</span>
          )}
          {member.isMuted && !member.isBanned && muteTimeRemaining && (
            <span className="text-xs text-amber-600 dark:text-amber-500">
              Muted ({muteTimeRemaining} remaining)
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <MemberModerationActions
        channelId={channelId}
        userId={member.userId}
        userName={member.user.name}
        memberRole={member.role as ChannelRole}
        isMuted={member.isMuted}
        mutedUntil={member.mutedUntil}
        isBanned={member.isBanned}
        viewerRole={viewerRole}
      />
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function MemberListSkeleton(): React.ReactElement {
  return (
    <div
      data-slot="member-list-skeleton"
      className="space-y-2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading members</span>
    </div>
  );
}

export { MemberListSkeleton };
