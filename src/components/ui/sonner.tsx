"use client"

import type { ReactElement } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

/**
 * Accessible toast notification container.
 *
 * Screen Reader Support (built-in via Sonner):
 * - Container has `aria-live="polite"` for non-intrusive announcements
 * - Container has `aria-relevant="additions text"` to announce new toasts
 * - Container has `aria-atomic="false"` to only read new content
 * - All toast types (success, error, info, warning) are announced to screen readers
 *
 * @see https://sonner.emilkowal.ski/getting-started for Sonner accessibility docs
 */
const Toaster = ({ ...props }: ToasterProps): ReactElement => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      containerAriaLabel="Notifications"
      icons={{
        success: <CircleCheckIcon className="size-4" aria-hidden="true" />,
        info: <InfoIcon className="size-4" aria-hidden="true" />,
        warning: <TriangleAlertIcon className="size-4" aria-hidden="true" />,
        error: <OctagonXIcon className="size-4" aria-hidden="true" />,
        loading: (
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
        closeButtonAriaLabel: "Dismiss notification",
      }}
      {...props}
    />
  )
}

export { Toaster }
