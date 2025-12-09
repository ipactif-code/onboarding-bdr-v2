"use client";

import { ReactNode, useEffect, useMemo } from "react";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { useAuth } from "@clerk/nextjs";

interface ConvexClientProviderProps {
  children: ReactNode;
}

function ConvexProviderWithAuth({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  // Create a stable Convex client
  const convex = useMemo(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
    []
  );

  // Set up auth when the auth state changes
  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        // Provide the token fetcher to Convex
        // Use the "convex" JWT template from Clerk
        convex.setAuth(async () => {
          const token = await getToken({ template: "convex" });
          return token ?? undefined;
        });
      } else {
        // Clear auth when signed out
        convex.clearAuth();
      }
    }
  }, [convex, getToken, isLoaded, isSignedIn]);

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

export function ConvexClientProvider({
  children,
}: ConvexClientProviderProps): ReactNode {
  return <ConvexProviderWithAuth>{children}</ConvexProviderWithAuth>;
}
