"use client";

import { ReactNode } from "react";
import { useEnsureUser } from "@/hooks/use-ensure-user";

interface UserSyncProviderProps {
  children: ReactNode;
}

/**
 * Provider component that ensures the current user exists in the database.
 * Should be placed inside ConvexProviderWithClerk and ClerkProvider.
 */
export function UserSyncProvider({ children }: UserSyncProviderProps) {
  useEnsureUser();
  return <>{children}</>;
}
