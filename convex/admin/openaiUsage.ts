"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { requireAdminInAction } from "../lib/auth";

/**
 * OpenAI cost bucket from the API response.
 * Note: The OpenAI API returns cost values as strings, not numbers.
 */
type OpenAICostBucket = {
  start_time: number;
  end_time: number;
  results?: Array<{
    amount?: {
      value?: string; // OpenAI API returns cost as string (e.g., "0.003200...")
      currency?: string;
    };
  }>;
};

/**
 * OpenAI costs API response structure.
 */
type OpenAICostsResponse = {
  object: string;
  data: OpenAICostBucket[];
  has_more: boolean;
  next_page?: string;
};

/**
 * Daily cost bucket validator for Convex returns.
 */
const dailyCostBucketValidator = v.object({
  date: v.string(),
  cost: v.number(),
});

/**
 * OpenAI usage result validator for Convex returns.
 */
const openaiUsageResultValidator = v.object({
  totalCost: v.number(),
  buckets: v.array(dailyCostBucketValidator),
  startTime: v.number(),
  endTime: v.number(),
  rawBucketCount: v.number(),
});

/**
 * Fetch actual OpenAI usage costs from the OpenAI Admin API.
 *
 * This action:
 * 1. Validates the user is authenticated and has admin role
 * 2. Requires OPENAI_ADMIN_KEY environment variable
 * 3. Fetches costs from the OpenAI organization costs API
 * 4. Returns daily cost buckets and total cost
 *
 * @see https://platform.openai.com/docs/api-reference/usage
 */
export const fetchOpenAICosts = action({
  args: {
    startTime: v.optional(v.number()), // Unix timestamp (seconds), defaults to 30 days ago
    endTime: v.optional(v.number()), // Unix timestamp (seconds), defaults to now
  },
  returns: openaiUsageResultValidator,
  handler: async (ctx, args) => {
    // Step 1: Verify admin access
    await requireAdminInAction(ctx);

    // Step 2: Check for API key
    const adminKey = process.env.OPENAI_ADMIN_KEY;
    if (!adminKey) {
      throw new Error("Configuration error: OPENAI_ADMIN_KEY not configured");
    }

    // Step 3: Calculate date range (default: last 30 days)
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const startTimestamp = args.startTime ?? thirtyDaysAgo;
    const endTimestamp = args.endTime ?? now;

    // Step 4: Build API request URL
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", startTimestamp.toString());
    url.searchParams.set("end_time", endTimestamp.toString());
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");

    // Step 5: Fetch from OpenAI API
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[openaiUsage] OpenAI API error:", response.status, errorText);
      throw new Error(
        `OpenAI API error: ${response.status} - ${errorText.slice(0, 200)}`
      );
    }

    // Step 6: Parse response
    const data: OpenAICostsResponse = await response.json();

    // Step 7: Transform response into our format
    // Sum ALL results in each bucket (not just the first one)
    // Note: OpenAI API returns cost values as strings, so we must parseFloat
    let totalCost = 0;
    const buckets = (data.data || []).map((bucket: OpenAICostBucket) => {
      // Sum all result amounts in this bucket (parsing string values to numbers)
      let bucketCost = 0;
      for (const result of bucket.results || []) {
        bucketCost += parseFloat(result.amount?.value ?? "0") || 0;
      }
      totalCost += bucketCost;

      // Convert Unix timestamp (seconds) to ISO date string (YYYY-MM-DD)
      const date =
        new Date(bucket.start_time * 1000).toISOString().split("T")[0] ?? "";

      return {
        date,
        cost: bucketCost,
      };
    });

    return {
      totalCost,
      buckets,
      startTime: startTimestamp,
      endTime: endTimestamp,
      rawBucketCount: data.data?.length ?? 0,
    };
  },
});
