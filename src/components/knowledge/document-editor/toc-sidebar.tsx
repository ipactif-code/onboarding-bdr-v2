"use client";

import * as React from "react";
import type { PlateEditor } from "platejs/react";
import { isHeading } from "@platejs/toc";
import type { TElement } from "platejs";
import { NodeApi } from "platejs";
import { cva } from "class-variance-authority";
import {
  ChevronLeft,
  ChevronRight,
  List,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-plate/tooltip";

/**
 * Represents a heading extracted from the editor content.
 */
export interface TocHeading {
  /** Unique identifier for the heading element */
  id: string;
  /** The text content of the heading */
  text: string;
  /** Heading level (1, 2, or 3) */
  level: 1 | 2 | 3;
  /** Reference to the heading element for scrolling */
  element: TElement;
  /** Path to the element in the editor */
  path: number[];
}

/**
 * Props for the TocSidebar component.
 */
interface TocSidebarProps {
  /** The Plate editor instance */
  editor: PlateEditor;
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Callback when the toggle button is clicked */
  onToggle: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Maps heading type to level number.
 */
const headingTypeToLevel: Record<string, 1 | 2 | 3> = {
  h1: 1,
  h2: 2,
  h3: 3,
};

/**
 * Variant styles for TOC heading items based on level.
 */
const tocItemVariants = cva(
  "group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
  {
    variants: {
      level: {
        1: "pl-2",
        2: "pl-5",
        3: "pl-8",
      },
      active: {
        true: "bg-accent text-accent-foreground font-semibold",
        false: "text-muted-foreground",
      },
    },
    defaultVariants: {
      level: 1,
      active: false,
    },
  }
);

/**
 * Custom hook to extract headings from Plate editor content.
 *
 * This hook traverses the editor content and extracts all H1, H2, and H3
 * headings, returning them as a structured list for the TOC sidebar.
 *
 * @param editor - The Plate editor instance
 * @returns Array of TocHeading objects
 *
 * @example
 * ```tsx
 * const headings = useTocHeadings(editor);
 * ```
 */
export function useTocHeadings(editor: PlateEditor): TocHeading[] {
  return React.useMemo(() => {
    if (!editor || !editor.children) {
      return [];
    }

    const headings: TocHeading[] = [];

    try {
      const values = editor.api.nodes<TElement>({
        at: [],
        match: (n) => isHeading(n),
      });

      if (!values) return [];

      Array.from(values).forEach(([node, path]) => {
        const { type } = node;
        const level = headingTypeToLevel[type];

        // Only include H1, H2, H3
        if (!level) return;

        const text = NodeApi.string(node);
        const id = (node.id as string) || `heading-${path.join("-")}`;

        if (text && text.trim()) {
          headings.push({
            id,
            text: text.trim(),
            level,
            element: node,
            path,
          });
        }
      });
    } catch {
      // Editor might not be fully initialized
      return [];
    }

    return headings;
    // editor.children is intentionally included to recompute when content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editor?.children]);
}

/**
 * Custom hook to track the currently active heading based on scroll position.
 *
 * Uses IntersectionObserver to detect which heading is currently in view.
 *
 * @param headings - Array of TocHeading objects
 * @returns The ID of the currently active heading
 */
function useActiveHeading(headings: TocHeading[]): string | null {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (headings.length === 0) {
      setActiveId(null);
      return;
    }

    // Get all heading elements in the DOM by their IDs
    const headingElements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);

    if (headingElements.length === 0) {
      // Fallback: set first heading as active
      setActiveId(headings[0]?.id ?? null);
      return;
    }

    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: "-80px 0px -70% 0px", // Account for fixed header
      threshold: 0,
    };

    const visibleHeadings = new Set<string>();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        if (entry.isIntersecting) {
          visibleHeadings.add(id);
        } else {
          visibleHeadings.delete(id);
        }
      });

      // Set the first visible heading as active
      if (visibleHeadings.size > 0) {
        // Find the topmost visible heading
        for (const heading of headings) {
          if (visibleHeadings.has(heading.id)) {
            setActiveId(heading.id);
            break;
          }
        }
      }
    }, observerOptions);

    headingElements.forEach((el) => observer.observe(el));

    // Set initial active heading
    const firstHeading = headings[0];
    if (firstHeading && !activeId) {
      setActiveId(firstHeading.id);
    }

    return () => {
      observer.disconnect();
    };
  }, [headings, activeId]);

  return activeId;
}

