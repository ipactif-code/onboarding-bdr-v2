"use client";

import * as React from "react";
import { useQuery } from "convex/react";

import type { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isChannelRole } from "@/lib/type-guards";

import { MembersList } from "./channel-members-dialog/members-list";
import { AddMembersTab } from "./channel-members-dialog/add-members-tab";
import type { ChannelRole } from "./channel-members-dialog/types";

// ============================================================================
// Types
// ============================================================================

export interface MemberManagementDialogProps {
  /** The channel ID to manage members for */
  channelId: Id<"channels">;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog open state changes */
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// MemberManagementDialog Component
// ============================================================================

/**
 * Dialog for managing channel members.
 *
 * Features:
 * - View all channel members with their roles and online status
 * - Add new members (admin/owner only) - shows when channel is private
 * - Remove members (admin/owner only) - placeholder for T079-3
 * - Change member roles (owner only) - placeholder for T079-4
 *
 * Permissions:
 * - Admins/Owners: Full member management UI with invite and actions
 * - Regular members: Read-only member list view
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <MemberManagementDialog
 *   channelId={channelId}
 *   open={open}
 *   onOpenChange={setOpen}
 * />
 * ```
 */
export function MemberManagementDialog({
  channelId,
  open,
  onOpenChange,
}: MemberManagementDialogProps): React.ReactElement {
  // Fetch channel data to determine type and user's role
  const channel = useQuery(api.channels.get, { channelId });

  // Determine if user can manage members (owner or admin)
  const rawRole = channel?.membership?.role;
  const userRole: ChannelRole | undefined = isChannelRole(rawRole)
    ? rawRole
    : undefined;
  const canManageMembers = userRole === "owner" || userRole === "admin";

  // Only show invite section for private channels
  const isPrivateChannel = channel?.type === "private";
  const showInviteSection = canManageMembers && isPrivateChannel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
          <DialogDescription>
            {canManageMembers
              ? "View, invite, or manage members in this channel."
              : "View members in this channel."}
          </DialogDescription>
        </DialogHeader>

        {showInviteSection ? (
          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">Current Members</TabsTrigger>
              <TabsTrigger value="invite">Invite Members</TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="mt-4">
              <MembersList channelId={channelId} userRole={userRole} />
            </TabsContent>
            <TabsContent value="invite" className="mt-4">
              <AddMembersTab channelId={channelId} />
            </TabsContent>
          </Tabs>
        ) : canManageMembers ? (
          // For non-private channels, admins can still manage members but no invite
          <Tabs defaultValue="members" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="members" className="flex-1">
                Current Members
              </TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="mt-4">
              <MembersList channelId={channelId} userRole={userRole} />
            </TabsContent>
          </Tabs>
        ) : (
          // Regular members see read-only list
          <MembersList channelId={channelId} userRole={userRole} />
        )}
      </DialogContent>
    </Dialog>
  );
}
