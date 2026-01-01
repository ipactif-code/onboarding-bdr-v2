import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

// Type workaround: Use require() to avoid TS2589 deep type instantiation on 'internal'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { internal } = require("./_generated/api") as { internal: any };

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Get the headers
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    // Get the body
    const body = await request.text();

    // Call the Node.js action to verify and process the webhook
    const result = await ctx.runAction(internal.clerkWebhook.verifyAndProcess, {
      body,
      svixId,
      svixTimestamp,
      svixSignature,
    });

    if (!result.success) {
      const status = result.error === "Invalid signature" ? 400 : 500;
      return new Response(result.error ?? "Error processing webhook", {
        status,
      });
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
