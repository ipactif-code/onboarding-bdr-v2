"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useVoiceSender hook.
 */
export interface UseVoiceSenderOptions {
  /** Channel ID for channel voice messages (mutually exclusive with conversationId) */
  channelId?: Id<"channels">;
  /** Conversation ID for DM voice messages (mutually exclusive with channelId) */
  conversationId?: Id<"conversations">;
  /** Lesson ID for lesson-specific discussions (only used with channelId) */
  lessonId?: Id<"lessons">;
  /** Parent message ID for thread replies */
  parentId?: Id<"messages">;
  /** Callback fired on successful send */
  onSuccess?: () => void;
  /** Callback fired on error */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useVoiceSender hook.
 */
export interface UseVoiceSenderReturn {
  /** Send a voice message blob to the server */
  sendVoice: (
    blob: Blob,
    mimeType: string,
    duration: number,
    waveformData: number[]
  ) => Promise<void>;
  /** Whether a voice message is currently being uploaded */
  isUploading: boolean;
  /** Error from the last send attempt, if any */
  error: Error | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for uploading and sending voice messages to Convex.
 * Handles the upload workflow: generate URL -> upload blob -> send message.
 *
 * @example
 * ```tsx
 * const { sendVoice, isUploading, error } = useVoiceSender({
 *   channelId,
 *   onSuccess: () => setIsVoiceMode(false),
 *   onError: (err) => toast.error("Voice message failed"),
 * });
 *
 * // When recording is complete:
 * await sendVoice(audioBlob, mimeType, duration, waveformData);
 * ```
 */
export function useVoiceSender(
  options: UseVoiceSenderOptions
): UseVoiceSenderReturn {
  const {
    channelId,
    conversationId,
    lessonId,
    parentId,
    onSuccess,
    onError,
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Convex mutations for voice messages
  const generateUploadUrl = useMutation(api.voiceMessages.generateUploadUrl);
  const sendVoiceToChannel = useMutation(api.voiceMessages.sendVoiceToChannel);
  const sendVoiceToConversation = useMutation(
    api.voiceMessages.sendVoiceToConversation
  );

  const sendVoice = useCallback(
    async (
      blob: Blob,
      mimeType: string,
      duration: number,
      waveformData: number[]
    ): Promise<void> => {
      if (isUploading) return;
      if (!channelId && !conversationId) {
        const err = new Error(
          "Either channelId or conversationId must be provided"
        );
        setError(err);
        onError?.(err);
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        // Step 1: Get upload URL from Convex
        const uploadUrl = await generateUploadUrl();

        // Step 2: Upload the audio blob to Convex Storage
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: blob,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload audio file");
        }

        const { storageId } = await uploadResponse.json();

        // Step 3: Send the voice message using the appropriate mutation
        if (channelId) {
          await sendVoiceToChannel({
            channelId,
            storageId,
            duration,
            fileSize: blob.size,
            mimeType,
            waveformData,
            parentId,
            lessonId,
          });
        } else if (conversationId) {
          await sendVoiceToConversation({
            conversationId,
            storageId,
            duration,
            fileSize: blob.size,
            mimeType,
            waveformData,
          });
        }

        toast.success("Voice message sent");
        onSuccess?.();
      } catch (err) {
        const errorInstance =
          err instanceof Error ? err : new Error("Failed to send voice message");
        setError(errorInstance);
        toast.error(errorInstance.message);
        onError?.(errorInstance);
      } finally {
        setIsUploading(false);
      }
    },
    [
      isUploading,
      channelId,
      conversationId,
      lessonId,
      parentId,
      generateUploadUrl,
      sendVoiceToChannel,
      sendVoiceToConversation,
      onSuccess,
      onError,
    ]
  );

  return {
    sendVoice,
    isUploading,
    error,
  };
}
