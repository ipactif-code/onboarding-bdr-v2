import type { FileRouter } from 'uploadthing/next';

import { auth } from '@clerk/nextjs/server';
import { createUploadthing } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';

const f = createUploadthing();

export const ourFileRouter = {
  editorUploader: f(['image', 'text', 'blob', 'pdf', 'video', 'audio'])
    .middleware(async () => {
      // Authenticate with Clerk
      const { userId } = await auth();

      // Block unauthenticated uploads
      if (!userId) {
        throw new UploadThingError('Unauthorized: You must be logged in to upload files');
      }

      // Return userId as metadata (accessible in onUploadComplete)
      return { userId };
    })
    .onUploadComplete(({ file, metadata }) => {
      console.log('[UploadThing] Upload complete:', {
        fileName: file.name,
        fileUrl: file.ufsUrl,
        uploadedBy: metadata.userId,
      });

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
