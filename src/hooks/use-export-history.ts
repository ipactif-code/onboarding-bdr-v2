"use client";

import { useCallback, useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";

import { Id } from "../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../convex/_generated/api").api;

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = "json" | "csv";

export interface UseExportHistoryOptions {
  /**
   * The ID of the channel to export history from.
   */
  channelId: Id<"channels">;
}

export interface ExportHistoryParams {
  /**
   * Export format: "json" or "csv".
   */
  format: ExportFormat;
  /**
   * Optional start date filter (timestamp in milliseconds).
   */
  startDate?: number;
  /**
   * Optional end date filter (timestamp in milliseconds).
   */
  endDate?: number;
}

export interface UseExportHistoryReturn {
  /**
   * Export channel history with the given parameters.
   */
  exportHistory: (params: ExportHistoryParams) => Promise<void>;
  /**
   * Whether an export is currently in progress.
   */
  isExporting: boolean;
}

// ============================================================================
// useExportHistory Hook
// ============================================================================

/**
 * Hook for exporting channel message history.
 *
 * @param options.channelId - The ID of the channel to export
 * @returns Export function and loading state
 *
 * @example
 * ```tsx
 * const { exportHistory, isExporting } = useExportHistory({ channelId });
 *
 * const handleExport = async () => {
 *   await exportHistory({
 *     format: "json",
 *     startDate: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
 *   });
 * };
 * ```
 */
export function useExportHistory(
  options: UseExportHistoryOptions
): UseExportHistoryReturn {
  const { channelId } = options;
  const [isExporting, setIsExporting] = useState(false);

  // Action
  const exportAction = useAction(api.channels.exportHistory.exportChannelHistory);

  // Export history and trigger download
  const exportHistory = useCallback(
    async (params: ExportHistoryParams) => {
      const { format, startDate, endDate } = params;
      setIsExporting(true);

      try {
        const result = await exportAction({
          channelId,
          format,
          startDate,
          endDate,
        });

        // Create blob and trigger download
        const blob = new Blob([result.data], { type: result.mimeType });
        const url = URL.createObjectURL(blob);

        // Create temporary link and trigger download
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL
        URL.revokeObjectURL(url);

        toast.success(`Exported ${result.messageCount} messages`);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to export channel history";
        toast.error(message);
        throw error;
      } finally {
        setIsExporting(false);
      }
    },
    [channelId, exportAction]
  );

  return {
    exportHistory,
    isExporting,
  };
}
