import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";

// ============================================================================
// Constants
// ============================================================================

/** Maximum file size: 50MB in bytes */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Blocked file extensions (executable files) */
const BLOCKED_EXTENSIONS = [
  ".exe",
  ".dll",
  ".sh",
  ".bat",
  ".cmd",
  ".msi",
  ".scr",
  ".pif",
];

/** Blocked MIME types (executable files) */
const BLOCKED_MIME_TYPES = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-sh",
  "application/x-bat",
  "application/x-executable",
  "application/x-dosexec",
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate file size is within the 50MB limit.
 * @throws Error if file size exceeds limit
 */
function validateFileSize(fileSize: number): void {
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed size of 50MB. Received: ${Math.round(fileSize / (1024 * 1024))}MB`
    );
  }
  if (fileSize <= 0) {
    throw new Error("File size must be greater than 0");
  }
}

/**
 * Check if a file type/name is blocked (executable).
 * @throws Error if file type is blocked
 */
function validateFileType(fileName: string, mimeType: string): void {
  // Check extension
  const lowerFileName = fileName.toLowerCase();
  for (const ext of BLOCKED_EXTENSIONS) {
    if (lowerFileName.endsWith(ext)) {
      throw new Error(
        `File type not allowed: ${ext} files are blocked for security reasons`
      );
    }
  }

  // Check MIME type
  const lowerMimeType = mimeType.toLowerCase();
  if (BLOCKED_MIME_TYPES.includes(lowerMimeType)) {
    throw new Error(
      `File type not allowed: ${mimeType} is blocked for security reasons`
    );
  }
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Generate a pre-signed URL for uploading a file to Convex storage.
 *
 * T159: Validates file size and MIME type before generating URL.
 * The actual upload happens client-side using the returned URL.
 *
 * @param fileSize - The size of the file in bytes (must be <= 50MB)
 * @param fileName - The name of the file (used for extension validation)
 * @param mimeType - The MIME type of the file (blocked types rejected)
 * @returns The pre-signed upload URL
 */
export const generateUploadUrl = mutation({
  args: {
    fileSize: v.number(),
    fileName: v.string(),
    mimeType: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Validate file size (50MB limit)
    validateFileSize(args.fileSize);

    // Validate file type (block executables)
    validateFileType(args.fileName, args.mimeType);

    // Generate and return the upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create an attachment record after a file has been uploaded.
 *
 * T159b: Saves attachment metadata to the database.
 * The messageId is undefined initially and will be set when the message is sent.
 *
 * @param storageId - The Convex storage ID from the upload response
 * @param fileName - Original file name
 * @param fileSize - File size in bytes
 * @param fileType - MIME type of the file
 * @returns The ID of the created attachment record
 */
export const createAttachment = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
  },
  returns: v.id("messageAttachments"),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Re-validate file size (defense in depth)
    validateFileSize(args.fileSize);

    // Re-validate file type (defense in depth)
    validateFileType(args.fileName, args.fileType);

    // Create the attachment record without a messageId
    // The messageId will be set when the attachment is linked to a message
    const attachmentId = await ctx.db.insert("messageAttachments", {
      storageId: args.storageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
      uploadedAt: Date.now(),
    });

    return attachmentId;
  },
});

/**
 * Create attachment records from UploadThing upload results.
 *
 * Called when a message is sent with attachments that were uploaded via UploadThing.
 * Stores the UploadThing URL directly in downloadUrl field (no storageId).
 *
 * @param messageId - The message to attach files to
 * @param attachments - Array of attachment data from UploadThing
 * @returns Array of created attachment IDs
 */
export const createFromUploadThing = mutation({
  args: {
    messageId: v.id("messages"),
    attachments: v.array(
      v.object({
        url: v.string(),
        name: v.string(),
        size: v.number(),
        type: v.string(),
      })
    ),
  },
  returns: v.array(v.id("messageAttachments")),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify message exists
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user is the sender of the message
    if (message.senderId !== user._id) {
      throw new Error("Only the message sender can attach files");
    }

    const attachmentIds: Id<"messageAttachments">[] = [];

    for (const attachment of args.attachments) {
      // Re-validate file size (defense in depth)
      validateFileSize(attachment.size);

      // Re-validate file type (defense in depth)
      validateFileType(attachment.name, attachment.type);

      const id = await ctx.db.insert("messageAttachments", {
        messageId: args.messageId,
        downloadUrl: attachment.url, // Store UploadThing URL directly
        fileName: attachment.name,
        fileSize: attachment.size,
        fileType: attachment.type,
        uploadedAt: Date.now(),
        // storageId is NOT set - we're using external URL from UploadThing
      });
      attachmentIds.push(id);
    }

    return attachmentIds;
  },
});

/**
 * Link attachments to a message after it has been created.
 *
 * Internal helper mutation to update attachment records with the messageId.
 *
 * @param messageId - The message to link attachments to
 * @param attachmentIds - Array of attachment IDs to link
 */
export const linkAttachmentsToMessage = mutation({
  args: {
    messageId: v.id("messages"),
    attachmentIds: v.array(v.id("messageAttachments")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Verify message exists
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Link each attachment to the message
    for (const attachmentId of args.attachmentIds) {
      const attachment = await ctx.db.get(attachmentId);
      if (!attachment) {
        throw new Error(`Attachment not found: ${attachmentId}`);
      }

      // Only link attachments that aren't already linked to a message
      // This prevents stealing attachments from other messages
      if (attachment.messageId) {
        throw new Error(
          `Attachment ${attachmentId} is already linked to a message`
        );
      }

      await ctx.db.patch(attachmentId, {
        messageId: args.messageId,
      });
    }

    return null;
  },
});

// ============================================================================
// Queries
// ============================================================================

/**
 * Get a single attachment with its download URL.
 *
 * T160: Fetches attachment record and resolves storageId to download URL.
 *
 * @param attachmentId - The ID of the attachment to fetch
 * @returns The attachment with downloadUrl, or null if not found
 */
export const getAttachment = query({
  args: {
    attachmentId: v.id("messageAttachments"),
  },
  returns: v.union(
    v.object({
      _id: v.id("messageAttachments"),
      messageId: v.optional(v.id("messages")),
      fileName: v.string(),
      fileSize: v.number(),
      fileType: v.string(),
      thumbnailUrl: v.optional(v.string()),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
      uploadedAt: v.number(),
      downloadUrl: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      return null;
    }

    // Resolve storageId to download URL
    let downloadUrl: string | null = null;
    if (attachment.storageId) {
      downloadUrl = await ctx.storage.getUrl(attachment.storageId);
    } else if (attachment.downloadUrl) {
      // Use stored downloadUrl (e.g., from UploadThing)
      downloadUrl = attachment.downloadUrl;
    }

    return {
      _id: attachment._id,
      messageId: attachment.messageId,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      fileType: attachment.fileType,
      thumbnailUrl: attachment.thumbnailUrl,
      width: attachment.width,
      height: attachment.height,
      uploadedAt: attachment.uploadedAt,
      downloadUrl,
    };
  },
});

/**
 * Get all attachments for a specific message with download URLs.
 *
 * T163: Queries messageAttachments by message index and resolves URLs.
 *
 * @param messageId - The message to get attachments for
 * @returns Array of attachments with download URLs
 */
export const getMessageAttachments = query({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.array(
    v.object({
      _id: v.id("messageAttachments"),
      fileName: v.string(),
      fileSize: v.number(),
      fileType: v.string(),
      thumbnailUrl: v.optional(v.string()),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
      uploadedAt: v.number(),
      downloadUrl: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Query attachments by message using the by_message index
    const attachments = await ctx.db
      .query("messageAttachments")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    // Resolve download URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        let downloadUrl: string | null = null;
        if (attachment.storageId) {
          downloadUrl = await ctx.storage.getUrl(attachment.storageId);
        } else if (attachment.downloadUrl) {
          downloadUrl = attachment.downloadUrl;
        }

        return {
          _id: attachment._id,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          fileType: attachment.fileType,
          thumbnailUrl: attachment.thumbnailUrl,
          width: attachment.width,
          height: attachment.height,
          uploadedAt: attachment.uploadedAt,
          downloadUrl,
        };
      })
    );

    return attachmentsWithUrls;
  },
});
