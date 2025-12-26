/**
 * Type guards for runtime type validation.
 *
 * These functions provide type-safe runtime checks that help TypeScript
 * narrow types in conditional branches. They should be used instead of
 * type assertions (`as`) when the type needs to be verified at runtime.
 */

import type { ChannelRole } from "@/components/messaging/channel-members-dialog/types";

/**
 * Type guard to check if a value is a valid ChannelRole.
 *
 * @param role - The value to check
 * @returns true if the value is a valid ChannelRole, false otherwise
 *
 * @example
 * ```typescript
 * const rawRole = channel?.membership?.role;
 * const userRole = isChannelRole(rawRole) ? rawRole : undefined;
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
