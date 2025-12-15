"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
        <div className="w-64 border-r bg-background p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
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

  // Hide header on messages page
  const hideHeader = pathname === "/messages" || pathname.startsWith("/messages/");

  return (
    <SidebarProvider defaultOpen={false}>
      <AuthReadyGuard>
        <UserProvider>
          <AppSidebar />
          <SidebarInset className="h-screen">
            {!hideHeader && (
              <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2 px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Separator
                    orientation="vertical"
                    className="mr-2 data-[orientation=vertical]:h-4"
                  />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbPage>Dashboard</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
              </header>
            )}
            <div
              className={cn(
                "flex flex-1 flex-col min-h-0",
                !hideHeader && "p-6 pt-0"
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
