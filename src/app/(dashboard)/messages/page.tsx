import * as React from "react";
import { MessageSquare } from "lucide-react";

/**
 * Messages index page.
 *
 * This is a Server Component that displays a placeholder when no channel is selected.
 * The ChannelList is rendered by the layout, so this page only needs to show
 * the "Select a channel" empty state.
 *
 * Route: /messages
 */
export default function MessagesPage(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <MessageSquare className="mx-auto mb-4 size-12 opacity-50" />
        <h2 className="text-lg font-medium">Select a channel</h2>
        <p className="text-sm">Choose a channel from the sidebar to start messaging</p>
      </div>
    </div>
  );
}
