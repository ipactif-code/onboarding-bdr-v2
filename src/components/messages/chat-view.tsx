"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { useQuery, useMutation } from "convex/react";
import { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatViewProps {
  conversationId: Id<"conversations">;
}

export function ChatView({ conversationId }: ChatViewProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch conversation with messages from Convex
  const data = useQuery(api.messages.getConversation, {
    conversationId,
  });

  // Mark as read mutation
  const markAsRead = useMutation(api.messages.markRead);

  // Send message mutation
  const sendMessage = useMutation(api.messages.send);

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
  }, [data?.messages]);

  const handleSend = async (content: string): Promise<void> => {
    if (!content.trim()) return;

    await sendMessage({
      conversationId,
      content: content.trim(),
    });
  };

  if (data === undefined) {
    return <ChatViewSkeleton />;
  }

  // Transform conversation data for ChatHeader
  const participant = data.conversation?.participants[0];
  const headerData = {
    name: participant?.name ?? "Unknown",
    avatar: participant?.avatarUrl,
    isOnline: participant?.status === "online",
  };

  // Type for message items
  type MessageItem = {
    _id: Id<"messages">;
    content: string;
    senderId: Id<"users">;
    senderName: string;
    senderAvatarUrl?: string;
    createdAt: number;
    isOwn: boolean;
  };

  // Transform messages for MessageList
  const messages = data.messages.map((msg: MessageItem) => ({
    _id: msg._id,
    content: msg.content,
    senderId: msg.senderId,
    senderName: msg.senderName,
    senderAvatar: msg.senderAvatarUrl,
    createdAt: msg.createdAt,
    isOwn: msg.isOwn,
  }));

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <ChatHeader
        name={headerData.name}
        avatar={headerData.avatar}
        isOnline={headerData.isOnline}
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

function ChatViewSkeleton(): ReactElement {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border">
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
      <div className="p-4 border-t border-border">
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
