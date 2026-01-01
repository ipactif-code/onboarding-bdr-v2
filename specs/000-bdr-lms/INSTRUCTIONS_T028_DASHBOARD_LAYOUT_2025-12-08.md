# 🎯 CLAUDE CODE INTEGRATION INSTRUCTIONS
**Task:** T028 - Dashboard Layout (Sidebar + Header)  
**Source:** Figma Make output  
**Date:** 2025-12-08  
**Project:** Onboarding BDR Team v2 LMS

---

## 📋 CONTEXT

Figma Make generated a dashboard shell layout. We need to integrate it with:
1. Shadcn sidebar component (already installed via `npx shadcn@latest add sidebar`)
2. Lucide React icons (replace Figma SVG paths)
3. Next.js App Router structure
4. Clerk UserButton for authentication

## 🎨 FIGMA MAKE OUTPUT (Reference)

```tsx
"use client";

import svgPaths from "./imports/svg-abranxl8h9";
import imgSidebarMediaAsset from "figma:asset/ec9f5796767742e0c90cd9f48270de2d198ef911.png";
import imgAvatar from "figma:asset/cfa90523740b88f37cf837b3a4b69c4f932d514c.png";

export default function App() {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside className="flex flex-col bg-neutral-50 shrink-0" aria-label="Main navigation">
        {/* Sidebar Header */}
        <div className="p-2">
          <button 
            className="flex items-center justify-center p-2.5 rounded-lg size-8 hover:bg-neutral-100 transition-colors"
            aria-label="Application menu"
          >
            <img 
              src={imgSidebarMediaAsset} 
              alt="" 
              className="rounded-lg size-8 object-cover"
            />
          </button>
        </div>

        {/* Sidebar Content */}
        <nav className="flex flex-col gap-1 p-2" aria-label="Sidebar navigation">
          <button 
            className="flex items-center justify-center p-2 rounded-lg size-8 hover:bg-neutral-200 transition-colors"
            aria-label="Dashboard"
          >
            <svg className="size-4" fill="none" viewBox="0 0 16 16">
              <path d={svgPaths.p1352c600} stroke="#0A0A0A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
            </svg>
          </button>
          {/* ... more nav buttons ... */}
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto p-2">
          <button 
            className="flex items-center justify-center rounded-lg size-8 hover:bg-neutral-200 transition-colors"
            aria-label="User profile"
          >
            <img 
              src={imgAvatar} 
              alt="User avatar" 
              className="rounded-lg size-8 object-cover"
            />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-neutral-200 bg-white">
          <div className="flex items-center h-full px-5">
            <div className="flex items-center gap-2">
              <button 
                className="flex items-center justify-center rounded-lg size-7 hover:bg-neutral-100 transition-colors"
                aria-label="Toggle sidebar"
              >
                <svg className="size-4" fill="none" viewBox="0 0 16 16">
                  <path d={svgPaths.paee2100} stroke="#0A0A0A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
              </button>

              <div className="w-2 flex items-center">
                <div className="h-4 w-px bg-neutral-200" />
              </div>

              <nav aria-label="Breadcrumb">
                <ol className="flex items-center gap-2.5">
                  <li>
                    <a href="#" className="text-neutral-500 hover:text-neutral-700 transition-colors">
                      Building Your Application
                    </a>
                  </li>
                  <li>
                    <svg className="size-4" fill="none" viewBox="0 0 15 15">
                      <path d={svgPaths.p5646280} stroke="#737373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33" />
                    </svg>
                  </li>
                  <li>
                    <span className="text-neutral-950">Data Fetching</span>
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 bg-white border-l border-neutral-200">
          <div className="p-6">
            {/* Content slot */}
          </div>
        </main>
      </div>
    </div>
  );
}
```

---

## 🔧 INTEGRATION REQUIREMENTS

