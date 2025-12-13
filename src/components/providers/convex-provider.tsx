"use client";

import { ReactNode, useEffect, useMemo, useState, createContext, useContext } from "react";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { useAuth } from "@clerk/nextjs";

// Context to expose auth ready state
interface ConvexAuthContextType {
  isAuthReady: boolean;
}

const ConvexAuthContext = createContext<ConvexAuthContextType>({ isAuthReady: false });

export function useConvexAuth() {
  return useContext(ConvexAuthContext);
}

interface ConvexClientProviderProps {
  children: ReactNode;
}

function ConvexProviderWithAuth({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Create a stable Convex client
  const convex = useMemo(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
    []
  );

  // Set up auth when the auth state changes
  useEffect(() => {
    if (!isLoaded) {
      setIsAuthReady(false);
      return;
    }

    if (isSignedIn) {
      // Provide the token fetcher to Convex
      // Use the "convex" JWT template from Clerk
      convex.setAuth(async () => {
        const token = await getToken({ template: "convex" });
        return token ?? undefined;
      });

      // Fetch token once to ensure it's ready, then mark auth as ready
      const initializeAuth = async () => {
        try {
          await getToken({ template: "convex" });
          setIsAuthReady(true);
        } catch (error) {
          console.error("Failed to initialize Convex auth:", error);
          setIsAuthReady(true); // Still mark ready to avoid infinite loading
        }
      };

      initializeAuth();
    } else {
      // Not signed in - clear auth and mark as ready
      convex.clearAuth();
      setIsAuthReady(true);
    }
  }, [convex, getToken, isLoaded, isSignedIn]);

  return (
    <ConvexAuthContext.Provider value={{ isAuthReady }}>
      <ConvexProvider client={convex}>{children}</ConvexProvider>
    </ConvexAuthContext.Provider>
  );
}

export function ConvexClientProvider({
  children,
}: ConvexClientProviderProps): ReactNode {
  return <ConvexProviderWithAuth>{children}</ConvexProviderWithAuth>;
}
