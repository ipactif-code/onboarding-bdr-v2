"use client";

import { useState, type ReactElement } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationItem } from "./conversation-item";
import { NewMessageModal } from "./new-message-modal";

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
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: ConversationListProps): ReactElement {
  const [search, setSearch] = useState("");
  const [newMessageOpen, setNewMessageOpen] = useState(false);

  const handleConversationCreated = (conversationId: Id<"conversations">): void => {
    onSelect(conversationId);
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.participantName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col h-full bg-muted/50 border-r border-border">
        {/* Header */}
        <div className="p-4 border-b border-border space-y-4">
          {/* Title + New Button */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-foreground">Inbox</h2>
            <Button size="sm" onClick={() => setNewMessageOpen(true)}>
              <Plus className="size-4" data-icon="inline-start" />
              New
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
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

      {/* New Message Modal */}
      <NewMessageModal
        open={newMessageOpen}
        onOpenChange={setNewMessageOpen}
        onConversationCreated={handleConversationCreated}
      />
    </>
  );
}
