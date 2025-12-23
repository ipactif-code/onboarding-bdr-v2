"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  AtSign,
  FileText,
  MoreHorizontal,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickNavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface QuickNavigationProps {
  className?: string;
  /** Counts for badges (from parent) */
  unreadCount?: number;
  threadCount?: number;
  mentionCount?: number;
  draftCount?: number;
}

/**
 * QuickNavigation provides quick access links at the top of the messaging sidebar.
 *
 * Links:
 * - Unread: Shows unread messages count
 * - Threads: Shows thread conversations
 * - Mentions: Shows @mentions
 * - Drafts: Shows saved drafts
 * - More: Additional filters/options
 *
 * @example
 * ```tsx
 * <QuickNavigation
 *   unreadCount={5}
 *   mentionCount={2}
 * />
 * ```
 */
export function QuickNavigation({
  className,
  unreadCount = 0,
  threadCount = 0,
  mentionCount = 0,
  draftCount = 0,
}: QuickNavigationProps): React.ReactElement {
  const pathname = usePathname();

  const items: QuickNavItem[] = [
    {
      id: "unread",
      label: "Unread",
      href: "/messages/unread",
      icon: Filter,
      badge: unreadCount,
    },
    {
      id: "threads",
      label: "Threads",
      href: "/messages/threads",
      icon: MessageSquare,
      badge: threadCount,
    },
    {
      id: "mentions",
      label: "Mentions",
      href: "/messages/mentions",
      icon: AtSign,
      badge: mentionCount,
    },
    {
      id: "drafts",
      label: "Drafts",
      href: "/messages/drafts",
      icon: FileText,
      badge: draftCount,
    },
  ];

  return (
    <nav
      data-slot="quick-navigation"
      aria-label="Quick navigation"
      className={cn("space-y-0.5 px-2", className)}
    >
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
              "transition-colors duration-150",
              isActive
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={cn(
                  "ml-auto flex size-5 min-w-5 items-center justify-center rounded-full text-xs font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
                aria-label={`${item.badge} ${item.label.toLowerCase()}`}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        );
      })}

      {/* More options */}
      <button
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
          "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        type="button"
      >
        <MoreHorizontal className="size-4 shrink-0" />
        <span>More</span>
      </button>
    </nav>
  );
}

export type { QuickNavigationProps, QuickNavItem };
