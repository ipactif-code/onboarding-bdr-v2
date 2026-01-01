import type { FileRouter } from 'uploadthing/next';

import { currentUser } from '@clerk/nextjs/server';
import { createUploadthing } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';

const f = createUploadthing();

export const ourFileRouter = {
  /**
   * Editor uploader for Plate.js rich text editor.
   * Accepts common file types for embedding in documents.
   */
  editorUploader: f(['image', 'text', 'blob', 'pdf', 'video', 'audio'])
    .middleware(async () => {
      // Authenticate with Clerk
      const user = await currentUser();

      // Block unauthenticated uploads
      if (!user) {
        throw new UploadThingError('Unauthorized: You must be logged in to upload files');
      }

      // Return userId as metadata (accessible in onUploadComplete)
      return { userId: user.id };
    })
    .onUploadComplete(({ file }) => {
      return {
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
        url: file.ufsUrl,
      };
    }),

  /**
   * Message attachment uploader for direct messaging.
   * Accepts images, videos, audio, PDFs, and other files up to 32MB each.
   * Supports batch uploads with up to 10 files per upload.
   */
  messageAttachment: f({
    image: { maxFileSize: '32MB', maxFileCount: 10 },
    video: { maxFileSize: '32MB', maxFileCount: 10 },
    audio: { maxFileSize: '32MB', maxFileCount: 10 },
    pdf: { maxFileSize: '32MB', maxFileCount: 10 },
    blob: { maxFileSize: '32MB', maxFileCount: 10 },
  })
    .middleware(async () => {
      // Authenticate with Clerk
      const user = await currentUser();

      // Block unauthenticated uploads
      if (!user) {
        throw new UploadThingError('Unauthorized: You must be logged in to upload files');
      }

      // Return userId as metadata (accessible in onUploadComplete)
      return { userId: user.id };
    })
    .onUploadComplete(({ file }) => {
      return {
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
        url: file.ufsUrl,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
