# File Storage Patterns

## Table of Contents

1. [Overview](#overview)
2. [Upload Flow](#upload-flow)
3. [Download Flow](#download-flow)
4. [Image Handling](#image-handling)
5. [File Metadata](#file-metadata)
6. [Cleanup](#cleanup)

## Overview

Convex File Storage provides:
- Direct upload URLs (bypass server)
- Automatic CDN distribution
- References via `v.id("_storage")`
- Max file size: 20MB (default)

## Upload Flow

### 1. Generate Upload URL (Mutation)

```typescript
// convex/files.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
```

### 2. Upload from Client (React)

```typescript
// Client component
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function FileUploader() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFile = useMutation(api.files.saveFile);

  const handleUpload = async (file: File) => {
    // 1. Get upload URL
    const uploadUrl = await generateUploadUrl();

    // 2. Upload file directly to storage
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!response.ok) throw new Error("Upload failed");

    // 3. Get storage ID from response
    const { storageId } = await response.json();

    // 4. Save file reference to database
    await saveFile({
      storageId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
  };

  return (
    <input
      type="file"
      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
    />
  );
}
```

### 3. Save File Reference (Mutation)

```typescript
export const saveFile = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    return await ctx.db.insert("files", {
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      uploadedBy: user._id,
      createdAt: Date.now(),
    });
  },
});
```

## Download Flow

### Get File URL

```typescript
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});
```

### Get File with Metadata

```typescript
export const getFile = query({
  args: { fileId: v.id("files") },
  returns: v.union(
    v.object({
      _id: v.id("files"),
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
      url: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const file = await ctx.db.get(args.fileId);
    if (!file) return null;

    const url = await ctx.storage.getUrl(file.storageId);

    return {
      _id: file._id,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      url,
    };
  },
});
```

## Image Handling

### Schema for Images

```typescript
// convex/schema.ts
images: defineTable({
  storageId: v.id("_storage"),
  alt: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  uploadedBy: v.id("users"),
  createdAt: v.number(),
}).index("by_uploadedBy", ["uploadedBy"]),

// Reference in other tables
courses: defineTable({
  title: v.string(),
  thumbnailId: v.optional(v.id("_storage")),  // Direct storage ref
  // OR
  imageId: v.optional(v.id("images")),         // Via images table
}),
```

### Get Image URL Pattern

```typescript
export const getCourseWithThumbnail = query({
  args: { courseId: v.id("courses") },
  returns: v.object({
    _id: v.id("courses"),
    title: v.string(),
    thumbnailUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");

    let thumbnailUrl: string | null = null;
    if (course.thumbnailId) {
      thumbnailUrl = await ctx.storage.getUrl(course.thumbnailId);
    }

    return {
      _id: course._id,
      title: course.title,
      thumbnailUrl,
    };
  },
});
```

### Image Component (React)

```typescript
// components/convex-image.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ConvexImageProps {
  storageId: Id<"_storage"> | null | undefined;
  alt: string;
  className?: string;
}

export function ConvexImage({ storageId, alt, className }: ConvexImageProps) {
  const url = useQuery(
    api.files.getFileUrl,
    storageId ? { storageId } : "skip"
  );

  if (!url) return null;

  return <img src={url} alt={alt} className={className} />;
}
```

## File Metadata

### Files Table Schema

```typescript
// convex/schema.ts
files: defineTable({
  storageId: v.id("_storage"),
  fileName: v.string(),
  fileType: v.string(),          // MIME type
  fileSize: v.number(),          // bytes
  uploadedBy: v.id("users"),
  folder: v.optional(v.string()), // Optional organization
  createdAt: v.number(),
})
  .index("by_uploadedBy", ["uploadedBy"])
  .index("by_folder", ["folder"]),
```

### List User Files

```typescript
export const listMyFiles = query({
  args: { folder: v.optional(v.string()) },
  returns: v.array(
    v.object({
      _id: v.id("files"),
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
      url: v.union(v.string(), v.null()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    let query = ctx.db
      .query("files")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", user._id));

    const files = await query.collect();

    // Filter by folder if specified
    const filtered = args.folder
      ? files.filter((f) => f.folder === args.folder)
      : files;

    // Add URLs
    return await Promise.all(
      filtered.map(async (file) => ({
        _id: file._id,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        url: await ctx.storage.getUrl(file.storageId),
        createdAt: file.createdAt,
      }))
    );
  },
});
```

## Cleanup

### Delete File

```typescript
export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");
    if (file.uploadedBy !== user._id) throw new Error("Unauthorized");

    // Delete from storage
    await ctx.storage.delete(file.storageId);

    // Delete metadata
    await ctx.db.delete(args.fileId);

    return null;
  },
});
```

### Replace File (Update)

```typescript
export const replaceFile = mutation({
  args: {
    fileId: v.id("files"),
    newStorageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");
    if (file.uploadedBy !== user._id) throw new Error("Unauthorized");

    // Delete old file from storage
    await ctx.storage.delete(file.storageId);

    // Update metadata with new file
    await ctx.db.patch(args.fileId, {
      storageId: args.newStorageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
    });

    return null;
  },
});
```

### Cleanup Orphaned Files (Cron)

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "cleanup-orphaned-files",
  { hourUTC: 3, minuteUTC: 0 },
  internal.maintenance.cleanupOrphanedFiles
);

export default crons;

// convex/maintenance.ts
export const cleanupOrphanedFiles = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    // Find files older than 24h with no references
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    const oldFiles = await ctx.db
      .query("files")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .collect();

    let deleted = 0;
    for (const file of oldFiles) {
      // Check if file is referenced anywhere
      const isReferenced = await checkFileReferences(ctx, file.storageId);
      if (!isReferenced) {
        await ctx.storage.delete(file.storageId);
        await ctx.db.delete(file._id);
        deleted++;
      }
    }

    return deleted;
  },
});
```
