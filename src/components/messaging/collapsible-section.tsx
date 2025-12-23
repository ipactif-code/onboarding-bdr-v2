"use client";

import * as React from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
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
            "flex flex-1 items-center gap-1 rounded-sm px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <ChevronRight
            className={cn(
              "size-3 transition-transform duration-200",
              effectiveOpen && "rotate-90"
            )}
          />
          <span>{title}</span>
        </Collapsible.Trigger>

        {/* Optional action button */}
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Content */}
      <Collapsible.Content
        className={cn(
          "overflow-hidden",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1"
        )}
      >
        <div className="px-2 py-1">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export type { CollapsibleSectionProps };
