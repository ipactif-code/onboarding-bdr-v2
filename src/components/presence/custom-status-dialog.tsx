"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface CustomStatusData {
  text?: string
  emoji?: string
  expiresAt?: number
}

export interface CustomStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStatus?: CustomStatusData
  onSave: (status: CustomStatusData) => void
}

const durationOptions = [
  { value: "never", label: "Don't clear" },
  { value: "30min", label: "30 minutes" },
  { value: "1hour", label: "1 hour" },
  { value: "4hours", label: "4 hours" },
  { value: "today", label: "Today" },
] as const

function calculateExpiresAt(duration: string): number | undefined {
  const now = Date.now()

  switch (duration) {
    case "30min":
      return now + 30 * 60 * 1000
    case "1hour":
      return now + 60 * 60 * 1000
    case "4hours":
      return now + 4 * 60 * 60 * 1000
    case "today": {
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)
      return endOfDay.getTime()
    }
    case "never":
    default:
      return undefined
  }
}

function CustomStatusDialog({
  open,
  onOpenChange,
  currentStatus,
  onSave,
}: CustomStatusDialogProps): React.ReactElement {
  const [emoji, setEmoji] = React.useState<string>(currentStatus?.emoji ?? "")
  const [text, setText] = React.useState<string>(currentStatus?.text ?? "")
  const [duration, setDuration] = React.useState<string>("never")

  // Reset form when dialog opens/closes or currentStatus changes
  React.useEffect(() => {
    if (open) {
      setEmoji(currentStatus?.emoji ?? "")
      setText(currentStatus?.text ?? "")
      setDuration("never")
    }
  }, [open, currentStatus])

  const handleSave = (): void => {
    const expiresAt = calculateExpiresAt(duration)
    onSave({
      text: text.trim() || undefined,
      emoji: emoji.trim() || undefined,
      expiresAt,
    })
    onOpenChange(false)
  }

  const characterCount = text.length
  const maxChars = 100
  const isOverLimit = characterCount > maxChars

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set custom status</DialogTitle>
          <DialogDescription>
            Set a custom status message that others can see
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="emoji" className="text-sm font-medium">
              Emoji (optional)
            </label>
            <Input
              id="emoji"
              type="text"
              placeholder="😊"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={2}
              className="text-2xl"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="status-text" className="text-sm font-medium">
              Status message
            </label>
            <Input
              id="status-text"
              type="text"
              placeholder="Working on something cool..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={maxChars}
              aria-invalid={isOverLimit}
            />
            <div
              className={`text-xs ${
                isOverLimit ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {characterCount}/{maxChars} characters
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="duration" className="text-sm font-medium">
              Clear after
            </label>
            <Select value={duration} onValueChange={(value) => setDuration(value ?? "never")}>
              <SelectTrigger id="duration" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {durationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isOverLimit || !text.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { CustomStatusDialog }
