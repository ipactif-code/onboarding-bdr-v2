"use client";

import { cn } from "@/lib/utils";

type Status = "online" | "away" | "dnd" | "offline";

interface OnlineIndicatorProps {
  status: Status;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** If true, shows as a badge positioned for avatar overlay */
  showAsBadge?: boolean;
}

/**
 * OnlineIndicator displays a colored dot showing user presence status.
 *
 * Status colors:
 * - online: green-500
 * - away: yellow-500
 * - dnd: red-500
 * - offline: gray-400
 *
 * @example
 * ```tsx
 * // Standalone dot
 * <OnlineIndicator status="online" size="md" />
 *
 * // Badge overlay on avatar
 * <div className="relative">
 *   <Avatar />
 *   <OnlineIndicator status="online" showAsBadge />
 * </div>
 * ```
 */
export function OnlineIndicator({
  status,
  size = "md",
  className,
  showAsBadge = false,
}: OnlineIndicatorProps): React.ReactElement {
  const sizeClasses = {
    sm: "size-2",
    md: "size-2.5",
    lg: "size-3",
  };

  const statusClasses = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    dnd: "bg-red-500",
    offline: "bg-gray-400",
  };

  const baseClasses = cn(
    "rounded-full",
    sizeClasses[size],
    statusClasses[status],
    showAsBadge && "absolute bottom-0 right-0 border-2 border-background",
    className
  );

  const statusLabels: Record<Status, string> = {
    online: "Online",
    away: "Away",
    dnd: "Do Not Disturb",
    offline: "Offline",
  };

  return (
    <span
      data-slot="online-indicator"
      className={baseClasses}
      aria-label={`Status: ${statusLabels[status]}`}
      role="img"
    />
  );
}

export type { OnlineIndicatorProps, Status };
