"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThumbnailUpload } from "./thumbnail-upload";
import { toast } from "sonner";

interface MainInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: Id<"courses">;
  currentTitle: string;
  currentDescription: string;
  currentThumbnailUrl?: string;
}

export function MainInfoModal({
  open,
  onOpenChange,
  courseId,
  currentTitle,
  currentDescription,
  currentThumbnailUrl,
}: MainInfoModalProps) {
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription);
  const [thumbnailStorageId, setThumbnailStorageId] = useState<Id<"_storage"> | null>(null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateCourse = useMutation(api.courses.update);
  const saveCoverImage = useMutation(api.files.saveCoverImage);
  const removeCoverImage = useMutation(api.files.removeCoverImage);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTitle(currentTitle);
      setDescription(currentDescription);
      setThumbnailStorageId(null);
      setRemoveThumbnail(false);
    }
  }, [open, currentTitle, currentDescription]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);

    try {
      // Update title and description
      await updateCourse({
        courseId,
        title: title.trim(),
        description: description.trim() || undefined,
      });

      // Handle thumbnail changes
      if (removeThumbnail) {
        await removeCoverImage({ courseId });
      } else if (thumbnailStorageId) {
        await saveCoverImage({
          courseId,
          storageId: thumbnailStorageId,
        });
      }

      toast.success("Course information updated");
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating course:", error);
      toast.error("Failed to update course information");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Main Information</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Course title"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Course description"
              rows={3}
            />
          </div>

          {/* Thumbnail */}
          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <ThumbnailUpload
              currentImageUrl={removeThumbnail ? undefined : currentThumbnailUrl}
              onUploadComplete={(storageId) => {
                setThumbnailStorageId(storageId);
                setRemoveThumbnail(false);
              }}
              onRemove={() => {
                setThumbnailStorageId(null);
                setRemoveThumbnail(true);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
