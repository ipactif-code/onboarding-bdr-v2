import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireAdmin } from "../lib/auth";

// ============================================================================
// Types
// ============================================================================

const budgetStatusValidator = v.object({
  month: v.string(),
  totalMinutesUsed: v.number(),
  totalTranscriptionCount: v.number(),
  totalCostCents: v.number(),
  budgetCents: v.number(),
  percentUsed: v.number(),
  isDisabled: v.boolean(),
  alertSentAt80Percent: v.optional(v.number()),
  alertSentAt100Percent: v.optional(v.number()),
  topUsers: v.array(
    v.object({
      userId: v.id("users"),
      userName: v.string(),
      email: v.string(),
      dailyMinutesUsed: v.number(),
      dailyTranscriptionCount: v.number(),
    })
  ),
});

const budgetHistoryItemValidator = v.object({
  month: v.string(),
  totalMinutesUsed: v.number(),
  totalTranscriptionCount: v.number(),
  totalCostCents: v.number(),
  budgetCents: v.number(),
  percentUsed: v.number(),
  isDisabled: v.boolean(),
});

// ============================================================================
// Queries
// ============================================================================

/**
 * Get top users by transcription usage for today.
 * Returns up to 10 users sorted by minutes used descending.
 */
export const getTopUsersToday = query({
  args: {},
  returns: v.array(
    v.object({
      userId: v.id("users"),
      userName: v.string(),
      minutesUsed: v.number(),
      transcriptionCount: v.number(),
      lastTranscriptionAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

    // Query transcriptionUsage for today using the by_date index
    const usageRecords = await ctx.db
      .query("transcriptionUsage")
      .withIndex("by_date", (q) => q.eq("date", todayStr))
      .collect();

    // Sort by minutes used descending and take top 10
    const topRecords = usageRecords
      .sort((a, b) => b.dailyMinutesUsed - a.dailyMinutesUsed)
      .slice(0, 10);

    // Enrich with user names
    const result = await Promise.all(
      topRecords.map(async (record) => {
        const user = await ctx.db.get(record.userId);
        return {
          userId: record.userId,
          userName: user?.name ?? user?.email ?? "Unknown User",
          minutesUsed: record.dailyMinutesUsed,
          transcriptionCount: record.dailyTranscriptionCount,
          lastTranscriptionAt: record.updatedAt,
        };
      })
    );

    return result;
  },
});

/**
 * Get the current month's transcription budget status.
 * Includes total usage, cost, budget, percentage used, and top 10 users by usage.
 */
export const getBudgetStatus = query({
  args: {},
  returns: budgetStatusValidator,
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Get current month in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Get current month's budget record
    const budgetRecord = await ctx.db
      .query("transcriptionBudget")
      .withIndex("by_month", (q) => q.eq("month", currentMonth))
      .unique();

    // Default values if no budget record exists
    const totalMinutesUsed = budgetRecord?.totalMinutesUsed ?? 0;
    const totalTranscriptionCount = budgetRecord?.totalTranscriptionCount ?? 0;
    const totalCostCents = budgetRecord?.totalCostCents ?? 0;
    const budgetCents = budgetRecord?.budgetCents ?? 200000; // $2000 default
    const isDisabled = budgetRecord?.isDisabled ?? false;
    const alertSentAt80Percent = budgetRecord?.alertSentAt80Percent;
    const alertSentAt100Percent = budgetRecord?.alertSentAt100Percent;

    // Calculate percentage used
    const percentUsed =
      budgetCents > 0 ? Math.round((totalCostCents / budgetCents) * 100 * 10) / 10 : 0;

    // Get today's date in YYYY-MM-DD format
    const today = now.toISOString().split("T")[0] ?? "";

    // Get top 10 users by usage for today
    const todayUsage = await ctx.db
      .query("transcriptionUsage")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();

    // Sort by minutes used descending and take top 10
    const sortedUsage = todayUsage
      .sort((a, b) => b.dailyMinutesUsed - a.dailyMinutesUsed)
      .slice(0, 10);

    // Fetch user details for top users
    const topUsers = await Promise.all(
      sortedUsage.map(async (usage) => {
        const user = await ctx.db.get(usage.userId);
        return {
          userId: usage.userId,
          userName: user?.name ?? "Unknown User",
          email: user?.email ?? "unknown@example.com",
          dailyMinutesUsed: usage.dailyMinutesUsed,
          dailyTranscriptionCount: usage.dailyTranscriptionCount,
        };
      })
    );

    return {
      month: currentMonth,
      totalMinutesUsed,
      totalTranscriptionCount,
      totalCostCents,
      budgetCents,
      percentUsed,
      isDisabled,
      alertSentAt80Percent,
      alertSentAt100Percent,
      topUsers,
    };
  },
});

/**
 * Get the last 12 months of transcription budget history.
 * Useful for charts showing usage trends over time.
 */
export const getBudgetHistory = query({
  args: {},
  returns: v.array(budgetHistoryItemValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Generate last 12 months
    const now = new Date();
    const months: string[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months.push(month);
    }

    // Fetch all budget records (we'll filter in memory since there are only ~12)
    const allBudgets = await ctx.db.query("transcriptionBudget").collect();

    // Create a map for quick lookup
    const budgetMap = new Map<string, (typeof allBudgets)[0]>();
    for (const budget of allBudgets) {
      budgetMap.set(budget.month, budget);
    }

    // Build history array for each month
    const history = months.map((month) => {
      const budget = budgetMap.get(month);
      const totalMinutesUsed = budget?.totalMinutesUsed ?? 0;
      const totalTranscriptionCount = budget?.totalTranscriptionCount ?? 0;
      const totalCostCents = budget?.totalCostCents ?? 0;
      const budgetCents = budget?.budgetCents ?? 200000;
      const isDisabled = budget?.isDisabled ?? false;
      const percentUsed =
        budgetCents > 0
          ? Math.round((totalCostCents / budgetCents) * 100 * 10) / 10
          : 0;

      return {
        month,
        totalMinutesUsed,
        totalTranscriptionCount,
        totalCostCents,
        budgetCents,
        percentUsed,
        isDisabled,
      };
    });

    // Reverse to get chronological order (oldest first)
    return history.reverse();
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Set the budget limit for a specific month.
 * Creates a new budget record if one doesn't exist, or updates the existing one.
 */
export const setBudgetLimit = mutation({
  args: {
    month: v.string(), // "YYYY-MM" format
    budgetCents: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Validate month format
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRegex.test(args.month)) {
      throw new Error(
        "Invalid month format. Expected YYYY-MM (e.g., 2025-01)"
      );
    }

    // Maximum budget limit ($100,000 = 10,000,000 cents)
    const MAX_BUDGET_CENTS = 10_000_000;

    // Validate budget is positive
    if (args.budgetCents < 0) {
      throw new Error("Budget must be a positive number");
    }

    // Validate budget does not exceed maximum
    if (args.budgetCents > MAX_BUDGET_CENTS) {
      throw new Error("Budget cannot exceed $100,000");
    }

    // Check if budget record exists for this month
    const existingBudget = await ctx.db
      .query("transcriptionBudget")
      .withIndex("by_month", (q) => q.eq("month", args.month))
      .unique();

    const now = Date.now();

    if (existingBudget) {
      // Update existing record
      await ctx.db.patch(existingBudget._id, {
        budgetCents: args.budgetCents,
        updatedAt: now,
      });
    } else {
      // Create new record with default values
      await ctx.db.insert("transcriptionBudget", {
        month: args.month,
        totalMinutesUsed: 0,
        totalTranscriptionCount: 0,
        totalCostCents: 0,
        budgetCents: args.budgetCents,
        isDisabled: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Enable or disable the transcription service for the current month.
 * When disabled, checkTranscriptionBudget should reject all transcription requests.
 */
export const toggleTranscriptionService = mutation({
  args: {
    isDisabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Get current month in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const timestamp = Date.now();

    // Check if budget record exists for this month
    const existingBudget = await ctx.db
      .query("transcriptionBudget")
      .withIndex("by_month", (q) => q.eq("month", currentMonth))
      .unique();

    if (existingBudget) {
      // Update existing record
      await ctx.db.patch(existingBudget._id, {
        isDisabled: args.isDisabled,
        updatedAt: timestamp,
      });
    } else {
      // Create new record with default values
      await ctx.db.insert("transcriptionBudget", {
        month: currentMonth,
        totalMinutesUsed: 0,
        totalTranscriptionCount: 0,
        totalCostCents: 0,
        budgetCents: 200000, // $2000 default
        isDisabled: args.isDisabled,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return null;
  },
});
