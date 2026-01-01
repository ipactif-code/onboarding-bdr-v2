"use client";

import * as React from "react";
import { useState } from "react";
import {
  MoreHorizontal,
  VolumeX,
  Volume2,
  Ban,
  UserCheck,
  Loader2,
  Clock,
} from "lucide-react";

import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useChannelModeration } from "@/hooks/use-channel-moderation";

// ============================================================================
// Types
// ============================================================================

export type ChannelRole = "owner" | "admin" | "moderator" | "member";

export interface MemberModerationActionsProps {
  /**
   * The channel ID.
   */
  channelId: Id<"channels">;
  /**
   * The target member's user ID.
   */
  userId: Id<"users">;
  /**
   * The target member's name (for display in dialogs).
   */
  userName: string;
  /**
   * The target member's role in the channel.
   */
  memberRole: ChannelRole;
  /**
   * Whether the member is currently muted.
   */
  isMuted: boolean;
  /**
   * When the mute expires (timestamp in ms).
   */
  mutedUntil?: number;
  /**
   * Whether the member is currently banned.
   */
  isBanned: boolean;
  /**
   * The current user's role in the channel.
   */
  viewerRole: ChannelRole;
  /**
   * Optional additional class name.
   */
  className?: string;
}

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<ChannelRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

// Mute duration options
const MUTE_DURATIONS = [
  { label: "15 minutes", minutes: 15 },
  { label: "1 hour", minutes: 60 },
  { label: "24 hours", minutes: 1440 },
  { label: "7 days", minutes: 10080 },
  { label: "Custom...", minutes: -1 },
] as const;

// ============================================================================
// MemberModerationActions Component
// ============================================================================

/**
 * Dropdown menu with moderation actions for a channel member.
 *
 * Actions available based on viewer permissions:
 * - Mute/Unmute (moderator+, cannot mute equal/higher role)
 * - Ban/Unban (admin+ only, cannot ban owner)
 *
 * @example
 * ```tsx
 * <MemberModerationActions
 *   channelId={channelId}
 *   userId={member.userId}
 *   userName={member.user.name}
 *   memberRole={member.role as ChannelRole}
 *   isMuted={member.isMuted}
 *   mutedUntil={member.mutedUntil}
 *   isBanned={member.isBanned}
 *   viewerRole="admin"
 * />
 * ```
 */
export function MemberModerationActions({
  channelId,
  userId,
  userName,
  memberRole,
  isMuted,
  mutedUntil: _mutedUntil,
  isBanned,
  viewerRole,
  className,
}: MemberModerationActionsProps): React.ReactElement | null {
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showCustomMuteDialog, setShowCustomMuteDialog] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [customMuteMinutes, setCustomMuteMinutes] = useState("");

  const { muteMember, unmuteMember, banMember, unbanMember, isLoading } =
    useChannelModeration({ channelId });

  // Permission checks
  const viewerRoleLevel = ROLE_HIERARCHY[viewerRole];
  const memberRoleLevel = ROLE_HIERARCHY[memberRole];

  // Can mute: viewer is moderator+ and target has lower role
  const canMute =
    viewerRoleLevel >= ROLE_HIERARCHY.moderator &&
    memberRoleLevel < viewerRoleLevel &&
    memberRole !== "owner";

  // Can ban: viewer is admin+ and target is not owner
  const canBan =
    viewerRoleLevel >= ROLE_HIERARCHY.admin && memberRole !== "owner";

  // If viewer has no moderation permissions, don't show the menu
  const hasAnyPermission = canMute || canBan;
  if (!hasAnyPermission) {
    return null;
  }

  // Handle mute with preset duration
  const handleMute = async (minutes: number): Promise<void> => {
    if (minutes === -1) {
      setShowCustomMuteDialog(true);
      return;
    }
    await muteMember(userId, minutes);
  };

  // Handle custom mute duration
  const handleCustomMute = async (): Promise<void> => {
    const minutes = parseInt(customMuteMinutes, 10);
    if (isNaN(minutes) || minutes <= 0) {
      return;
    }
    await muteMember(userId, minutes);
    setShowCustomMuteDialog(false);
    setCustomMuteMinutes("");
  };

  // Handle unmute
  const handleUnmute = async (): Promise<void> => {
    await unmuteMember(userId);
  };

  // Handle ban
  const handleBan = async (): Promise<void> => {
    await banMember(userId, banReason || undefined);
    setShowBanDialog(false);
    setBanReason("");
  };

  // Handle unban
  const handleUnban = async (): Promise<void> => {
    await unbanMember(userId);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isLoading}
              className={className}
            />
          }
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <MoreHorizontal className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">Member actions for {userName}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Moderation</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Mute/Unmute actions */}
            {canMute && !isBanned && (
              <>
                {isMuted ? (
                  <DropdownMenuItem onClick={handleUnmute}>
                    <Volume2 className="size-4" aria-hidden="true" />
                    Unmute
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <VolumeX className="size-4" aria-hidden="true" />
                      Mute
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {MUTE_DURATIONS.map((duration) => (
                        <DropdownMenuItem
                          key={duration.label}
                          onClick={() => handleMute(duration.minutes)}
                        >
                          <Clock className="size-4" aria-hidden="true" />
                          {duration.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </>
            )}

            {/* Ban/Unban actions */}
            {canBan && (
              <>
                {isBanned ? (
                  <DropdownMenuItem onClick={handleUnban}>
                    <UserCheck className="size-4" aria-hidden="true" />
                    Unban
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setShowBanDialog(true)}
                  >
                    <Ban className="size-4" aria-hidden="true" />
                    Ban from channel
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ban confirmation dialog */}
      <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {userName}?</DialogTitle>
            <DialogDescription>
              This will remove the member from the channel. They will not be
              able to rejoin until unbanned.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label
              htmlFor="ban-reason"
              className="text-sm font-medium text-foreground"
            >
              Reason (optional)
            </label>
            <Input
              id="ban-reason"
              placeholder="Enter reason for ban..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBanDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBan}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  Banning...
                </>
              ) : (
                "Ban Member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom mute duration dialog */}
      <Dialog open={showCustomMuteDialog} onOpenChange={setShowCustomMuteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Mute Duration</DialogTitle>
            <DialogDescription>
              Enter how long to mute {userName} (in minutes).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label
              htmlFor="custom-mute-duration"
              className="text-sm font-medium text-foreground"
            >
              Duration (minutes)
            </label>
            <Input
              id="custom-mute-duration"
              type="number"
              min="1"
              max="43200"
              placeholder="Enter duration in minutes..."
              value={customMuteMinutes}
              onChange={(e) => setCustomMuteMinutes(e.target.value)}
              className="mt-2"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Maximum: 43200 minutes (30 days)
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCustomMuteDialog(false);
                setCustomMuteMinutes("");
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCustomMute}
              disabled={
                isLoading ||
                !customMuteMinutes ||
                parseInt(customMuteMinutes, 10) <= 0
              }
            >
              {isLoading ? (
                <>
                  <Loader2
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  Muting...
                </>
              ) : (
                "Mute Member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
