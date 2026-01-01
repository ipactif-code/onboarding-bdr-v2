"use client";

import * as React from "react";
import { useState } from "react";
import { Download, Loader2, FileJson, FileSpreadsheet } from "lucide-react";

import type { Id } from "../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useExportHistory, type ExportFormat } from "@/hooks/use-export-history";

// ============================================================================
// Types
// ============================================================================

export interface ExportHistoryDialogProps {
  /**
   * The channel ID to export history from.
   */
  channelId: Id<"channels">;
  /**
   * Optional trigger element. If not provided, a default button is used.
   * When using controlled mode (open/onOpenChange), trigger is optional.
   */
  trigger?: React.ReactNode;
  /**
   * Optional additional class name for the trigger wrapper.
   */
  className?: string;
  /**
   * Controlled open state. When provided, the dialog becomes controlled.
   */
  open?: boolean;
  /**
   * Callback when the open state should change. Required when using controlled mode.
   */
  onOpenChange?: (open: boolean) => void;
}

// ============================================================================
// ExportHistoryDialog Component
// ============================================================================

/**
 * Dialog for exporting channel message history.
 *
 * Features:
 * - Format selection (JSON or CSV)
 * - Optional date range picker
 * - Loading state during export
 * - Auto-download on success
 *
 * @example
 * ```tsx
 * <ExportHistoryDialog channelId={channelId} />
 *
 * // Or with custom trigger
 * <ExportHistoryDialog
 *   channelId={channelId}
 *   trigger={<MenuItem>Export History</MenuItem>}
 * />
 * ```
 */
export function ExportHistoryDialog({
  channelId,
  trigger,
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ExportHistoryDialogProps): React.ReactElement {
  // Internal state for uncontrolled mode
  const [internalOpen, setInternalOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Use controlled or uncontrolled mode
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (value: boolean) => controlledOnOpenChange?.(value)
    : setInternalOpen;

  const { exportHistory, isExporting } = useExportHistory({ channelId });

  // Reset form when dialog closes
  const handleOpenChange = (newOpen: boolean): void => {
    setOpen(newOpen);
    if (!newOpen) {
      setFormat("json");
      setStartDate("");
      setEndDate("");
    }
  };

  // Handle export
  const handleExport = async (): Promise<void> => {
    // Parse dates to timestamps
    const startTimestamp = startDate
      ? new Date(startDate).getTime()
      : undefined;
    const endTimestamp = endDate
      ? new Date(endDate).setHours(23, 59, 59, 999) // End of day
      : undefined;

    try {
      await exportHistory({
        format,
        startDate: startTimestamp,
        endDate: endTimestamp,
      });
      setOpen(false);
    } catch {
      // Error is handled in the hook with toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Only render trigger in uncontrolled mode */}
      {!isControlled && (
        <DialogTrigger
          render={
            trigger ? (
              <span className={className}>{trigger}</span>
            ) : (
              <Button variant="outline" className={className} />
            )
          }
        >
          {!trigger && (
            <>
              <Download className="size-4" aria-hidden="true" />
              Export History
            </>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Channel History</DialogTitle>
          <DialogDescription>
            Export all messages from this channel. You can filter by date range
            and choose between JSON and CSV formats.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <FormatOption
                format="json"
                selected={format === "json"}
                onSelect={() => setFormat("json")}
                icon={FileJson}
                label="JSON"
                description="Structured data format"
              />
              <FormatOption
                format="csv"
                selected={format === "csv"}
                onSelect={() => setFormat("csv")}
                icon={FileSpreadsheet}
                label="CSV"
                description="Spreadsheet compatible"
              />
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Date Range{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="start-date"
                  className="text-xs text-muted-foreground"
                >
                  Start Date
                </label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || undefined}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="end-date"
                  className="text-xs text-muted-foreground"
                >
                  End Date
                </label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to export all messages.
            </p>
          </div>

          {/* Rate limit notice */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Note:</strong> You can export
              once every 5 minutes. Large exports may take a moment to process.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="size-4" aria-hidden="true" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// FormatOption Component
// ============================================================================

interface FormatOptionProps {
  format: ExportFormat;
  selected: boolean;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}

function FormatOption({
  format: _format,
  selected,
  onSelect,
  icon: Icon,
  label,
  description,
}: FormatOptionProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-slot="format-option"
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/5"
          : "border-border"
      )}
      role="radio"
      aria-checked={selected}
      aria-label={`Export as ${label}`}
    >
      <Icon
        className={cn(
          "size-6",
          selected ? "text-primary" : "text-muted-foreground"
        )}
        aria-hidden="true"
      />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}
