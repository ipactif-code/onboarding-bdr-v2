"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "convex/react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;
import {
  BreadcrumbItem,
  BreadcrumbDataResponse,
  extractIdsFromPath,
  extractNamesFromResponse,
  buildStaticBreadcrumbs,
  buildDynamicBreadcrumbs,
} from "@/lib/breadcrumb-config";

/**
 * Hook to generate breadcrumb items based on the current pathname.
 *
 * Features:
 * - Static routes: Returns immediately with predefined labels
 * - Dynamic routes: Calls Convex query to get real names (course title, lesson title)
 * - Loading state: Shows fallback labels while fetching
 * - Admin routes: `/admin` prefix is never shown in breadcrumb labels
 *
 * @returns Array of breadcrumb items with labels and hrefs
 */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();

  // Extract IDs from pathname (if dynamic route)
  const extractedIds = useMemo(() => extractIdsFromPath(pathname), [pathname]);

  // Query Convex for dynamic data (only if IDs are present)
  const breadcrumbData = useQuery(
    api.navigation.getBreadcrumbData,
    extractedIds?.courseId
      ? {
          courseId: extractedIds.courseId,
          lessonId: extractedIds.lessonId,
        }
      : "skip"
  ) as BreadcrumbDataResponse | undefined;

  const breadcrumbs = useMemo(() => {
    // If it's a dynamic route
    if (extractedIds) {
      // Extract names from API response using the correct structure
      const names = extractNamesFromResponse(breadcrumbData);

      const dynamicBreadcrumbs = buildDynamicBreadcrumbs(pathname, names);
      if (dynamicBreadcrumbs) {
        return dynamicBreadcrumbs;
      }
    }

    // Static route or fallback
    return buildStaticBreadcrumbs(pathname);
  }, [pathname, extractedIds, breadcrumbData]);

  return breadcrumbs;
}

/**
 * Re-export types for convenience
 */
export type { BreadcrumbItem } from "@/lib/breadcrumb-config";
