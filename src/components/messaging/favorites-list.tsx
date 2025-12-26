"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { Star } from "lucide-react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelListItem } from "./sidebar/channel-list-item";
import { DMListItem } from "./sidebar/dm-list-item";

interface FavoritesListProps {
  className?: string;
}

/**
 * FavoritesList displays a mixed list of favorited channels and DMs.
 * Uses the favorites.list() query which returns both types combined.
 *
 * @example
 * ```tsx
 * <CollapsibleSection id="favorites" title="Favorites">
 *   <FavoritesList />
 * </CollapsibleSection>
 * ```
 */
export function FavoritesList({
  className,
}: FavoritesListProps): React.ReactElement {
  const pathname = usePathname();
  const favorites = useQuery(api.favorites.list);

  // Determine active item from pathname
  const getActiveId = (): { type: "channel" | "dm"; id: string } | null => {
    if (pathname?.startsWith("/messages/dm/")) {
      return { type: "dm", id: pathname.split("/messages/dm/")[1]?.split("/")[0] || "" };
    }
    if (pathname?.startsWith("/messages/") && !pathname.includes("/dm/")) {
      const parts = pathname.split("/messages/")[1]?.split("/") || [];
      if (parts[0] && !["unread", "threads", "mentions", "drafts"].includes(parts[0])) {
        return { type: "channel", id: parts[0] };
      }
    }
    return null;
  };

  const activeItem = getActiveId();

  // Loading state
  if (favorites === undefined) {
    return <FavoritesListSkeleton className={className} />;
  }

  // Empty state
  if (favorites.length === 0) {
    return (
      <div
        data-slot="favorites-list-empty"
        className={cn(
          "flex flex-col items-center justify-center py-4 text-center",
          className
        )}
      >
        <Star className="mb-1 size-5 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">
          No favorites yet
        </p>
        <p className="text-xs text-muted-foreground/70">
          Click the star on channels or DMs
        </p>
      </div>
    );
  }

  return (
    <div
      data-slot="favorites-list"
      className={cn("space-y-0.5", className)}
    >
      {favorites.map((item: { type: "channel" | "dm"; id: string; name: string; isPrivate?: boolean; unreadCount?: number; avatarUrl?: string }) => {
        const isActive =
          activeItem?.type === item.type && activeItem?.id === item.id;

        if (item.type === "channel") {
          return (
            <ChannelListItem
              key={`channel-${item.id}`}
              id={item.id}
              name={item.name}
              isPrivate={item.isPrivate ?? false}
              unreadCount={item.unreadCount ?? 0}
              isActive={isActive}
            />
          );
        }

        return (
          <DMListItem
            key={`dm-${item.id}`}
            conversationId={item.id}
            name={item.name}
            avatarUrl={item.avatarUrl}
            status="offline" // TODO: integrate presence when available
            isActive={isActive}
          />
        );
      })}
    </div>
  );
}

/**
 * Loading skeleton for FavoritesList
 */
export function FavoritesListSkeleton({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      data-slot="favorites-list-skeleton"
      className={cn("space-y-1", className)}
    >
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export type { FavoritesListProps };
