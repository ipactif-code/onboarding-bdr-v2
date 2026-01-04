"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useUserContext } from "@/contexts/user-context"

interface NavigationItem {
  title: string
  url: string
  icon: LucideIcon
  showFor: "all" | "admin"
}

const getNavigationItems = (isAdmin: boolean): NavigationItem[] => [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, showFor: "all" },
  { title: "Courses", url: isAdmin ? "/admin/courses" : "/courses", icon: BookOpen, showFor: "all" },
  { title: "Messages", url: "/messages", icon: MessageSquare, showFor: "all" },
  { title: "Teams", url: "/admin/teams", icon: Users, showFor: "admin" },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3, showFor: "admin" },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>): React.ReactElement {
  const pathname = usePathname()
  const router = useRouter()
  const { isAdmin } = useUserContext()

  const visibleItems = getNavigationItems(isAdmin).filter(
    (item) => item.showFor === "all" || (item.showFor === "admin" && isAdmin)
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <GraduationCap className="size-5" />
          </div>
          <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
            BDR LMS
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {visibleItems.map((item) => {
              const isActive = pathname === item.url ||
                (item.url !== "/" && pathname.startsWith(item.url))

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => router.push(item.url)}
                    tooltip={item.title}
                    isActive={isActive}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
