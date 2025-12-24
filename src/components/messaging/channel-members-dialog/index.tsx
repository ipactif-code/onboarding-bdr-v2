"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ChannelMembersDialogProps } from "./types";
import { MembersList } from "./members-list";
import { AddMembersTab } from "./add-members-tab";

// Re-export types for external use
export type { ChannelMembersDialogProps, ChannelRole, MemberInfo, UserSearchResult } from "./types";

// ============================================================================
// ChannelMembersDialog Component
// ============================================================================

/**
 * Dialog for managing channel members.
 *
 * Features:
 * - View all channel members with their roles and online status
 * - Add new members (owner/admin only)
 * - Remove members (owner/admin only)
 * - Change member roles (owner only)
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <ChannelMembersDialog
 *   channelId={channelId}
 *   open={open}
 *   onOpenChange={setOpen}
 *   userRole={channel?.membership?.role}
 * />
 * ```
 */
export function ChannelMembersDialog({
  channelId,
  open,
  onOpenChange,
  userRole,
}: ChannelMembersDialogProps): React.ReactElement {
  const canAddMembers = userRole === "owner" || userRole === "admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Channel Members</DialogTitle>
          <DialogDescription>
            {canAddMembers
              ? "View, add, or manage members in this channel."
              : "View members in this channel."}
          </DialogDescription>
        </DialogHeader>

        {canAddMembers ? (
          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="add">Add Members</TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="mt-4">
              <MembersList channelId={channelId} userRole={userRole} />
            </TabsContent>
            <TabsContent value="add" className="mt-4">
              <AddMembersTab channelId={channelId} />
            </TabsContent>
          </Tabs>
        ) : (
          <MembersList channelId={channelId} userRole={userRole} />
        )}
      </DialogContent>
    </Dialog>
  );
}
