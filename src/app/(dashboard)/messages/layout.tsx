import * as React from "react";

/**
 * Messages layout component for the messaging feature.
 *
 * This layout provides a full-height container for the messaging interface.
 * The actual sidebar (conversation list) is currently implemented within
 * the MessagesView component for real-time updates via Convex.
 *
 * The parent dashboard layout already:
 * - Handles authentication checks
 * - Hides the app header for /messages routes
 * - Provides the SidebarProvider context
 *
 * Future enhancements:
 * - Extract conversation sidebar into this layout
 * - Add mobile drawer/sheet for responsive navigation
 * - Add presence indicator context
 */
export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {children}
    </div>
  );
}
