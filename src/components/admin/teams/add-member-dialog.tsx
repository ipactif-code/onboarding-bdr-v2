"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Plus, Search, Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface AddMemberDialogProps {
  teamId: Id<"teams">;
  existingMemberIds: Id<"users">[];
}

export function AddMemberDialog({ teamId, existingMemberIds }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Fetch all users
  const users = useQuery(api.users.list, { search: search || undefined });

  // Add members mutation
  const addMembers = useMutation(api.teams.addMembers);

  // Filter out existing members
  const availableUsers = users?.data.filter(
    (user) => !existingMemberIds.includes(user._id)
  );

  // Toggle user selection
  const toggleUser = (userId: Id<"users">) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Add selected members
  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) return;

    setIsAdding(true);
    try {
      const result = await addMembers({ teamId, userIds: selectedUserIds });
      setSelectedUserIds([]);
      setSearch("");
      setOpen(false);
      toast.success(
        `Added ${result.added} member${result.added !== 1 ? "s" : ""}`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add members");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlus className="size-4" data-icon="inline-start" />
        Add Member
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Members</DialogTitle>
          <DialogDescription>
            Select users to add to this team.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* User list */}
        <ScrollArea className="h-[300px] pr-4">
          {availableUsers === undefined ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded-lg animate-pulse"
                >
                  <div className="size-9 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-48 bg-muted rounded mt-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search
                ? "No users found matching your search"
                : "All users are already members of this team"}
            </div>
          ) : (
            <div className="space-y-1">
              {availableUsers.map((user) => {
                const isSelected = selectedUserIds.includes(user._id);
                const initials = user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={user._id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleUser(user._id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleUser(user._id)}
                    />
                    <Avatar className="size-9">
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {user.name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="size-4 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Selected count */}
        {selectedUserIds.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {selectedUserIds.length} user{selectedUserIds.length !== 1 ? "s" : ""}{" "}
            selected
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMembers}
            disabled={selectedUserIds.length === 0 || isAdding}
          >
            {isAdding ? (
              "Adding..."
            ) : (
              <>
                <Plus className="size-4" data-icon="inline-start" />
                Add {selectedUserIds.length || ""} Member
                {selectedUserIds.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
