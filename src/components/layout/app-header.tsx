"use client";

import { Fragment, type ReactElement } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";

/**
 * Application header with dynamic breadcrumb navigation.
 *
 * Features:
 * - Automatic breadcrumb generation based on URL
 * - Real names for courses/lessons via Convex query
 * - Loading skeletons while fetching dynamic data
 * - Proper link handling (last item is not a link)
 * - `/admin` prefix is never shown in breadcrumb
 */
export function AppHeader(): ReactElement {
  const breadcrumbs = useBreadcrumbs();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const isFirst = index === 0;

              return (
                <Fragment key={`${item.label}-${index}`}>
                  {/* Separator OUTSIDE BreadcrumbItem to avoid nested <li> */}
                  {!isFirst && <BreadcrumbSeparator />}

                  <BreadcrumbItem>
                    {/* Loading state */}
                    {item.isLoading ? (
                      <Skeleton className="h-4 w-24" />
                    ) : item.href && !isLast ? (
                      /* Link for non-last items with href */
                      <BreadcrumbLink render={<Link href={item.href} />}>
                        {item.label}
                      </BreadcrumbLink>
                    ) : (
                      /* Current page (last item) or item without href */
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
