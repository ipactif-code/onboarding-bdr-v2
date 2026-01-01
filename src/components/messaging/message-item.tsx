"use client";

import { Check, MessageSquare } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import * as apiModule from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-plate/tooltip";
import { cn } from "@/lib/utils";
import { getInitials, formatTimestamp } from "@/lib/message-utils";
import { LessonBadge } from "@/components/messaging/lesson-badge";
import { MessageItemSkeleton } from "@/components/messaging/message-item-skeleton";
import { MessageActionButtons } from "@/components/messaging/message-action-buttons";
import { RichTextRenderer } from "@/components/messaging/rich-text-renderer";
import { ReactionBar, ReactionBarSkeleton, type ReactionGroup } from "@/components/messaging/reaction-bar";
import { VoicePlayer, VoicePlayerSkeleton } from "@/components/messaging/voice-player";
import { FileAttachment } from "@/components/messaging/file-attachment";
import { ImageAttachment } from "@/components/messaging/image-attachment";
import { Skeleton } from "@/components/ui/skeleton";
import { isImage } from "@/lib/file-type-utils";

// Type workaround: Convex's API has excessively deep type nesting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;

// ============================================================================
// Types
// ============================================================================

/** Message content type. */
type MessageContentType = "text" | "voice" | "file" | "system";

/** Attachment type returned from getMessageAttachments query. */
interface MessageAttachment {
  _id: Id<"messageAttachments">;
  fileName: string;
  fileSize: number;
  fileType: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  uploadedAt: number;
  downloadUrl: string | null;
}

