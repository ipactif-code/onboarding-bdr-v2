"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserProvider } from "@/contexts/user-context";
import { useConvexAuth } from "@/components/providers/convex-provider";
import { cn } from "@/lib/utils";

function AuthReadyGuard({ children }: { children: React.ReactNode }) {
  const { isAuthReady } = useConvexAuth();

  if (!isAuthReady) {
    return (
      <div className="flex min-h-screen w-full">
        {/* Sidebar skeleton */}
        <div className="w-16 border-r bg-background p-4 space-y-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col">
          {/* Header skeleton */}
          <div className="h-16 border-b px-4 flex items-center gap-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-4 w-px" />
            <Skeleton className="h-4 w-32" />
          </div>
          {/* Content skeleton */}
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Hide header on messages page (full-height chat interface)
  const hideHeader =
    pathname === "/messages" || pathname.startsWith("/messages/");

  return (
    <SidebarProvider defaultOpen={false}>
      <AuthReadyGuard>
        <UserProvider>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            {!hideHeader && <AppHeader />}
            <div
              className={cn(
                "flex flex-1 flex-col min-h-0 min-w-0",
                !hideHeader && "p-6"
              )}
            >
              {children}
            </div>
          </SidebarInset>
        </UserProvider>
      </AuthReadyGuard>
    </SidebarProvider>
  );
}
