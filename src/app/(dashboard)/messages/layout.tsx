"use client";

import * as React from "react";
import { MessagingSidebar } from "@/components/messaging/messaging-sidebar";

/**
 * Messages layout component for the messaging feature.
 *
 * This layout provides a two-column layout with:
 * - Left sidebar: Slack-like navigation with collapsible sections
 * - Right main area: Channel/conversation content or placeholder
 *
 * Search functionality is now handled by the CommandPalette (Ctrl+K / Cmd+K)
 * which is provided at the dashboard layout level.
 *
 * The parent dashboard layout already:
 * - Handles authentication checks
 * - Hides the app header for /messages routes
 * - Provides the SidebarProvider context
 * - Provides the CommandPaletteProvider
 */
export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar with Slack-like collapsible sections */}
      <aside className="h-full w-64 shrink-0 border-r bg-muted/30">
        <MessagingSidebar />
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-hidden" aria-label="Messages">
        {children}
      </main>
    </div>
  );
}
