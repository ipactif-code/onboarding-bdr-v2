"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { Webhook } from "svix";

// Type workaround: Use require() to avoid TS2589 deep type instantiation on 'internal'
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const { internal } = require("./_generated/api") as { internal: any };

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
}

export const verifyAndProcess = internalAction({
  args: {
    body: v.string(),
    svixId: v.string(),
    svixTimestamp: v.string(),
    svixSignature: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("Missing CLERK_WEBHOOK_SECRET environment variable");
      return { success: false, error: "Server configuration error" };
    }

    // Verify the webhook signature
    const wh = new Webhook(webhookSecret);
    let payload: ClerkWebhookEvent;

    try {
      payload = wh.verify(args.body, {
        "svix-id": args.svixId,
        "svix-timestamp": args.svixTimestamp,
        "svix-signature": args.svixSignature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      console.error("Error verifying webhook:", err);
      return { success: false, error: "Invalid signature" };
    }

    // Handle the webhook event
    switch (payload.type) {
      case "user.created":
      case "user.updated": {
        const email = payload.data.email_addresses?.[0]?.email_address;
        if (!email) {
          console.error("No email address in webhook payload");
          return { success: false, error: "Invalid payload: missing email" };
        }

        const firstName = payload.data.first_name ?? "";
        const lastName = payload.data.last_name ?? "";
        const name =
          `${firstName} ${lastName}`.trim() ||
          (email.split("@")[0] ?? "User");

        await ctx.runMutation(internal.users.syncFromClerk, {
          clerkId: payload.data.id,
          email,
          name,
          avatarUrl: payload.data.image_url,
        });
        break;
      }

      case "user.deleted": {
        await ctx.runMutation(internal.users.removeByClerkId, {
          clerkId: payload.data.id,
        });
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }

    return { success: true };
  },
});
