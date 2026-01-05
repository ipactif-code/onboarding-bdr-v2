"use client";

import * as React from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  /** Unique ID for localStorage persistence */
  id: string;
  /** Section title displayed in header */
  title: string;
  /** Optional action button (e.g., "+" to add new) */
  action?: React.ReactNode;
  /** Children to render when expanded */
  children: React.ReactNode;
  /** Default expanded state (used if no localStorage value) */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * CollapsibleSection provides an expandable/collapsible container with
 * localStorage persistence for remembering user preference.
 *
 * @example
 * ```tsx
 * <CollapsibleSection
 *   id="favorites"
 *   title="Favorites"
 *   action={<button onClick={() => {}}>+</button>}
 *   defaultOpen={true}
 * >
 *   <FavoritesList />
 * </CollapsibleSection>
 * ```
 */
export function CollapsibleSection({
  id,
  title,
  action,
  children,
  defaultOpen = true,
  className,
}: CollapsibleSectionProps): React.ReactElement {
  // Initialize from localStorage, with SSR safety
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Load from localStorage on mount
  React.useEffect(() => {
    const storageKey = `sidebar-section-${id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      setIsOpen(stored === "true");
    }
    setIsHydrated(true);
  }, [id]);

  // Persist to localStorage on change
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      setIsOpen(open);
      localStorage.setItem(`sidebar-section-${id}`, String(open));
    },
    [id]
  );

  // Prevent hydration mismatch by rendering in closed state initially
  const effectiveOpen = isHydrated ? isOpen : defaultOpen;

  return (
    <Collapsible.Root
      data-slot="collapsible-section"
      open={effectiveOpen}
      onOpenChange={handleOpenChange}
      className={cn("flex flex-col", className)}
    >
      {/* Header with trigger */}
      <div className="flex items-center justify-between px-2 py-1">
        <Collapsible.Trigger
          className={cn(
            "group flex flex-1 items-center gap-1 rounded-sm px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <ChevronRight
            className={cn(
              "size-3 transition-transform duration-200",
              "group-data-[panel-open]:rotate-90"
            )}
          />
          <span>{title}</span>
        </Collapsible.Trigger>

        {/* Optional action button */}
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Content */}
      <Collapsible.Panel
        className={cn(
          "flex h-[var(--collapsible-panel-height)] flex-col justify-end overflow-hidden",
          "transition-all duration-150 ease-out",
          "data-[starting-style]:h-0 data-[ending-style]:h-0",
          "[&[hidden]:not([hidden='until-found'])]:hidden"
        )}
      >
        <div className="px-2 py-1">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export type { CollapsibleSectionProps };
