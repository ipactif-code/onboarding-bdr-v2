"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { Settings, Search } from "lucide-react";

import type { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportHistoryDialog } from "@/components/channels/admin/export-history-dialog";
import {
  MemberModerationActions,
  type ChannelRole,
} from "@/components/channels/admin/member-moderation-actions";

// ============================================================================
// Types
// ============================================================================

export interface ChannelSettingsDialogProps {
  /**
   * The ID of the channel to configure.
   */
  channelId: Id<"channels">;
  /**
   * Whether the dialog is open.
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

// Helper function to get user initials for avatar fallback
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// ChannelSettingsDialog Component
// ============================================================================

/**
 * ChannelSettingsDialog provides a tabbed interface for channel configuration.
 *
 * Tabs:
 * - Details: Edit channel name, description, and topic
 * - Members: View and manage channel members
 * - Advanced: Archive or delete the channel
 *
 * Permission checks:
 * - Only channel owners, admins, or global admins can access full settings
 * - Regular members see a read-only view or permission denied message
 *
 * @example
 * ```tsx
 * const [settingsOpen, setSettingsOpen] = useState(false);
 *
 * <ChannelSettingsDialog
 *   channelId={channelId}
 *   open={settingsOpen}
 *   onOpenChange={setSettingsOpen}
 * />
 * ```
 */
export function ChannelSettingsDialog({
  channelId,
  open,
  onOpenChange,
}: ChannelSettingsDialogProps): React.ReactElement {
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(memberSearchQuery);
      setCursor(undefined); // Reset pagination on search
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearchQuery]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setMemberSearchQuery("");
      setDebouncedSearch("");
      setCursor(undefined);
    }
  }, [open]);

  // Fetch channel data
  const channel = useQuery(api.channels.get, open ? { channelId } : "skip");

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

  // Fetch current user to check global admin status
  const currentUser = useQuery(api.users.me);

  // Loading state
  const isLoading =
    channel === undefined ||
    membersResult === undefined ||
    currentUser === undefined;

  // Permission check: owner, admin, moderator of channel OR global admin
  const userRole = channel?.membership?.role;
  const isGlobalAdmin = currentUser?.role === "admin";
  const canManageChannel =
    userRole === "owner" ||
    userRole === "admin" ||
    userRole === "moderator" ||
    isGlobalAdmin;

  // Viewer role for member moderation actions
  const viewerRole: ChannelRole = isGlobalAdmin
    ? "owner"
    : (userRole as ChannelRole) || "member";

  // Load more members callback
  const loadMore = useCallback(() => {
    if (membersResult?.nextCursor) {
      setCursor(membersResult.nextCursor);
    }
  }, [membersResult?.nextCursor]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-2xl")} showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5" aria-hidden="true" />
            Channel Settings
          </DialogTitle>
          <DialogDescription>
            Manage channel details, members, and advanced options.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <ChannelSettingsDialogSkeleton />
        ) : !channel ? (
          <div className="py-8 text-center text-muted-foreground">
            Channel not found or you don&apos;t have access.
          </div>
        ) : !canManageChannel ? (
          <div className="py-8 text-center text-muted-foreground">
            You don&apos;t have permission to manage this channel.
          </div>
        ) : (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="members">
                Members ({membersResult?.members.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4">
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Details form will go here
              </div>
            </TabsContent>

            <TabsContent value="members" className="mt-4">
              <div className="space-y-4">
                {/* Search input */}
                <div className="relative">
                  <Search
                    className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    placeholder="Search members..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="pl-9"
                    aria-label="Search members"
                  />
                </div>

                {/* Member list */}
                <div
                  className="max-h-80 overflow-y-auto rounded-lg border"
                  role="list"
                  aria-label="Channel members"
                >
                  {membersResult === undefined ? (
                    <MemberListSkeleton />
                  ) : membersResult.members.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      {debouncedSearch
                        ? "No members found matching your search."
                        : "No members in this channel."}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {membersResult.members.map((member) => {
                        const roleConfig =
                          ROLE_CONFIG[member.role as ChannelRole] ||
                          ROLE_CONFIG.member;
                        const muteTimeRemaining = getMuteTimeRemaining(member);

                        return (
                          <div
                            key={member._id}
                            role="listitem"
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
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
                              <AvatarFallback>
                                {getInitials(member.user.name)}
                              </AvatarFallback>
                            </Avatar>

                            {/* Name and status */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {member.user.name}
                                </span>
                                <Badge
                                  variant={roleConfig.variant}
                                  className="shrink-0"
                                >
                                  {roleConfig.label}
                                </Badge>
                              </div>

                              {/* Status indicators */}
                              <div className="mt-0.5 flex items-center gap-2">
                                {member.isBanned && (
                                  <span className="text-xs text-destructive">
                                    Banned
                                  </span>
                                )}
                                {member.isMuted &&
                                  !member.isBanned &&
                                  muteTimeRemaining && (
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
                      })}
                    </div>
                  )}
                </div>

                {/* Load more button */}
                {membersResult?.hasMore && (
                  <div className="flex justify-center">
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
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="mt-4">
              <div className="space-y-4">
                {/* Export History Section */}
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-medium">Export Channel History</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Download all messages from this channel in JSON or CSV format.
                  </p>
                  <div className="mt-3">
                    <ExportHistoryDialog channelId={channelId} />
                  </div>
                </div>

                {/* Placeholder for other advanced options */}
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Additional advanced options (archive, delete, etc.) will be added here.
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate remaining mute time for a member.
 */
function getMuteTimeRemaining(member: ChannelMember): string | null {
  if (!member.isMuted || !member.mutedUntil) return null;
  const remaining = member.mutedUntil - Date.now();
  if (remaining <= 0) return null;

  const minutes = Math.ceil(remaining / (60 * 1000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.ceil(hours / 24);
  return `${days}d`;
}

// ============================================================================
// Skeleton Components
// ============================================================================

function ChannelSettingsDialogSkeleton(): React.ReactElement {
  return (
    <div
      data-slot="channel-settings-dialog-skeleton"
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>

      <span className="sr-only">Loading channel settings</span>
    </div>
  );
}

function MemberListSkeleton(): React.ReactElement {
  return (
    <div
      data-slot="member-list-skeleton"
      className="divide-y"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
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

export { ChannelSettingsDialogSkeleton, MemberListSkeleton };
