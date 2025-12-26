"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

// ============================================================================
// Types
// ============================================================================

export interface ThreadHeaderProps {
  /** Callback when close button is clicked. */
  onClose?: () => void;
  /** Ref for the close button to enable focus management (WCAG 2.4.3). */
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

// ============================================================================
// ThreadHeader Component
// ============================================================================

/**
 * ThreadHeader displays the header for a thread view with title and close button.
 * Close button has 44x44px minimum touch target for WCAG 2.5.5 compliance.
 */
export function ThreadHeader({
  onClose,
  closeButtonRef,
}: ThreadHeaderProps): React.ReactElement {
  return (
    <div
      data-slot="thread-header"
      className="flex items-center justify-between border-b px-4 py-3"
    >
      <h2 className="text-sm font-semibold">Thread</h2>
      {onClose && (
        <Button
          ref={closeButtonRef}
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close thread"
          className="min-h-11 min-w-11"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
