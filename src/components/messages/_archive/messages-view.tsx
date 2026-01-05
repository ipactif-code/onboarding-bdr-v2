"use client";

import { useState, useEffect, type ReactElement } from "react";
import { useQuery } from "convex/react";
import { Id } from "../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../convex/_generated/api").api;
import { ConversationList } from "@/components/messages/conversation-list";
import { ChatView } from "@/components/messages/chat-view";
import { Skeleton } from "@/components/ui/skeleton";

export function MessagesView(): ReactElement {
  const [selectedConversationId, setSelectedConversationId] = useState<
    Id<"conversations"> | null
  >(null);

  // Fetch conversations from Convex
  const rawConversations = useQuery(api.messages.listConversations);

  // Type for conversation items from the query
  type ConversationItem = {
    _id: Id<"conversations">;
    participants: Array<{ name?: string; avatarUrl?: string; status?: string }>;
    lastMessage?: { content?: string; createdAt?: number };
    unreadCount: number;
  };

  // Transform data to match ConversationList expectations
  const conversations = rawConversations?.map((conv: ConversationItem) => {
    const participant = conv.participants[0];
    return {
      _id: conv._id,
      participantName: participant?.name ?? "Unknown",
      participantAvatar: participant?.avatarUrl,
      lastMessage: conv.lastMessage?.content,
      lastMessageAt: conv.lastMessage?.createdAt,
      unreadCount: conv.unreadCount,
      isOnline: participant?.status === "online",
    };
  });

  // Use all conversations (filtering removed)
  const filteredConversations = conversations;

  // Select first conversation by default
  useEffect(() => {
    if (filteredConversations && filteredConversations.length > 0 && !selectedConversationId) {
      const firstConversation = filteredConversations[0];
      if (firstConversation) {
        setSelectedConversationId(firstConversation._id);
      }
    }
  }, [filteredConversations, selectedConversationId]);

  if (rawConversations === undefined) {
    return <MessagesViewSkeleton />;
  }

  return (
    <div className="grid grid-cols-[0.3fr_1fr] h-full overflow-hidden">
      {/* Left: Conversation List */}
      <ConversationList
        conversations={filteredConversations ?? []}
        selectedId={selectedConversationId}
        onSelect={setSelectedConversationId}
      />

      {/* Right: Chat View */}
      {selectedConversationId ? (
        <ChatView conversationId={selectedConversationId} />
      ) : (
        <EmptyChat />
      )}
    </div>
  );
}

function MessagesViewSkeleton(): ReactElement {
  return (
    <div className="grid grid-cols-[0.3fr_1fr] h-full overflow-hidden">
      <div className="bg-muted/50 border-r border-border p-4 space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="p-4">
        <Skeleton className="h-12 w-48" />
      </div>
    </div>
  );
}

function EmptyChat(): ReactElement {
  return (
    <div className="flex items-center justify-center h-full bg-background">
      <p className="text-muted-foreground">Select a conversation to start messaging</p>
    </div>
  );
}
