import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "@/lib/uploadthing";

// Export routes for Next App Router
// This creates the /api/uploadthing endpoint
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
