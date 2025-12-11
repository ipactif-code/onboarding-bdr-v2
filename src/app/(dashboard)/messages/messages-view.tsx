"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ConversationList } from "@/components/messages/conversation-list";
import { ChatView } from "@/components/messages/chat-view";
import { Skeleton } from "@/components/ui/skeleton";

export function MessagesView() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    Id<"conversations"> | null
  >(null);

  // Fetch conversations from Convex
  const rawConversations = useQuery(api.messages.listConversations);

  // Transform data to match ConversationList expectations
  const conversations = rawConversations?.map((conv) => {
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
      setSelectedConversationId(filteredConversations[0]._id);
    }
  }, [filteredConversations, selectedConversationId]);

  if (rawConversations === undefined) {
    return <MessagesViewSkeleton />;
  }

  return (
    <div className="grid grid-cols-[0.3fr_1fr] h-screen">
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

function MessagesViewSkeleton() {
  return (
    <div className="grid grid-cols-[0.3fr_1fr] h-screen">
      <div className="bg-neutral-50 border-r border-neutral-200 p-4 space-y-4">
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

function EmptyChat() {
  return (
    <div className="flex items-center justify-center h-full bg-white">
      <p className="text-neutral-500">Select a conversation to start messaging</p>
    </div>
  );
}
