"use client";

import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { FileText, Image as ImageIcon } from "lucide-react";

interface Message {
  _id: string;
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

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const initials = message.senderName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const time = format(new Date(message.createdAt), "h:mm a");

  return (
    <div
      className={cn(
        "flex gap-3 max-w-[70%]",
        isOwn ? "ml-auto flex-row-reverse" : ""
      )}
    >
      {/* Avatar - only for other's messages */}
      {!isOwn && (
        <Avatar className="size-8 shrink-0">
          <AvatarImage src={message.senderAvatar} alt={message.senderName} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      )}

      {/* Message content */}
      <div className={cn("space-y-1", isOwn ? "items-end" : "items-start")}>
        {/* Bubble */}
        <div
          className={cn(
            "px-4 py-2 rounded-2xl",
            isOwn
              ? "bg-blue-600 text-white rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                  isOwn
                    ? "bg-blue-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {attachment.type.startsWith("image/") ? (
                  <ImageIcon className="size-4" />
                ) : (
                  <FileText className="size-4" />
                )}
                <span className="truncate max-w-[200px]">{attachment.name}</span>
              </a>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span
          className={cn(
            "text-xs text-muted-foreground block",
            isOwn ? "text-right" : "text-left"
          )}
        >
          {time}
        </span>
      </div>
    </div>
  );
}
