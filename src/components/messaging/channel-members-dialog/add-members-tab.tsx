"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { Search, X, Loader2 } from "lucide-react";

import type { Id } from "../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../convex/_generated/api").api;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import type { MemberInfo, UserSearchResult } from "./types";
import { getInitials } from "./helpers";
import { UserSearchRow } from "./user-search-row";

interface AddMembersTabProps {
  channelId: Id<"channels">;
}

export function AddMembersTab({ channelId }: AddMembersTabProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const searchResults = useQuery(
    api.directMessages.searchUsers,
    searchQuery.trim().length >= 2 ? { query: searchQuery.trim(), limit: 10 } : "skip"
  );

  const addMembers = useMutation(api.channels.addMembers);
  const currentMembers = useQuery(api.channels.getMembers, { channelId });
  const currentMemberIds = new Set(currentMembers?.map((m: MemberInfo) => m.userId) ?? []);

  const filteredResults = searchResults?.filter(
    (user: UserSearchResult) =>
      !currentMemberIds.has(user._id) && !selectedUsers.some((s) => s._id === user._id)
  ) ?? [];

  const handleSelectUser = useCallback((user: UserSearchResult) => {
    setSelectedUsers((prev) => [...prev, user]);
    setSearchQuery("");
  }, []);

  const handleRemoveSelected = useCallback((userId: Id<"users">) => {
    setSelectedUsers((prev) => prev.filter((u) => u._id !== userId));
  }, []);

  const handleAddMembers = useCallback(async () => {
    if (selectedUsers.length === 0) return;
    try {
      setIsAdding(true);
      const result = await addMembers({ channelId, userIds: selectedUsers.map((u) => u._id) });
      if (result.added > 0) {
        toast.success(`Added ${result.added} ${result.added === 1 ? "member" : "members"} to the channel`);
      }
      if (result.alreadyMembers > 0) {
        toast.info(`${result.alreadyMembers} ${result.alreadyMembers === 1 ? "user was" : "users were"} already members`);
      }
      setSelectedUsers([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add members");
    } finally {
      setIsAdding(false);
    }
  }, [channelId, addMembers, selectedUsers]);

  return (
    <div className="space-y-4">
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <Badge key={user._id} variant="secondary" className="flex items-center gap-1 pl-1">
              <Avatar className="size-5">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <span>{user.name}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleRemoveSelected(user._id)}
                aria-label={`Remove ${user.name} from selection`}
                className="ml-1 min-h-11 min-w-11 rounded-full"
              >
                <X className="size-3" aria-hidden="true" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Label htmlFor="member-search" className="sr-only">
          Search for members to add
        </Label>
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="member-search"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 min-h-11 min-w-11 -translate-y-1/2"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
      </div>

      <ScrollArea className="h-48">
        {searchQuery.trim().length < 2 ? (
          <div
            className="flex flex-col items-center justify-center py-8 text-center"
            role="status"
            aria-live="polite"
          >
            <Search className="mb-2 size-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Type at least 2 characters to search</p>
          </div>
        ) : searchResults === undefined ? (
          <div
            className="flex items-center justify-center py-8"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading search results</span>
          </div>
        ) : filteredResults.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-8 text-center"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-muted-foreground">
              {searchResults.length === 0 ? `No users found matching "${searchQuery}"` : "All matching users are already members"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredResults.map((user: UserSearchResult) => (
              <UserSearchRow key={user._id} user={user} onSelect={() => handleSelectUser(user)} />
            ))}
          </div>
        )}
      </ScrollArea>

      {selectedUsers.length > 0 && (
        <div className="flex justify-end pt-2">
          <Button onClick={handleAddMembers} disabled={isAdding}>
            {isAdding ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                Adding...
              </>
            ) : (
              <>Add {selectedUsers.length} {selectedUsers.length === 1 ? "Member" : "Members"}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
