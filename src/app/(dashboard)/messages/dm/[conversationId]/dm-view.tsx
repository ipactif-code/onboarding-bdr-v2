"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

import { Id } from "../../../../../../convex/_generated/dataModel";
import type { AttachmentData } from "@/hooks/use-messages";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../convex/_generated/api").api;
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";

import { DMHeader, type Participant } from "./components/dm-header";
import { DMMessageList, type Message } from "./components/dm-message-list";
import { DMMessageInput } from "./components/dm-message-input";
import { ThreadPanel } from "@/components/messaging/thread-panel";

interface DMViewProps {
  conversationId: string;
}

/** DMView orchestrates header, message list, and input components. */
export function DMView({ conversationId }: DMViewProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const parsedConversationId = conversationId as Id<"conversations">;

  // Convex subscriptions
  const conversationData = useQuery(api.messages.getConversation, {
    conversationId: parsedConversationId,
    limit: 50,
  });

  const sendMessageMutation = useMutation(api.messages.send);
  const markReadMutation = useMutation(api.messages.markRead);
  const deleteMessageMutation = useMutation(api.messages.deleteChannelMessage);

  // Delete confirmation state
  const [deleteMessageId, setDeleteMessageId] = useState<Id<"messages"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Thread panel state
  const [openThreadId, setOpenThreadId] = useState<Id<"messages"> | null>(null);

  // Track whether we've processed the initial thread param from URL
  const threadParamProcessedRef = useRef(false);

  // Get current user for thread panel
  const currentUser = useQuery(api.users.me);

  // Typing indicator hook
  const { handleTyping, clearTyping } = useTypingIndicator({ conversationId });

  const lastReadAtRef = useRef<number>(0);
  const hasMarkedReadRef = useRef(false);

  // Reset flags when conversation changes
  useEffect(() => {
    hasMarkedReadRef.current = false;
    threadParamProcessedRef.current = false;
  }, [parsedConversationId]);

  // Mark as read when entering conversation or when new messages arrive
  // Uses timestamp tracking to detect genuinely new messages (like channel-view)
  useEffect(() => {
    if (
      conversationData?.conversation &&
      conversationData.messages.length > 0 &&
      !hasMarkedReadRef.current
    ) {
      const latestMessage = conversationData.messages[conversationData.messages.length - 1];
      if (latestMessage && latestMessage.createdAt > lastReadAtRef.current) {
        lastReadAtRef.current = latestMessage.createdAt;
        hasMarkedReadRef.current = true;
        markReadMutation({ conversationId: parsedConversationId }).catch(() => {
          // Silently ignore errors for marking as read
        });
      }
    }
  }, [conversationData, parsedConversationId, markReadMutation]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isAtBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [conversationData?.messages.length, isAtBottom]);

  // Open thread from URL query parameter (e.g., ?thread=messageId)
  // Only process once after conversation data is loaded
  useEffect(() => {
    // Skip if already processed or conversation is still loading
    if (threadParamProcessedRef.current || conversationData === undefined) {
      return;
    }

    const threadId = searchParams.get("thread");
    if (threadId) {
      // Mark as processed to prevent re-running
      threadParamProcessedRef.current = true;

      // Set the thread to open
      setOpenThreadId(threadId as Id<"messages">);

      // Clear the query param from URL for cleaner UX
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname, conversationData]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const threshold = 100;
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
    setIsAtBottom(isNearBottom);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, attachments?: AttachmentData[]) => {
      try {
        await sendMessageMutation({
          conversationId: parsedConversationId,
          content,
          attachments,
        });
        clearTyping();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send message";
        toast.error(message);
      }
    },
    [parsedConversationId, sendMessageMutation, clearTyping]
  );

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // Edit handler - for now, just show a toast since edit UI is not implemented
  const handleEdit = useCallback((messageId: Id<"messages">) => {
    // TODO: Implement edit modal/inline editing for DM messages
    toast.info("Message editing is not yet available for direct messages");
    void messageId; // Suppress unused variable warning
  }, []);

  // Delete request handler - shows confirmation modal
  const handleDeleteRequest = useCallback((messageId: Id<"messages">) => {
    setDeleteMessageId(messageId);
  }, []);

  // Confirm delete handler - actually deletes the message
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteMessageId) return;
    setIsDeleting(true);
    try {
      await deleteMessageMutation({ messageId: deleteMessageId });
      toast.success("Message deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete message";
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeleteMessageId(null);
    }
  }, [deleteMessageId, deleteMessageMutation]);

  // Thread handlers
  const handleReply = useCallback((messageId: Id<"messages">) => {
    setOpenThreadId(messageId);
  }, []);

  const handleCloseThread = useCallback(() => {
    setOpenThreadId(null);
  }, []);

  const handleSendThreadReply = useCallback(
    async (content: string, attachments?: AttachmentData[]) => {
      if (!openThreadId) return;
      try {
        await sendMessageMutation({
          conversationId: parsedConversationId,
          content,
          parentId: openThreadId,
          attachments,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send reply";
        toast.error(message);
      }
    },
    [openThreadId, parsedConversationId, sendMessageMutation]
  );

  // Loading state
  if (conversationData === undefined) {
    return <DMViewSkeleton />;
  }

  // Conversation not found
  if (!conversationData.conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <MessageCircle className="mb-4 size-12 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Conversation not found</h2>
        <p className="mt-2 text-muted-foreground">
          This conversation may have been deleted or you don&apos;t have access.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => router.push("/messages")}
        >
          Back to messages
        </Button>
      </div>
    );
  }

  const { conversation, messages } = conversationData;
  const participants = conversation.participants as Participant[];

  // Get display name for header
  const getDisplayName = (): string => {
    if (participants.length === 0) return "Unknown";
    if (participants.length === 1) return participants[0]?.name ?? "Unknown";
    const names = participants.slice(0, 3).map((p) => p.name);
    if (participants.length > 3) {
      return `${names.join(", ")} +${participants.length - 3}`;
    }
    return names.join(", ");
  };

  return (
    <div data-slot="dm-view" className="flex h-full flex-col">
      <DMHeader
        conversationId={conversationId}
        participants={participants}
        displayName={getDisplayName()}
        conversationType={conversation.type}
        onBack={() => router.push("/messages")}
      />

      <DMMessageList
        messages={messages as Message[]}
        conversationId={parsedConversationId}
        isAtBottom={isAtBottom}
        onScroll={handleScroll}
        onScrollToBottom={scrollToBottom}
        scrollAreaRef={scrollAreaRef}
        bottomRef={bottomRef}
        className="flex-1"
        onReply={handleReply}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
      />

      <DMMessageInput
        conversationId={conversationId}
        displayName={getDisplayName()}
        onSend={handleSendMessage}
        onTyping={handleTyping}
      />

      {/* Delete Confirmation Modal */}
      <AlertDialog
        open={deleteMessageId !== null}
        onOpenChange={(open) => !open && setDeleteMessageId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this message. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Thread Panel for DM threads */}
      {currentUser && (
        <ThreadPanel
          parentMessageId={openThreadId}
          currentUserId={currentUser._id}
          currentUserName={currentUser.name}
          conversationId={parsedConversationId}
          onClose={handleCloseThread}
          onSendReply={handleSendThreadReply}
        />
      )}
    </div>
  );
}

function DMViewSkeleton(): React.ReactElement {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex-1 space-y-1 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 py-2">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-4">
        <div className="flex items-end gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