### 1. Use Shadcn Sidebar Component
- Use the installed Shadcn sidebar from `@/components/ui/sidebar`
- **Default state: COLLAPSED (icon-only mode)**
- Toggle via header button to expand/collapse
- Use `SidebarProvider` with `defaultOpen={false}`

### 2. Fix Icon Centering
- Icons must be perfectly centered in sidebar buttons
- Use `flex items-center justify-center` on button AND icon wrapper
- Icon size: `size-4` (16px)
- Button size: `size-9` (36px) for better touch target

### 3. Replace Figma Assets with Lucide Icons
Map the navigation items to Lucide icons:
- Dashboard → `LayoutDashboard`
- Notifications → `Bell`
- Documentation/Courses → `BookOpen`
- Inbox/Messages → `MessageSquare`
- Users/Teams → `Users`
- Analytics → `BarChart3`
- Settings → `Settings`

### 4. Use Clerk UserButton
- Replace avatar button with Clerk's `<UserButton />` component
- Position at bottom of sidebar

### 5. Breadcrumb Component
- Use Shadcn Breadcrumb from `@/components/ui/breadcrumb`
- Make it dynamic via props or context

---

## 📁 FILES TO CREATE

### File 1: `src/app/(dashboard)/layout.tsx`

```tsx
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 bg-white p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
```

### File 2: `src/components/layout/app-sidebar.tsx`

```tsx
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
```

### File 3: `src/components/layout/app-header.tsx`

```tsx
"use client";

import { PanelLeft, ChevronRight } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
}

export function AppHeader({ breadcrumbs }: AppHeaderProps) {
  const { toggleSidebar } = useSidebar();

  // Default breadcrumbs if none provided
  const items = breadcrumbs || [
    { label: "Dashboard", href: "/" },
  ];

  return (
    <header className="h-16 border-b border-neutral-200 bg-white shrink-0">
      <div className="flex items-center h-full px-4 gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="size-4" />
        </Button>

        <Separator orientation="vertical" className="h-4" />

        <Breadcrumb>
          <BreadcrumbList>
            {items.map((item, index) => (
              <BreadcrumbItem key={index}>
                {index > 0 && (
                  <BreadcrumbSeparator>
                    <ChevronRight className="size-4" />
                  </BreadcrumbSeparator>
                )}
                {item.href && index < items.length - 1 ? (
                  <BreadcrumbLink href={item.href}>
                    {item.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
```

### File 4: `src/app/(dashboard)/page.tsx` (Placeholder)

```tsx
export default function DashboardPage() {
  return (
    <div className="flex items-center justify-center h-full min-h-[calc(100vh-4rem-3rem)]">
      <div className="bg-purple-50 border border-dashed border-purple-300 rounded-lg p-12">
        <p className="text-neutral-950 text-center">
          Dashboard content will be added here
        </p>
      </div>
    </div>
  );
}
```

---

## ✅ SUCCESS CRITERIA

- [ ] Sidebar is collapsed by default (icon-only mode)
- [ ] Clicking header button toggles sidebar open/closed
- [ ] Icons are perfectly centered in sidebar buttons
- [ ] Lucide icons replace Figma SVG paths
- [ ] Clerk UserButton displays at sidebar footer
- [ ] Breadcrumb is dynamic and uses Shadcn component
- [ ] Layout is responsive
- [ ] Active nav item is highlighted
- [ ] Tooltips show on hover when sidebar is collapsed

---

## ⚠️ IMPORTANT NOTES

1. **Shadcn Sidebar**: Use `collapsible="icon"` prop on `<Sidebar>` for icon-only collapse mode

2. **SidebarProvider**: Must wrap the entire layout with `defaultOpen={false}`

3. **useSidebar hook**: Use `state` to check if collapsed, `toggleSidebar` for the button

4. **Icon centering**: The key is `flex items-center justify-center` on both the button and icon container

5. **Clerk UserButton**: Already configured in the project, just import and use

---

**End of Instructions**
