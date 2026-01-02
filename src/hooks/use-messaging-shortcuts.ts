"use client";

import { useCallback, useEffect } from "react";
import { useCommandPalette } from "@/components/command-palette";

// ============================================================================
// Types
// ============================================================================

interface UseMessagingShortcutsOptions {
  /** Callback when Escape is pressed to close panels */
  onClosePanel?: () => void;
  /** Whether the thread panel is currently open */
  isThreadPanelOpen?: boolean;
}

interface UseMessagingShortcutsReturn {
  /** Opens the search (command palette) */
  onOpenSearch: () => void;
  /** Closes any open panel */
  onClosePanel: () => void;
  /** Whether the search/command palette is open */
  isSearchOpen: boolean;
  /** Sets the search open state */
  setIsSearchOpen: (open: boolean) => void;
  /** ARIA keyboard shortcut string for search elements */
  searchAriaKeyShortcuts: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Checks if the active element is an input field where keyboard shortcuts
 * should be suppressed.
 */
function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();

  // Input, textarea, and contenteditable elements
  if (tagName === "input" || tagName === "textarea") {
    return true;
  }

  // ContentEditable elements (like Plate.js editor)
  if (activeElement.hasAttribute("contenteditable")) {
    return activeElement.getAttribute("contenteditable") === "true";
  }

  // Elements with role="textbox" (accessibility pattern)
  if (activeElement.getAttribute("role") === "textbox") {
    return true;
  }

  return false;
}

/**
 * Detects if the user is on a Mac for keyboard shortcut display.
 */
function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes("Mac");
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useMessagingShortcuts - Global keyboard shortcuts for the messaging UI.
 *
 * Provides centralized keyboard shortcut handling for:
 * - **Ctrl+K / Cmd+K**: Opens the command palette (search)
 * - **Escape**: Closes open panels (thread panel, search results)
 *
 * Shortcuts are suppressed when focus is in input fields to avoid
 * interfering with text editing.
 *
 * @param options.onClosePanel - Callback when Esc is pressed to close panels
 * @param options.isThreadPanelOpen - Whether thread panel is currently open
 * @returns Shortcut handlers and state for search/panels
 *
 * @example
 * ```tsx
 * function MessagesLayout({ children }) {
 *   const [threadPanelOpen, setThreadPanelOpen] = useState(false);
 *
 *   const {
 *     onOpenSearch,
 *     isSearchOpen,
 *     searchAriaKeyShortcuts,
 *   } = useMessagingShortcuts({
 *     onClosePanel: () => setThreadPanelOpen(false),
 *     isThreadPanelOpen: threadPanelOpen,
 *   });
 *
 *   return (
 *     <div aria-keyshortcuts={searchAriaKeyShortcuts}>
 *       {children}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMessagingShortcuts(
  options: UseMessagingShortcutsOptions = {}
): UseMessagingShortcutsReturn {
  const { onClosePanel, isThreadPanelOpen = false } = options;

  // Connect to the global command palette context
  const { open: isSearchOpen, setOpen: setIsSearchOpen } = useCommandPalette();

  // ========================================================================
  // Handlers
  // ========================================================================

  const onOpenSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, [setIsSearchOpen]);

  const handleClosePanel = useCallback(() => {
    onClosePanel?.();
  }, [onClosePanel]);

  // ========================================================================
  // Global Escape Key Handler
  // ========================================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Only handle Escape key
      if (event.key !== "Escape") return;

      // Don't handle if in input field
      if (isInputFocused()) return;

      // Priority order for closing:
      // 1. Search/command palette is handled by Dialog itself
      // 2. Thread panel
      if (isSearchOpen) {
        // Let the Dialog component handle its own Escape
        return;
      }

      if (isThreadPanelOpen) {
        event.preventDefault();
        handleClosePanel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return (): void => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSearchOpen, isThreadPanelOpen, handleClosePanel]);

  // ========================================================================
  // ARIA Keyboard Shortcut String
  // ========================================================================

  // Use platform-appropriate modifier key for accessibility
  const searchAriaKeyShortcuts = isMac()
    ? "Meta+k"
    : "Control+k";

  return {
    onOpenSearch,
    onClosePanel: handleClosePanel,
    isSearchOpen,
    setIsSearchOpen,
    searchAriaKeyShortcuts,
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Returns the keyboard shortcut display text for search.
 * Use this for showing shortcut hints in UI.
 *
 * @example
 * ```tsx
 * <kbd>{getSearchShortcutDisplay()}</kbd> // "Cmd+K" on Mac, "Ctrl+K" on Windows
 * ```
 */
export function getSearchShortcutDisplay(): string {
  return isMac() ? "Cmd+K" : "Ctrl+K";
}

/**
 * Returns individual parts for custom keyboard hint rendering.
 *
 * @example
 * ```tsx
 * const { modifier, key } = getSearchShortcutParts();
 * <kbd className="..."><span>{modifier}</span>{key}</kbd>
 * ```
 */
export function getSearchShortcutParts(): { modifier: string; key: string } {
  return {
    modifier: isMac() ? "Cmd" : "Ctrl",
    key: "K",
  };
}
