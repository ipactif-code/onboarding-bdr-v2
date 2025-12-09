"use client";

import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationItem } from "./conversation-item";

interface Conversation {
  _id: Id<"conversations">;
  participantName: string;
  participantAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: number;
  unreadCount: number;
  isOnline?: boolean;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: Id<"conversations"> | null;
  onSelect: (id: Id<"conversations">) => void;
  showUnreadsOnly: boolean;
  onToggleUnreads: (value: boolean) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  showUnreadsOnly,
  onToggleUnreads,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filteredConversations = conversations.filter((conv) =>
    conv.participantName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-neutral-50 border-r border-neutral-200">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 space-y-4">
        {/* Title + Unreads toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-neutral-950">Inbox</h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="unreads" className="text-sm text-neutral-950">
              Unreads
            </Label>
            <Switch
              id="unreads"
              checked={showUnreadsOnly}
              onCheckedChange={onToggleUnreads}
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-neutral-500 text-sm">
            {search ? "No conversations found" : "No messages yet"}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation._id}
              conversation={conversation}
              isSelected={selectedId === conversation._id}
              onClick={() => onSelect(conversation._id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
