# 🎯 CLAUDE CODE INTEGRATION INSTRUCTIONS
**Task:** T170 - Messages Page  
**Source:** Figma Make - Messages.tsx  
**Date:** 2025-12-08  
**Project:** Onboarding BDR Team v2 LMS

---

## 📚 SPEC-KIT REFERENCES

Before implementing, read these specification files:

```
specs/001-bdr-lms/contracts/messaging.ts  → Message queries/mutations
specs/001-bdr-lms/types/index.ts          → Message, Conversation types
convex/messaging.ts                        → Actual implementation
convex/schema.ts                           → Database schema
```

---

## 📋 CONTEXT

Real-time messaging page for users and admins to communicate. Features:
- Conversation list with search and unreads filter
- Chat view with message history
- Real-time message updates via Convex
- Online/offline status indicators
- File attachments support

---

## 🏗️ LAYOUT STRUCTURE (from Figma)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─ Inbox Sidebar (0.3fr) ──────┐  ┌─ Chat Area (1fr) ────────┐ │
│  │                              │  │                          │ │
│  │  Inbox         Unreads [○─]  │  │  ┌──┐ Travis Barker      │ │
│  │  ┌─────────────────────────┐ │  │  │  │ ● Online           │ │
│  │  │ 🔍 Search               │ │  │  └──┘                    │ │
│  │  └─────────────────────────┘ │  ├──────────────────────────┤ │
│  │ ──────────────────────────── │  │                          │ │
│  │  William Smith    09:34 AM   │  │                          │ │
│  │  Lorem ipsum dolor sit amet..│  │    (Messages Area)       │ │
│  │ ──────────────────────────── │  │                          │ │
│  │  Sarah Johnson    10:45 AM   │  │                          │ │
│  │  Vestibulum ante ipsum...    │  │                          │ │
│  │ ──────────────────────────── │  │                          │ │
│  │  Michael Brown    11:30 AM   │  │                          │ │
│  │  Fusce vitae laoreet enim... │  │                          │ │
│  │ ──────────────────────────── │  ├──────────────────────────┤ │
│  │  Emily Davis      02:15 PM   │  │  [📎] [Type message...] [Send] │
│  │  Pellentesque habitant...    │  │                          │ │
│  │ ──────────────────────────── │  └──────────────────────────┘ │
│  └──────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 FILES TO CREATE

```
src/app/(dashboard)/messages/
├── page.tsx                    → Server component wrapper
└── messages-view.tsx           → Main client component

src/components/messages/
├── conversation-list.tsx       → Left sidebar with conversations
├── conversation-item.tsx       → Single conversation preview
├── chat-view.tsx               → Right panel chat interface
├── chat-header.tsx             → Avatar + name + status
├── message-list.tsx            → Scrollable messages
├── message-bubble.tsx          → Single message display
└── message-input.tsx           → Input with attachments
```

---

## 🔧 DETAILED IMPLEMENTATION

### File 1: `src/app/(dashboard)/messages/page.tsx`

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MessagesView } from "./messages-view";

export default async function MessagesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <MessagesView />;
}
```

---

### File 2: `src/app/(dashboard)/messages/messages-view.tsx`

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
```

---

### File 3: `src/components/messages/conversation-list.tsx`

```tsx
"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
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
```

---

### File 4: `src/components/messages/conversation-item.tsx`

```tsx
"use client";

import { Id } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Conversation {
  _id: Id<"conversations">;
  participantName: string;
  participantAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: number;
  unreadCount: number;
  isOnline?: boolean;
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const timeAgo = conversation.lastMessageAt
    ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false })
    : "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 border-b border-neutral-200 transition-colors",
        isSelected ? "bg-white" : "hover:bg-neutral-100"
      )}
    >
      {/* Header: Name + Time */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-normal text-neutral-950">
            {conversation.participantName}
          </span>
          {conversation.unreadCount > 0 && (
            <span className="size-2 rounded-full bg-blue-600" />
          )}
        </div>
        <span className="text-sm text-neutral-500">{timeAgo}</span>
      </div>

      {/* Message Preview */}
      <p className="text-xs text-neutral-950 line-clamp-2 leading-4">
        {conversation.lastMessage || "No messages yet"}
      </p>
    </button>
  );
}
```

---

