"use client";

import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

/**
 * Online user info returned by the hook
 */
export interface OnlineUser {
  /**
   * The user's Convex ID
   */
  userId: Id<"users">;

  /**
   * The user's display name
   */
  name: string;
}

/**
 * Return type for the useOnlineUsers hook
 */
export interface UseOnlineUsersReturn {
  /**
   * Array of currently online users
   */
  users: OnlineUser[];

  /**
   * Whether the data is still loading
   */
  isLoading: boolean;
}

/**
 * Hook to get all currently online users.
 *
 * Useful for @here mentions which should notify all active users.
 * Users are considered "online" if they:
 * - Have status explicitly set to "online", OR
 * - Have been active within the last 5 minutes
 *
 * Uses Convex's real-time subscriptions to automatically update
 * when users come online or go offline.
 *
 * @returns Object with users array and isLoading state
 *
 * @example
 * ```tsx
 * const { users, isLoading } = useOnlineUsers();
 *
 * if (isLoading) return <Skeleton />;
 *
 * return (
 *   <div>
 *     {users.length} users online
 *     {users.map(user => (
 *       <span key={user.userId}>{user.name}</span>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useOnlineUsers(): UseOnlineUsersReturn {
  const data = useQuery(api.presence.getOnlineUsers);

  return {
    users: data ?? [],
    isLoading: data === undefined,
  };
}
