"use client";

import * as React from "react";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CommandPalette } from "./command-palette";

// ============================================================================
// Types
// ============================================================================

interface CommandPaletteContextValue {
  /** Whether the command palette is open */
  open: boolean;
  /** Set the open state of the command palette */
  setOpen: (open: boolean) => void;
  /** Toggle the command palette open/closed */
  toggle: () => void;
}

// ============================================================================
// Context
// ============================================================================

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
);

// ============================================================================
// Hook
// ============================================================================

/**
 * useCommandPalette - Access the command palette context.
 *
 * Provides methods to control the command palette state:
 * - `open`: Current open state
 * - `setOpen`: Set the open state
 * - `toggle`: Toggle open/closed
 *
 * @throws Error if used outside of CommandPaletteProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { open, setOpen, toggle } = useCommandPalette();
 *
 *   return (
 *     <Button onClick={toggle}>
 *       Open Command Palette (Cmd+K)
 *     </Button>
 *   );
 * }
 * ```
 */
export function useCommandPalette(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider"
    );
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface CommandPaletteProviderProps {
  children: React.ReactNode;
}

/**
 * CommandPaletteProvider - Provides global command palette functionality.
 *
 * Features:
 * - Listens for Ctrl+K / Cmd+K keyboard shortcut globally
 * - Provides context for controlling the palette from any component
 * - Renders the CommandPalette component
 *
 * Place this provider near the root of your app, inside the ConvexProvider
 * but outside individual page components.
 *
 * @example
 * ```tsx
 * // In your root layout or app component
 * <ConvexProvider>
 *   <CommandPaletteProvider>
 *     {children}
 *   </CommandPaletteProvider>
 * </ConvexProvider>
 * ```
 */
export function CommandPaletteProvider({
  children,
}: CommandPaletteProviderProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  // Global keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Ctrl+K (Windows/Linux) or Cmd+K (Mac)
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return (): void => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggle]);

  const contextValue: CommandPaletteContextValue = {
    open,
    setOpen,
    toggle,
  };

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}
