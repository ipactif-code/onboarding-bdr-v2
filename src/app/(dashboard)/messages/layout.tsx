"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { MessagingSidebar } from "@/components/messaging/messaging-sidebar";
import {
  MessagingErrorBoundary,
  CompactErrorFallback,
  useErrorBoundaryReset,
} from "@/components/messaging/messaging-error-boundary";
import { ConnectionStatusBanner } from "@/components/messaging/connection-status";
import {
  MobileSidebarProvider,
  useMobileSidebar,
} from "@/contexts/mobile-sidebar-context";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// MessagesLayoutContent Component
// ============================================================================

/**
 * Inner layout component that uses the mobile sidebar context.
 * Separated from provider to allow hook usage.
 */
function MessagesLayoutContent({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { key: sidebarKey, resetKey: resetSidebar } = useErrorBoundaryReset();
  const { key: contentKey, resetKey: resetContent } = useErrorBoundaryReset();
  const { isOpen, close, toggle } = useMobileSidebar();

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Mobile sidebar toggle button - visible only on mobile */}
      <div className="absolute left-2 top-2 z-40 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="min-h-11 min-w-11"
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
          aria-controls="mobile-sidebar"
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {/* Desktop sidebar - hidden on mobile */}
      <aside
        data-slot="messaging-sidebar-desktop"
        className="hidden h-full w-64 shrink-0 border-r bg-muted/30 md:block"
      >
        <MessagingErrorBoundary
          key={sidebarKey}
          onReset={resetSidebar}
          fallback={
            <div className="flex h-full items-center justify-center p-4">
              <CompactErrorFallback
                onReset={resetSidebar}
                message="Unable to load navigation"
              />
            </div>
          }
        >
          <MessagingSidebar />
        </MessagingErrorBoundary>
      </aside>

      {/* Mobile sidebar - Sheet/Drawer on mobile */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent
          side="left"
          id="mobile-sidebar"
          className="w-[280px] p-0 sm:max-w-[320px]"
          aria-label="Navigation menu"
        >
          {/* Visually hidden title for accessibility */}
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <MessagingErrorBoundary
            key={sidebarKey}
            onReset={resetSidebar}
            fallback={
              <div className="flex h-full items-center justify-center p-4">
                <CompactErrorFallback
                  onReset={resetSidebar}
                  message="Unable to load navigation"
                />
              </div>
            }
          >
            <MessagingSidebar onNavigate={close} />
          </MessagingErrorBoundary>
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <main
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          // Add left padding on mobile to account for hamburger menu
          "pt-14 md:pt-0"
        )}
        aria-label="Messages"
      >
        {/* Connection status banner - shows when offline or reconnecting */}
        <ConnectionStatusBanner
          className="mx-3 mt-3 flex-shrink-0 md:mx-4 md:mt-4"
          showPendingCount
          autoHideWhenConnected
        />

        {/* Content wrapper - takes remaining space after banner */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MessagingErrorBoundary
            key={contentKey}
            onReset={resetContent}
            title="Unable to load messages"
            description="We couldn't load this conversation. Please try again."
            className="flex min-h-0 flex-1 flex-col"
          >
            {children}
          </MessagingErrorBoundary>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// MessagesLayout Component
// ============================================================================

/**
 * Messages layout component for the messaging feature.
 *
 * This layout provides a responsive two-column layout with:
 * - Mobile (< 768px): Collapsible sidebar as a Sheet/Drawer
 * - Desktop (>= 768px): Fixed left sidebar
 * - Right main area: Channel/conversation content or placeholder
 *
 * Error boundaries wrap both the sidebar and main content areas to provide
 * graceful error recovery without crashing the entire messaging interface.
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
    <MobileSidebarProvider>
      <MessagesLayoutContent>{children}</MessagesLayoutContent>
    </MobileSidebarProvider>
  );
}
