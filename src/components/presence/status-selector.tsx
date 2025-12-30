"use client"

import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusIndicator } from "./status-indicator"

export type PresenceStatus = "online" | "away" | "dnd" | "offline"

export interface CustomStatus {
  text?: string
  emoji?: string
}

export interface StatusSelectorProps {
  currentStatus: PresenceStatus
  onStatusChange: (status: PresenceStatus) => void
  onCustomStatusClick?: () => void
  customStatus?: CustomStatus
  disabled?: boolean
  children: React.ReactNode
}

const statusOptions: Array<{
  value: PresenceStatus
  label: string
}> = [
  { value: "online", label: "Online" },
  { value: "away", label: "Away" },
  { value: "dnd", label: "Do not disturb" },
  { value: "offline", label: "Offline" },
]

function StatusSelector({
  currentStatus,
  onStatusChange,
  onCustomStatusClick,
  customStatus,
  disabled = false,
  children,
}: StatusSelectorProps): React.ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {statusOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onStatusChange(option.value)}
            className="gap-2"
          >
            <StatusIndicator status={option.value} size="md" />
            <span className="flex-1">{option.label}</span>
            {currentStatus === option.value && (
              <span className="text-muted-foreground text-xs">Active</span>
            )}
          </DropdownMenuItem>
        ))}

        {onCustomStatusClick && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCustomStatusClick}>
              {customStatus?.emoji && (
                <span className="mr-2">{customStatus.emoji}</span>
              )}
              <span className="flex-1">
                {customStatus?.text ? "Edit custom status..." : "Set custom status..."}
              </span>
            </DropdownMenuItem>
            {customStatus?.text && (
              <DropdownMenuItem
                onClick={() => {
                  // Call with undefined to clear
                  onCustomStatusClick()
                }}
              >
                <span className="flex-1">Clear custom status</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { StatusSelector }
