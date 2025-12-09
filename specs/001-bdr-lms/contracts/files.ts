# Convex Function Contracts: File Storage

**Module**: `convex/files.ts`
**Date**: 2025-12-06

## Overview

File upload and storage using Convex's built-in file storage.
Used for course cover images and file lesson attachments.

---

## Queries

### `api.files.getUploadUrl`
Generate a presigned URL for file upload.

```typescript
export const getUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
```

**Authorization**: Admin only (for course/lesson files)
**Returns**: Presigned URL valid for short duration

---

### `api.files.getUrl`
Get public URL for a stored file.

```typescript
export const getUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.optional(v.string()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
```

**Authorization**: Any authenticated user

---

### `api.files.listForLesson`
Get all file attachments for a lesson.

```typescript
export const listForLesson = query({
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.array(v.object({
    _id: v.id("files"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    downloadUrl: v.string(),
    uploadedAt: v.number(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: User with course access

---

## Mutations

### `api.files.saveAttachment`
Save file attachment metadata after upload.

```typescript
export const saveAttachment = mutation({
  args: {
    lessonId: v.id("lessons"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Validation**:
- Max file size: 50MB
- Allowed types: pdf, doc, docx, xls, xlsx, ppt, pptx, jpg, jpeg, png, gif, zip
- Lesson must be of type "files"

---

### `api.files.removeAttachment`
Remove a file attachment.

```typescript
export const removeAttachment = mutation({
  args: {
    fileId: v.id("files"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Side Effects**: Deletes file from Convex storage

---

### `api.files.saveCoverImage`
Save course cover image.

```typescript
export const saveCoverImage = mutation({
  args: {
    courseId: v.id("courses"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Side Effects**: Deletes old cover image if exists

---

### `api.files.removeCoverImage`
Remove course cover image.

```typescript
export const removeCoverImage = mutation({
  args: {
    courseId: v.id("courses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Side Effects**: Deletes file from Convex storage

---

## Upload Flow

```typescript
// 1. Get upload URL
const uploadUrl = await generateUploadUrl();

// 2. Upload file directly to Convex storage
const response = await fetch(uploadUrl, {
  method: "POST",
  headers: { "Content-Type": file.type },
  body: file,
});
const { storageId } = await response.json();

// 3. Save metadata
await saveAttachment({
  lessonId,
  storageId,
  fileName: file.name,
  fileSize: file.size,
  fileType: file.type,
});
```

---

## React Component Example

```typescript
function FileUpload({ lessonId }: { lessonId: Id<"lessons"> }) {
  const generateUploadUrl = useMutation(api.files.getUploadUrl);
  const saveAttachment = useMutation(api.files.saveAttachment);

  const handleUpload = async (file: File) => {
    // Validate
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("File too large (max 50MB)");
    }

    // Upload
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await response.json();

    // Save metadata
    await saveAttachment({
      lessonId,
      storageId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
  };

  return <input type="file" onChange={e => handleUpload(e.target.files[0])} />;
}
```

---

## Validation Rules

### File Size
- Maximum: 50MB per file
- Convex storage hard limit

### Allowed File Types (for attachments)
- Documents: pdf, doc, docx
- Spreadsheets: xls, xlsx
- Presentations: ppt, pptx
- Images: jpg, jpeg, png, gif
- Archives: zip

### Image Files (for cover images)
- jpg, jpeg, png, gif, webp
- Recommended: 16:9 aspect ratio
- Max dimensions: 1920x1080

---

## Storage Cleanup

Files are automatically cleaned up when:
- Lesson is deleted (removes all attachments)
- Course is deleted (removes cover image)
- Attachment is explicitly removed
- Cover image is replaced

Convex garbage collects orphaned files automatically.
