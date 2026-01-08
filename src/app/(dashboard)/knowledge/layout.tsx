"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { KnowledgeSidebar } from "./components/knowledge-sidebar";
import {
  MobileSidebarProvider,
  useMobileSidebar,
} from "@/contexts/mobile-sidebar-context";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// KnowledgeLayoutContent Component
// ============================================================================

/**
 * Inner layout component that uses the mobile sidebar context.
 * Separated from provider to allow hook usage.
 */
function KnowledgeLayoutContent({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { isOpen, close, toggle } = useMobileSidebar();
  const pathname = usePathname();

  // Check if we're on a document editing page (hide sidebar on mobile for more space)
  const isDocumentPage = pathname.includes("/doc/");

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Mobile sidebar toggle button - visible only on mobile */}
      {!isDocumentPage && (
        <div className="absolute left-2 top-2 z-40 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="min-h-11 min-w-11"
            aria-label="Toggle navigation menu"
            aria-expanded={isOpen}
            aria-controls="mobile-kb-sidebar"
          >
            <Menu className="size-5" />
          </Button>
        </div>
      )}

      {/* Desktop sidebar - hidden on mobile */}
      <aside
        data-slot="knowledge-sidebar-desktop"
        className="hidden h-full w-64 shrink-0 border-r bg-muted/30 md:block"
      >
        <KnowledgeSidebar />
      </aside>

      {/* Mobile sidebar - Sheet/Drawer on mobile */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent
          side="left"
          id="mobile-kb-sidebar"
          className="w-[280px] p-0 sm:max-w-[320px]"
          aria-label="Knowledge Base navigation menu"
        >
          {/* Visually hidden title for accessibility */}
          <SheetTitle className="sr-only">Knowledge Base Navigation</SheetTitle>
          <KnowledgeSidebar onNavigate={close} />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <main
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          // Add top padding on mobile to account for hamburger menu
          !isDocumentPage && "pt-14 md:pt-0"
        )}
        aria-label="Knowledge Base"
      >
        {/* Content wrapper - no padding/overflow for document editor (needs full height) */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            // Document pages need full height for the editor - no padding or overflow
            isDocumentPage
              ? "h-full"
              : "overflow-auto p-4 md:p-6"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// KnowledgeLayout Component
// ============================================================================

/**
 * Knowledge Base layout component.
 *
 * This layout provides a responsive two-column layout with:
 * - Mobile (< 768px): Collapsible sidebar as a Sheet/Drawer
 * - Desktop (>= 768px): Fixed left sidebar with workspace navigation
 * - Right main area: Workspace/folder/document content
 *
 * The parent dashboard layout already:
 * - Handles authentication checks
 * - Provides the SidebarProvider context
 * - Provides the CommandPaletteProvider
 */
export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <MobileSidebarProvider>
      <KnowledgeLayoutContent>{children}</KnowledgeLayoutContent>
    </MobileSidebarProvider>
  );
}
