"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { Id } from "../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../convex/_generated/api").api;
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ThumbnailUploadProps {
  currentImageUrl?: string;
  onUploadComplete: (storageId: Id<"_storage">) => void;
  onRemove: () => void;
}

export function ThumbnailUpload({
  currentImageUrl,
  onUploadComplete,
  onRemove,
}: ThumbnailUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.files.getUploadUrl);

  const handleUpload = useCallback(
    async (file: File) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }

      setIsUploading(true);

      try {
        // Generate upload URL
        const uploadUrl = await generateUploadUrl();

        // Upload file
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const { storageId } = await response.json();

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);

        onUploadComplete(storageId);
        toast.success("Thumbnail uploaded successfully");
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload thumbnail");
      } finally {
        setIsUploading(false);
      }
    },
    [generateUploadUrl, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload]
  );

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    onRemove();
  }, [onRemove]);

  const displayUrl = previewUrl || currentImageUrl;

  // Show preview if we have an image
  if (displayUrl) {
    return (
      <div className="relative">
        <img
          src={displayUrl}
          alt="Thumbnail preview"
          className="h-40 w-full rounded-lg border border-border object-cover"
        />
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8"
          onClick={handleRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Show dropzone
  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        flex h-40 cursor-pointer flex-col items-center justify-center gap-2
        rounded-lg border-2 border-dashed transition-colors
        ${isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}
        ${isUploading ? "pointer-events-none opacity-50" : ""}
      `}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id="thumbnail-upload"
        disabled={isUploading}
      />
      <label
        htmlFor="thumbnail-upload"
        className="flex cursor-pointer flex-col items-center gap-2"
      >
        {isUploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        ) : (
          <Upload className="h-8 w-8 text-gray-400" />
        )}
        <span className="text-sm font-medium text-gray-700">
          {isUploading ? "Uploading..." : "Upload a file"}
        </span>
        <span className="text-xs text-gray-500">
          Drag and drop or click to upload
        </span>
        <span className="text-xs text-gray-400">Accepts image</span>
      </label>
    </div>
  );
}
