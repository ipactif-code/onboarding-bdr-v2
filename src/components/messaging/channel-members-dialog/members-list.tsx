"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { User } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

import type { ChannelRole, MemberInfo } from "./types";
import { getRoleLabel } from "./helpers";
import { MemberRow } from "./member-row";

interface MembersListProps {
  channelId: Id<"channels">;
  userRole?: ChannelRole;
}

export function MembersList({ channelId, userRole }: MembersListProps): React.ReactElement {
  const members = useQuery(api.channels.getMembers, { channelId });
  const removeMember = useMutation(api.channels.removeMember);
  const updateMemberRole = useMutation(api.channels.updateMemberRole);

  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handleRemoveMember = useCallback(
    async (userId: Id<"users">, userName: string) => {
      try {
        setActionInProgress(`remove-${userId}`);
        await removeMember({ channelId, userId });
        toast.success(`${userName} has been removed from the channel`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to remove member";
        toast.error(message);
      } finally {
        setActionInProgress(null);
      }
    },
    [channelId, removeMember]
  );

  const handleChangeRole = useCallback(
    async (userId: Id<"users">, userName: string, newRole: "admin" | "moderator" | "member") => {
      try {
        setActionInProgress(`role-${userId}`);
        await updateMemberRole({ channelId, userId, newRole });
        toast.success(`${userName} is now a ${getRoleLabel(newRole)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to change role";
        toast.error(message);
      } finally {
        setActionInProgress(null);
      }
    },
    [channelId, updateMemberRole]
  );

  if (members === undefined) {
    return <MembersListSkeleton />;
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <User className="mb-2 size-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">No members found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[320px]">
      <div className="space-y-1 pr-4">
        {members.map((member: MemberInfo) => (
          <MemberRow
            key={member._id}
            member={member}
            userRole={userRole}
            isActionInProgress={
              actionInProgress === `remove-${member.userId}` ||
              actionInProgress === `role-${member.userId}`
            }
            onRemove={() => handleRemoveMember(member.userId, member.userName)}
            onChangeRole={(newRole) => handleChangeRole(member.userId, member.userName, newRole)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

export function MembersListSkeleton(): React.ReactElement {
  return (
    <div className="space-y-1 pr-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}
