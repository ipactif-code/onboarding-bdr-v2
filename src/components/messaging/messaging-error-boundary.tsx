"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
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
 * Props for the MessagingErrorBoundary component.
 */
export interface MessagingErrorBoundaryProps {
  /** Child components to wrap with error boundary */
  children: React.ReactNode;
  /** Custom fallback component to render when an error occurs */
  fallback?: React.ReactNode;
  /** Callback function invoked when the error boundary resets */
  onReset?: () => void;
  /** Additional CSS classes for the error fallback container */
  className?: string;
  /** Context-specific title for the error message */
  title?: string;
  /** Context-specific description for the error message */
  description?: string;
}

interface MessagingErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// Default Fallback Component
// ============================================================================

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
  className?: string;
  title?: string;
  description?: string;
}

/**
 * Default fallback UI rendered when an error is caught.
 * Displays an error message with a retry button.
 */
function ErrorFallback({
  error,
  onReset,
  className,
  title = "Something went wrong",
  description = "We encountered an error loading this section. Please try again.",
}: ErrorFallbackProps): React.ReactElement {
  return (
    <Card
      data-slot="messaging-error-fallback"
      className={cn(
        "mx-auto max-w-md border-destructive/30 bg-destructive/5",
        className
      )}
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
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
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

        {/* Retry button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full"
          aria-label="Try again to reload this section"
        >
          <RefreshCw className="size-4" data-icon="inline-start" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Compact Error Fallback for Sidebar Sections
// ============================================================================

interface CompactErrorFallbackProps {
  onReset: () => void;
  className?: string;
  message?: string;
}

/**
 * Compact fallback UI for smaller sections like sidebar lists.
 */
export function CompactErrorFallback({
  onReset,
  className,
  message = "Failed to load",
}: CompactErrorFallbackProps): React.ReactElement {
  return (
    <div
      data-slot="messaging-error-compact"
      role="alert"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-center",
        className
      )}
    >
      <AlertTriangle
        className="size-5 text-destructive"
        aria-hidden="true"
      />
      <p className="text-xs text-muted-foreground">{message}</p>
      <Button
        variant="ghost"
        size="xs"
        onClick={onReset}
        className="text-xs"
        aria-label="Try again to reload this section"
      >
        <RefreshCw className="size-3" data-icon="inline-start" />
        Retry
      </Button>
    </div>
  );
}

// ============================================================================
// MessagingErrorBoundary Class Component
// ============================================================================

/**
 * Error boundary component for messaging features.
 *
 * Catches JavaScript errors in child component tree, logs errors,
 * and displays a fallback UI instead of crashing the entire app.
 *
 * @example
 * ```tsx
 * <MessagingErrorBoundary
 *   title="Unable to load channels"
 *   description="We couldn't load your channels. Please try again."
 *   onReset={() => console.log("User clicked retry")}
 * >
 *   <ChannelList />
 * </MessagingErrorBoundary>
 * ```
 *
 * @example Using custom fallback
 * ```tsx
 * <MessagingErrorBoundary
 *   fallback={<CompactErrorFallback onReset={() => {}} message="Channels unavailable" />}
 * >
 *   <ChannelList />
 * </MessagingErrorBoundary>
 * ```
 */
export class MessagingErrorBoundary extends React.Component<
  MessagingErrorBoundaryProps,
  MessagingErrorBoundaryState
> {
  constructor(props: MessagingErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Static method to update state when an error is thrown.
   * Called during the "render" phase.
   */
  static getDerivedStateFromError(error: Error): MessagingErrorBoundaryState {
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
      console.error("[MessagingErrorBoundary] Caught error:", error);
      console.error("[MessagingErrorBoundary] Component stack:", errorInfo.componentStack);
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
    const { children, fallback, className, title, description } = this.props;

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
        <ErrorFallback
          error={error}
          onReset={this.handleReset}
          className={className}
          title={title}
          description={description}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// Hook for Resetting Error Boundaries on Navigation
// ============================================================================

/**
 * Custom hook to reset error boundaries when navigating.
 * Use this with Next.js router events if needed.
 *
 * @example
 * ```tsx
 * const { key, resetKey } = useErrorBoundaryReset();
 * return <MessagingErrorBoundary key={key} onReset={resetKey}>...</MessagingErrorBoundary>
 * ```
 */
export function useErrorBoundaryReset(): {
  key: number;
  resetKey: () => void;
} {
  const [key, setKey] = React.useState(0);

  const resetKey = React.useCallback(() => {
    setKey((prev) => prev + 1);
  }, []);

  return { key, resetKey };
}

// ============================================================================
// Exports
// ============================================================================

export { ErrorFallback };
export type { ErrorFallbackProps, CompactErrorFallbackProps };
