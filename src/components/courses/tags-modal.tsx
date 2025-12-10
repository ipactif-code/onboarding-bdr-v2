"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Search, Plus, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Tag {
  _id: Id<"tags">;
  name: string;
}

interface TagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: Id<"courses">;
  currentTags: Tag[];
}

export function TagsModal({
  open,
  onOpenChange,
  courseId,
  currentTags,
}: TagsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // Fetch all available tags (skip when modal is closed to avoid auth errors)
  const allTags = useQuery(api.tags.list, open ? { search: searchQuery } : "skip");

  const addTag = useMutation(api.courses.addTag);
  const removeTag = useMutation(api.courses.removeTag);

  // Reset search when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setNewTagName("");
    }
  }, [open]);

  // Filter out already added tags
  const availableTags = allTags?.filter(
    (tag) => !currentTags.some((ct) => ct._id === tag._id)
  );

  const handleAddTag = async (tagName: string) => {
    setIsAdding(tagName);
    try {
      await addTag({ courseId, tagName });
      toast.success("Tag added");
    } catch (error) {
      console.error("Error adding tag:", error);
      toast.error("Failed to add tag");
    } finally {
      setIsAdding(null);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreating(true);
    try {
      await addTag({ courseId, tagName: newTagName.trim() });
      setNewTagName("");
      toast.success("Tag created and added");
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error("Failed to create tag");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveTag = async (tagId: Id<"tags">) => {
    setIsRemoving(tagId);
    try {
      await removeTag({ courseId, tagId });
      toast.success("Tag removed");
    } catch (error) {
      console.error("Error removing tag:", error);
      toast.error("Failed to remove tag");
    } finally {
      setIsRemoving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Tags Section */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Current Tags</h4>
            {currentTags.length === 0 ? (
              <p className="text-sm text-gray-500">No tags added yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentTags.map((tag) => (
                  <Badge
                    key={tag._id}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag._id)}
                      disabled={isRemoving === tag._id}
                      className="ml-1 rounded-full hover:bg-gray-300"
                    >
                      {isRemoving === tag._id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Create New Tag Section */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Create New Tag</h4>
            <div className="flex gap-2">
              <Input
                placeholder="Enter new tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
              />
              <Button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || isCreating}
                size="icon"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Add Existing Tags Section */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Add Existing Tag</h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[150px]">
              {availableTags === undefined ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : availableTags.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  {searchQuery ? "No matching tags found" : "No available tags"}
                </p>
              ) : (
                <div className="space-y-1 p-1">
                  {availableTags.map((tag) => (
                    <button
                      key={tag._id}
                      onClick={() => handleAddTag(tag.name)}
                      disabled={isAdding === tag.name}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                    >
                      <span>{tag.name}</span>
                      {isAdding === tag.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
