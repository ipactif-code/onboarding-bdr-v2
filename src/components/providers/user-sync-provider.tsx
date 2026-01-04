"use client";

import { ReactNode, type ReactElement } from "react";
import { useEnsureUser } from "@/hooks/use-ensure-user";

interface UserSyncProviderProps {
  children: ReactNode;
}

/**
 * Provider component that ensures the current user exists in the database.
 * Should be placed inside ConvexProviderWithClerk and ClerkProvider.
 */
export function UserSyncProvider({ children }: UserSyncProviderProps): ReactElement {
  useEnsureUser();
  return <>{children}</>;
}
