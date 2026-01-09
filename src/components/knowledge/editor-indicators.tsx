"use client";

import * as React from "react";
import {
  Save,
  Loader2,
  Check,
  Wifi,
  WifiOff,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SaveStatus } from "@/hooks/knowledge/use-editor-save";

// ============================================================================
// Types
// ============================================================================

/**
 * Connection status for the editor.
 * Can be from either collaboration config or Hocuspocus provider.
 */
export type EditorConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

// ============================================================================
// Save Status Indicator
// ============================================================================

interface SaveStatusIndicatorProps {
  status: SaveStatus;
}

export function SaveStatusIndicator({
  status,
}: SaveStatusIndicatorProps): React.ReactElement | null {
  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {status === "saving" && (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="size-3.5 text-green-500" />
          <span>Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <Save className="size-3.5 text-destructive" />
          <span className="text-destructive">Save failed</span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Connection Status Indicator
// ============================================================================

interface ConnectionStatusIndicatorProps {
  status: EditorConnectionStatus;
  error: string | null;
  activeEditors: number;
}

export function ConnectionStatusIndicator({
  status,
  error,
  activeEditors,
}: ConnectionStatusIndicatorProps): React.ReactElement {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            {status === "connecting" && (
              <>
                <div className="size-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  Connecting...
                </span>
              </>
            )}
            {status === "connected" && (
              <>
                <Wifi className="size-3.5 text-green-500" />
                <span className="text-xs text-muted-foreground">Live</span>
                {activeEditors > 1 && (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Users className="size-3" />
                    {activeEditors}
                  </span>
                )}
              </>
            )}
            {status === "disconnected" && (
              <>
                <WifiOff className="size-3.5 text-gray-400" />
                <span className="text-xs text-muted-foreground">Offline</span>
              </>
            )}
            {status === "error" && (
              <>
                <div className="size-2 rounded-full bg-red-500" />
                <span className="text-xs text-destructive">Error</span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {status === "connecting" && "Connecting to collaboration server..."}
          {status === "connected" &&
            `Real-time collaboration active${activeEditors > 1 ? ` (${activeEditors} editors)` : ""}`}
          {status === "disconnected" &&
            "Offline - changes saved locally, will sync when reconnected"}
          {status === "error" && (error || "Connection error")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function DocumentEditorSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumbs skeleton */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <Skeleton className="size-4" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Header skeleton */}
      <div className="px-8 py-6 border-b">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8" />
          <Skeleton className="h-8 w-64" />
        </div>
      </div>

      {/* Editor skeleton */}
      <div className="flex-1 px-8 py-6 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    </div>
  );
}

// ============================================================================
// Editor Content Skeleton (for Yjs sync)
// ============================================================================

export function EditorContentSkeleton(): React.ReactElement {
  return (
    <div className="h-full overflow-auto px-[100px] py-4">
      <div className="space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div className="text-center">
        <WifiOff className="size-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Cannot Join Collaboration
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">{error}</p>
      </div>
      <Button onClick={onRetry} variant="outline">
        Retry Connection
      </Button>
    </div>
  );
}
