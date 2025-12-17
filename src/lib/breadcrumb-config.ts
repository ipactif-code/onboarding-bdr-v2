import { Id } from "../../convex/_generated/dataModel";

/**
 * Type definition for a breadcrumb item
 */
export interface BreadcrumbItem {
  /** Display label for the breadcrumb */
  label: string;
  /** Optional href - if not provided, the item is not clickable (current page) */
  href?: string;
  /** Whether this item is currently loading dynamic data */
  isLoading?: boolean;
}

/**
 * Extracted IDs from URL path
 */
export interface ExtractedIds {
  courseId?: Id<"courses">;
  lessonId?: Id<"lessons">;
  isAdminRoute: boolean;
}

/**
 * Response type from api.navigation.getBreadcrumbData
 * Matches the Back-end contract exactly
 */
export interface BreadcrumbDataResponse {
  course?: { _id: Id<"courses">; title: string };
  section?: { _id: Id<"sections">; title: string };
  lesson?: { _id: Id<"lessons">; title: string };
}

/**
 * Normalized names extracted from BreadcrumbDataResponse
 */
export interface BreadcrumbNames {
  courseName?: string;
  lessonName?: string;
  sectionName?: string;
}

/**
 * Extract normalized names from API response
 * Maps Back-end structure to internal format
 */
export function extractNamesFromResponse(
  data: BreadcrumbDataResponse | undefined | null
): BreadcrumbNames {
  return {
    courseName: data?.course?.title,
    lessonName: data?.lesson?.title,
    sectionName: data?.section?.title,
  };
}

/**
 * Static route labels - routes that don't need dynamic data
 */
export const STATIC_ROUTES: Record<string, string> = {
  "/": "Dashboard",
  "/courses": "Courses",
  "/messages": "Messages",
  "/profile": "Profile",
  "/settings": "Settings",
  // Admin routes (without "admin" prefix in label)
  "/admin/courses": "Courses",
  "/admin/courses/new": "New Course",
  "/admin/teams": "Teams",
  "/admin/analytics": "Analytics",
  "/admin/users": "Users",
} as const;

/**
 * Dynamic route configuration
 */
interface DynamicRouteConfig {
  pattern: RegExp;
  extract: (matches: RegExpMatchArray) => ExtractedIds;
  buildBreadcrumbs: (
    ids: ExtractedIds,
    names: BreadcrumbNames
  ) => BreadcrumbItem[];
}

/**
 * Route patterns for dynamic routes
 * Order matters: more specific patterns first
 */
