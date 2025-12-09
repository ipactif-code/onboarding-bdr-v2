"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";

/**
 * Hook that ensures the current user exists in the Convex database.
 * Call this in a component that renders when the user is authenticated.
 *
 * This handles the case where:
 * 1. User signs in with Clerk
 * 2. Clerk webhook hasn't fired yet (or failed)
 * 3. User tries to access the app
 *
 * Without this, queries that use requireAuth would fail because
 * the user doesn't exist in the database yet.
 */
export function useEnsureUser() {
  const { isSignedIn, isLoaded } = useAuth();
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const hasEnsured = useRef(false);

  useEffect(() => {
    // Only run once per session when user is signed in
    if (isLoaded && isSignedIn && !hasEnsured.current) {
      hasEnsured.current = true;
      ensureCurrentUser().catch((error) => {
        console.error("Failed to ensure user:", error);
        // Reset so it can retry on next render
        hasEnsured.current = false;
      });
    }
  }, [isLoaded, isSignedIn, ensureCurrentUser]);
}
