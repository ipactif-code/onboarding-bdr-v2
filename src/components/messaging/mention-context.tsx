"use client";

/**
 * MentionContext - Context for providing the current user's name to mention components.
 *
 * Used to highlight mentions of the current user differently (amber background)
 * compared to other mentions (blue text).
 */

import * as React from "react";

// ============================================================================
// Types
// ============================================================================

/**
 * Context value for mention highlighting.
 */
export interface MentionContextValue {
  /** The current user's display name for highlighting their mentions. */
  currentUserName?: string;
}

// ============================================================================
// Context
// ============================================================================

const MentionContext = React.createContext<MentionContextValue>({});

// ============================================================================
// Provider
// ============================================================================

/**
 * Provider component for mention context.
 * Wrap RichTextRenderer content with this to enable current user highlighting.
 *
 * @example
 * ```tsx
 * <MentionContextProvider currentUserName="John Doe">
 *   <RichTextRenderer content={content} />
 * </MentionContextProvider>
 * ```
 */
export function MentionContextProvider({
  children,
  currentUserName,
}: {
  children: React.ReactNode;
  currentUserName?: string;
}): React.ReactElement {
  const value = React.useMemo(
    () => ({ currentUserName }),
    [currentUserName]
  );
  return (
    <MentionContext.Provider value={value}>
      {children}
    </MentionContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the mention context.
 *
 * @returns The current mention context value with currentUserName.
 */
export function useMentionContext(): MentionContextValue {
  return React.useContext(MentionContext);
}
