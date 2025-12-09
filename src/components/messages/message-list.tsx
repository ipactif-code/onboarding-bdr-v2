"use client";

import { useUser } from "@clerk/nextjs";
import { Id } from "../../../convex/_generated/dataModel";
import { MessageBubble } from "./message-bubble";

interface Message {
  _id: Id<"messages">;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: number;
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: string;
  }[];
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const { user } = useUser();
  const currentUserId = user?.id;

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-neutral-500">No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message._id}
          message={message}
          isOwn={message.senderId === currentUserId}
        />
      ))}
    </div>
  );
}
