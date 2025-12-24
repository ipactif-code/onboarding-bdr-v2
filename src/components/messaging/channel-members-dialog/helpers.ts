import type { ChannelRole } from "./types";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the badge variant for a given role.
 */
export function getRoleBadgeVariant(
  role: ChannelRole
): "default" | "secondary" | "outline" {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "secondary";
    case "moderator":
      return "outline";
    default:
      return "outline";
  }
}

/**
 * Get the display label for a role.
 */
export function getRoleLabel(role: ChannelRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "moderator":
      return "Moderator";
    case "member":
      return "Member";
  }
}

/**
 * Get initials from a name.
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Check if the current user can manage (remove/change role of) a target member.
 */
export function canManageMember(
  userRole: ChannelRole | undefined,
  targetRole: ChannelRole
): boolean {
  // Only owner and admin can manage members
  if (!userRole || (userRole !== "owner" && userRole !== "admin")) {
    return false;
  }
  // Cannot manage the owner
  if (targetRole === "owner") {
    return false;
  }
  // Only owner can manage admins
  if (targetRole === "admin" && userRole !== "owner") {
    return false;
  }
  return true;
}

/**
 * Check if the current user can change roles.
 */
export function canChangeRoles(userRole: ChannelRole | undefined): boolean {
  return userRole === "owner" || userRole === "admin";
}
