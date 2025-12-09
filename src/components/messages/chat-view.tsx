"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatViewProps {
  conversationId: Id<"conversations">;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch conversation details
  const conversation = useQuery(api.messaging.getConversation, {
    conversationId,
  });

  // Fetch messages
  const messages = useQuery(api.messaging.listMessages, {
    conversationId,
  });

  // Mark as read mutation
  const markAsRead = useMutation(api.messaging.markAsRead);

  // Send message mutation
  const sendMessage = useMutation(api.messaging.sendMessage);

  // Mark conversation as read when opened
  useEffect(() => {
    if (conversationId) {
      markAsRead({ conversationId });
    }
  }, [conversationId, markAsRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (content: string) => {
    if (!content.trim()) return;

    await sendMessage({
      conversationId,
      content: content.trim(),
    });
  };

  if (conversation === undefined || messages === undefined) {
    return <ChatViewSkeleton />;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <ChatHeader
        name={conversation.participantName}
        avatar={conversation.participantAvatar}
        isOnline={conversation.isOnline}
      />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <MessageList messages={messages} />
      </div>

      {/* Input */}
      <MessageInput onSend={handleSend} />
    </div>
  );
}

function ChatViewSkeleton() {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <Skeleton className="h-12 w-48 ml-auto" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-12 w-56 ml-auto" />
      </div>
      <div className="p-4 border-t border-neutral-200">
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
