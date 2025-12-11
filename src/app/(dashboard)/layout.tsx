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
import { UserProvider } from "@/contexts/user-context";

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
      <UserProvider>
        <AppSidebar />
        <SidebarInset>
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
          <main className={`flex flex-1 flex-col ${hideHeader ? "" : "gap-4 p-4 pt-0"}`}>
            {children}
          </main>
        </SidebarInset>
      </UserProvider>
    </SidebarProvider>
  );
}
