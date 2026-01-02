"use client";

import * as React from "react";
import { createContext, useContext, useState, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

interface MobileSidebarContextValue {
  /** Whether the mobile sidebar is currently open */
  isOpen: boolean;
  /** Open the mobile sidebar */
  open: () => void;
  /** Close the mobile sidebar */
  close: () => void;
  /** Toggle the mobile sidebar */
  toggle: () => void;
}

// ============================================================================
// Context
// ============================================================================

const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(
  null
);

// ============================================================================
// Provider
// ============================================================================

interface MobileSidebarProviderProps {
  children: React.ReactNode;
}

/**
 * Provider for managing mobile sidebar visibility state.
 *
 * Use this context to control the messaging sidebar on mobile devices.
 * The sidebar is rendered as a Sheet (slide-in drawer) on mobile.
 *
 * @example
 * ```tsx
 * <MobileSidebarProvider>
 *   <MessagesLayout>{children}</MessagesLayout>
 * </MobileSidebarProvider>
 * ```
 */
export function MobileSidebarProvider({
  children,
}: MobileSidebarProviderProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const value = React.useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return (
    <MobileSidebarContext.Provider value={value}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access mobile sidebar state and controls.
 *
 * Must be used within a MobileSidebarProvider.
 *
 * @example
 * ```tsx
 * const { isOpen, open, close, toggle } = useMobileSidebar();
 *
 * // In a hamburger menu button
 * <Button onClick={toggle} aria-label="Toggle navigation">
 *   <Menu />
 * </Button>
 * ```
 */
export function useMobileSidebar(): MobileSidebarContextValue {
  const context = useContext(MobileSidebarContext);

  if (!context) {
    throw new Error(
      "useMobileSidebar must be used within a MobileSidebarProvider"
    );
  }

  return context;
}

export { MobileSidebarContext };
