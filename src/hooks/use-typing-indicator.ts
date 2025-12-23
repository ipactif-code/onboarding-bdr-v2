"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Debounce interval for typing indicator updates (in milliseconds).
 * Prevents spamming the API with rapid-fire updates while user types.
 */
const TYPING_DEBOUNCE_MS = 2000;

/**
 * Inactivity timeout after which typing indicator auto-clears (in milliseconds).
 * This is slightly less than the server-side expiry (3000ms) to ensure
 * the indicator clears smoothly on the client side.
 */
const TYPING_INACTIVITY_MS = 2500;

/**
 * Options for the useTypingIndicator hook.
 */
export interface UseTypingIndicatorOptions {
  /**
   * The ID of the conversation to track typing for.
   * This should be a valid Convex ID for the conversations table.
   */
  conversationId: string;
}

/**
 * Return type for the useTypingIndicator hook.
 */
export interface UseTypingIndicatorReturn {
  /**
   * Call this when the user types (debounced internally).
   * Safe to call on every keystroke - will only update the server
   * at most once per TYPING_DEBOUNCE_MS.
   */
  handleTyping: () => void;

  /**
   * Call this when the user stops typing or sends a message.
   * Immediately clears the typing indicator on the server.
   */
  clearTyping: () => void;
}

/**
 * Hook for managing typing indicator state from the input side.
 *
 * Features:
 * - Debounces keystroke handling (calls setTyping at most every 2 seconds)
 * - Auto-clears after inactivity (relies on server expiry as backup)
 * - Cleans up on unmount
 * - Safe to call handleTyping on every keystroke
 *
 * @example
 * ```tsx
 * const { handleTyping, clearTyping } = useTypingIndicator({
 *   conversationId: "abc123"
 * });
 *
 * // On input change
 * <input onChange={() => handleTyping()} />
 *
 * // On message send
 * const handleSend = async () => {
 *   await sendMessage(...);
 *   clearTyping();
 * };
 * ```
 */
export function useTypingIndicator(
  options: UseTypingIndicatorOptions
): UseTypingIndicatorReturn {
  const { conversationId } = options;

  // Convex mutations for typing indicator
  const setTypingMutation = useMutation(api.typing.setTyping);
  const clearTypingMutation = useMutation(api.typing.clearTyping);

  // Track last time we sent a typing update to the server
  const lastTypingTimeRef = useRef<number>(0);

  // Timer refs for debouncing and inactivity timeout
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clear the typing indicator on the server.
   * Called when user sends a message or navigates away.
   */
  const clearTyping = useCallback((): void => {
    // Clear any pending timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // Reset last typing time
    lastTypingTimeRef.current = 0;

    // Clear on server (fire and forget, no need to await)
    void clearTypingMutation({
      conversationId: conversationId as Id<"conversations">,
    });
  }, [clearTypingMutation, conversationId]);

  /**
   * Handle user typing. This is debounced internally - safe to call
   * on every keystroke without overwhelming the server.
   */
  const handleTyping = useCallback((): void => {
    const now = Date.now();

    // Clear any existing inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Set new inactivity timer - will auto-clear if user stops typing
    inactivityTimerRef.current = setTimeout(() => {
      clearTyping();
    }, TYPING_INACTIVITY_MS);

    // Check if we've exceeded the debounce interval
    const timeSinceLastTyping = now - lastTypingTimeRef.current;

    if (timeSinceLastTyping >= TYPING_DEBOUNCE_MS) {
      // Immediately send typing update
      lastTypingTimeRef.current = now;
      void setTypingMutation({
        conversationId: conversationId as Id<"conversations">,
      });
    } else if (!debounceTimerRef.current) {
      // Schedule a debounced update for the remaining time
      const remainingTime = TYPING_DEBOUNCE_MS - timeSinceLastTyping;
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        lastTypingTimeRef.current = Date.now();
        void setTypingMutation({
          conversationId: conversationId as Id<"conversations">,
        });
      }, remainingTime);
    }
  }, [setTypingMutation, clearTyping, conversationId]);

  // Cleanup on unmount - clear typing indicator and timers
  useEffect(() => {
    return () => {
      // Clear timers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      // Clear typing indicator on server
      void clearTypingMutation({
        conversationId: conversationId as Id<"conversations">,
      });
    };
  }, [clearTypingMutation, conversationId]);

  return {
    handleTyping,
    clearTyping,
  };
}
