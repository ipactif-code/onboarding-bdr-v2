"use client";

import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { BookmarksList } from "@/components/messaging/bookmarks-list";

/**
 * BookmarksView is the client component for viewing bookmarked messages.
 *
 * Features:
 * - Displays all bookmarked messages
 * - Click to navigate to the original message location
 * - Remove bookmarks
 */
export function BookmarksView(): React.ReactElement {
  const router = useRouter();

  const handleNavigateToMessage = (
    messageId: Id<"messages">,
    context: { type: "channel" | "conversation"; id: string }
  ): void => {
    if (context.type === "channel") {
      // Navigate to channel with thread param to highlight message
      router.push(`/messages/${context.id}?thread=${messageId}`);
    } else {
      // Navigate to DM conversation
      router.push(`/messages/dm/${context.id}`);
    }
  };

  return (
    <div data-slot="bookmarks-view" className="flex h-full flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <Bookmark className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-base font-semibold">Bookmarks</h1>
      </header>

      {/* Bookmarks list */}
      <div className="flex-1 overflow-hidden">
        <BookmarksList
          onNavigateToMessage={handleNavigateToMessage}
          className="h-full"
        />
      </div>
    </div>
  );
}
