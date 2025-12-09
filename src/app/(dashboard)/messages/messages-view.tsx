"use client";

import { useState } from "react";
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
  const [showUnreadsOnly, setShowUnreadsOnly] = useState(false);

  // Fetch conversations
  const conversations = useQuery(api.messaging.listConversations, {
    unreadOnly: showUnreadsOnly,
  });

  // Select first conversation by default
  if (conversations && conversations.length > 0 && !selectedConversationId) {
    setSelectedConversationId(conversations[0]._id);
  }

  if (conversations === undefined) {
    return <MessagesViewSkeleton />;
  }

  return (
    <div className="grid grid-cols-[0.3fr_1fr] h-[calc(100vh-64px)]">
      {/* Left: Conversation List */}
      <ConversationList
        conversations={conversations}
        selectedId={selectedConversationId}
        onSelect={setSelectedConversationId}
        showUnreadsOnly={showUnreadsOnly}
        onToggleUnreads={setShowUnreadsOnly}
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
    <div className="grid grid-cols-[0.3fr_1fr] h-[calc(100vh-64px)]">
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
