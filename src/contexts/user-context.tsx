"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

type UserRole = "admin" | "user";

interface User {
  id: string;
  clerkId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  isAdmin: false,
});

export function UserProvider({ children }: { children: ReactNode }): ReactNode {
  const data = useQuery(api.users.me);
  const isLoading = data === undefined;

  const user: User | null = data ? {
    id: data._id,
    clerkId: data.clerkId,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
    avatarUrl: data.avatarUrl,
  } : null;

  const value: UserContextType = {
    user,
    isLoading,
    isAdmin: data?.role === "admin",
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
