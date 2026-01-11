"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;

// ============================================================================
// Types
// ============================================================================

/**
 * Plate.js user format for collaboration and discussions.
 * Used by the Plate.js discussion plugin for comments and cursors.
 */
export interface PlateUser {
  /** Unique user identifier (Convex user ID as string) */
  id: string;
  /** Display name for the user */
  name: string;
  /** Avatar URL for the user */
  avatarUrl: string;
  /** Hue value (0-359) for cursor color in collaborative editing */
  hue: number;
}

/**
 * Return type for the useCurrentUser hook.
 */
export interface UseCurrentUserReturn {
  /** Current user in Plate.js format, null if not authenticated */
  currentUser: PlateUser | null;
  /** Whether the user data is still loading */
  isLoading: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a fallback avatar URL using DiceBear.
 * Uses the glass style for a modern, consistent look.
 *
 * @param userId - User ID to use as seed for deterministic avatar
 * @returns DiceBear avatar URL
 */
function generateFallbackAvatarUrl(userId: string): string {
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(userId)}`;
}

/**
 * Generate a consistent hue value from a user ID.
 * Uses a simple hash based on character codes for determinism.
 *
 * @param userId - User ID to generate hue from
 * @returns Hue value between 0 and 359
 */
function generateHueFromUserId(userId: string): number {
  if (!userId || userId.length === 0) {
    return 0;
  }

  // Use a simple hash combining multiple characters for better distribution
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }

  // Normalize to 0-359 range (hue values)
  return Math.abs(hash) % 360;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook that returns the current user in Plate.js user format.
 *
 * Transforms Convex user data into the format expected by Plate.js
 * discussion and collaboration plugins.
 *
 * @returns Current user in Plate.js format with loading state
 *
 * @example
 * ```tsx
 * const { currentUser, isLoading } = useCurrentUser();
 *
 * if (isLoading) {
 *   return <Skeleton />;
 * }
 *
 * if (!currentUser) {
 *   return <SignInPrompt />;
 * }
 *
 * // Use currentUser for Plate.js discussion plugin
 * <DiscussionProvider user={currentUser}>
 *   <Editor />
 * </DiscussionProvider>
 * ```
 */
export function useCurrentUser(): UseCurrentUserReturn {
  // Fetch current user from Convex
  const user = useQuery(api.users.me);

  // Transform user to Plate.js format with memoization
  const currentUser = useMemo<PlateUser | null>(() => {
    // Still loading
    if (user === undefined) {
      return null;
    }

    // Not authenticated
    if (user === null) {
      return null;
    }

    const userId = user._id.toString();

    return {
      id: userId,
      name: user.name,
      avatarUrl: user.avatarUrl || generateFallbackAvatarUrl(userId),
      hue: generateHueFromUserId(userId),
    };
  }, [user]);

  // Loading state: user is undefined (query still in flight)
  const isLoading = user === undefined;

  return {
    currentUser,
    isLoading,
  };
}
