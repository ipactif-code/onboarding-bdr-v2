"use client";

import { useState, useEffect, type ReactElement } from "react";
import { useQuery, useMutation } from "convex/react";
import { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { Search, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface NewMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: Id<"conversations">) => void;
}

export function NewMessageModal({
  open,
  onOpenChange,
  onConversationCreated,
}: NewMessageModalProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<{
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Search users (only when modal is open AND query is 2+ characters)
  const searchResults = useQuery(
    api.users.search,
    open && searchQuery.length >= 2 ? { query: searchQuery, limit: 10 } : "skip"
  );

  const sendDirect = useMutation(api.messages.sendDirect);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedUser(null);
      setMessage("");
    }
  }, [open]);

  const handleSelectUser = (user: {
    _id: Id<"users">;
    name: string;
    avatarUrl?: string;
  }): void => {
    setSelectedUser(user);
    setSearchQuery("");
  };

  const handleSend = async (): Promise<void> => {
    if (!selectedUser || !message.trim()) return;

    setIsSending(true);
    try {
      const result = await sendDirect({
        recipientId: selectedUser._id,
        content: message.trim(),
      });

      toast.success("Message sent");
      onConversationCreated(result.conversationId);
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected User or Search */}
          {selectedUser ? (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage src={selectedUser.avatarUrl} />
                  <AvatarFallback>
                    {getInitials(selectedUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">
                    {selectedUser.name}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedUser(null)}
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              {/* Search Results */}
              {searchQuery.length >= 2 && (
                <ScrollArea className="h-[200px] border rounded-lg">
                  {searchResults === undefined ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No users found
                    </div>
                  ) : (
                    <div className="p-1">
                      {searchResults.map((user: { _id: Id<"users">; name: string; avatarUrl?: string }) => (
                        <button
                          key={user._id}
                          onClick={() => handleSelectUser(user)}
                          className="flex w-full items-center gap-3 rounded-md p-2 hover:bg-muted"
                        >
                          <Avatar className="size-8">
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback>
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {user.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}

              {searchQuery.length > 0 && searchQuery.length < 2 && (
                <p className="text-xs text-muted-foreground">
                  Type at least 2 characters to search
                </p>
              )}
            </div>
          )}

          {/* Message Input (only shown when user is selected) */}
          {selectedUser && (
            <div className="space-y-2">
              <Textarea
                placeholder="Write your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || isSending}
                >
                  {isSending ? (
                    <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  ) : (
                    <Send className="size-4" data-icon="inline-start" />
                  )}
                  Send Message
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
