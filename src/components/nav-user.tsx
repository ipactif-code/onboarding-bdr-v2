"use client"

import { useState } from "react"
import { useUser, useClerk } from "@clerk/nextjs"
import {
  ChevronsUpDown,
  LogOut,
  User,
  Smile,
} from "lucide-react"
import { toast } from "sonner"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { StatusIndicator, CustomStatusDialog, type PresenceStatus } from "@/components/presence"
import { useMyPresence } from "@/hooks/use-my-presence"
import type { CustomStatus } from "@/hooks/use-my-presence"

const statusOptions: Array<{
  value: PresenceStatus
  label: string
}> = [
  { value: "online", label: "Online" },
  { value: "away", label: "Away" },
  { value: "dnd", label: "Do not disturb" },
]

export function NavUser(): React.ReactElement {
  const { isMobile } = useSidebar()
  const { user } = useUser()
  const { signOut, openUserProfile } = useClerk()
  const { status, customStatus, setStatus, setCustomStatus, clearCustomStatus, isUpdating } = useMyPresence()
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [customStatusDialogOpen, setCustomStatusDialogOpen] = useState(false)

  const name = user?.fullName ?? "User"
  const email = user?.primaryEmailAddress?.emailAddress ?? ""
  const avatarUrl = user?.imageUrl

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const handleStatusChange = async (newStatus: PresenceStatus): Promise<void> => {
    if (newStatus === status || isUpdating) return
    try {
      setIsChangingStatus(true)
      await setStatus(newStatus)
      toast.success(`Status changed to ${newStatus === "dnd" ? "Do not disturb" : newStatus}`)
    } catch {
      toast.error("Failed to update status")
    } finally {
      setIsChangingStatus(false)
    }
  }

  const handleCustomStatusSave = async (statusData: CustomStatus): Promise<void> => {
    try {
      await setCustomStatus({
        text: statusData.text,
        emoji: statusData.emoji,
        expiresAt: statusData.expiresAt,
      })
      toast.success("Custom status updated")
    } catch {
      toast.error("Failed to update custom status")
    }
  }

  const handleClearCustomStatus = async (): Promise<void> => {
    try {
      await clearCustomStatus()
      toast.success("Custom status cleared")
    } catch {
      toast.error("Failed to clear custom status")
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground" />}>
            <div className="relative">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatarUrl} alt={name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <StatusIndicator
                status={status}
                size="sm"
                className="absolute -bottom-0.5 -right-0.5 ring-2 ring-sidebar"
              />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs">{email}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <div className="relative">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={avatarUrl} alt={name} />
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <StatusIndicator
                    status={status}
                    size="sm"
                    className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  {customStatus ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {customStatus.emoji && `${customStatus.emoji} `}
                      {customStatus.text}
                    </span>
                  ) : (
                    <span className="truncate text-xs capitalize">
                      {status === "dnd" ? "Do not disturb" : status}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Status submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={isChangingStatus}>
                <StatusIndicator status={status} size="sm" className="mr-2" />
                Set status
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {statusOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                      disabled={isChangingStatus}
                      className="gap-2"
                    >
                      <StatusIndicator status={option.value} size="sm" />
                      <span className="flex-1">{option.label}</span>
                      {status === option.value && (
                        <span className="text-muted-foreground text-xs">Active</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {/* Custom status option */}
                  <DropdownMenuItem
                    onClick={() => setCustomStatusDialogOpen(true)}
                    disabled={isChangingStatus}
                    className="gap-2"
                  >
                    <Smile className="size-3.5" />
                    <span className="flex-1">
                      {customStatus ? "Edit custom status..." : "Set custom status..."}
                    </span>
                  </DropdownMenuItem>
                  {customStatus && (
                    <DropdownMenuItem
                      onClick={handleClearCustomStatus}
                      disabled={isUpdating}
                      className="gap-2 text-muted-foreground"
                    >
                      <span className="size-3.5" />
                      <span className="flex-1">Clear custom status</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openUserProfile()}>
              <User />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut({ redirectUrl: '/sign-in' })}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Custom Status Dialog */}
        <CustomStatusDialog
          open={customStatusDialogOpen}
          onOpenChange={setCustomStatusDialogOpen}
          currentStatus={customStatus ?? undefined}
          onSave={handleCustomStatusSave}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
