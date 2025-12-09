"use client";

import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Users,
  BarChart3,
  Settings,
  GraduationCap
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Courses",
    href: "/courses",
    icon: BookOpen,
  },
  {
    title: "Messages",
    href: "/messages",
    icon: MessageSquare,
  },
  {
    title: "Teams",
    href: "/admin/teams",
    icon: Users,
    adminOnly: true,
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    adminOnly: true,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-neutral-200 bg-neutral-50">
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="flex items-center justify-center size-9 p-0"
              asChild
            >
              <Link href="/">
                <div className="flex items-center justify-center size-8 rounded-lg bg-blue-600 text-white">
                  <GraduationCap className="size-4" />
                </div>
                {!isCollapsed && (
                  <span className="ml-2 font-semibold">BDR LMS</span>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {navigationItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.title}
                  className={cn(
                    "flex items-center justify-center size-9 p-0",
                    !isCollapsed && "justify-start px-3 w-full"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className="size-4 shrink-0" />
                    {!isCollapsed && (
                      <span className="ml-2">{item.title}</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className={cn(
              "flex items-center justify-center",
              !isCollapsed && "justify-start px-2"
            )}>
              <UserButton
                afterSignOutUrl="/sign-in"
                appearance={{
                  elements: {
                    avatarBox: "size-8 rounded-lg"
                  }
                }}
              />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