/**
 * Scrolls to a heading element smoothly.
 *
 * @param headingId - The ID of the heading element to scroll to
 */
function scrollToHeading(headingId: string): void {
  const element = document.getElementById(headingId);
  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

/**
 * Table of Contents Sidebar for the Knowledge Base Editor.
 *
 * Features:
 * - Extracts H1, H2, H3 headings from editor content
 * - Hierarchical display with indentation
 * - Highlights current section based on scroll position
 * - Click to scroll to heading
 * - Collapsible with smooth animation
 * - Responsive: hidden on mobile by default
 *
 * @example
 * ```tsx
 * const [isTocOpen, setIsTocOpen] = useState(true);
 *
 * <TocSidebar
 *   editor={editor}
 *   isOpen={isTocOpen}
 *   onToggle={() => setIsTocOpen(!isTocOpen)}
 * />
 * ```
 */
export function TocSidebar({
  editor,
  isOpen,
  onToggle,
  className,
}: TocSidebarProps): React.ReactElement {
  const headings = useTocHeadings(editor);
  const activeHeadingId = useActiveHeading(headings);

  return (
    <div
      data-slot="toc-sidebar"
      className={cn(
        "relative flex flex-col border-r bg-background transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-0",
        "hidden lg:flex", // Hidden on mobile by default
        className
      )}
    >
      {/* Toggle button - always visible */}
      <div
        className={cn(
          "absolute top-3 z-10 transition-all duration-300",
          isOpen ? "right-2" : "-right-10"
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onToggle}
              aria-label={isOpen ? "Collapse table of contents" : "Expand table of contents"}
              aria-expanded={isOpen}
              className="bg-background shadow-sm"
            >
              {isOpen ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isOpen ? "Collapse TOC" : "Expand TOC"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Sidebar content - only visible when open */}
      <div
        className={cn(
          "flex flex-col overflow-hidden transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <List className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Table of Contents</h3>
        </div>

        {/* Headings list */}
        <ScrollArea className="flex-1">
          <nav className="p-2" aria-label="Table of contents">
            {headings.length > 0 ? (
              <ul className="space-y-0.5">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <button
                      type="button"
                      onClick={() => scrollToHeading(heading.id)}
                      className={tocItemVariants({
                        level: heading.level,
                        active: activeHeadingId === heading.id,
                      })}
                      aria-current={activeHeadingId === heading.id ? "location" : undefined}
                    >
                      <span className="truncate">{heading.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No headings found.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add H1, H2, or H3 headings to see them here.
                </p>
              </div>
            )}
          </nav>
        </ScrollArea>

        {/* Footer with heading count */}
        {headings.length > 0 && (
          <div className="border-t px-4 py-2">
            <p className="text-xs text-muted-foreground">
              {headings.length} {headings.length === 1 ? "heading" : "headings"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for the TOC sidebar.
 */
export function TocSidebarSkeleton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      data-slot="toc-sidebar-skeleton"
      className={cn(
        "flex w-64 flex-col border-r bg-background",
        "hidden lg:flex",
        className
      )}
    >
      {/* Header skeleton */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-2 space-y-2">
        <div className="h-7 w-full rounded bg-muted animate-pulse" />
        <div className="h-7 w-5/6 rounded bg-muted animate-pulse ml-3" />
        <div className="h-7 w-4/5 rounded bg-muted animate-pulse ml-3" />
        <div className="h-7 w-full rounded bg-muted animate-pulse" />
        <div className="h-7 w-3/4 rounded bg-muted animate-pulse ml-3" />
        <div className="h-7 w-5/6 rounded bg-muted animate-pulse ml-6" />
        <div className="h-7 w-4/5 rounded bg-muted animate-pulse ml-6" />
        <div className="h-7 w-full rounded bg-muted animate-pulse" />
      </div>

      {/* Footer skeleton */}
      <div className="border-t px-4 py-2">
        <div className="h-3 w-20 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export type { TocSidebarProps };
