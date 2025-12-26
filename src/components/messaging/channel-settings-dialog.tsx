"use client";

import { useQuery } from "convex/react";
import { Settings } from "lucide-react";

import type { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// Types
// ============================================================================

export interface ChannelSettingsDialogProps {
  /**
   * The ID of the channel to configure.
   */
  channelId: Id<"channels">;
  /**
   * Whether the dialog is open.
   */
  open: boolean;
  /**
   * Callback when the open state changes.
   */
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// ChannelSettingsDialog Component
// ============================================================================

/**
 * ChannelSettingsDialog provides a tabbed interface for channel configuration.
 *
 * Tabs:
 * - Details: Edit channel name, description, and topic
 * - Members: View and manage channel members
 * - Advanced: Archive or delete the channel
 *
 * Permission checks:
 * - Only channel owners, admins, or global admins can access full settings
 * - Regular members see a read-only view or permission denied message
 *
 * @example
 * ```tsx
 * const [settingsOpen, setSettingsOpen] = useState(false);
 *
 * <ChannelSettingsDialog
 *   channelId={channelId}
 *   open={settingsOpen}
 *   onOpenChange={setSettingsOpen}
 * />
 * ```
 */
export function ChannelSettingsDialog({
  channelId,
  open,
  onOpenChange,
}: ChannelSettingsDialogProps): React.ReactElement {
  // Fetch channel data
  const channel = useQuery(api.channels.get, open ? { channelId } : "skip");

  // Fetch member list
  const members = useQuery(
    api.channels.getMembers,
    open ? { channelId } : "skip"
  );

  // Fetch current user to check global admin status
  const currentUser = useQuery(api.users.me);

  // Loading state
  const isLoading =
    channel === undefined ||
    members === undefined ||
    currentUser === undefined;

  // Permission check: owner, admin, moderator of channel OR global admin
  const userRole = channel?.membership?.role;
  const isGlobalAdmin = currentUser?.role === "admin";
  const canManageChannel =
    userRole === "owner" ||
    userRole === "admin" ||
    userRole === "moderator" ||
    isGlobalAdmin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-2xl")} showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5" aria-hidden="true" />
            Channel Settings
          </DialogTitle>
          <DialogDescription>
            Manage channel details, members, and advanced options.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <ChannelSettingsDialogSkeleton />
        ) : !channel ? (
          <div className="py-8 text-center text-muted-foreground">
            Channel not found or you don&apos;t have access.
          </div>
        ) : !canManageChannel ? (
          <div className="py-8 text-center text-muted-foreground">
            You don&apos;t have permission to manage this channel.
          </div>
        ) : (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="members">
                Members ({members?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4">
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Details form will go here
              </div>
            </TabsContent>

            <TabsContent value="members" className="mt-4">
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Members list will go here
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="mt-4">
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Advanced options will go here
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function ChannelSettingsDialogSkeleton(): React.ReactElement {
  return (
    <div
      data-slot="channel-settings-dialog-skeleton"
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>

      <span className="sr-only">Loading channel settings</span>
    </div>
  );
}

export { ChannelSettingsDialogSkeleton };
