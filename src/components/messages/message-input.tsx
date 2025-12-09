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
