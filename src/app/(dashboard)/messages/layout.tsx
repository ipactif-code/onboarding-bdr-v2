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
      {/* Sidebar with Slack-like collapsible sections */}
      <aside className="w-64 shrink-0 border-r bg-muted/30">
        <MessagingSidebar />
      </aside>

      {/* Main content area for channel/conversation views */}
      <main className="flex flex-1 flex-col overflow-hidden" aria-label="Messages">
        {children}
      </main>
    </div>
  );
}
