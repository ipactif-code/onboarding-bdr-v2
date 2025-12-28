"use client";

import { MessageInput } from "@/components/messaging/message-input";
import { TypingIndicator } from "@/components/messaging/typing-indicator";
import { Id } from "../../../../../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export interface DMMessageInputProps {
  /**
   * The conversation ID for typing indicator subscription.
   */
  conversationId: string;

  /**
   * Display name for the placeholder text.
   */
  displayName: string;

  /**
   * Callback when user sends a message.
   */
  onSend: (content: string) => void;

  /**
   * Optional callback when user is typing (for typing indicator).
   */
  onTyping?: () => void;
}

// ============================================================================
// DMMessageInput Component
// ============================================================================

/**
 * Message input section for direct message conversations.
 * Combines the TypingIndicator and MessageInput components.
 */
export function DMMessageInput({
  conversationId,
  displayName,
  onSend,
  onTyping,
}: DMMessageInputProps): React.ReactElement {
  return (
    <div data-slot="dm-message-input">
      {/* Typing indicator - shows who is typing */}
      <TypingIndicator conversationId={conversationId} />

      {/* Message input */}
      <div className="border-t p-4">
        <MessageInput
          onSend={onSend}
          onTyping={onTyping}
          placeholder={`Message ${displayName}`}
          conversationId={conversationId as Id<"conversations">}
        />
      </div>
    </div>
  );
}
