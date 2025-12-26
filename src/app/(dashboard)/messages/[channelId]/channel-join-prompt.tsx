"use client";

import { Button } from "@/components/ui/button";
import { ChannelHeader } from "@/components/messaging/channel-header";
import { type ChannelWithMembership } from "@/hooks/use-channel";

// ============================================================================
// Types
// ============================================================================

export interface ChannelJoinPromptProps {
  /** The channel data to display. */
  channel: ChannelWithMembership;
  /** Callback when user clicks join button. */
  onJoin: () => void;
}

// ============================================================================
// ChannelJoinPrompt Component
// ============================================================================

/**
 * ChannelJoinPrompt displays a prompt for users who are not members of a channel.
 * Shows channel info and a join button for public channels.
 */
export function ChannelJoinPrompt({
  channel,
  onJoin,
}: ChannelJoinPromptProps): React.ReactElement {
  return (
    <div data-slot="channel-join-prompt" className="flex h-full flex-col">
      <ChannelHeader channel={channel} />
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-semibold">#{channel.name}</h2>
        {channel.description && (
          <p className="mt-2 max-w-md text-muted-foreground">
            {channel.description}
          </p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          {channel.memberCount} {channel.memberCount === 1 ? "member" : "members"}
        </p>
        {channel.type === "public" && !channel.isArchived && (
          <Button onClick={onJoin} className="mt-6">
            Join Channel
          </Button>
        )}
        {channel.type === "private" && (
          <p className="mt-4 text-sm text-muted-foreground">
            This is a private channel. You need an invite to join.
          </p>
        )}
        {channel.isArchived && (
          <p className="mt-4 text-sm text-muted-foreground">
            This channel has been archived.
          </p>
        )}
      </div>
    </div>
  );
}
