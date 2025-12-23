"use client";

import * as React from "react";
import { ChannelList } from "@/components/messaging/channel-list";

/**
 * Messages layout component for the messaging feature.
 *
 * This layout provides a two-column layout with:
 * - Left sidebar: ChannelList with real-time updates
 * - Right main area: Channel content (messages) or placeholder
 *
 * The parent dashboard layout already:
 * - Handles authentication checks
 * - Hides the app header for /messages routes
 * - Provides the SidebarProvider context
 */
export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar with ChannelList - persists across navigation */}
      <aside className="w-64 shrink-0 border-r bg-muted/30">
        <ChannelList />
      </aside>

      {/* Main content area for channel views */}
      <main className="flex flex-1 flex-col overflow-hidden" aria-label="Messages">
        {children}
      </main>
    </div>
  );
}
