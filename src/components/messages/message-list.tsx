"use client";

import { Id } from "../../../convex/_generated/dataModel";
import { MessageBubble } from "./message-bubble";

interface Message {
  _id: Id<"messages">;
  content: string;
  senderId: Id<"users">;
  senderName: string;
  senderAvatar?: string;
  createdAt: number;
  isOwn: boolean;
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message._id}
          message={message}
          isOwn={message.isOwn}
        />
      ))}
    </div>
  );
}
