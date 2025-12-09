"use client";

import { Id } from "../../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Conversation {
  _id: Id<"conversations">;
  participantName: string;
  participantAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: number;
  unreadCount: number;
  isOnline?: boolean;
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const timeAgo = conversation.lastMessageAt
    ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false })
    : "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 border-b border-neutral-200 transition-colors",
        isSelected ? "bg-white" : "hover:bg-neutral-100"
      )}
    >
      {/* Header: Name + Time */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-normal text-neutral-950">
            {conversation.participantName}
          </span>
          {conversation.unreadCount > 0 && (
            <span className="size-2 rounded-full bg-blue-600" />
          )}
        </div>
        <span className="text-sm text-neutral-500">{timeAgo}</span>
      </div>

      {/* Message Preview */}
      <p className="text-xs text-neutral-950 line-clamp-2 leading-4">
        {conversation.lastMessage || "No messages yet"}
      </p>
    </button>
  );
}