export interface MessageItemProps {
  id: Id<"messages">;
  content: string;
  /** Content type of the message (text, voice, file, system). Defaults to "text". */
  contentType?: MessageContentType;
  senderId: Id<"users">;
  senderName: string;
  senderAvatarUrl?: string;
  createdAt: number;
  isOwn: boolean;
  isEdited?: boolean;
  threadReplyCount?: number;
  status?: "sending" | "sent" | "failed";
  /** Lesson information for messages linked to a course lesson. */
  lesson?: {
    title: string;
  };
  /**
   * Whether to show the thread reply button and indicator.
   * Set to false when displaying messages inside a thread panel to avoid nested navigation.
   * @default true
   */
  showThreadButton?: boolean;
  /**
   * The current user's display name for highlighting @mentions.
   * When the current user is mentioned, the mention will be highlighted differently.
   */
  currentUserName?: string;
  /** Channel ID for pin functionality (only pass for channel messages). */
  channelId?: Id<"channels">;
  /** Whether current user is a channel admin (for pin authorization). */
  isChannelAdmin?: boolean;
  /**
   * Whether this message has file attachments.
   * When true, attachments will be fetched and displayed below the message content.
   */
  hasAttachments?: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// ============================================================================
// MessageItem Component
// ============================================================================

/**
 * MessageItem component displays a single message in a conversation.
 * Supports different visual states for sending, sent, and failed messages.
 * Shows action buttons on hover for reply, edit (own messages), and delete (own messages).
 */
export function MessageItem({
  id,
  content,
  contentType = "text",
  senderId,
  senderName,
  senderAvatarUrl,
  createdAt,
  isOwn,
  isEdited = false,
  threadReplyCount = 0,
  status = "sent",
  lesson,
  showThreadButton = true,
  currentUserName,
  channelId,
  isChannelAdmin,
  hasAttachments = false,
  onReply,
  onEdit,
  onDelete,
}: MessageItemProps): React.ReactElement {
  // Fetch reactions for this message (real-time subscription)
  const reactions = useQuery(
    api.reactions.getMessageReactions,
    { messageId: id }
  ) as ReactionGroup[] | undefined;

  // Fetch voice message data when contentType is "voice"
  const voiceData = useQuery(
    api.voiceMessages.getVoiceMessage,
    contentType === "voice" ? { messageId: id } : "skip"
  );

  // Fetch attachments when message has them
  const attachments = useQuery(
    api.attachments.getMessageAttachments,
    hasAttachments ? { messageId: id } : "skip"
  );

  // Mutations for transcription
  // - editTranscription and retryTranscription: only available for own messages
  // - requestTranscription: available to any user (anyone can request transcription)
  const editTranscription = useMutation(api.voiceMessages.editTranscription);
  const retryTranscription = useMutation(api.voiceMessages.retryTranscription);
  const requestTranscription = useMutation(api.voiceMessages.requestTranscription);

  // Separate attachments into images and files for different layouts
  const imageAttachments = (attachments as MessageAttachment[] | undefined)?.filter(
    (att: MessageAttachment) => isImage(att.fileType)
  ) ?? [];
  const fileAttachments = (attachments as MessageAttachment[] | undefined)?.filter(
    (att: MessageAttachment) => !isImage(att.fileType)
  ) ?? [];

  return (
    <div
      data-slot="message-item"
      data-message-id={id}
      data-sender-id={senderId}
      data-status={status}
      className={cn(
        "group relative flex gap-3 px-4 py-2 transition-colors hover:bg-muted/50",
        isOwn && "bg-muted/30",
        status === "sending" && "opacity-60",
        status === "failed" && "border-l-2 border-destructive bg-destructive/5"
      )}
    >
      {/* Avatar */}
      <Avatar size="default" className="mt-0.5 shrink-0">
        {senderAvatarUrl ? (
          <AvatarImage src={senderAvatarUrl} alt={senderName} />
        ) : null}
        <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
      </Avatar>

      {/* Message content area */}
      <div className="min-w-0 flex-1">
        {/* Header: sender name, timestamp, status indicator */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {senderName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(createdAt)}
          </span>
          {isEdited && (
            <span className="text-xs text-muted-foreground italic">
              (edited)
            </span>
          )}
          {isOwn && status === "sent" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex" aria-label="Message sent">
                  <Check className="size-3 text-muted-foreground" aria-hidden="true" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Sent</TooltipContent>
            </Tooltip>
          )}
          {status === "failed" && (
            <span className="text-xs font-medium text-destructive">
              Failed to send
            </span>
          )}
        </div>

        {/* Lesson badge for messages linked to a course lesson */}
        {lesson && (
          <div className="mt-1">
            <LessonBadge lessonTitle={lesson.title} />
          </div>
        )}

        {/* Message body */}
        <div className="mt-1 break-words">
          {contentType === "voice" ? (
            voiceData === undefined ? (
              <VoicePlayerSkeleton />
            ) : voiceData && voiceData.audioUrl ? (
              <VoicePlayer
                audioUrl={voiceData.audioUrl}
                duration={voiceData.duration}
                waveformData={voiceData.waveformData}
                transcription={voiceData.transcription}
                transcriptionStatus={voiceData.transcriptionStatus}
                onTranscriptionEdit={
                  isOwn
                    ? (text) => editTranscription({ messageId: id, transcription: text })
                    : undefined
                }
                onTranscriptionRetry={
                  isOwn && voiceData.transcriptionStatus === "failed"
                    ? () => retryTranscription({ messageId: id })
                    : undefined
                }
                onTranscriptionRequest={
                  voiceData.transcriptionStatus === "pending" && !voiceData.transcription
                    ? () => requestTranscription({ messageId: id })
                    : undefined
                }
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Audio file unavailable</span>
              </div>
            )
          ) : (
            <RichTextRenderer content={content} currentUserName={currentUserName} />
          )}
        </div>

        {/* Attachments section */}
        {hasAttachments && (
          <div className="mt-2 space-y-2">
            {/* Loading state */}
            {attachments === undefined && (
              <AttachmentsSkeleton />
            )}

            {/* Images in responsive grid */}
            {imageAttachments.length > 0 && (
              <div
                className={cn(
                  "grid gap-2",
                  imageAttachments.length === 1 && "grid-cols-1",
                  imageAttachments.length === 2 && "grid-cols-2",
                  imageAttachments.length >= 3 && "grid-cols-2 md:grid-cols-3"
                )}
              >
                {imageAttachments.map((attachment: MessageAttachment) => {
                  console.log("[MessageItem] Rendering ImageAttachment with:", {
                    downloadUrl: attachment.downloadUrl,
                    fileName: attachment.fileName,
                    hasDownloadUrl: !!attachment.downloadUrl,
                  });
                  return attachment.downloadUrl ? (
                    <ImageAttachment
                      key={attachment._id}
                      fileName={attachment.fileName}
                      fileSize={attachment.fileSize}
                      fileType={attachment.fileType}
                      downloadUrl={attachment.downloadUrl}
                      thumbnailUrl={attachment.thumbnailUrl}
                      width={attachment.width}
                      height={attachment.height}
                    />
                  ) : null;
                })}
              </div>
            )}

            {/* Files stacked */}
            {fileAttachments.length > 0 && (
              <div className="space-y-1">
                {fileAttachments.map((attachment: MessageAttachment) => (
                  attachment.downloadUrl && (
                    <FileAttachment
                      key={attachment._id}
                      fileName={attachment.fileName}
                      fileSize={attachment.fileSize}
                      fileType={attachment.fileType}
                      downloadUrl={attachment.downloadUrl}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* Thread reply count indicator */}
        {showThreadButton && threadReplyCount > 0 && (
          <button
            type="button"
            onClick={onReply}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
            aria-label={`View ${threadReplyCount} ${threadReplyCount === 1 ? "reply" : "replies"}`}
          >
            <MessageSquare className="size-3" aria-hidden="true" />
            <span>
              {threadReplyCount} {threadReplyCount === 1 ? "reply" : "replies"}
            </span>
          </button>
        )}

        {/* Message reactions */}
        {reactions === undefined ? (
          <ReactionBarSkeleton />
        ) : (
          <ReactionBar
            messageId={id}
            reactions={reactions}
            className="mt-2"
          />
        )}
      </div>

      {/* Action buttons (visible on hover/focus) */}
      <MessageActionButtons
        messageId={id}
        isOwn={isOwn}
        showThreadButton={showThreadButton}
        channelId={channelId}
        isChannelAdmin={isChannelAdmin}
        onReply={onReply}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

// ============================================================================
// AttachmentsSkeleton Component
// ============================================================================

/**
 * Skeleton loader for attachments while they are being fetched.
 */
function AttachmentsSkeleton(): React.ReactElement {
  return (
    <div className="space-y-2" data-slot="attachments-skeleton">
      {/* Skeleton for potential image */}
      <Skeleton className="h-48 w-full max-w-md rounded-lg" />
      {/* Skeleton for potential file */}
      <Skeleton className="h-11 w-full max-w-md rounded-lg" />
    </div>
  );
}

export { MessageItemSkeleton, AttachmentsSkeleton };
