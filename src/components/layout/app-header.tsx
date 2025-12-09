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

interface BreadcrumbItemData {
  label: string;
  href?: string;
}

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItemData[];
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
