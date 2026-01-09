"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the EditorErrorBoundary component.
 */
export interface EditorErrorBoundaryProps {
  /** Child components to wrap with error boundary */
  children: React.ReactNode;
  /** Custom fallback component to render when an error occurs */
  fallback?: React.ReactNode;
  /** Callback function invoked when the error boundary resets */
  onReset?: () => void;
  /** Additional CSS classes for the error fallback container */
  className?: string;
  /** URL to navigate back to (defaults to /knowledge) */
  backUrl?: string;
}

interface EditorErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// Error Fallback Component
// ============================================================================

interface EditorErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
  className?: string;
  backUrl?: string;
}

/**
 * Fallback UI rendered when an editor error is caught.
 * Displays an error message with retry and navigation options.
 */
function EditorErrorFallback({
  error,
  onReset,
  className,
  backUrl = "/knowledge",
}: EditorErrorFallbackProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center p-8",
        className
      )}
    >
      <Card
        data-slot="editor-error-fallback"
        className="mx-auto max-w-md border-destructive/30 bg-destructive/5"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10"
              aria-hidden="true"
            >
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base text-destructive">
                Editor Error
              </CardTitle>
              <CardDescription>
                The document editor encountered an error and couldn&apos;t
                continue. Your recent changes may not have been saved.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error details (development mode only) */}
          {process.env.NODE_ENV === "development" && error && (
            <details className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
              <summary className="cursor-pointer text-xs font-medium text-destructive">
                Error details (development only)
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground">
                {error.message}
                {error.stack && (
                  <>
                    {"\n\n"}
                    {error.stack}
                  </>
                )}
              </pre>
            </details>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="w-full"
              aria-label="Try again to reload the editor"
            >
              <RefreshCw className="size-4" data-icon="inline-start" />
              Try Again
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              aria-label="Go back to documents list"
              render={(props) => <Link {...props} href={backUrl} />}
            >
              <ArrowLeft className="size-4" data-icon="inline-start" />
              Back to Documents
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// EditorErrorBoundary Class Component
// ============================================================================

/**
 * Error boundary component for the document editor.
 *
 * Catches JavaScript errors in the editor component tree (Plate.js, Yjs, etc.),
 * logs errors, and displays a fallback UI instead of crashing the entire page.
 *
 * @example
 * ```tsx
 * <EditorErrorBoundary
 *   onReset={() => window.location.reload()}
 *   backUrl="/knowledge"
 * >
 *   <CollaborativeEditor ... />
 * </EditorErrorBoundary>
 * ```
 */
export class EditorErrorBoundary extends React.Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  constructor(props: EditorErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Static method to update state when an error is thrown.
   * Called during the "render" phase.
   */
  static getDerivedStateFromError(error: Error): EditorErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Lifecycle method called after an error has been thrown.
   * Use for error logging or analytics.
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging/monitoring
    // In production, this could send to an error tracking service
    if (process.env.NODE_ENV === "development") {
      console.error("[EditorErrorBoundary] Caught error:", error);
      console.error(
        "[EditorErrorBoundary] Component stack:",
        errorInfo.componentStack
      );
    }
  }

  /**
   * Reset the error boundary state, allowing children to re-render.
   */
  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, className, backUrl } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        // If fallback is a React element, clone it to pass reset handler
        if (React.isValidElement(fallback)) {
          return React.cloneElement(
            fallback as React.ReactElement<{ onReset?: () => void }>,
            { onReset: this.handleReset }
          );
        }
        return fallback;
      }

      // Use default fallback
      return (
        <EditorErrorFallback
          error={error}
          onReset={this.handleReset}
          className={className}
          backUrl={backUrl}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { EditorErrorFallback };
export type { EditorErrorFallbackProps };
