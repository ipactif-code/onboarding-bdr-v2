"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

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
