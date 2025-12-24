"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import {
  ArrowLeft,
  Users,
  MoreVertical,
  Star,
  BellOff,
  EyeOff,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

// ============================================================================
// Types
// ============================================================================

export interface Participant {
  _id: string;
  name: string;
  avatarUrl?: string;
  status: "online" | "offline" | "away" | "dnd";
}

export interface DMHeaderProps {
  conversationId: string;
  participants: Participant[];
  displayName: string;
  conversationType: "direct" | "group" | "broadcast";
  onBack: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates initials from a display name.
 * Returns up to 2 characters (first letter of first two words).
 */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const firstWord = words[0];
  const secondWord = words[1];

  if (!firstWord) {
    return "?";
  }

  if (!secondWord) {
    return firstWord.length >= 2
      ? firstWord.slice(0, 2).toUpperCase()
      : firstWord.toUpperCase();
  }

  const first = firstWord[0] ?? "";
  const second = secondWord[0] ?? "";
  return (first + second).toUpperCase();
}

/**
 * Gets the status color class for a user status.
 */
function getStatusColor(status: Participant["status"]): string {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "away":
      return "bg-yellow-500";
    case "dnd":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

// ============================================================================
// DMHeader Component
// ============================================================================

/**
 * Header component for direct message conversations.
 * Displays participant info, avatars, online status, and action menu.
 */
export function DMHeader({
  conversationId,
  participants,
  displayName,
  conversationType,
  onBack,
}: DMHeaderProps): React.ReactElement {
  const router = useRouter();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const hideConversation = useMutation(api.directMessages.hide);
  const leaveGroup = useMutation(api.directMessages.leaveGroup);
  const toggleFavorite = useMutation(api.directMessages.toggleFavorite);

  const firstParticipant = participants[0];
  const isGroup = conversationType === "group" || participants.length > 1;
  const isGroupDM = conversationType === "group" && participants.length >= 2;

  const handleHide = async (): Promise<void> => {
    try {
      setIsHiding(true);
      await hideConversation({
        conversationId: conversationId as Id<"conversations">,
      });
      toast.success("Conversation hidden");
      router.push("/messages");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to hide conversation"
      );
    } finally {
      setIsHiding(false);
    }
  };

  const handleLeaveGroup = async (): Promise<void> => {
    try {
      setIsLeaving(true);
      await leaveGroup({
        conversationId: conversationId as Id<"conversations">,
      });
      setShowLeaveDialog(false);
      toast.success("You have left the group");
      router.push("/messages");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to leave group"
      );
    } finally {
      setIsLeaving(false);
    }
  };

  const handleToggleFavorite = async (): Promise<void> => {
    try {
      const newState = await toggleFavorite({
        conversationId: conversationId as Id<"conversations">,
      });
      toast.success(
        newState ? "Added to favorites" : "Removed from favorites"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update favorite"
      );
    }
  };

  return (
    <>
      <div
        data-slot="dm-header"
        className="flex h-14 items-center gap-3 border-b px-4"
      >
        {/* Back button (mobile-friendly) */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
          aria-label="Back to messages"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Button>

        {/* Avatar(s) */}
        {isGroup ? (
          <div className="relative flex size-10 items-center justify-center rounded-full bg-muted">
            <Users className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
        ) : firstParticipant ? (
          <div className="relative">
            <Avatar size="default">
              {firstParticipant.avatarUrl ? (
                <AvatarImage
                  src={firstParticipant.avatarUrl}
                  alt={firstParticipant.name}
                />
              ) : null}
              <AvatarFallback>{getInitials(firstParticipant.name)}</AvatarFallback>
            </Avatar>
            {/* Online status indicator */}
            <span
              className={cn(
                "absolute bottom-0 right-0 size-3 rounded-full border-2 border-background",
                getStatusColor(firstParticipant.status)
              )}
              aria-label={`Status: ${firstParticipant.status}`}
            />
          </div>
        ) : null}

        {/* Name and status */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <h1 className="truncate text-sm font-semibold">{displayName}</h1>
          {!isGroup && firstParticipant && (
            <span className="text-xs text-muted-foreground capitalize">
              {firstParticipant.status === "dnd"
                ? "Do not disturb"
                : firstParticipant.status}
            </span>
          )}
          {isGroup && (
            <span className="text-xs text-muted-foreground">
              {participants.length} participants
            </span>
          )}
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Conversation options"
              />
            }
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleToggleFavorite}>
              <Star className="mr-2 size-4" aria-hidden="true" />
              Toggle favorite
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <BellOff className="mr-2 size-4" aria-hidden="true" />
              Mute conversation
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!isGroupDM && (
              <DropdownMenuItem onClick={handleHide} disabled={isHiding}>
                <EyeOff className="mr-2 size-4" aria-hidden="true" />
                {isHiding ? "Hiding..." : "Hide conversation"}
              </DropdownMenuItem>
            )}
            {isGroupDM && (
              <DropdownMenuItem
                onClick={() => setShowLeaveDialog(true)}
                variant="destructive"
              >
                <LogOut className="mr-2 size-4" aria-hidden="true" />
                Leave group
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Leave Group Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer receive messages from this group. You cannot
              rejoin unless someone adds you back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveGroup}
              disabled={isLeaving}
              variant="destructive"
            >
              {isLeaving ? "Leaving..." : "Leave Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
