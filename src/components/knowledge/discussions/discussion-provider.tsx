"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { Value } from "platejs";

import type { Id } from "../../../../convex/_generated/dataModel";
import type { PlateUser } from "@/hooks/knowledge/use-current-user";
import { useCurrentUser } from "@/hooks/knowledge/use-current-user";
import {
  useKBCommentMutations,
  type UseKBCommentMutationsReturn,
  type CreateCommentArgs,
} from "@/hooks/knowledge/use-kb-comment-mutations";
import {
  useKBDiscussions,
  type TDiscussion,
} from "@/hooks/knowledge/use-kb-discussions";

// ============================================================================
// Types
// ============================================================================

/**
 * User data structure for Plate.js discussion plugin.
 * Maps user ID to user information.
 */
export type UsersRecord = Record<string, PlateUser>;

/**
 * Context value provided by DiscussionProvider.
 * Bridges Convex data with Plate.js discussion plugin.
 */
export interface DiscussionContextValue {
  // Current user info
  /** Current user's ID */
  currentUserId: string;
  /** Current user in Plate.js format, null if not authenticated */
  currentUser: PlateUser | null;

  // Users map for lookups
  /** Record of all users participating in discussions */
  users: UsersRecord;

  // Discussions data
  /** All discussions for the document in Plate.js TDiscussion format */
  discussions: TDiscussion[];
  /** Whether data is still loading */
  isLoading: boolean;

  // Mutations
  /** Create a new comment or reply - primary method for persisting to Convex */
  createComment: (args: CreateCommentArgs) => Promise<string>;
  /** Add a comment to a discussion (creates discussion if new) - legacy */
  addComment: (discussionId: string, content: Value) => Promise<string>;
  /** Edit an existing comment's content */
  editComment: (commentId: string, content: Value) => Promise<void>;
  /** Delete a comment */
  deleteComment: (commentId: string) => Promise<void>;
  /** Resolve a discussion thread */
  resolveDiscussion: (discussionId: string) => Promise<void>;
  /** Unresolve (reopen) a discussion thread */
  unresolveDiscussion: (discussionId: string) => Promise<void>;
  /** Add an emoji reaction to a comment */
  addReaction: (commentId: string, emoji: string) => Promise<void>;
  /** Remove an emoji reaction from a comment */
  removeReaction: (commentId: string, emoji: string) => Promise<void>;
}

/**
 * Props for the DiscussionProvider component.
 */
export interface DiscussionProviderProps {
  /** The document ID to fetch discussions for */
  documentId: Id<"kbDocuments">;
  /** Child components that will have access to discussion context */
  children: ReactNode;
  /** Whether to include resolved discussions (default: false) */
  includeResolved?: boolean;
}

// ============================================================================
// Context
// ============================================================================

const DiscussionContext = createContext<DiscussionContextValue | null>(null);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a fallback avatar URL using DiceBear.
 * Used when a user has no avatar set.
 *
 * @param userId - User ID to use as seed for deterministic avatar
 * @returns DiceBear avatar URL
 */