export const DYNAMIC_ROUTE_PATTERNS: DynamicRouteConfig[] = [
  // Admin routes first (more specific)
  {
    // /admin/courses/[courseId]/lessons/[lessonId]
    pattern: /^\/admin\/courses\/([^/]+)\/lessons\/([^/]+)$/,
    extract: (matches: RegExpMatchArray): ExtractedIds => ({
      courseId: matches[1] as Id<"courses">,
      lessonId: matches[2] as Id<"lessons">,
      isAdminRoute: true,
    }),
    buildBreadcrumbs: (
      ids: ExtractedIds,
      names: BreadcrumbNames
    ): BreadcrumbItem[] => [
      { label: "Dashboard", href: "/" },
      { label: "Courses", href: "/admin/courses" },
      {
        label: names.courseName || "Course",
        href: `/admin/courses/${ids.courseId}`,
        isLoading: !names.courseName,
      },
      {
        label: names.lessonName || "Lesson",
        isLoading: !names.lessonName,
      },
    ],
  },
  {
    // /admin/courses/[courseId]
    pattern: /^\/admin\/courses\/([^/]+)$/,
    extract: (matches: RegExpMatchArray): ExtractedIds => ({
      courseId: matches[1] as Id<"courses">,
      isAdminRoute: true,
    }),
    buildBreadcrumbs: (
      ids: ExtractedIds,
      names: BreadcrumbNames
    ): BreadcrumbItem[] => [
      { label: "Dashboard", href: "/" },
      { label: "Courses", href: "/admin/courses" },
      {
        label: names.courseName || "Course",
        isLoading: !names.courseName,
      },
    ],
  },
  // User routes
  {
    // /courses/[courseId]/lessons/[lessonId]
    pattern: /^\/courses\/([^/]+)\/lessons\/([^/]+)$/,
    extract: (matches: RegExpMatchArray): ExtractedIds => ({
      courseId: matches[1] as Id<"courses">,
      lessonId: matches[2] as Id<"lessons">,
      isAdminRoute: false,
    }),
    buildBreadcrumbs: (
      ids: ExtractedIds,
      names: BreadcrumbNames
    ): BreadcrumbItem[] => [
      { label: "Dashboard", href: "/" },
      { label: "Courses", href: "/courses" },
      {
        label: names.courseName || "Course",
        href: `/courses/${ids.courseId}`,
        isLoading: !names.courseName,
      },
      {
        label: names.lessonName || "Lesson",
        isLoading: !names.lessonName,
      },
    ],
  },
  {
    // /courses/[courseId]
    pattern: /^\/courses\/([^/]+)$/,
    extract: (matches: RegExpMatchArray): ExtractedIds => ({
      courseId: matches[1] as Id<"courses">,
      isAdminRoute: false,
    }),
    buildBreadcrumbs: (
      ids: ExtractedIds,
      names: BreadcrumbNames
    ): BreadcrumbItem[] => [
      { label: "Dashboard", href: "/" },
      { label: "Courses", href: "/courses" },
      {
        label: names.courseName || "Course",
        isLoading: !names.courseName,
      },
    ],
  },
];

/**
 * Extract IDs from a pathname
 */
export function extractIdsFromPath(pathname: string): ExtractedIds | null {
  // Check static routes FIRST - they don't need ID extraction
  // This prevents "new" from being captured as a courseId
  if (STATIC_ROUTES[pathname]) {
    return null;
  }

  // Then check dynamic patterns
  for (const route of DYNAMIC_ROUTE_PATTERNS) {
    const matches = pathname.match(route.pattern);
    if (matches) {
      return route.extract(matches);
    }
  }
  return null;
}

/**
 * Build breadcrumbs for a static route
 */
export function buildStaticBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Handle root
  if (pathname === "/") {
    return [{ label: "Dashboard" }];
  }

  // Check if it's a known static route
  const staticLabel = STATIC_ROUTES[pathname];
  if (staticLabel) {
    return [{ label: "Dashboard", href: "/" }, { label: staticLabel }];
  }

  // Fallback: parse URL segments (for unknown routes)
  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: "Dashboard", href: "/" }];

  // Skip "admin" segment in display
  const filteredSegments = segments.filter((s) => s !== "admin");
  const isAdmin = segments.includes("admin");

  filteredSegments.forEach((segment, index) => {
    const isLast = index === filteredSegments.length - 1;
    // Capitalize first letter
    const label = segment.charAt(0).toUpperCase() + segment.slice(1);

    if (isLast) {
      items.push({ label });
    } else {
      // Build href considering if we're in admin context
      const pathSegments = filteredSegments.slice(0, index + 1);
      const href = isAdmin
        ? `/admin/${pathSegments.join("/")}`
        : `/${pathSegments.join("/")}`;
      items.push({ label, href });
    }
  });

  return items;
}

/**
 * Find the matching dynamic route pattern and build breadcrumbs
 */
export function buildDynamicBreadcrumbs(
  pathname: string,
  names: BreadcrumbNames
): BreadcrumbItem[] | null {
  for (const route of DYNAMIC_ROUTE_PATTERNS) {
    const matches = pathname.match(route.pattern);
    if (matches) {
      const ids = route.extract(matches);
      return route.buildBreadcrumbs(ids, names);
    }
  }
  return null;
}
