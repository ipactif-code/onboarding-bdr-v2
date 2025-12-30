import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusIndicatorVariants = cva(
  "rounded-full",
  {
    variants: {
      status: {
        online: "bg-green-500",
        away: "bg-yellow-500",
        dnd: "bg-red-500",
        offline: "bg-gray-400",
      },
      size: {
        sm: "w-2 h-2",
        md: "w-2.5 h-2.5",
        lg: "w-3 h-3",
      },
    },
    defaultVariants: {
      status: "offline",
      size: "md",
    },
  }
)

const statusLabels = {
  online: "Online",
  away: "Away",
  dnd: "Do not disturb",
  offline: "Offline",
} as const

export interface StatusIndicatorProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusIndicatorVariants> {
  showPulse?: boolean
}

function StatusIndicator({
  status = "offline",
  size = "md",
  showPulse = false,
  className,
  ...props
}: StatusIndicatorProps): React.ReactElement {
  const label = statusLabels[status ?? "offline"]

  return (
    <span
      data-slot="status-indicator"
      aria-label={label}
      role="status"
      className={cn(
        statusIndicatorVariants({ status, size }),
        showPulse && status === "online" && "animate-pulse",
        className
      )}
      {...props}
    />
  )
}

export { StatusIndicator, statusIndicatorVariants }