function generateFallbackAvatarUrl(userId: string): string {
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(userId)}`;
}

/**
 * Generate a consistent hue value from a user ID.
 * Used for cursor colors in collaborative editing.
 *
 * @param userId - User ID to generate hue from
 * @returns Hue value between 0 and 359
 */
function generateHueFromUserId(userId: string): number {
  if (!userId || userId.length === 0) {
    return 0;
  }

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }

  return Math.abs(hash) % 360;
}

/**
 * Build a users record from discussions data.
 * Extracts all unique users from discussions and their comments.
 *
 * @param discussions - Array of discussions
 * @param currentUser - Current user (if authenticated)
 * @returns Record mapping user ID to PlateUser
 */
function buildUsersFromDiscussions(
  discussions: TDiscussion[],
  currentUser: PlateUser | null
): UsersRecord {
  const users: UsersRecord = {};

  // Add current user first (if authenticated)
  if (currentUser) {
    users[currentUser.id] = currentUser;
  }

  // Extract all unique user IDs from discussions
  for (const discussion of discussions) {
    // Add discussion author
    if (!users[discussion.userId]) {
      users[discussion.userId] = createPlaceholderUser(discussion.userId);
    }

    // Add comment authors
    for (const comment of discussion.comments) {
      if (!users[comment.userId]) {
        users[comment.userId] = createPlaceholderUser(comment.userId);
      }
    }
  }

  return users;
}

/**
 * Create a placeholder user for when full user data isn't available.
 * This happens when we only have a user ID from the discussions data.
 *
 * @param userId - The user ID
 * @returns PlateUser with placeholder data
 */
function createPlaceholderUser(userId: string): PlateUser {
  return {
    id: userId,
    name: `User ${userId.slice(-4)}`, // Use last 4 chars as name
    avatarUrl: generateFallbackAvatarUrl(userId),
    hue: generateHueFromUserId(userId),
  };
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Provider component that bridges Convex data with Plate.js discussion plugin.
 *
 * Fetches discussions and current user from Convex, transforms them into
 * the format expected by Plate.js, and provides mutation callbacks.
 *
 * @example
 * ```tsx
 * <DiscussionProvider documentId={params.documentId}>
 *   <KnowledgeEditor />
 * </DiscussionProvider>
 * ```
 */
export function DiscussionProvider({
  documentId,
  children,
  includeResolved = false,
}: DiscussionProviderProps): React.ReactElement {
  // Fetch current user
  const { currentUser, isLoading: isUserLoading } = useCurrentUser();

  // Fetch discussions
  const { discussions, isLoading: isDiscussionsLoading } = useKBDiscussions({
    documentId,
    includeResolved,
  });

  // Get mutation callbacks
  const mutations: UseKBCommentMutationsReturn = useKBCommentMutations({
    documentId,
  });

  // Combined loading state
  const isLoading = isUserLoading || isDiscussionsLoading;

  // Build users record from discussions
  const users = useMemo(
    () => buildUsersFromDiscussions(discussions, currentUser),
    [discussions, currentUser]
  );

  // Current user ID (empty string if not authenticated)
  const currentUserId = currentUser?.id ?? "";

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<DiscussionContextValue>(
    () => ({
      currentUserId,
      currentUser,
      users,
      discussions,
      isLoading,
      createComment: mutations.createComment,
      addComment: mutations.addComment,
      editComment: mutations.editComment,
      deleteComment: mutations.deleteComment,
      resolveDiscussion: mutations.resolveDiscussion,
      unresolveDiscussion: mutations.unresolveDiscussion,
      addReaction: mutations.addReaction,
      removeReaction: mutations.removeReaction,
    }),
    [
      currentUserId,
      currentUser,
      users,
      discussions,
      isLoading,
      mutations.createComment,
      mutations.addComment,
      mutations.editComment,
      mutations.deleteComment,
      mutations.resolveDiscussion,
      mutations.unresolveDiscussion,
      mutations.addReaction,
      mutations.removeReaction,
    ]
  );

  return (
    <DiscussionContext.Provider value={contextValue}>
      {children}
    </DiscussionContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access discussion context.
 *
 * Must be used within a DiscussionProvider.
 *
 * @returns DiscussionContextValue with current user, discussions, and mutations
 * @throws Error if used outside of DiscussionProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     currentUserId,
 *     discussions,
 *     addComment,
 *   } = useDiscussionContext();
 *
 *   // Use in Plate.js plugin configuration
 *   editor.setOption(discussionPlugin, 'currentUserId', currentUserId);
 *   editor.setOption(discussionPlugin, 'discussions', discussions);
 * }
 * ```
 */
export function useDiscussionContext(): DiscussionContextValue {
  const context = useContext(DiscussionContext);

  if (!context) {
    throw new Error(
      "useDiscussionContext must be used within a DiscussionProvider"
    );
  }

  return context;
}

// ============================================================================
// Optional Hook (safe version that doesn't throw)
// ============================================================================

/**
 * Hook to optionally access discussion context.
 *
 * Unlike useDiscussionContext, this hook returns null if used outside
 * of a DiscussionProvider instead of throwing an error.
 *
 * @returns DiscussionContextValue or null if not within provider
 *
 * @example
 * ```tsx
 * function OptionalDiscussionFeature() {
 *   const context = useOptionalDiscussionContext();
 *
 *   if (!context) {
 *     return null; // Not in a discussion context
 *   }
 *
 *   return <DiscussionPanel discussions={context.discussions} />;
 * }
 * ```
 */
export function useOptionalDiscussionContext(): DiscussionContextValue | null {
  return useContext(DiscussionContext);
}