### File 5: `src/components/messages/chat-view.tsx`

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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

  const handleSend = async (content: string, attachments?: File[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    await sendMessage({
      conversationId,
      content: content.trim(),
      // TODO: Handle file attachments
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
```

---

### File 6: `src/components/messages/chat-header.tsx`

```tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatHeaderProps {
  name: string;
  avatar?: string;
  isOnline?: boolean;
}

export function ChatHeader({ name, avatar, isOnline }: ChatHeaderProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-4 border-b border-neutral-200">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative">
          <Avatar className="size-10">
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {/* Online indicator */}
          {isOnline && (
            <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-white" />
          )}
        </div>

        {/* Name + Status */}
        <div className="flex flex-col">
          <span className="text-base font-medium text-black/85">{name}</span>
          <span
            className={`text-sm ${isOnline ? "text-green-600" : "text-neutral-500"}`}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>
    </div>
  );
}
```

---

### File 7: `src/components/messages/message-list.tsx`

```tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { Id } from "@/convex/_generated/dataModel";
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
```

---

### File 8: `src/components/messages/message-bubble.tsx`

```tsx
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
              : "bg-neutral-100 text-neutral-950 rounded-bl-md"
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
                    : "bg-neutral-200 text-neutral-700"
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
            "text-xs text-neutral-500 block",
            isOwn ? "text-right" : "text-left"
          )}
        >
          {time}
        </span>
      </div>
    </div>
  );
}
```

---

### File 9: `src/components/messages/message-input.tsx`

```tsx
"use client";

import { useState, useRef } from "react";
import { Paperclip, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MessageInputProps {
  onSend: (content: string, attachments?: File[]) => Promise<void>;
}

export function MessageInput({ onSend }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && attachments.length === 0) return;

    setIsSending(true);
    try {
      await onSend(content, attachments);
      setContent("");
      setAttachments([]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t border-neutral-200 p-2 bg-white">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-neutral-100 rounded-lg px-3 py-1 text-sm"
            >
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-1">
        {/* Attachment button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 size-10 rounded-full bg-black/10 hover:bg-black/20"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Text input */}
        <div className="flex-1">
          <Input
            placeholder="Type your message here.."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-neutral-50 border-none h-9 rounded-xl"
            disabled={isSending}
          />
        </div>

        {/* Send button */}
        <Button
          type="submit"
          disabled={isSending || (!content.trim() && attachments.length === 0)}
          className="shrink-0 h-9 px-4 bg-blue-600 hover:bg-blue-700"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Send className="size-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
```

---

## 🔄 CONVEX API INTEGRATION

```tsx
// Conversations
api.messaging.listConversations({ unreadOnly? })
// Returns:
{
  _id: Id<"conversations">,
  participantName: string,
  participantAvatar?: string,
  lastMessage?: string,
  lastMessageAt?: number,
  unreadCount: number,
  isOnline?: boolean,
}[]

api.messaging.getConversation({ conversationId })
// Returns: Same as above for single conversation

// Messages
api.messaging.listMessages({ conversationId })
// Returns:
{
  _id: Id<"messages">,
  content: string,
  senderId: string,
  senderName: string,
  senderAvatar?: string,
  createdAt: number,
  attachments?: Attachment[],
}[]

// Mutations
api.messaging.sendMessage({ conversationId, content, attachmentIds? })
api.messaging.markAsRead({ conversationId })
```

---

## 📦 SHADCN COMPONENTS USED

All already installed:
- `Input`
- `Button`
- `Switch`
- `Label`
- `Avatar`, `AvatarImage`, `AvatarFallback`
- `ScrollArea`
- `Skeleton`

---

## 📦 NPM PACKAGES REQUIRED

```bash
# Already installed
npm install date-fns
```

---

## ✅ SUCCESS CRITERIA

- [ ] Page accessible at `/messages`
- [ ] Conversation list shows all conversations with previews
- [ ] "Unreads" toggle filters unread conversations only
- [ ] Search filters conversations by participant name
- [ ] Clicking conversation shows chat view
- [ ] Chat header shows avatar, name, online status
- [ ] Messages display with sender alignment (own = right, others = left)
- [ ] Own messages have blue bubble, others have gray
- [ ] Timestamps display correctly
- [ ] Message input works with Enter to send
- [ ] Attachment button allows file selection
- [ ] Send button disabled when no content
- [ ] Loading states during fetch
- [ ] Real-time updates when new messages arrive (Convex reactive)
- [ ] Conversation marked as read when opened
- [ ] Responsive layout on tablet+ screens

---

## ⚠️ IMPORTANT NOTES

1. **Sidebar removed** - Already in layout (T028)
2. **Real-time** - Convex `useQuery` is reactive, no extra setup needed
3. **File uploads** - Use Convex storage, similar to course cover image
4. **Online status** - May require presence tracking (enhancement)
5. **Mobile** - Consider responsive design for smaller screens (future)

---

## 🐛 TROUBLESHOOTING

**Issue:** Messages not updating in real-time
- **Solution:** Ensure using `useQuery` from `convex/react`, not manual fetch

**Issue:** Scroll not at bottom for new messages
- **Solution:** Check `scrollRef.current.scrollTop = scrollRef.current.scrollHeight` in useEffect

**Issue:** Unread count not clearing
- **Solution:** Ensure `markAsRead` mutation is called when conversation is selected

---

**End of Instructions**
