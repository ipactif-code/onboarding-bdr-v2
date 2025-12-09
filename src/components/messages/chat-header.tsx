"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatHeaderProps {
  name: string;
  avatar?: string;
  isOnline?: boolean;
}

export function ChatHeader({ name, avatar, isOnline }: ChatHeaderProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-4 border-b border-neutral-200">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative">
          <Avatar className="size-10">
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {/* Online indicator */}
          {isOnline && (
            <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-white" />
          )}
        </div>

        {/* Name + Status */}
        <div className="flex flex-col">
          <span className="text-base font-medium text-black/85">{name}</span>
          <span
            className={`text-sm ${isOnline ? "text-green-600" : "text-neutral-500"}`}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>
    </div>
  );
}
