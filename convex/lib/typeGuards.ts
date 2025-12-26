/**
 * Type guards for Convex backend runtime type validation.
 *
 * These functions provide type-safe runtime checks that help TypeScript
 * narrow types in conditional branches. They should be used instead of
 * type assertions (`as`) when the type needs to be verified at runtime.
 */

import type { ChannelRole } from "./permissions";

/**
 * Type guard to check if a value is a valid ChannelRole.
 *
 * @param role - The value to check
 * @returns true if the value is a valid ChannelRole, false otherwise
 *
 * @example
 * ```typescript
 * const rawRole = membership.role;
 * if (isChannelRole(rawRole)) {
 *   const order = roleOrder[rawRole]; // Type-safe access
 * }
 * ```
 */
export function isChannelRole(role: unknown): role is ChannelRole {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "moderator" ||
    role === "member"
  );
}
